"""
Learning Module Endpoints
HeyGen avatar + RAG-powered training for staff.

Admin (manage_learning):
  - CRUD learning_modules
  - Upload / reindex / delete learning_documents

Auditor (view_learning_sessions):
  - List sessions, view messages

Staff (consume_learning):
  - List published modules
  - Start session (gets ephemeral HeyGen token)
  - Send message (RAG + LLM, persisted)
  - End session (optional evaluation in guided mode)
"""

import logging
import asyncio
import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form

from db.supabase_client import (
    get_supabase,
    select,
    insert,
    update as sb_update,
    delete,
)
from permissions_system import has_permission

from learning.config import (
    LEARNING_BUCKET,
    MAX_UPLOAD_SIZE_BYTES,
)
from learning.ingest import ingest_document
from learning.extract import extract_text
from learning.retriever import retrieve, format_context
from learning.llm import (
    chat,
    chat_json,
    build_module_system_prompt,
    build_rag_user_message,
)
from learning.liveavatar import create_avatar_session, get_avatar_config

logger = logging.getLogger(__name__)


# ===================== Pydantic models =====================

class ModuleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    system_prompt: str
    mode: str = "free"  # free | guided
    objectives: list = Field(default_factory=list)
    llm_model: Optional[str] = None
    status: str = "draft"  # draft | published | archived
    order_index: int = 0


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    mode: Optional[str] = None
    objectives: Optional[list] = None
    llm_model: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None


class SessionStart(BaseModel):
    module_id: Optional[str] = None  # None = conversación libre


class SessionMessage(BaseModel):
    text: str


# ===================== Helpers =====================

def _require_role_perm(staff_payload: dict, perm: str):
    role = staff_payload.get("role")
    if not has_permission(role, perm):
        raise HTTPException(
            status_code=403,
            detail=f"El rol '{role}' no tiene permiso '{perm}'",
        )


def _safe_storage_filename(name: str) -> str:
    """Supabase Storage keys reject accents, spaces and most non-ASCII.
    Returns an ASCII-only slug while preserving extension."""
    if not name:
        return "file"
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    ascii_name = re.sub(r"\s+", "_", ascii_name)
    ascii_name = re.sub(r"[^A-Za-z0-9._-]", "", ascii_name)
    ascii_name = ascii_name.strip("._-") or "file"
    return ascii_name


def _ensure_bucket_exists():
    """Create the learning-documents bucket if missing (private)."""
    sb = get_supabase()
    try:
        sb.storage.get_bucket(LEARNING_BUCKET)
    except Exception:
        try:
            sb.storage.create_bucket(LEARNING_BUCKET, options={"public": False})
            logger.info(f"[learning] created bucket {LEARNING_BUCKET}")
        except Exception as e:
            logger.warning(f"[learning] could not ensure bucket: {e}")


# ===================== Router setup =====================

