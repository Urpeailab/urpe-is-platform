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
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Header
from fastapi.responses import StreamingResponse
import json as _json

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
    LEARNING_USE_ELEVENLABS,
    RAG_LOOKUP_SECRET,
)
from learning.ingest import ingest_document
from learning.extract import extract_text
from learning.retriever import retrieve, format_context
from learning.llm import (
    chat,
    chat_stream,
    chat_json,
    build_module_system_prompt,
    build_rag_user_message,
    build_conversational_system_prompt,
)
from learning.liveavatar import create_avatar_session, get_avatar_config
from learning.elevenlabs import create_connector_session, build_dynamic_variables
from learning.transcribe import transcribe_audio

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
    # Opcional: el cliente puede mandar el historial reciente para que el backend
    # no tenga que consultar la BD. Ahorra ~150-300ms por turno. Se ignora en
    # endpoints que no lo soportan (transcribe, test-retrieval).
    recent_messages: Optional[List[dict]] = None


class AgentRagLookupRequest(BaseModel):
    """Payload del tool `search_module_knowledge` que el agent de ElevenLabs
    invoca cuando necesita info del módulo. El agent rellena estos campos a
    partir de las dynamic_variables que le pasamos al iniciar la sesión."""
    query: str
    module_id: Optional[str] = None
    top_k: Optional[int] = None  # default = RETRIEVAL_TOP_K en config


class SessionEventLog(BaseModel):
    """Eventos que el frontend captura del data channel de LiveKit y nos
    reenvía para que persistamos transcripciones + estados de la sesión.

    `kind` espejea (casi) los tipos de eventos del Connector:
      - user_transcript          → mensaje del usuario completo
      - agent_response           → mensaje del avatar completo
      - session_stopped          → la sesión terminó del lado del agent
    El `payload` queda como JSON crudo en metadata por si hay info útil
    (tool_call_id, agent_text correction, etc.).
    """
    kind: str
    text: Optional[str] = None
    payload: Optional[dict] = None


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


# ===================== Idle / orphan sweeper =====================

# Una sesión "active" sin actividad por más de este tiempo se considera
# huérfana (el usuario cerró el browser, perdió la red, etc.). El audit
# muestra el `effective_status` derivado, y el cleanup-orphans endpoint
# marca el status real en BD.
SESSION_IDLE_THRESHOLD = timedelta(hours=2)


def _parse_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _is_session_orphan(session: dict) -> bool:
    """True si la sesión está 'active' pero idle por más del threshold."""
    if (session or {}).get("status") != "active":
        return False
    ref = _parse_iso(session.get("last_activity_at")) or _parse_iso(session.get("started_at"))
    if not ref:
        return False
    return datetime.now(timezone.utc) - ref > SESSION_IDLE_THRESHOLD


def _effective_session_status(session: dict) -> str:
    """Status derivado: si está 'active' pero idle, mostramos 'abandoned'."""
    raw = (session or {}).get("status") or "active"
    if raw == "active" and _is_session_orphan(session):
        return "abandoned"
    return raw


