"""
Whitepaper generation service - integrates with external redaccion system
"""
import os
import asyncio
import httpx
import logging
from datetime import datetime, timezone
from bson import ObjectId

logger = logging.getLogger(__name__)

REDACCION_URL = os.environ.get("REDACCION_API_URL", "").rstrip("/")
REDACCION_EMAIL = os.environ.get("REDACCION_EMAIL", "")
REDACCION_PASSWORD = os.environ.get("REDACCION_PASSWORD", "")

_cached_token = {"token": None, "expires": 0}


async def _get_redaccion_token():
    """Login to redaccion system, cache token"""
    now = datetime.now(timezone.utc).timestamp()
    if _cached_token["token"] and _cached_token["expires"] > now:
        return _cached_token["token"]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{REDACCION_URL}/api/auth/login", json={
            "email": REDACCION_EMAIL,
            "password": REDACCION_PASSWORD,
        })
        resp.raise_for_status()
        data = resp.json()
        token = data["access_token"]
        _cached_token["token"] = token
        _cached_token["expires"] = now + 82800  # 23 hours
        return token


async def _search_client(token: str, email: str):
    """Search for client by email in redaccion system"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/clients/search",
            params={"q": email},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        clients = data.get("clients", [])
        for c in clients:
            if c.get("email", "").lower() == email.lower():
                return c["id"]
        return None


async def _create_client(token: str, name: str, email: str, phone: str = ""):
    """Create client in redaccion system"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{REDACCION_URL}/api/clients",
            json={"name": name, "email": email, "phone": phone},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["client_id"]