def setup_learning_router(db, verify_staff_token):
    router = APIRouter()

    # ============== ADMIN: módulos ==============

    @router.get("/admin/learning/modules")
    async def list_modules_admin(staff_payload: dict = Depends(verify_staff_token)):
        _require_role_perm(staff_payload, "manage_learning")
        modules = select("learning_modules", order="order_index", order_desc=False, limit=200)
        return {"success": True, "modules": modules}

    @router.post("/admin/learning/modules")
    async def create_module(
        request: ModuleCreate,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "manage_learning")
        payload = request.model_dump()
        payload["created_by"] = staff_payload.get("id")
        result = insert("learning_modules", payload)
        return {"success": True, "module": result}

    @router.get("/admin/learning/modules/{module_id}")
    async def get_module_admin(module_id: str, staff_payload: dict = Depends(verify_staff_token)):
        _require_role_perm(staff_payload, "manage_learning")
        module = select("learning_modules", filters={"id": module_id}, single=True)
        if not module:
            raise HTTPException(status_code=404, detail="Módulo no encontrado")
        documents = select("learning_documents", filters={"module_id": module_id}, order="created_at")
        return {"success": True, "module": module, "documents": documents}

    @router.patch("/admin/learning/modules/{module_id}")
    async def update_module(
        module_id: str,
        request: ModuleUpdate,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "manage_learning")
        existing = select("learning_modules", filters={"id": module_id}, single=True)
        if not existing:
            raise HTTPException(status_code=404, detail="Módulo no encontrado")
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        if not update_data:
            return {"success": True, "module": existing}
        sb_update("learning_modules", {"id": module_id}, update_data)
        updated = select("learning_modules", filters={"id": module_id}, single=True)
        return {"success": True, "module": updated}

    @router.delete("/admin/learning/modules/{module_id}")
    async def delete_module(module_id: str, staff_payload: dict = Depends(verify_staff_token)):
        _require_role_perm(staff_payload, "manage_learning")
        delete("learning_modules", filters={"id": module_id})
        return {"success": True}

    # ============== ADMIN: documentos ==============

    @router.get("/admin/learning/documents")
    async def list_documents(
        module_id: Optional[str] = None,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "manage_learning")
        filters = {"module_id": module_id} if module_id else None
        docs = select("learning_documents", filters=filters, order="created_at")
        return {"success": True, "documents": docs}

    @router.post("/admin/learning/documents")
    async def upload_document(
        file: UploadFile = File(...),
        module_id: Optional[str] = Form(None),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "manage_learning")

        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Archivo vacío")
        if len(contents) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Archivo excede el límite de {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB",
            )

        name_lower = (file.filename or "").lower()
        if not (name_lower.endswith(".pdf") or name_lower.endswith(".docx")):
            raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF o DOCX")

        _ensure_bucket_exists()
        sb = get_supabase()
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        scope = module_id or "global"
        safe_name = _safe_storage_filename(file.filename or "")
        storage_path = f"{scope}/{ts}_{safe_name}"

        try:
            sb.storage.from_(LEARNING_BUCKET).upload(
                storage_path,
                contents,
                file_options={"content-type": file.content_type or "application/octet-stream"},
            )
        except Exception as e:
            logger.exception("[learning] storage upload failed")
            raise HTTPException(status_code=500, detail=f"Error subiendo a Storage: {e}")

        doc = insert(
            "learning_documents",
            {
                "module_id": module_id,
                "filename": file.filename,
                "storage_path": storage_path,
                "mime_type": file.content_type,
                "size_bytes": len(contents),
                "status": "pending",
                "uploaded_by": staff_payload.get("id"),
            },
        )

        # Run ingest in background so the upload returns immediately
        async def _run_ingest(doc_id: str):
            try:
                await asyncio.to_thread(ingest_document, doc_id)
            except Exception:
                logger.exception(f"[learning] background ingest failed for {doc_id}")

        asyncio.create_task(_run_ingest(doc["id"]))

        return {"success": True, "document": doc}

    @router.post("/admin/learning/documents/{document_id}/reindex")
    async def reindex_document(
        document_id: str,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "manage_learning")
        doc = select("learning_documents", filters={"id": document_id}, single=True)
        if not doc:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        async def _run():
            try:
                await asyncio.to_thread(ingest_document, document_id)
            except Exception:
                logger.exception(f"[learning] reindex failed for {document_id}")

        asyncio.create_task(_run())
        return {"success": True, "message": "Reindexación iniciada"}

    @router.delete("/admin/learning/documents/{document_id}")
    async def delete_document(
        document_id: str,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "manage_learning")
        doc = select("learning_documents", filters={"id": document_id}, single=True)
        if not doc:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        try:
            get_supabase().storage.from_(LEARNING_BUCKET).remove([doc["storage_path"]])
        except Exception as e:
            logger.warning(f"[learning] could not remove storage object: {e}")

        delete("learning_documents", filters={"id": document_id})
        return {"success": True}

    @router.post("/admin/learning/modules/{module_id}/test-retrieval")
    async def test_retrieval(
        module_id: str,
        request: SessionMessage,  # reutiliza {text: str}
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Diagnóstico: dada una pregunta, devuelve los chunks que el RAG matchearía
        para este módulo, con su similitud. No llama al LLM."""
        _require_role_perm(staff_payload, "manage_learning")

        module = select("learning_modules", filters={"id": module_id}, single=True)
        if not module:
            raise HTTPException(status_code=404, detail="Módulo no encontrado")

        query = (request.text or "").strip()
        if not query:
            raise HTTPException(status_code=400, detail="Pregunta vacía")

        # Cuántos chunks tiene este módulo en total (para distinguir
        # "0 indexados" vs "indexados pero la query no matchea").
        all_chunks_for_module = select(
            "learning_chunks", filters={"module_id": module_id}, limit=1000
        ) or []
        total_indexed = len(all_chunks_for_module)

        try:
            chunks = retrieve(query, module_id=module_id)
        except Exception as e:
            logger.exception("[learning] test_retrieval failed")
            raise HTTPException(status_code=500, detail=f"Error en retrieval: {e}")

        return {
            "success": True,
            "module_id": module_id,
            "query": query,
            "total_chunks_in_module": total_indexed,
            "matches": [
                {
                    "id": c.get("id"),
                    "similarity": c.get("similarity"),
                    "source": (c.get("metadata") or {}).get("source_filename"),
                    "preview": (c.get("content") or "")[:400],
                }
                for c in chunks
            ],
            "min_similarity_threshold": 0.3,
        }

    @router.post("/admin/learning/modules/draft-from-document")
    async def draft_module_from_document(
        file: UploadFile = File(...),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Analiza un PDF/DOCX con LLM y devuelve campos sugeridos para un módulo.
        No persiste nada — solo retorna un borrador editable."""
        _require_role_perm(staff_payload, "manage_learning")

        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Archivo vacío")
        if len(contents) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Archivo excede el límite de {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB",
            )

        name_lower = (file.filename or "").lower()
        if not (name_lower.endswith(".pdf") or name_lower.endswith(".docx")):
            raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF o DOCX")

        try:
            text = await asyncio.to_thread(
                extract_text, contents, file.content_type or "", file.filename or ""
            )
        except Exception as e:
            logger.exception("[learning.draft] extraction failed")
            raise HTTPException(status_code=400, detail=f"No se pudo extraer texto: {e}")

        if not text or len(text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="El documento no tiene texto suficiente para analizar",
            )

        # Limita el contexto para mantener costo/latencia razonables.
        # ~30k chars ≈ 7-8k tokens, suficiente para generar metadata.
        MAX_CHARS = 30000
        truncated = text[:MAX_CHARS]
        was_truncated = len(text) > MAX_CHARS

        system_msg = (
            "Eres un asistente que diseña módulos de capacitación interna para URPE. "
            "Analizas documentos y propones la metadata de un módulo nuevo. "
            "Responde SIEMPRE en español y SOLO con JSON válido."
        )
        user_msg = (
            "A partir del siguiente documento, propón los campos para un módulo de aprendizaje. "
            "Responde con un JSON con esta forma exacta:\n"
            "{\n"
            '  "title": "string corto, máx 60 caracteres",\n'
            '  "description": "1-2 oraciones, máx 200 caracteres",\n'
            '  "system_prompt": "instrucciones para un tutor virtual que enseñará este material. '
            'Empieza con \'Eres un tutor virtual de URPE especializado en…\' y describe alcance, '
            'tono y qué debe priorizar al responder.",\n'
            '  "mode": "guided" o "free",\n'
            '  "objectives": [{"text": "objetivo 1"}, ...]\n'
            "}\n\n"
            "Reglas:\n"
            "- mode=\"guided\" SOLO si el documento tiene una estructura secuencial clara con "
            "lecciones/objetivos. Si es referencia general, FAQ o material consultivo, usa \"free\".\n"
            "- objectives: solo si mode=\"guided\". Máximo 6 objetivos, en orden lógico.\n"
            "- Si mode=\"free\", devuelve objectives: [].\n"
            "- No inventes información que no esté en el documento.\n\n"
        )
        if was_truncated:
            user_msg += (
                "(Nota: el documento es largo, se truncó a los primeros caracteres. "
                "Usa lo disponible para inferir el alcance general.)\n\n"
            )
        user_msg += f"DOCUMENTO ({file.filename}):\n\n{truncated}"

        try:
            draft = await asyncio.to_thread(
                chat_json,
                [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                None,  # default model
                0.3,
            )
        except Exception as e:
            logger.exception("[learning.draft] llm call failed")
            raise HTTPException(status_code=500, detail=f"Error consultando el LLM: {e}")

        # Validación / normalización defensiva: el modelo a veces se sale del esquema.
        title = (draft.get("title") or "").strip()[:60]
        description = (draft.get("description") or "").strip()[:200]
        system_prompt = (draft.get("system_prompt") or "").strip()
        mode = draft.get("mode") or "free"
        if mode not in ("free", "guided"):
            mode = "free"
        raw_objectives = draft.get("objectives") or []
        objectives = []
        if mode == "guided" and isinstance(raw_objectives, list):
            for i, o in enumerate(raw_objectives[:6]):
                obj_text = ""
                if isinstance(o, dict):
                    obj_text = (o.get("text") or "").strip()
                elif isinstance(o, str):
                    obj_text = o.strip()
                if obj_text:
                    objectives.append({"id": f"obj_{i}", "text": obj_text})

        if not title and not system_prompt:
            raise HTTPException(
                status_code=502,
                detail="El LLM no devolvió un borrador válido. Intenta otra vez o llena los campos manualmente.",
            )

        return {
            "success": True,
            "draft": {
                "title": title,
                "description": description,
                "system_prompt": system_prompt,
                "mode": mode,
                "objectives": objectives,
            },
            "source_filename": file.filename,
            "truncated": was_truncated,
        }

    # ============== AUDIT: sesiones ==============

    @router.get("/admin/learning/sessions")
    async def list_sessions_admin(
        limit: int = 200,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "view_learning_sessions")
        sessions = select(
            "learning_sessions",
            order="started_at",
            order_desc=True,
            limit=limit,
        )
        return {"success": True, "sessions": sessions}

    @router.get("/admin/learning/sessions/{session_id}")
    async def get_session_detail(
        session_id: str,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "view_learning_sessions")
        session = select("learning_sessions", filters={"id": session_id}, single=True)
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        messages = select(
            "learning_messages",
            filters={"session_id": session_id},
            order="created_at",
            order_desc=False,
        )
        evaluation = select(
            "learning_evaluations",
            filters={"session_id": session_id},
            single=True,
        )
        return {
            "success": True,
            "session": session,
            "messages": messages,
            "evaluation": evaluation,
        }

    # ============== STAFF: consumo ==============

    @router.get("/learning/modules")
    async def list_modules_staff(staff_payload: dict = Depends(verify_staff_token)):
        _require_role_perm(staff_payload, "consume_learning")
        modules = select(
            "learning_modules",
            filters={"status": "published"},
            order="order_index",
            order_desc=False,
        )
        return {"success": True, "modules": modules}

    @router.post("/learning/sessions")
    async def start_session(
        request: SessionStart,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        try:
            _require_role_perm(staff_payload, "consume_learning")

            module = None
            if request.module_id:
                module = select("learning_modules", filters={"id": request.module_id}, single=True)
                if not module:
                    raise HTTPException(status_code=404, detail="Módulo no encontrado")
                if module.get("status") != "published":
                    raise HTTPException(status_code=400, detail="Módulo no publicado")

            try:
                session = insert(
                    "learning_sessions",
                    {
                        "staff_id": staff_payload.get("id"),
                        "module_id": request.module_id,
                        "status": "active",
                    },
                )
            except Exception as e:
                logger.exception("[learning] insert session failed")
                raise HTTPException(status_code=500, detail=f"DB insert session: {e}")

            system_prompt = build_module_system_prompt(module or {})
            try:
                insert(
                    "learning_messages",
                    {
                        "session_id": session["id"],
                        "role": "system",
                        "content": system_prompt,
                    },
                )
            except Exception as e:
                logger.exception("[learning] insert system message failed")
                raise HTTPException(status_code=500, detail=f"DB insert message: {e}")

            avatar_session = None
            avatar_error = None
            try:
                avatar_session = create_avatar_session(module)
            except Exception as e:
                avatar_error = str(e)
                logger.warning(f"[learning] LiveAvatar session error (returning session anyway): {e}")

            avatar = get_avatar_config()

            opening_text = None
            if module and module.get("mode") == "guided":
                try:
                    opening = chat(
                        [
                            {"role": "system", "content": system_prompt},
                            {
                                "role": "user",
                                "content": "Empieza la sesión: salúdame brevemente y haz la primera pregunta para iniciar el módulo.",
                            },
                        ],
                        model=module.get("llm_model"),
                    )
                    opening_text = opening.get("text")
                    if opening_text:
                        insert(
                            "learning_messages",
                            {
                                "session_id": session["id"],
                                "role": "assistant",
                                "content": opening_text,
                                "tokens_input": opening.get("tokens_input"),
                                "tokens_output": opening.get("tokens_output"),
                            },
                        )
                except Exception:
                    logger.exception("[learning] failed to generate opening message")

            return {
                "success": True,
                "session_id": session["id"],
                "module": module,
                "system_prompt": system_prompt,
                "avatar_session": avatar_session,
                "avatar_error": avatar_error,
                "avatar": avatar,
                "opening_text": opening_text,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("[learning] start_session unexpected error")
            raise HTTPException(status_code=500, detail=f"Unexpected: {type(e).__name__}: {e}")

    @router.post("/learning/sessions/{session_id}/message")
    async def send_message(
        session_id: str,
        request: SessionMessage,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        try:
            _require_role_perm(staff_payload, "consume_learning")

            session = select("learning_sessions", filters={"id": session_id}, single=True)
            if not session:
                raise HTTPException(status_code=404, detail="Sesión no encontrada")
            if session.get("staff_id") != staff_payload.get("id"):
                raise HTTPException(status_code=403, detail="No es tu sesión")
            if session.get("status") != "active":
                raise HTTPException(status_code=400, detail="Sesión no activa")

            user_text = (request.text or "").strip()
            if not user_text:
                raise HTTPException(status_code=400, detail="Mensaje vacío")

            try:
                insert(
                    "learning_messages",
                    {"session_id": session_id, "role": "user", "content": user_text},
                )
            except Exception as e:
                logger.exception("[learning] insert user message failed")
                raise HTTPException(status_code=500, detail=f"DB insert user msg: {e}")

            module_id = session.get("module_id")

            chunks = []
            context = ""
            retrieval_failed = False
            try:
                chunks = retrieve(user_text, module_id=module_id)
                context = format_context(chunks)
            except Exception as e:
                logger.exception("[learning] RAG retrieval failed (continuing without context)")
                retrieval_failed = True

            # Cortocircuito: si estamos dentro de un módulo y no recuperamos nada,
            # respondemos canned sin llamar al LLM. Evita que invente respuestas
            # genéricas cuando el material no cubre la pregunta.
            short_circuited = False
            if module_id and not chunks and not retrieval_failed:
                assistant_text = (
                    "No tengo esa información en el material indexado de este módulo. "
                    "Te recomiendo consultarlo con tu líder."
                )
                short_circuited = True
                result = {"text": assistant_text, "tokens_input": None, "tokens_output": None}
            else:
                try:
                    messages_db = select(
                        "learning_messages",
                        filters={"session_id": session_id},
                        order="created_at",
                        order_desc=False,
                    )
                except Exception as e:
                    logger.exception("[learning] select messages failed")
                    raise HTTPException(status_code=500, detail=f"DB select messages: {e}")

                system_msg = next((m for m in messages_db if m.get("role") == "system"), None)
                recent = [m for m in messages_db if m.get("role") in ("user", "assistant")][-10:]

                llm_messages = []
                if system_msg:
                    llm_messages.append({"role": "system", "content": system_msg["content"]})
                for i, m in enumerate(recent):
                    if i == len(recent) - 1 and m.get("role") == "user":
                        llm_messages.append(
                            {"role": "user", "content": build_rag_user_message(m["content"], context)}
                        )
                    else:
                        llm_messages.append({"role": m["role"], "content": m["content"]})

                model = None
                if module_id:
                    mod = select("learning_modules", filters={"id": module_id}, single=True)
                    model = (mod or {}).get("llm_model")

                try:
                    result = chat(llm_messages, model=model)
                except Exception as e:
                    logger.exception("[learning] LLM chat failed")
                    raise HTTPException(status_code=502, detail=f"Error del modelo (OpenRouter): {e}")

                assistant_text = result.get("text", "")

            chunk_ids = [c.get("id") for c in chunks]

            try:
                insert(
                    "learning_messages",
                    {
                        "session_id": session_id,
                        "role": "assistant",
                        "content": assistant_text,
                        "retrieved_chunk_ids": chunk_ids,
                        "tokens_input": result.get("tokens_input"),
                        "tokens_output": result.get("tokens_output"),
                    },
                )
            except Exception as e:
                logger.exception("[learning] insert assistant message failed")
                # Igual devolvemos la respuesta al usuario aunque falle el insert.

            return {
                "success": True,
                "assistant_text": assistant_text,
                "retrieved_chunks": [
                    {
                        "id": c.get("id"),
                        "content": (c.get("content") or "")[:300],
                        "similarity": c.get("similarity"),
                        "source": (c.get("metadata") or {}).get("source_filename"),
                    }
                    for c in chunks
                ],
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("[learning] send_message unexpected error")
            raise HTTPException(status_code=500, detail=f"Unexpected: {type(e).__name__}: {e}")

    @router.post("/learning/sessions/{session_id}/resume-avatar")
    async def resume_avatar(
        session_id: str,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Crea un nuevo avatar_session (LiveKit token) para reanudar una sesión
        que fue pausada por inactividad. No crea otra learning_session."""
        _require_role_perm(staff_payload, "consume_learning")
        session = select("learning_sessions", filters={"id": session_id}, single=True)
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        if session.get("staff_id") != staff_payload.get("id"):
            raise HTTPException(status_code=403, detail="No es tu sesión")
        if session.get("status") != "active":
            raise HTTPException(status_code=400, detail="Sesión no activa")

        module = None
        if session.get("module_id"):
            module = select("learning_modules", filters={"id": session["module_id"]}, single=True)

        try:
            avatar_session = create_avatar_session(module)
        except Exception as e:
            logger.exception("[learning] resume_avatar failed")
            raise HTTPException(status_code=502, detail=f"No se pudo reanudar el avatar: {e}")

        return {"success": True, "avatar_session": avatar_session}

    @router.post("/learning/sessions/{session_id}/end")
    async def end_session(
        session_id: str,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        _require_role_perm(staff_payload, "consume_learning")

        session = select("learning_sessions", filters={"id": session_id}, single=True)
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        if session.get("staff_id") != staff_payload.get("id"):
            raise HTTPException(status_code=403, detail="No es tu sesión")
        if session.get("status") != "active":
            return {"success": True, "message": "Sesión ya cerrada"}

        started = session.get("started_at")
        ended_at = datetime.now(timezone.utc).isoformat()
        duration = None
        if started:
            try:
                started_dt = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                duration = int((datetime.now(timezone.utc) - started_dt).total_seconds())
            except Exception:
                pass

        sb_update(
            "learning_sessions",
            {"id": session_id},
            {"status": "completed", "ended_at": ended_at, "duration_seconds": duration},
        )

        # Evaluación si modo guiado
        evaluation_row = None
        module_id = session.get("module_id")
        if module_id:
            module = select("learning_modules", filters={"id": module_id}, single=True)
            if module and module.get("mode") == "guided" and (module.get("objectives") or []):
                evaluation_row = _generate_evaluation(session_id, module, staff_payload.get("id"))

        return {"success": True, "session_id": session_id, "evaluation": evaluation_row}

    @router.get("/learning/sessions/me")
    async def my_sessions(staff_payload: dict = Depends(verify_staff_token)):
        _require_role_perm(staff_payload, "consume_learning")
        sessions = select(
            "learning_sessions",
            filters={"staff_id": staff_payload.get("id")},
            order="started_at",
            order_desc=True,
            limit=50,
        )
        return {"success": True, "sessions": sessions}

    return router


# ===================== Helpers privados =====================

def _generate_evaluation(session_id: str, module: dict, staff_id: str) -> Optional[dict]:
    """Generate JSON evaluation from full transcript and persist it."""
    messages = select(
        "learning_messages",
        filters={"session_id": session_id},
        order="created_at",
        order_desc=False,
    )
    transcript_lines = []
    for m in messages:
        if m.get("role") in ("user", "assistant"):
            transcript_lines.append(f"{m['role'].upper()}: {m['content']}")
    transcript = "\n".join(transcript_lines)

    objectives = module.get("objectives") or []
    objectives_text = "\n".join([f"- ({o.get('id')}) {o.get('text')}" for o in objectives])

    prompt = (
        "Eres un evaluador. Recibes una transcripción de una sesión de aprendizaje guiada "
        "entre un colaborador y un tutor virtual. Evalúa qué tan bien el colaborador "
        "demostró comprensión de cada objetivo. Devuelve JSON estricto con esta forma:\n"
        '{\n  "score": 0-100 (numero),\n'
        '  "objectives_covered": [{"id": "...", "covered": true/false, "evidence": "frase corta"}],\n'
        '  "feedback": "retroalimentación breve para el colaborador (3-4 frases en español)"\n}'
    )

    user_msg = (
        f"OBJETIVOS:\n{objectives_text}\n\n"
        f"TRANSCRIPCIÓN:\n{transcript}\n\n"
        "Devuelve SOLO el JSON."
    )

    try:
        result = chat_json(
            [
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_msg},
            ],
            model=module.get("llm_model"),
        )
    except Exception:
        logger.exception(f"[learning] eval generation failed for session {session_id}")
        return None

    if not result:
        return None

    row = insert(
        "learning_evaluations",
        {
            "session_id": session_id,
            "module_id": module.get("id"),
            "staff_id": staff_id,
            "score": result.get("score"),
            "objectives_covered": result.get("objectives_covered") or [],
            "feedback": result.get("feedback"),
            "raw_response": result,
        },
    )
    return row