def _touch_session_activity(session_id: str):
    """Actualizar last_activity_at de la sesión. Silencia errores para no
    romper el flujo principal si la columna no existe aún (migración 018)."""
    try:
        sb_update(
            "learning_sessions",
            filters={"id": session_id},
            data={"last_activity_at": datetime.now(timezone.utc).isoformat()},
        )
    except Exception:
        logger.exception("[learning] could not touch last_activity_at")


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
        # Anotamos effective_status para que el UI muestre sesiones idle como
        # 'abandoned' sin necesidad de correr el sweeper.
        for s in sessions:
            s["effective_status"] = _effective_session_status(s)
        return {"success": True, "sessions": sessions}

    @router.delete("/admin/learning/sessions/{session_id}")
    async def delete_session(
        session_id: str,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Hard delete de una sesión + sus mensajes + evaluación.

        Sólo para compliance/GDPR. La acción es irreversible.
        """
        _require_role_perm(staff_payload, "view_learning_sessions")
        # Cascade manual (las FKs originales no tenían ON DELETE CASCADE)
        try:
            delete("learning_messages", filters={"session_id": session_id})
            delete("learning_evaluations", filters={"session_id": session_id})
            delete("learning_sessions", filters={"id": session_id})
        except Exception as e:
            logger.exception(f"[learning] delete session {session_id} failed")
            raise HTTPException(status_code=500, detail=f"No se pudo eliminar: {e}")
        return {"success": True, "session_id": session_id}

    class _RedactRequest(BaseModel):
        reason: Optional[str] = None

    @router.post("/admin/learning/messages/{message_id}/redact")
    async def redact_message(
        message_id: str,
        request: _RedactRequest,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Marca un mensaje como redactado (GDPR). El contenido se reemplaza por
        un placeholder pero la fila se conserva para que el audit no quede roto."""
        _require_role_perm(staff_payload, "view_learning_sessions")
        msg = select("learning_messages", filters={"id": message_id}, single=True)
        if not msg:
            raise HTTPException(status_code=404, detail="Mensaje no encontrado")
        try:
            sb_update(
                "learning_messages",
                filters={"id": message_id},
                data={
                    "content": "[contenido redactado por compliance]",
                    "redacted_at": datetime.now(timezone.utc).isoformat(),
                    "redacted_by": staff_payload.get("id"),
                    "redaction_reason": (request.reason or "").strip() or None,
                },
            )
        except Exception as e:
            logger.exception(f"[learning] redact message {message_id} failed")
            raise HTTPException(status_code=500, detail=f"No se pudo redactar: {e}")
        return {"success": True, "message_id": message_id}

    @router.post("/admin/learning/sessions/cleanup-orphans")
    async def cleanup_orphan_sessions(
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Marca como 'abandoned' las sesiones 'active' sin actividad reciente."""
        _require_role_perm(staff_payload, "view_learning_sessions")
        active = select(
            "learning_sessions",
            filters={"status": "active"},
            limit=1000,
        )
        now = datetime.now(timezone.utc)
        updated = 0
        for s in active:
            if not _is_session_orphan(s):
                continue
            ref = _parse_iso(s.get("last_activity_at")) or _parse_iso(s.get("started_at")) or now
            started = _parse_iso(s.get("started_at")) or ref
            try:
                sb_update(
                    "learning_sessions",
                    filters={"id": s["id"]},
                    data={
                        "status": "abandoned",
                        "ended_at": ref.isoformat(),
                        "duration_seconds": max(0, int((ref - started).total_seconds())),
                    },
                )
                updated += 1
            except Exception:
                logger.exception(f"[learning] could not abandon session {s.get('id')}")
        return {"success": True, "abandoned": updated, "scanned": len(active)}

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
                if LEARNING_USE_ELEVENLABS:
                    dyn_vars = build_dynamic_variables(module, staff_payload)
                    avatar_session = create_connector_session(
                        module=module, dynamic_variables=dyn_vars
                    )
                else:
                    avatar_session = create_avatar_session(module)
            except Exception as e:
                avatar_error = str(e)
                logger.warning(f"[learning] avatar session error (returning session anyway): {e}")

            avatar = get_avatar_config()

            # Con el Connector, ElevenLabs es quien dice el first_message del
            # agent (configurado en su UI con dynamic variables). NO disparamos
            # nuestro propio "opening" via OpenRouter — sería redundante y haría
            # que el avatar diga dos saludos seguidos.
            opening_text = None
            if not LEARNING_USE_ELEVENLABS and module and module.get("mode") == "guided":
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
                _touch_session_activity(session_id)
            except Exception as e:
                logger.exception("[learning] insert user message failed")
                raise HTTPException(status_code=500, detail=f"DB insert user msg: {e}")

            module_id = session.get("module_id")

            # Siempre intentamos RAG si hay módulo; el LLM decide qué hacer con el
            # resultado (incluso si está vacío) según el prompt construido en
            # build_rag_user_message. Antes había una heurística regex para detectar
            # "saludos" y un cortocircuito canned "no encontré información" que rompía
            # conversaciones naturales y follow-ups.
            chunks = []
            context = ""
            retrieval_failed = False
            rag_skipped = not module_id  # sin módulo = conversación libre

            if module_id:
                try:
                    chunks = retrieve(user_text, module_id=module_id)
                    context = format_context(chunks)
                except Exception:
                    logger.exception("[learning] RAG retrieval failed (continuing without context)")
                    retrieval_failed = True

            short_circuited = False  # ya no se usa el cortocircuito

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

            # System prompt: el persistido si existe, sino el del módulo, sino conversacional puro.
            persisted_system = next((m for m in messages_db if m.get("role") == "system"), None)
            if persisted_system and persisted_system.get("content"):
                system_content = persisted_system["content"]
            elif module_id:
                mod_lookup = select("learning_modules", filters={"id": module_id}, single=True)
                system_content = build_module_system_prompt(mod_lookup or {})
            else:
                system_content = build_conversational_system_prompt()

            recent = [m for m in messages_db if m.get("role") in ("user", "assistant")][-10:]

            llm_messages = [{"role": "system", "content": system_content}]
            for i, m in enumerate(recent):
                if i == len(recent) - 1 and m.get("role") == "user" and module_id:
                    # En el último turno inyectamos el contexto RAG (puede estar vacío).
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
                "rag_skipped": rag_skipped,
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

    @router.post("/learning/sessions/{session_id}/message_stream")
    async def send_message_stream(
        session_id: str,
        request: SessionMessage,
        background_tasks: BackgroundTasks,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Versión streaming de send_message: emite SSE para que el frontend
        empiece a reproducir TTS oración por oración antes de que el LLM
        termine de generar. Reduce latencia perceptual de ~3s a ~600ms."""
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

        # Diferimos el insert del mensaje del usuario para que NO bloquee el
        # stream. BackgroundTasks corre después de que termine la respuesta;
        # como ya tenemos user_text en memoria, no necesitamos esperar a que
        # esté en la BD para usarlo en el LLM.
        background_tasks.add_task(
            insert,
            "learning_messages",
            {"session_id": session_id, "role": "user", "content": user_text},
        )
        background_tasks.add_task(_touch_session_activity, session_id)

        module_id = session.get("module_id")

        # Siempre intentamos RAG si hay módulo. El LLM ahora maneja contextos vacíos
        # con gracia (saludos, follow-ups, off-topic) via build_rag_user_message,
        # así que se eliminaron la heurística regex y el cortocircuito canned.
        chunks = []
        context = ""
        retrieval_failed = False
        if module_id:
            try:
                chunks = retrieve(user_text, module_id=module_id)
                context = format_context(chunks)
            except Exception:
                logger.exception("[learning] RAG retrieval failed")
                retrieval_failed = True

        # Construcción del system prompt — cargamos el módulo una sola vez
        # y lo reusamos para system prompt + selección de modelo.
        mod = None
        if module_id:
            try:
                mod = select("learning_modules", filters={"id": module_id}, single=True)
            except Exception:
                mod = None

        if module_id and mod:
            system_content = build_module_system_prompt(mod)
        else:
            system_content = build_conversational_system_prompt()

        # Recent messages: si el cliente nos los manda evitamos el query a BD
        # (ahorra ~150-300ms). Si no, fallback al query.
        if request.recent_messages:
            client_recent = [
                m for m in request.recent_messages
                if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
            ][-9:]
            recent = client_recent + [{"role": "user", "content": user_text}]
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
            db_recent = [m for m in messages_db if m.get("role") in ("user", "assistant")][-9:]
            recent = db_recent + [{"role": "user", "content": user_text}]

        llm_messages = [{"role": "system", "content": system_content}]
        for i, m in enumerate(recent):
            if i == len(recent) - 1 and m.get("role") == "user" and module_id:
                # En el último turno con módulo, inyectamos el contexto RAG
                # (vacío o no — el prompt builder maneja ambos casos).
                llm_messages.append(
                    {"role": "user", "content": build_rag_user_message(m["content"], context)}
                )
            else:
                llm_messages.append({"role": m["role"], "content": m["content"]})

        model = (mod or {}).get("llm_model") if mod else None

        retrieved_chunks_payload = [
            {
                "id": c.get("id"),
                "content": (c.get("content") or "")[:300],
                "similarity": c.get("similarity"),
                "source": (c.get("metadata") or {}).get("source_filename"),
            }
            for c in chunks
        ]
        chunk_ids = [c.get("id") for c in chunks]

        def event_stream():
            def fmt(event: dict) -> str:
                return f"data: {_json.dumps(event, ensure_ascii=False)}\n\n"

            # Evento meta: el frontend ya puede mostrar fuentes RAG
            yield fmt({
                "type": "meta",
                "rag_skipped": not module_id,
                "retrieved_chunks": retrieved_chunks_payload,
            })

            full_text = ""
            stream_usage = {"tokens_input": None, "tokens_output": None}

            # Iteramos manualmente para capturar el `usage` que el generator
            # devuelve via StopIteration.value (último chunk de OpenRouter).
            gen = chat_stream(llm_messages, model=model)
            try:
                while True:
                    try:
                        delta = next(gen)
                    except StopIteration as stop:
                        if isinstance(stop.value, dict):
                            stream_usage = stop.value
                        break
                    full_text += delta
                    yield fmt({"type": "token", "text": delta})
            except Exception as e:
                logger.exception("[learning] LLM stream failed")
                yield fmt({"type": "error", "detail": f"Error del modelo: {e}"})
                return

            # Mandamos 'done' ANTES de insertar — el cliente ya tiene la
            # respuesta completa, no tiene que esperar a la BD.
            yield fmt({"type": "done", "text": full_text})

            # Persistir respuesta + tokens (antes el endpoint de streaming no
            # guardaba tokens, dejando el costo de la mayoría de sesiones
            # invisible en el audit).
            try:
                insert(
                    "learning_messages",
                    {
                        "session_id": session_id,
                        "role": "assistant",
                        "content": full_text,
                        "retrieved_chunk_ids": chunk_ids,
                        "tokens_input": stream_usage.get("tokens_input"),
                        "tokens_output": stream_usage.get("tokens_output"),
                    },
                )
            except Exception:
                logger.exception("[learning] insert assistant message failed")

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # desactiva buffering en nginx si lo hay
            },
        )

    @router.post("/learning/sessions/{session_id}/transcribe")
    async def transcribe_session_audio(
        session_id: str,
        audio: UploadFile = File(...),
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Recibe un blob de audio (webm/ogg/mp3/wav) grabado en el navegador
        y devuelve el texto transcrito por Whisper. No envía el mensaje, solo
        transcribe — el frontend decide si lo manda como mensaje o lo edita."""
        _require_role_perm(staff_payload, "consume_learning")

        session = select("learning_sessions", filters={"id": session_id}, single=True)
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        if session.get("staff_id") != staff_payload.get("id"):
            raise HTTPException(status_code=403, detail="No es tu sesión")

        try:
            data = await audio.read()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"No se pudo leer el audio: {e}")

        if not data:
            raise HTTPException(status_code=400, detail="Audio vacío")
        if len(data) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio supera 25 MB (límite de Whisper)")

        filename = audio.filename or "audio.webm"
        mime = audio.content_type or "audio/webm"

        try:
            text = transcribe_audio(data, filename=filename, mime=mime, language="es")
        except Exception as e:
            logger.exception("[learning] transcribe failed")
            raise HTTPException(status_code=502, detail=f"Error transcribiendo: {e}")

        return {"success": True, "text": text}

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
            if LEARNING_USE_ELEVENLABS:
                dyn_vars = build_dynamic_variables(module, staff_payload)
                avatar_session = create_connector_session(
                    module=module, dynamic_variables=dyn_vars
                )
            else:
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

    @router.post("/learning/sessions/{session_id}/event")
    async def log_session_event(
        session_id: str,
        event: SessionEventLog,
        staff_payload: dict = Depends(verify_staff_token),
    ):
        """Persistir un evento que el frontend captó del data channel del Connector.

        Con el flujo legacy todos los mensajes los insertaba el backend porque
        el LLM corría acá. Con el Connector, ElevenLabs emite las transcripciones
        directamente en el data channel de LiveKit y el frontend nos las
        reenvía aquí para mantener `learning_messages` actualizado (auditoría +
        evaluación al final de sesión).
        """
        _require_role_perm(staff_payload, "consume_learning")

        session = select("learning_sessions", filters={"id": session_id}, single=True)
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        if session.get("staff_id") != staff_payload.get("id"):
            raise HTTPException(status_code=403, detail="No es tu sesión")

        kind = (event.kind or "").strip()
        text = (event.text or "").strip()

        if kind == "user_transcript" and text:
            try:
                insert(
                    "learning_messages",
                    {"session_id": session_id, "role": "user", "content": text},
                )
                _touch_session_activity(session_id)
            except Exception:
                logger.exception("[learning.agent] insert user transcript failed")
        elif kind == "agent_response" and text:
            try:
                insert(
                    "learning_messages",
                    {"session_id": session_id, "role": "assistant", "content": text},
                )
                _touch_session_activity(session_id)
            except Exception:
                logger.exception("[learning.agent] insert agent response failed")
        elif kind == "session_stopped":
            # El agent terminó del lado del Connector (hang up). Marcamos la
            # sesión como completed acá; el cliente igual va a llamar /end
            # para disparar la evaluación.
            try:
                sb_update(
                    "learning_sessions",
                    {"id": session_id},
                    {
                        "status": "completed",
                        "ended_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            except Exception:
                logger.exception("[learning.agent] mark session stopped failed")
        else:
            logger.info(f"[learning.agent] event ignored kind={kind!r} text_len={len(text)}")

        return {"success": True}

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

    # =====================================================================
    # PUBLIC TOOL ENDPOINT — invocado por el Agent de ElevenLabs
    # =====================================================================
    # No usa verify_staff_token porque quien llama es ElevenLabs, no un user.
    # La única defensa es el bearer secret compartido (RAG_LOOKUP_SECRET) que
    # configuramos en el tool de ElevenLabs como custom header.
    @router.post("/learning/agent/rag_lookup")
    async def agent_rag_lookup(
        request: AgentRagLookupRequest,
        authorization: Optional[str] = Header(None),
    ):
        if not RAG_LOOKUP_SECRET:
            # Si la env no está seteada, NO aceptamos llamadas — preferimos
            # romper en seguro a aceptar cualquiera.
            raise HTTPException(status_code=503, detail="RAG lookup deshabilitado (RAG_LOOKUP_SECRET no configurado)")

        expected = f"Bearer {RAG_LOOKUP_SECRET}"
        if authorization != expected:
            logger.warning("[learning.agent] rag_lookup: bearer mismatch")
            raise HTTPException(status_code=401, detail="Unauthorized")

        query = (request.query or "").strip()
        if not query:
            return {"chunks": [], "context": "", "note": "Query vacía"}

        try:
            chunks = retrieve(query, module_id=request.module_id, top_k=request.top_k or 3)
            context = format_context(chunks)
        except Exception as e:
            logger.exception("[learning.agent] rag_lookup retrieval failed")
            raise HTTPException(status_code=500, detail=f"Retrieval error: {e}")

        payload_chunks = [
            {
                "content": c.get("content"),
                "source": (c.get("metadata") or {}).get("source_filename") or "documento",
                "similarity": round(c.get("similarity") or 0, 3),
            }
            for c in chunks
        ]

        return {
            "chunks": payload_chunks,
            "context": context,
            "count": len(payload_chunks),
            "note": (
                "No hay resultados. Decile al usuario literalmente que no tenés esa "
                "información en el material del módulo y que consulte con su líder."
                if not chunks
                else "Usá EXACTAMENTE los términos, criterios y pasos que aparecen en `context`. "
                "No los parafrasees a conceptos genéricos."
            ),
        }

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

    # Snapshot inmutable: guardamos el TEXTO de cada objetivo al momento de la
    # evaluación. Si después el admin edita los objetivos del módulo, esta
    # evaluación sigue siendo legible — no quedan IDs huérfanos.
    objectives_snapshot = [
        {"id": o.get("id"), "text": o.get("text")}
        for o in objectives
    ]

    # Mezclamos el texto del objetivo dentro de cada item de objectives_covered
    # para que el frontend pueda renderizar todo sin un join contra el módulo.
    covered_raw = result.get("objectives_covered") or []
    text_by_id = {o.get("id"): o.get("text") for o in objectives}
    covered_enriched = []
    for item in covered_raw:
        if not isinstance(item, dict):
            continue
        covered_enriched.append({
            **item,
            "text": text_by_id.get(item.get("id")) or item.get("text"),
        })

    row = insert(
        "learning_evaluations",
        {
            "session_id": session_id,
            "module_id": module.get("id"),
            "staff_id": staff_id,
            "score": result.get("score"),
            "objectives_covered": covered_enriched,
            "objectives_snapshot": objectives_snapshot,
            "feedback": result.get("feedback"),
            "raw_response": result,
        },
    )
    return row