async def _upload_and_extract(token: str, endpoint: str, file_url: str, file_name: str):
    """Download a file from URL and upload it to the extraction endpoint"""
    async with httpx.AsyncClient(timeout=120) as client:
        # Download file
        file_resp = await client.get(file_url, follow_redirects=True)
        file_resp.raise_for_status()
        file_bytes = file_resp.content

        # Detect MIME type from filename
        mime_type = "application/octet-stream"
        lower_name = file_name.lower()
        if lower_name.endswith(".pdf"):
            mime_type = "application/pdf"
        elif lower_name.endswith(".docx"):
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif lower_name.endswith(".doc"):
            mime_type = "application/msword"
        elif lower_name.endswith(".txt"):
            mime_type = "text/plain"
        else:
            # Try from response content-type header
            ct = file_resp.headers.get("content-type", "")
            if "pdf" in ct:
                mime_type = "application/pdf"
                if not lower_name.endswith(".pdf"):
                    file_name = file_name + ".pdf"
            elif "word" in ct or "docx" in ct:
                mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif ct and ct != "application/octet-stream":
                mime_type = ct
            else:
                # Check magic bytes
                if file_bytes[:4] == b'%PDF':
                    mime_type = "application/pdf"
                    if not lower_name.endswith(".pdf"):
                        file_name = file_name + ".pdf"

        # Upload to extraction endpoint
        files = {"file": (file_name, file_bytes, mime_type)}
        resp = await client.post(
            f"{REDACCION_URL}{endpoint}",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        task_id = data.get("task_id")
        if not task_id:
            return data.get("result", {})

        # Poll for completion
        for _ in range(120):  # max ~6 minutes
            await asyncio.sleep(3)
            status_resp = await client.get(
                f"{REDACCION_URL}/api/whitepapers/extraction-status/{task_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            status_resp.raise_for_status()
            status_data = status_resp.json()
            if status_data.get("status") == "completed":
                return status_data.get("result", {})
            if status_data.get("status") == "error":
                raise Exception(f"Extraction failed: {status_data.get('error', 'Unknown')}")

        raise Exception("Extraction timed out")


async def _create_whitepaper(token: str, payload: dict):
    """Create whitepaper via start-interactive"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{REDACCION_URL}/api/whitepapers/start-interactive",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def _start_generation(token: str, whitepaper_id: str):
    """Start background generation"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{REDACCION_URL}/api/whitepapers/{whitepaper_id}/generate-complete",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_whitepaper_status(token: str, whitepaper_id: str):
    """Get whitepaper generation status"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/whitepapers/{whitepaper_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def run_whitepaper_generation(db, case_id: str, job_id: str):
    """Background task: orchestrate the full whitepaper generation flow"""
    job_col = db.whitepaper_jobs

    async def update_status(status, step="", error="", **extra):
        update = {"status": status, "currentStep": step, "updatedAt": datetime.now(timezone.utc).isoformat()}
        if error:
            update["error"] = error
        update.update(extra)
        await job_col.update_one({"_id": job_id}, {"$set": update})

    try:
        await update_status("processing", "Autenticando con sistema de redaccion...")

        # Get visa case
        visa_case = await db.visa_cases.find_one({"_id": case_id})
        if not visa_case:
            await update_status("error", error="Caso de visa no encontrado")
            return

        user_id = visa_case.get("userId", "")

        # Get user info
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})

        if not user or not user.get("email"):
            await update_status("error", error="No se encontro el email del cliente")
            return

        client_email = user["email"]
        client_name = user.get("name", client_email)
        client_phone = user.get("phone", "")

        # Step 1: Auth
        token = await _get_redaccion_token()
        await update_status("processing", "Buscando cliente en sistema de redaccion...")

        # Step 2: Search/Create client
        client_uuid = await _search_client(token, client_email)
        if not client_uuid:
            await update_status("processing", "Creando cliente en sistema de redaccion...")
            client_uuid = await _create_client(token, client_name, client_email, client_phone)

        await update_status("processing", "Cliente encontrado/creado", externalClientId=client_uuid)

        # Step 3: Get CV
        cv_data = {}
        cv = await db.user_cvs.find_one(
            {"userId": user_id, "fileType": {"$in": ["cv", None]}},
            {"_id": 0, "url": 1, "fileName": 1}
        )
        if not cv:
            cv = await db.user_cvs.find_one(
                {"userId": user_id},
                {"_id": 0, "url": 1, "fileName": 1}
            )

        if cv and cv.get("url"):
            await update_status("processing", "Extrayendo datos del CV...")
            try:
                cv_data = await _upload_and_extract(
                    token, "/api/whitepapers/extract-cv-info",
                    cv["url"], cv.get("fileName", "cv.pdf")
                )
            except Exception as e:
                logger.warning(f"CV extraction failed: {e}")

        # Step 4: Get Business Plan (Stage 3 deliverable)
        project_data = {}
        bp_deliverable = await db.visa_deliverables.find_one(
            {"caseId": case_id, "stageNumber": 3},
            {"_id": 0, "files": 1, "fileUrl": 1, "fileName": 1}
        )
        bp_url = None
        bp_name = "business_plan.pdf"
        if bp_deliverable:
            files = bp_deliverable.get("files", [])
            if files:
                bp_url = files[0].get("fileUrl")
                bp_name = files[0].get("fileName", bp_name)
            elif bp_deliverable.get("fileUrl"):
                bp_url = bp_deliverable["fileUrl"]
                bp_name = bp_deliverable.get("fileName", bp_name)

        if bp_url:
            await update_status("processing", "Extrayendo datos del Business Plan...")
            try:
                project_data = await _upload_and_extract(
                    token, "/api/whitepapers/extract-project-info",
                    bp_url, bp_name
                )
            except Exception as e:
                logger.warning(f"Project extraction failed: {e}")

        # Step 5: Create whitepaper
        await update_status("processing", "Creando White Paper...")
        wp_payload = {
            "project_title": project_data.get("project_title", f"Proyecto de {client_name}"),
            "author_name": cv_data.get("author_name", client_name),
            "author_credentials": cv_data.get("author_credentials", "Professional"),
            "project_description": project_data.get("project_description", "Proyecto de interes nacional"),
            "target_audience": project_data.get("target_audience", "USCIS Adjudicators"),
            "technical_domain": cv_data.get("technical_domain", "Professional Services"),
            "language": "es",
            "client_id": client_uuid,
        }
        if cv_data.get("full_cv_data"):
            wp_payload["full_cv_data"] = cv_data["full_cv_data"]
        if cv_data.get("employment_summary"):
            wp_payload["employment_summary"] = cv_data["employment_summary"]
        if cv_data.get("years_of_experience"):
            wp_payload["years_of_experience"] = cv_data["years_of_experience"]

        wp_result = await _create_whitepaper(token, wp_payload)
        whitepaper_id = wp_result.get("whitepaper_id")
        if not whitepaper_id:
            await update_status("error", error="No se obtuvo whitepaper_id")
            return

        await update_status("processing", "Iniciando generacion...", externalWhitepaperId=whitepaper_id)

        # Step 6: Start generation
        await _start_generation(token, whitepaper_id)
        await update_status("generating", "Generando White Paper (esto puede tomar 5-10 minutos)...",
                          externalWhitepaperId=whitepaper_id)

    except Exception as e:
        logger.error(f"Whitepaper generation error for case {case_id}: {e}")
        await update_status("error", error=str(e))


# ── Policy Paper Generation ──────────────────────────────────────────

async def get_policy_paper_status(token: str, paper_id: str):
    """Get policy paper generation status"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/policy-papers/{paper_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def run_policy_paper_generation(db, case_id: str, job_id: str):
    """Background task: orchestrate policy paper generation"""
    job_col = db.policy_paper_jobs

    async def update_status(status, step="", error="", **extra):
        update = {"status": status, "currentStep": step, "updatedAt": datetime.now(timezone.utc).isoformat()}
        if error:
            update["error"] = error
        update.update(extra)
        await job_col.update_one({"_id": job_id}, {"$set": update})

    try:
        await update_status("processing", "Autenticando con sistema de redaccion...")

        visa_case = await db.visa_cases.find_one({"_id": case_id})
        if not visa_case:
            await update_status("error", error="Caso de visa no encontrado")
            return

        user_id = visa_case.get("userId", "")
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})

        if not user or not user.get("email"):
            await update_status("error", error="No se encontro el email del cliente")
            return

        client_email = user["email"]
        client_name = user.get("name", client_email)
        client_phone = user.get("phone", "")

        # Auth
        token = await _get_redaccion_token()
        await update_status("processing", "Buscando cliente en sistema de redaccion...")

        # Search/Create client
        client_uuid = await _search_client(token, client_email)
        if not client_uuid:
            await update_status("processing", "Creando cliente en sistema de redaccion...")
            client_uuid = await _create_client(token, client_name, client_email, client_phone)

        await update_status("processing", "Cliente listo. Buscando documento del proyecto...", externalClientId=client_uuid)

        # Get Business Plan file (Stage 3 deliverable)
        bp_deliverable = await db.visa_deliverables.find_one(
            {"caseId": case_id, "stageNumber": 3},
            {"_id": 0, "files": 1, "fileUrl": 1, "fileName": 1}
        )
        bp_url = None
        bp_name = "business_plan.pdf"
        if bp_deliverable:
            files = bp_deliverable.get("files", [])
            if files:
                bp_url = files[0].get("fileUrl")
                bp_name = files[0].get("fileName", bp_name)
            elif bp_deliverable.get("fileUrl"):
                bp_url = bp_deliverable["fileUrl"]
                bp_name = bp_deliverable.get("fileName", bp_name)

        if not bp_url:
            await update_status("error", error="No se encontro el Business Plan (Stage 3). Debe estar subido antes de generar el Policy Paper.")
            return

        await update_status("processing", "Descargando documento del proyecto...")

        # Download file
        async with httpx.AsyncClient(timeout=120) as client:
            file_resp = await client.get(bp_url, follow_redirects=True)
            file_resp.raise_for_status()
            file_bytes = file_resp.content

            await update_status("processing", "Enviando a sistema de redaccion para generar Policy Paper...")

            # POST to generate
            files = {"file": (bp_name, file_bytes, "application/octet-stream")}
            form_data = {"client_id": client_uuid}
            resp = await client.post(
                f"{REDACCION_URL}/api/policy-papers/generate",
                files=files,
                data=form_data,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            paper_id = data.get("paper_id")

            if not paper_id:
                await update_status("error", error="No se obtuvo paper_id del sistema de redaccion")
                return

            await update_status("generating", "Generando Policy Paper (5-10 minutos)...",
                              externalPaperId=paper_id, externalClientId=client_uuid)

    except Exception as e:
        logger.error(f"Policy paper generation error for case {case_id}: {e}")
        await update_status("error", error=str(e))


# ── Book Generation ──────────────────────────────────────────────────

async def get_book_status(token: str, book_id: str):
    """Get book generation status"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/books/in-progress/{book_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def run_book_generation(db, case_id: str, job_id: str):
    """Background task: orchestrate book generation"""
    job_col = db.book_jobs

    async def update_status(status, step="", error="", **extra):
        update = {"status": status, "currentStep": step, "updatedAt": datetime.now(timezone.utc).isoformat()}
        if error:
            update["error"] = error
        update.update(extra)
        await job_col.update_one({"_id": job_id}, {"$set": update})

    try:
        await update_status("processing", "Autenticando con sistema de redaccion...")

        visa_case = await db.visa_cases.find_one({"_id": case_id})
        if not visa_case:
            await update_status("error", error="Caso de visa no encontrado")
            return

        user_id = visa_case.get("userId", "")
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})

        if not user or not user.get("email"):
            await update_status("error", error="No se encontro el email del cliente")
            return

        client_email = user["email"]
        client_name = user.get("name", client_email)
        client_phone = user.get("phone", "")

        # Auth
        token = await _get_redaccion_token()
        await update_status("processing", "Buscando cliente en sistema de redaccion...")

        # Search/Create client
        client_uuid = await _search_client(token, client_email)
        if not client_uuid:
            await update_status("processing", "Creando cliente en sistema de redaccion...")
            client_uuid = await _create_client(token, client_name, client_email, client_phone)

        await update_status("processing", "Cliente listo. Obteniendo datos del proyecto...", externalClientId=client_uuid)

        # Get Business Plan text (Stage 3) for synopsis
        bp_text = ""
        bp_deliverable = await db.visa_deliverables.find_one(
            {"caseId": case_id, "stageNumber": 3},
            {"_id": 0, "files": 1, "fileUrl": 1, "fileName": 1}
        )
        bp_url = None
        bp_name = "business_plan.pdf"
        if bp_deliverable:
            files = bp_deliverable.get("files", [])
            if files:
                bp_url = files[0].get("fileUrl")
                bp_name = files[0].get("fileName", bp_name)
            elif bp_deliverable.get("fileUrl"):
                bp_url = bp_deliverable["fileUrl"]
                bp_name = bp_deliverable.get("fileName", bp_name)

        if bp_url:
            await update_status("processing", "Extrayendo texto del Business Plan...")
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    file_resp = await client.get(bp_url, follow_redirects=True)
                    file_resp.raise_for_status()
                    upload_files = {"file": (bp_name, file_resp.content, "application/octet-stream")}
                    resp = await client.post(
                        f"{REDACCION_URL}/api/econometric-studies/upload-document",
                        files=upload_files,
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if resp.status_code == 200:
                        bp_text = resp.json().get("extracted_text", "")
            except Exception as e:
                logger.warning(f"BP text extraction for book failed: {e}")

        # Get CV text for profile_summary
        profile_summary = ""
        cv = await db.user_cvs.find_one(
            {"userId": user_id, "fileType": {"$in": ["cv", None]}},
            {"_id": 0, "url": 1, "fileName": 1}
        )
        if not cv:
            cv = await db.user_cvs.find_one({"userId": user_id}, {"_id": 0, "url": 1, "fileName": 1})

        if cv and cv.get("url"):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    cv_resp = await client.get(cv["url"], follow_redirects=True)
                    cv_resp.raise_for_status()
                    cv_files = {"file": (cv.get("fileName", "cv.pdf"), cv_resp.content, "application/octet-stream")}
                    cv_extract = await client.post(
                        f"{REDACCION_URL}/api/econometric-studies/upload-document",
                        files=cv_files,
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if cv_extract.status_code == 200:
                        profile_summary = cv_extract.json().get("extracted_text", "")
            except Exception as e:
                logger.warning(f"CV extraction for book failed: {e}")

        # Step 1: Check book_preparations for client-selected idea & title
        await update_status("processing", "Verificando preparacion del libro...")
        prep = await db.book_preparations.find_one({"caseId": case_id}, {"_id": 0})

        if prep and prep.get("step") == "ready" and prep.get("selectedIdea") and prep.get("selectedTitle"):
            book_title = prep["selectedTitle"]
            book_synopsis = prep["selectedIdea"]
            profile_summary = prep.get("profileSummary", profile_summary or "")
            bp_text = prep.get("projectDescription", bp_text or "")
            client_uuid = prep.get("externalClientId", client_uuid)
            logger.info(f"Using client-prepared book: title='{book_title}', idea length={len(book_synopsis)}")
        else:
            book_title = f"Proyecto de Interes Nacional - {client_name}"
            book_synopsis = bp_text or f"Proyecto de interes nacional de {client_name}"

        # Create the book
        await update_status("processing", "Creando Libro Tecnico...")
        book_payload = {
            "title": book_title,
            "genre": "Academic / Technical",
            "synopsis": book_synopsis,
            "client_id": client_uuid,
            "num_chapters": 10,
            "writing_style": "academic",
            "language": "es",
            "author_name": client_name,
        }
        if profile_summary:
            book_payload["profile_summary"] = profile_summary
        if bp_text:
            book_payload["project_description"] = bp_text

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{REDACCION_URL}/api/books/start-interactive",
                json=book_payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            book_data = resp.json()
            book_id = book_data.get("id")

        if not book_id:
            await update_status("error", error="No se obtuvo book_id")
            return

        # Step 2: Start generation
        await update_status("processing", "Iniciando generacion del libro...", externalBookId=book_id)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{REDACCION_URL}/api/books/{book_id}/generate-fast",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()

        await update_status("generating", "Generando Libro Tecnico (5-15 minutos)...",
                          externalBookId=book_id, externalClientId=client_uuid)

    except Exception as e:
        logger.error(f"Book generation error for case {case_id}: {e}")
        await update_status("error", error=str(e))


# ── Book Idea & Title Suggestion helpers ─────────────────────────────

async def suggest_book_ideas(token: str, author_name: str, profile_summary: str,
                              project_description: str = "", language: str = "es"):
    """Call redaccion API to get 3 book ideas"""
    payload = {
        "author_name": author_name,
        "profile_summary": profile_summary,
        "language": language,
    }
    if project_description:
        payload["project_description"] = project_description

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{REDACCION_URL}/api/books/suggest-ideas",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def suggest_book_titles(token: str, selected_idea: str, profile_summary: str,
                               language: str = "es", is_custom_idea: bool = False):
    """Call redaccion API to get 3 title suggestions"""
    payload = {
        "selected_idea": selected_idea,
        "profile_summary": profile_summary,
        "language": language,
        "is_custom_idea": is_custom_idea,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{REDACCION_URL}/api/books/suggest-titles",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def extract_text_from_file(token: str, file_url: str, file_name: str):
    """Download file and extract text — tries extract-cv-info first, then upload-document"""
    # Try extract-cv-info (works reliably for CVs)
    try:
        result = await _upload_and_extract(token, "/api/whitepapers/extract-cv-info", file_url, file_name)
        if result and isinstance(result, dict):
            # Convert structured CV data to text summary
            parts = []
            if result.get("name"):
                parts.append(f"Name: {result['name']}")
            if result.get("summary") or result.get("profile_summary"):
                parts.append(result.get("summary") or result.get("profile_summary"))
            if result.get("experience"):
                exp = result["experience"]
                if isinstance(exp, list):
                    parts.append("Experience: " + "; ".join(str(e) for e in exp))
                else:
                    parts.append(f"Experience: {exp}")
            if result.get("education"):
                edu = result["education"]
                if isinstance(edu, list):
                    parts.append("Education: " + "; ".join(str(e) for e in edu))
                else:
                    parts.append(f"Education: {edu}")
            if result.get("skills"):
                skills = result["skills"]
                if isinstance(skills, list):
                    parts.append("Skills: " + ", ".join(str(s) for s in skills))
                else:
                    parts.append(f"Skills: {skills}")
            if result.get("publications"):
                parts.append(f"Publications: {result['publications']}")
            # If we got any structured data, return it
            text = "\n".join(parts)
            if text.strip():
                return text
            # If result is not structured but has raw text fields
            raw = " ".join(str(v) for v in result.values() if v and isinstance(v, str))
            if raw.strip():
                return raw
    except Exception as e:
        logger.warning(f"extract-cv-info failed, trying upload-document: {e}")

    # Fallback: try upload-document
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            file_resp = await client.get(file_url, follow_redirects=True)
            file_resp.raise_for_status()
            # Detect MIME type
            mime = "application/pdf"
            ln = file_name.lower()
            if ln.endswith(".docx"):
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif ln.endswith(".doc"):
                mime = "application/msword"
            elif ln.endswith(".txt"):
                mime = "text/plain"
            elif not ln.endswith(".pdf"):
                if file_resp.content[:4] == b'%PDF':
                    mime = "application/pdf"
            upload_files = {"file": (file_name, file_resp.content, mime)}
            resp = await client.post(
                f"{REDACCION_URL}/api/econometric-studies/upload-document",
                files=upload_files,
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json().get("extracted_text", "")
            else:
                logger.warning(f"upload-document returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"upload-document also failed: {e}")

    return ""


# ── Econometric Study Generation ─────────────────────────────────────

async def get_econometric_status(token: str, study_id: str):
    """Get econometric study generation status"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/econometric-studies/{study_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def run_econometric_generation(db, case_id: str, job_id: str):
    """Background task: orchestrate econometric study generation"""
    job_col = db.econometric_jobs

    async def update_status(status, step="", error="", **extra):
        update = {"status": status, "currentStep": step, "updatedAt": datetime.now(timezone.utc).isoformat()}
        if error:
            update["error"] = error
        update.update(extra)
        await job_col.update_one({"_id": job_id}, {"$set": update})

    try:
        await update_status("processing", "Autenticando con sistema de redaccion...")

        visa_case = await db.visa_cases.find_one({"_id": case_id})
        if not visa_case:
            await update_status("error", error="Caso de visa no encontrado")
            return

        user_id = visa_case.get("userId", "")
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})

        if not user or not user.get("email"):
            await update_status("error", error="No se encontro el email del cliente")
            return

        client_email = user["email"]
        client_name = user.get("name", client_email)
        client_phone = user.get("phone", "")

        # Auth
        token = await _get_redaccion_token()
        await update_status("processing", "Buscando cliente en sistema de redaccion...")

        # Search/Create client
        client_uuid = await _search_client(token, client_email)
        if not client_uuid:
            await update_status("processing", "Creando cliente en sistema de redaccion...")
            client_uuid = await _create_client(token, client_name, client_email, client_phone)

        await update_status("processing", "Cliente listo. Buscando Business Plan...", externalClientId=client_uuid)

        # Get Business Plan file (Stage 3)
        bp_deliverable = await db.visa_deliverables.find_one(
            {"caseId": case_id, "stageNumber": 3},
            {"_id": 0, "files": 1, "fileUrl": 1, "fileName": 1}
        )
        bp_url = None
        bp_name = "business_plan.pdf"
        if bp_deliverable:
            files = bp_deliverable.get("files", [])
            if files:
                bp_url = files[0].get("fileUrl")
                bp_name = files[0].get("fileName", bp_name)
            elif bp_deliverable.get("fileUrl"):
                bp_url = bp_deliverable["fileUrl"]
                bp_name = bp_deliverable.get("fileName", bp_name)

        if not bp_url:
            await update_status("error", error="No se encontro el Business Plan (Stage 3). Debe estar subido antes de generar el Estudio Econometrico.")
            return

        # Step 1: Upload document to extract text
        await update_status("processing", "Extrayendo texto del Business Plan...")
        project_description = ""
        async with httpx.AsyncClient(timeout=120) as client:
            file_resp = await client.get(bp_url, follow_redirects=True)
            file_resp.raise_for_status()
            file_bytes = file_resp.content

            upload_files = {"file": (bp_name, file_bytes, "application/octet-stream")}
            resp = await client.post(
                f"{REDACCION_URL}/api/econometric-studies/upload-document",
                files=upload_files,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            extract_data = resp.json()
            project_description = extract_data.get("extracted_text", "")

        if not project_description:
            await update_status("error", error="No se pudo extraer texto del documento")
            return

        # Get CV text (optional, improves quality)
        author_cv = ""
        cv = await db.user_cvs.find_one(
            {"userId": user_id, "fileType": {"$in": ["cv", None]}},
            {"_id": 0, "url": 1, "fileName": 1}
        )
        if not cv:
            cv = await db.user_cvs.find_one({"userId": user_id}, {"_id": 0, "url": 1, "fileName": 1})

        if cv and cv.get("url"):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    cv_resp = await client.get(cv["url"], follow_redirects=True)
                    cv_resp.raise_for_status()
                    cv_files = {"file": (cv.get("fileName", "cv.pdf"), cv_resp.content, "application/octet-stream")}
                    cv_extract = await client.post(
                        f"{REDACCION_URL}/api/econometric-studies/upload-document",
                        files=cv_files,
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if cv_extract.status_code == 200:
                        author_cv = cv_extract.json().get("extracted_text", "")
            except Exception as e:
                logger.warning(f"CV extraction for econometric failed: {e}")

        # Step 2: Create the study
        await update_status("processing", "Creando Estudio Econometrico...")
        study_payload = {
            "project_description": project_description,
            "client_id": client_uuid,
            "language": "es",
            "author_name": client_name,
        }
        if author_cv:
            study_payload["author_cv"] = author_cv

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{REDACCION_URL}/api/econometric-studies/start",
                json=study_payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            study_data = resp.json()
            study_id = study_data.get("study_id")

        if not study_id:
            await update_status("error", error="No se obtuvo study_id")
            return

        # Step 3: Start generation
        await update_status("processing", "Iniciando generacion...", externalStudyId=study_id)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{REDACCION_URL}/api/econometric-studies/{study_id}/generate-complete-v2",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()

        await update_status("generating", "Generando Estudio Econometrico (5-10 minutos)...",
                          externalStudyId=study_id, externalClientId=client_uuid)

    except Exception as e:
        logger.error(f"Econometric study generation error for case {case_id}: {e}")
        await update_status("error", error=str(e))


# ── Case Study (Harvard-Style) Generation ────────────────────────────

async def get_case_study_status(token: str, study_id: str):
    """Get case study generation status"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/case-studies/{study_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def run_case_study_generation(db, case_id: str, job_id: str):
    """Background task: orchestrate Harvard-style case study generation via multipart/form-data"""
    job_col = db.case_study_jobs

    async def update_status(status, step="", error="", **extra):
        update = {"status": status, "currentStep": step, "updatedAt": datetime.now(timezone.utc).isoformat()}
        if error:
            update["error"] = error
        update.update(extra)
        await job_col.update_one({"_id": job_id}, {"$set": update})

    try:
        await update_status("processing", "Autenticando con sistema de redaccion...")

        visa_case = await db.visa_cases.find_one({"_id": case_id})
        if not visa_case:
            await update_status("error", error="Caso de visa no encontrado")
            return

        user_id = visa_case.get("userId", "")
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})

        if not user or not user.get("email"):
            await update_status("error", error="No se encontro el email del cliente")
            return

        client_email = user["email"]
        client_name = user.get("name", client_email)
        client_phone = user.get("phone", "")

        # Auth
        token = await _get_redaccion_token()
        await update_status("processing", "Buscando cliente en sistema de redaccion...")

        # Search/Create client
        client_uuid = await _search_client(token, client_email)
        if not client_uuid:
            await update_status("processing", "Creando cliente en sistema de redaccion...")
            client_uuid = await _create_client(token, client_name, client_email, client_phone)

        await update_status("processing", "Cliente listo. Buscando Business Plan...", externalClientId=client_uuid)

        # Get Business Plan file (Stage 3 deliverable — same as other modules)
        bp_deliverable = await db.visa_deliverables.find_one(
            {"caseId": case_id, "stageNumber": 3},
            {"_id": 0, "files": 1, "fileUrl": 1, "fileName": 1}
        )
        bp_url = None
        bp_name = "business_plan.pdf"
        if bp_deliverable:
            files = bp_deliverable.get("files", [])
            if files:
                bp_url = files[0].get("fileUrl")
                bp_name = files[0].get("fileName", bp_name)
            elif bp_deliverable.get("fileUrl"):
                bp_url = bp_deliverable["fileUrl"]
                bp_name = bp_deliverable.get("fileName", bp_name)

        if not bp_url:
            await update_status("error", error="No se encontro el Business Plan (Stage 3). Debe estar subido antes de generar el Caso de Estudio.")
            return

        # Download Business Plan file
        await update_status("processing", "Descargando Business Plan...")
        async with httpx.AsyncClient(timeout=120) as client:
            bp_resp = await client.get(bp_url, follow_redirects=True)
            bp_resp.raise_for_status()
            bp_bytes = bp_resp.content

        # Get CV file (optional, improves quality)
        cv_bytes = None
        cv_name = "cv.pdf"
        cv = await db.user_cvs.find_one(
            {"userId": user_id, "fileType": {"$in": ["cv", None]}},
            {"_id": 0, "url": 1, "fileName": 1}
        )
        if not cv:
            cv = await db.user_cvs.find_one({"userId": user_id}, {"_id": 0, "url": 1, "fileName": 1})

        if cv and cv.get("url"):
            await update_status("processing", "Descargando CV del autor...")
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    cv_resp = await client.get(cv["url"], follow_redirects=True)
                    cv_resp.raise_for_status()
                    cv_bytes = cv_resp.content
                    cv_name = cv.get("fileName", "cv.pdf")
            except Exception as e:
                logger.warning(f"CV download for case study failed: {e}")

        # POST multipart/form-data to generate case study
        await update_status("processing", "Enviando documentos para generar Caso de Estudio Harvard...")
        async with httpx.AsyncClient(timeout=120) as client:
            multipart_files = [
                ("project_description", (bp_name, bp_bytes, "application/octet-stream")),
            ]
            if cv_bytes:
                multipart_files.append(("cv_file", (cv_name, cv_bytes, "application/octet-stream")))

            form_data = {
                "client_id": client_uuid,
                "title": f"Caso de Estudio: {client_name}",
            }

            resp = await client.post(
                f"{REDACCION_URL}/api/case-studies/generate",
                files=multipart_files,
                data=form_data,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            study_id = data.get("id")

        if not study_id:
            await update_status("error", error="No se obtuvo study_id del sistema de redaccion")
            return

        await update_status("generating", "Generando Caso de Estudio Harvard (3-5 minutos)...",
                          externalStudyId=study_id, externalClientId=client_uuid)

    except Exception as e:
        logger.error(f"Case study generation error for case {case_id}: {e}")
        await update_status("error", error=str(e))
