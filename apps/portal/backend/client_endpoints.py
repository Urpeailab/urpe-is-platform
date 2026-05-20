"""
Client-facing endpoints for Pay As You Advance Visa™ system
Allows clients to view their case, upload documents, and make payments (demo mode)
"""

from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path
import uuid
import logging
import shutil
import os
from openai import AsyncOpenAI

_openai_async_client = None

def _get_openai_async_client():
    global _openai_async_client
    if _openai_async_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            _openai_async_client = AsyncOpenAI(api_key=api_key)
    return _openai_async_client

logger = logging.getLogger(__name__)

# Import audit logging
from routes.audit import log_case_audit, AuditActionTypes

# Este router será importado en server.py
client_router = APIRouter(prefix="/api/client", tags=["client"])

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class DocumentUploadRequest(BaseModel):
    documentId: str
    fileName: str
    fileUrl: str  # In demo mode, this will be a mock URL
    fileSize: int
    notes: Optional[str] = None

class FileNoteAddRequest(BaseModel):
    text: str

class PaymentCreateRequest(BaseModel):
    caseId: str
    stageNumber: int
    amount: float
    paymentMethod: str = "demo_card"  # Demo payment method

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _file_note_thread(file_obj: dict) -> list:
    """Return the conversation thread for a single uploaded file.

    Folds the legacy single-shot `clientNote` into the first entry when the
    array hasn't been initialized yet, so older uploads display in the new UI
    without a backfill migration."""
    thread = file_obj.get('noteThread')
    if isinstance(thread, list) and thread:
        return list(thread)
    legacy = file_obj.get('clientNote') or {}
    if legacy.get('text'):
        return [{
            'id': legacy.get('id') or 'legacy-client-note',
            'text': legacy.get('text'),
            'authorId': legacy.get('authorId'),
            'authorName': legacy.get('authorName') or 'Cliente',
            'authorRole': legacy.get('authorRole') or 'client',
            'createdAt': legacy.get('createdAt'),
        }]
    return []


async def get_client_case(db, user_id: str):
    """Get the active visa case for a client"""
    from bson import ObjectId
    
    logger.info(f"🔍 get_client_case called with user_id: {user_id} (type: {type(user_id)})")
    
    # Try with ObjectId first, then string
    try:
        user_id_obj = ObjectId(user_id)
        logger.info(f"   Converted to ObjectId: {user_id_obj}")
        case = await db.visa_cases.find_one({
            'userId': user_id_obj,
            'status': {'$nin': ['completed', 'cancelled']}
        })
        logger.info(f"   Case found with ObjectId: {case is not None}")
        if case:
            logger.info(f"   ✅ Returning case: {case['_id']}")
            return case
    except Exception as e:
        logger.error(f"   Error with ObjectId: {e}")
    
    # Try with string
    logger.info("   Trying with string...")
    case = await db.visa_cases.find_one({
        'userId': user_id,
        'status': {'$nin': ['completed', 'cancelled']}
    })
    logger.info(f"   Case found with string: {case is not None}")
    
    if not case:
        logger.warning(f"   ❌ No case found for user_id: {user_id}")
    
    return case

def generate_mock_file_url(filename: str) -> str:
    """Generate a mock file URL for demo mode"""
    return f"https://demo-storage.urpe.com/documents/{uuid.uuid4()}/{filename}"


def _filter_visible_notes_thread(thread, legacy_text=None, legacy_visible=False, legacy_at=None):
    """Return only the notes marked visible to the client, falling back to a
    synthetic legacy entry when there is no thread but a single legacy note."""
    safe = list(thread) if isinstance(thread, list) else []
    if not safe and isinstance(legacy_text, str) and legacy_text.strip():
        safe = [{
            'id': 'legacy',
            'text': legacy_text,
            'visibleToClient': bool(legacy_visible),
            'createdAt': legacy_at,
        }]
    return [
        {'id': n.get('id'), 'text': n.get('text'), 'createdAt': n.get('createdAt')}
        for n in safe
        if isinstance(n, dict) and n.get('visibleToClient')
    ]


def _sanitize_client_documents(documents):
    """In-place: keep only client-visible notes and strip staff-private fields."""
    for doc in documents or []:
        if not isinstance(doc, dict):
            continue
        doc['notes'] = _filter_visible_notes_thread(
            doc.get('notes'),
            legacy_text=doc.get('note'),
            legacy_visible=doc.get('noteVisibleToClient'),
            legacy_at=doc.get('noteUpdatedAt') or doc.get('updatedAt'),
        )
        if not doc.get('noteVisibleToClient'):
            doc.pop('note', None)
        for k in ('noteVisibleToClient', 'noteUpdatedBy', 'noteUpdatedAt'):
            doc.pop(k, None)


def _sanitize_client_deliverables(deliverables):
    """In-place: keep only client-visible note entries inside each file and
    strip staff-private fields. Also normalizes the file-level files array.
    Files con `published=False` se ocultan del cliente (son borradores internos)."""
    for d in deliverables or []:
        if not isinstance(d, dict):
            continue
        raw_files = d.get('files') or []
        # Filtrar borradores antes de exponerlos al cliente. Si no hay flag,
        # asumimos published=True (default histórico).
        files = [f for f in raw_files if not (isinstance(f, dict) and f.get('published') is False)]
        file_url = d.get('file_url') or d.get('fileUrl')
        has_files = len(files) > 0 or (file_url and isinstance(file_url, str) and file_url.strip())
        if not has_files:
            d['files'] = []
            d['fileName'] = None
            d['fileUrl'] = None
            if d.get('status') not in ('pending',):
                d['status'] = 'pending'
            continue

        sanitized_files = []
        for f in files:
            if not isinstance(f, dict):
                sanitized_files.append(f)
                continue
            clean = dict(f)
            clean['noteEntries'] = _filter_visible_notes_thread(
                clean.get('noteEntries'),
                legacy_text=clean.get('note') or clean.get('notes'),
                legacy_visible=clean.get('noteVisibleToClient'),
                legacy_at=clean.get('noteUpdatedAt') or clean.get('uploadedAt'),
            )
            if not clean.get('noteVisibleToClient'):
                clean.pop('note', None)
                clean.pop('notes', None)
            for k in ('uploadedBy', 'uploadedByName', 'noteUpdatedBy',
                      'noteUpdatedAt', 'noteVisibleToClient', 'clientNotified',
                      'published'):
                clean.pop(k, None)
            sanitized_files.append(clean)
        d['files'] = sanitized_files

# =============================================================================
# CLIENT ENDPOINTS
# =============================================================================

def setup_client_endpoints(db, verify_token):
    """Setup client endpoints with database and auth dependencies"""
    
    def serialize_doc(doc):
        """Convert MongoDB document to JSON-serializable format"""
        if not doc:
            return doc
        from bson import ObjectId
        if isinstance(doc, list):
            return [serialize_doc(item) for item in doc]
        if isinstance(doc, dict):
            return {k: str(v) if isinstance(v, ObjectId) else serialize_doc(v) if isinstance(v, (dict, list)) else v 
                    for k, v in doc.items()}
        return doc
    
    @client_router.get("/my-case")
    async def get_my_case(user_payload: dict = Depends(verify_token)):
        """Get the client's active visa case with all details (Supabase)"""
        try:
            from db.supabase_client import select as sb_select

            user_id = user_payload.get('id')

            # Get case (exclude master case)
            cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
            case = next((c for c in cases if not c.get('is_master_case')), None)
            if not case:
                raise HTTPException(status_code=404, detail="No active visa case found")

            case_id = case.get('id')

            # Get stages, deliverables, documents, payments
            stages = sb_select("visa_stages", filters={"case_id": case_id}, order="stage_number", order_desc=False)
            deliverables = sb_select("visa_deliverables", filters={"case_id": case_id}, limit=200)
            documents = sb_select("visa_documents", filters={"case_id": case_id}, limit=200)
            payments = sb_select("payments", filters={"case_id": case_id}, order="created_at", order_desc=True)

            _sanitize_client_documents(documents)
            _sanitize_client_deliverables(deliverables)

            # Process payments
            for p in payments:
                p['paymentSource'] = 'manual'
                p['paidAt'] = p.get('paid_at') or p.get('paidAt') or p.get('created_at')
                sn = p.get('stage_numbers') or p.get('stageNumbers')
                if sn and isinstance(sn, list) and len(sn) > 0:
                    p['concept'] = f"Etapa(s) {', '.join(str(s) for s in sn)}"
                else:
                    p['concept'] = f"Etapa {p.get('stage_number') or p.get('stageNumber', '?')}"

            # Calculate progress
            completed_stages = []
            unlocked_stages = []
            for stage in stages:
                sn = stage.get('stage_number') or stage.get('stageNumber')
                is_paid = stage.get('is_paid') or stage.get('isPaid', False)
                status = stage.get('status', 'locked')
                if is_paid or status == 'completed':
                    completed_stages.append(sn)
                if status == 'unlocked':
                    unlocked_stages.append(sn)

            total_stages = len(stages)
            completed_count = len(completed_stages)
            real_progress = round((completed_count / total_stages) * 100) if total_stages > 0 else 0

            total_invested = sum(float(p.get('amount', 0) or 0) for p in payments if p.get('status') == 'completed')
            total_case_value = sum(float(s.get('amount', 0) or 0) for s in stages)

            # Add staff names
            coord_id = case.get('coordinator_id') or case.get('coordinatorId')
            advisor_id = case.get('advisor_id') or case.get('advisorId')
            if coord_id:
                coord = sb_select("staff", filters={"id": coord_id}, columns="name", single=True)
                if coord:
                    case['coordinatorName'] = coord.get('name', '')
            if advisor_id:
                advisor = sb_select("staff", filters={"id": advisor_id}, columns="name", single=True)
                if advisor:
                    case['salesRepName'] = advisor.get('name', '')
                    case['advisorName'] = advisor.get('name', '')

            return {
                'success': True,
                'case': case,
                'stages': stages,
                'deliverables': deliverables,
                'documents': documents,
                'payments': payments,
                'progress': {
                    'paidStages': completed_stages,
                    'completedStages': completed_stages,
                    'unlockedStages': unlocked_stages,
                    'currentStage': case.get('current_stage') or case.get('currentStage', 1),
                    'overallProgress': real_progress,
                    'totalStages': total_stages,
                    'completedCount': completed_count
                },
                'financials': {
                    'totalInvested': total_invested,
                    'totalCaseValue': total_case_value
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get my case error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.get("/my-case/deliverables")
    async def get_my_deliverables(
        stage: Optional[int] = None,
        user_payload: dict = Depends(verify_token)
    ):
        """Get deliverables for client's case (Supabase)"""
        try:
            from db.supabase_client import select as sb_select
            user_id = user_payload.get('id')

            cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
            case = next((c for c in cases if not c.get('is_master_case')), None)
            if not case:
                raise HTTPException(status_code=404, detail="No active visa case found")

            filters = {"case_id": case['id']}
            if stage:
                filters["stage_number"] = stage

            deliverables = sb_select("visa_deliverables", filters=filters, order="stage_number", order_desc=False, limit=200)
            _sanitize_client_deliverables(deliverables)

            return {
                'success': True,
                'deliverables': deliverables,
                'count': len(deliverables)
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get deliverables error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.get("/documents")
    async def get_my_documents(user_payload: dict = Depends(verify_token)):
        """Get client's uploaded documents (Supabase)"""
        try:
            from db.supabase_client import select as sb_select
            user_id = user_payload.get('id')

            cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
            case = next((c for c in cases if not c.get('is_master_case')), None)
            if not case:
                raise HTTPException(status_code=404, detail="No active visa case found")

            documents = sb_select("visa_documents", filters={"case_id": case['id']}, limit=200)
            _sanitize_client_documents(documents)

            grouped = {'pending': [], 'uploaded': [], 'validated': [], 'rejected': []}
            for doc in documents:
                status = doc.get('status', 'pending')
                if status not in grouped:
                    status = 'pending'
                grouped[status].append(doc)

            return {
                'success': True,
                'documents': documents,
                'grouped': grouped,
                'stats': {
                    'total': len(documents),
                    'pending': len(grouped['pending']),
                    'uploaded': len(grouped['uploaded']),
                    'validated': len(grouped['validated']),
                    'rejected': len(grouped['rejected'])
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get documents error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.post("/documents/upload")
    async def upload_document(
        request: DocumentUploadRequest,
        user_payload: dict = Depends(verify_token)
    ):
        """Upload a document (demo mode - simulates file upload)"""
        try:
            user_id = user_payload.get('id') or user_payload.get('_id')
            
            # Verify document exists and belongs to user's case
            document = await db.visa_client_documents.find_one({'_id': request.documentId})
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Verify ownership
            case = await db.visa_cases.find_one({'_id': document.get('caseId')})
            if not case or case.get('userId') != user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            
            # In demo mode, generate mock URL if not provided
            file_url = request.fileUrl
            if not file_url or file_url == "":
                file_url = generate_mock_file_url(request.fileName)
            
            # Update document
            update_data = {
                'fileName': request.fileName,
                'fileUrl': file_url,
                'fileSize': request.fileSize,
                'status': 'uploaded',
                'uploadedAt': datetime.now(timezone.utc).isoformat(),
                'notes': request.notes,
                'updatedAt': datetime.now(timezone.utc).isoformat()
            }
            
            await db.visa_client_documents.update_one(
                {'_id': request.documentId},
                {'$set': update_data}
            )
            
            logger.info(f"Document uploaded: {request.documentId} by user {user_id}")
            
            return {
                'success': True,
                'message': 'Document uploaded successfully',
                'documentId': request.documentId,
                'fileUrl': file_url
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Upload document error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.post("/documents/{document_id}/upload")
    async def upload_document_by_id(
        document_id: str,
        file: UploadFile = File(...),
        note: Optional[str] = Form(None),
        user_payload: dict = Depends(verify_token)
    ):
        """Upload a file for a specific document requirement (Supabase).

        El cliente puede adjuntar una nota/observación que queda asociada al
        archivo. La nota es inmutable (no se permite editarla desde el admin).
        """
        try:
            from storage_service import upload_file as supabase_upload
            from db.supabase_client import select as sb_select, update as sb_update

            user_id = user_payload.get('id')
            client_name = user_payload.get('name') or 'Cliente'
            # Si el JWT no trae el nombre, intentar leerlo de clients
            if client_name == 'Cliente':
                cl = sb_select("clients", filters={"id": user_id}, columns="name", single=True)
                if cl and cl.get('name'):
                    client_name = cl['name']

            # Verify user has a case
            cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
            case = next((c for c in cases if not c.get('is_master_case')), None)
            if not case:
                raise HTTPException(status_code=404, detail="No tienes un caso activo")

            # Verify document exists and belongs to user's case
            doc = sb_select("visa_documents", filters={"id": document_id}, single=True)
            if not doc:
                raise HTTPException(status_code=404, detail="Documento no encontrado")

            doc_case_id = doc.get('case_id') or doc.get('caseId')
            if doc_case_id != case.get('id'):
                raise HTTPException(status_code=403, detail="No tienes acceso a este documento")

            # Read and upload file
            file_content = await file.read()
            result = supabase_upload(
                file_content=file_content,
                filename=file.filename,
                folder=f"client-documents/{user_id}"
            )
            if not result.get('success'):
                raise HTTPException(status_code=500, detail=f"Error uploading to storage: {result.get('error', 'Unknown error')}")

            # Build files array
            note_text = (note or '').strip()
            now_iso = datetime.now(timezone.utc).isoformat()
            new_file = {
                'id': str(uuid.uuid4()),
                'fileName': file.filename,
                'fileUrl': result['fileUrl'],
                'fileSize': len(file_content),
                'uploadedAt': now_iso,
                'uploadedBy': str(user_id),
                'uploadedByName': client_name,
                'uploadedByRole': 'client',
            }
            if note_text:
                # Nota del cliente: inmutable. Guardamos quién la escribió y cuándo.
                new_file['clientNote'] = {
                    'text': note_text,
                    'authorId': str(user_id),
                    'authorName': client_name,
                    'authorRole': 'client',
                    'createdAt': now_iso,
                }
            existing_files = doc.get('files') or []
            if not existing_files and doc.get('file_url'):
                existing_files = [{'id': str(uuid.uuid4()), 'fileName': doc.get('file_name', 'archivo'), 'fileUrl': doc.get('file_url')}]
            existing_files.append(new_file)

            # Update document (only valid columns)
            sb_update("visa_documents", filters={"id": document_id}, data={
                'status': 'uploaded',
                'files': existing_files,
                'file_url': result['fileUrl'],
                'file_name': file.filename,
            })

            logger.info(f"Client document uploaded: {document_id} by user {user_id} (total files: {len(existing_files)})")

            # Audit log
            case_id = case.get('id')
            user_name = user_payload.get('name', 'Cliente')
            doc_name_field = doc.get('name')
            doc_name = (doc_name_field.get('es') if isinstance(doc_name_field, dict) else str(doc_name_field or '')) or doc.get('document_name') or 'Documento'
            await log_case_audit(
                case_id=case_id,
                action=f"Documento '{doc_name}' subido por el cliente",
                action_type=AuditActionTypes.DOCUMENT_UPLOADED,
                performed_by_id=str(user_id),
                performed_by_name=user_name,
                performed_by_role='client',
                details={'documentId': document_id, 'fileName': file.filename, 'totalFiles': len(existing_files)}
            )

            # Notify coordinator + seller via email
            try:
                from services.case_notifications import _send_email, _email_wrapper, FRONTEND_URL
                coord_id = case.get('coordinator_id') or case.get('coordinatorId')
                advisor_id = case.get('advisor_id') or case.get('advisorId')

                staff_to_notify = []
                if coord_id:
                    coord = sb_select("staff", filters={"id": coord_id}, columns="name,email", single=True)
                    if coord and coord.get('email'):
                        staff_to_notify.append(coord)
                if advisor_id and advisor_id != coord_id:
                    advisor = sb_select("staff", filters={"id": advisor_id}, columns="name,email", single=True)
                    if advisor and advisor.get('email'):
                        staff_to_notify.append(advisor)

                if staff_to_notify:
                    subject = f"Nuevo documento: {user_name} subió {doc_name}"
                    import html as _htmllib
                    note_html = (
                        f'<p style="margin:8px 0 0;padding:8px 10px;background:#FEF3C7;border-left:3px solid #F59E0B;border-radius:4px;font-size:13px;color:#78350F;"><strong>Nota del cliente:</strong> {_htmllib.escape(note_text)}</p>'
                        if note_text else ''
                    )
                    body = f"""
                    <p>El cliente <strong>{user_name}</strong> ha subido un documento a su caso:</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;">
                      <tr>
                        <td style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;">
                          <p style="margin:0 0 4px;font-size:13px;color:#1E40AF;">Documento subido por el cliente</p>
                          <p style="margin:0;font-size:17px;font-weight:700;color:#0F172A;">{doc_name}</p>
                          <p style="margin:8px 0 0;font-size:13px;color:#64748B;">Archivo: {file.filename}</p>
                          {note_html}
                        </td>
                      </tr>
                    </table>
                    <p>Ingresa al panel de administración para revisar el documento y <strong>validarlo</strong> o <strong>rechazarlo</strong>.</p>
                    """
                    for staff_member in staff_to_notify:
                        html = _email_wrapper(staff_member.get('name', 'Equipo'), "Documento pendiente de revisión", body, "Revisar documento", f"{FRONTEND_URL}/admin/visa-cases/{case_id}")
                        _send_email(staff_member['email'], subject, html)
                        logger.info(f"📧 Client upload notification sent to {staff_member['email']}")
            except Exception as notif_err:
                logger.warning(f"Client upload notification failed (non-critical): {notif_err}")

            return {
                "message": "Documento subido exitosamente",
                "documentId": document_id,
                "fileUrl": result['fileUrl'],
                "fileName": file.filename,
                "status": "uploaded",
                "totalFiles": len(existing_files),
                "files": existing_files
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading document {document_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error al subir el documento: {str(e)}")
    
    @client_router.post("/documents/{document_id}/files/{file_id}/notes")
    async def add_file_note_client(
        document_id: str,
        file_id: str,
        request: FileNoteAddRequest,
        user_payload: dict = Depends(verify_token)
    ):
        """Append a client reply to a file's note thread. Notifies the
        coordinator/advisor by email so they see the response in their inbox."""
        try:
            from db.supabase_client import select as sb_select, update as sb_update

            text = (request.text or '').strip()
            if not text:
                raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")
            if len(text) > 1000:
                raise HTTPException(status_code=400, detail="El mensaje no puede exceder 1000 caracteres")

            user_id = user_payload.get('id')
            client_name = user_payload.get('name') or 'Cliente'
            if client_name == 'Cliente':
                cl = sb_select("clients", filters={"id": user_id}, columns="name", single=True)
                if cl and cl.get('name'):
                    client_name = cl['name']

            # Verify case ownership
            cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
            case = next((c for c in cases if not c.get('is_master_case')), None)
            if not case:
                raise HTTPException(status_code=404, detail="No tienes un caso activo")

            doc = sb_select("visa_documents", filters={"id": document_id}, single=True)
            if not doc:
                raise HTTPException(status_code=404, detail="Documento no encontrado")
            if (doc.get('case_id') or doc.get('caseId')) != case.get('id'):
                raise HTTPException(status_code=403, detail="No tienes acceso a este documento")

            files = doc.get('files') or []
            target = next((f for f in files if f.get('id') == file_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Archivo no encontrado")

            now_iso = datetime.now(timezone.utc).isoformat()
            thread = _file_note_thread(target)
            entry = {
                'id': str(uuid.uuid4()),
                'text': text,
                'authorId': str(user_id),
                'authorName': client_name,
                'authorRole': 'client',
                'createdAt': now_iso,
            }
            thread.append(entry)
            target['noteThread'] = thread

            sb_update("visa_documents", filters={"id": document_id}, data={'files': files})

            # Notify coordinator + advisor
            try:
                from services.case_notifications import _send_email, _email_wrapper, FRONTEND_URL
                coord_id = case.get('coordinator_id') or case.get('coordinatorId')
                advisor_id = case.get('advisor_id') or case.get('advisorId')
                staff_to_notify = []
                if coord_id:
                    coord = sb_select("staff", filters={"id": coord_id}, columns="name,email", single=True)
                    if coord and coord.get('email'):
                        staff_to_notify.append(coord)
                if advisor_id and advisor_id != coord_id:
                    advisor = sb_select("staff", filters={"id": advisor_id}, columns="name,email", single=True)
                    if advisor and advisor.get('email'):
                        staff_to_notify.append(advisor)

                if staff_to_notify:
                    doc_name_field = doc.get('name')
                    doc_name = (doc_name_field.get('es') if isinstance(doc_name_field, dict) else str(doc_name_field or '')) or doc.get('document_name') or 'Documento'
                    case_id = case.get('id')
                    subject = f"Respuesta del cliente: {client_name} en {doc_name}"
                    import html as _htmllib
                    body = f"""
                    <p>El cliente <strong>{client_name}</strong> respondió en el hilo del archivo <strong>{_htmllib.escape(target.get('fileName') or '')}</strong> ({doc_name}):</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;">
                      <tr>
                        <td style="background:#FEF3C7;border-left:3px solid #F59E0B;border-radius:8px;padding:16px;">
                          <p style="margin:0;font-size:14px;color:#78350F;white-space:pre-wrap;">{_htmllib.escape(text)}</p>
                        </td>
                      </tr>
                    </table>
                    <p>Ingresa al panel para revisar y responder.</p>
                    """
                    for staff_member in staff_to_notify:
                        html_body = _email_wrapper(staff_member.get('name', 'Equipo'), "Respuesta del cliente", body, "Ver caso", f"{FRONTEND_URL}/admin/visa-cases/{case_id}")
                        _send_email(staff_member['email'], subject, html_body)
            except Exception as notif_err:
                logger.warning(f"Client reply notification failed (non-critical): {notif_err}")

            return {'success': True, 'note': entry, 'thread': thread}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Add file note (client) error: {e}")
            raise HTTPException(status_code=500, detail=f"Error al guardar la nota: {str(e)}")

    @client_router.delete("/documents/{document_id}/files/{file_id}")
    async def delete_document_file(
        document_id: str,
        file_id: str,
        user_payload: dict = Depends(verify_token)
    ):
        """
        Delete a specific file from a document's files array.
        """
        try:
            user_id = user_payload.get('id') or user_payload.get('_id')
            
            # Verify user has a case
            case = await get_client_case(db, user_id)
            if not case:
                raise HTTPException(status_code=404, detail="No tienes un caso activo")
            
            # Verify document exists
            doc = await db.visa_client_documents.find_one({'_id': document_id})
            if not doc:
                doc = await db.visa_client_documents.find_one({'id': document_id})
            
            if not doc:
                raise HTTPException(status_code=404, detail="Documento no encontrado")
            
            if doc.get('caseId') != case.get('_id') and doc.get('caseId') != case.get('id'):
                raise HTTPException(status_code=403, detail="No tienes acceso a este documento")
            
            # Get files array and remove the specified file
            files = doc.get('files', [])
            updated_files = [f for f in files if f.get('id') != file_id]
            
            if len(updated_files) == len(files):
                raise HTTPException(status_code=404, detail="Archivo no encontrado")
            
            # Update document
            update_data = {
                'files': updated_files,
                'updatedAt': datetime.utcnow().isoformat()
            }
            
            # If no files left, reset status to pending
            if len(updated_files) == 0:
                update_data['status'] = 'pending'
                update_data['fileUrl'] = None
                update_data['fileName'] = None
            else:
                # Update fileUrl to last file for backward compatibility
                update_data['fileUrl'] = updated_files[-1].get('fileUrl')
                update_data['fileName'] = updated_files[-1].get('fileName')
            
            await db.visa_client_documents.update_one(
                {'_id': document_id},
                {'$set': update_data}
            )
            
            logger.info(f"File {file_id} deleted from document {document_id} by user {user_id}")
            
            return {
                "message": "Archivo eliminado exitosamente",
                "documentId": document_id,
                "remainingFiles": len(updated_files)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting file from document {document_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error al eliminar el archivo: {str(e)}")

    @client_router.post("/documents/upload-file")
    async def upload_document_file(
        file: UploadFile = File(...),
        user_payload: dict = Depends(verify_token)
    ):
        """
        Upload a document file to Supabase Storage for clients and return the file URL
        """
        try:
            from storage_service import upload_file as supabase_upload
            
            user_id = user_payload.get('id') or user_payload.get('_id')
            
            # Leer contenido del archivo
            file_content = await file.read()
            
            # Subir a Supabase Storage
            result = supabase_upload(
                file_content=file_content,
                filename=file.filename,
                folder="documents"  # Carpeta específica para documentos de clientes
            )
            
            if not result.get('success'):
                raise HTTPException(
                    status_code=500, 
                    detail=f"Error uploading to Supabase: {result.get('error', 'Unknown error')}"
                )
            
            logger.info(f"Client document file uploaded to Supabase by user {user_id}: {result['filePath']}")
            
            return {
                "message": "File uploaded successfully to Supabase Storage",
                "fileUrl": result['fileUrl'],  # URL pública de Supabase
                "fileName": file.filename,
                "fileSize": len(file_content),
                "filePath": result['filePath']
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading client document file: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

    @client_router.post("/payments/create")
    async def create_payment(
        request: PaymentCreateRequest,
        user_payload: dict = Depends(verify_token)
    ):
        """Create a payment for a stage (demo mode - simulates Stripe payment)"""
        try:
            user_id = user_payload.get('id') or user_payload.get('_id')
            
            # Verify case ownership
            case = await db.visa_cases.find_one({'_id': request.caseId})
            if not case or case.get('userId') != user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            
            # Verify stage exists
            stage = await db.visa_stages.find_one({
                'caseId': request.caseId,
                'stageNumber': request.stageNumber
            })
            if not stage:
                raise HTTPException(status_code=404, detail="Stage not found")
            
            # Check if already paid
            existing_payment = await db.visa_payments.find_one({
                'caseId': request.caseId,
                'stageNumber': request.stageNumber,
                'status': 'completed'
            })
            if existing_payment:
                raise HTTPException(status_code=400, detail="Stage already paid")
            
            # Create payment record (DEMO MODE - auto-approve)
            payment_id = str(uuid.uuid4())
            payment = {
                '_id': payment_id,
                'id': payment_id,
                'caseId': request.caseId,
                'stageNumber': request.stageNumber,
                'amount': request.amount,
                'currency': 'USD',
                'status': 'completed',  # Demo: instant approval
                'paymentMethod': 'demo_card',  # Demo method
                'transactionId': f'demo_txn_{uuid.uuid4().hex[:12]}',  # Demo transaction
                'paidBy': user_id,
                'paidAt': datetime.now(timezone.utc).isoformat(),
                'notes': 'Demo payment - processed instantly',
                'createdAt': datetime.now(timezone.utc).isoformat()
            }
            
            await db.visa_payments.insert_one(payment)
            
            # Unlock stage and deliverables
            await db.visa_stages.update_one(
                {'_id': stage.get('_id')},
                {'$set': {
                    'status': 'unlocked',
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Unlock deliverables for this stage
            await db.visa_deliverables.update_many(
                {
                    'caseId': request.caseId,
                    'stageNumber': request.stageNumber,
                    'status': 'draft'
                },
                {'$set': {
                    'status': 'unlocked',
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update case progress
            await db.visa_cases.update_one(
                {'_id': request.caseId},
                {'$set': {
                    'currentStage': request.stageNumber,
                    'overallProgress': request.stageNumber * 25,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"Demo payment created: {payment_id} for stage {request.stageNumber}")
            
            return {
                'success': True,
                'message': 'Payment processed successfully (demo mode)',
                'payment': payment,
                'stageUnlocked': True
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Create payment error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.get("/payments")
    async def get_my_payments(user_payload: dict = Depends(verify_token)):
        """Get payment history for client's case (Supabase)"""
        try:
            from db.supabase_client import select as sb_select
            user_id = user_payload.get('id')

            cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
            case = next((c for c in cases if not c.get('is_master_case')), None)
            if not case:
                raise HTTPException(status_code=404, detail="No active visa case found")

            payments = sb_select("payments", filters={"case_id": case['id']}, order="created_at", order_desc=True, limit=200)

            # Stage names for concepts
            stages = sb_select("visa_stages", filters={"case_id": case['id']}, limit=100)
            stage_name_map = {}
            for s in stages:
                sn = s.get('stage_number') or s.get('stageNumber')
                name_field = s.get('name')
                if isinstance(name_field, dict):
                    stage_name_map[sn] = name_field.get('es') or name_field.get('en') or f"Etapa {sn}"
                else:
                    stage_name_map[sn] = str(name_field) if name_field else f"Etapa {sn}"

            for p in payments:
                p['paymentSource'] = 'manual'
                p['paidAt'] = p.get('paid_at') or p.get('paidAt') or p.get('created_at')
                stage_nums = p.get('stage_numbers') or p.get('stageNumbers') or []
                if stage_nums and isinstance(stage_nums, list):
                    names = [stage_name_map.get(n, f"Etapa {n}") for n in stage_nums]
                    p['concept'] = " + ".join(names)
                else:
                    sn = p.get('stage_number') or p.get('stageNumber')
                    p['concept'] = stage_name_map.get(sn, f"Etapa {sn or '?'}")

            total_paid = sum(float(p.get('amount', 0) or 0) for p in payments if p.get('status') == 'completed')
            total_pending = sum(float(p.get('amount', 0) or 0) for p in payments if p.get('status') == 'pending')

            return {
                'success': True,
                'payments': payments,
                'summary': {
                    'totalPaid': total_paid,
                    'totalPending': total_pending,
                    'count': len(payments),
                    'clientPayments': 0,
                    'manualPayments': len(payments)
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get payments error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.get("/notifications")
    async def get_notifications(user_payload: dict = Depends(verify_token)):
        """Get notifications for document validations/rejections"""
        try:
            user_id = user_payload.get('id') or user_payload.get('_id')
            
            case = await get_client_case(db, user_id)
            if not case:
                return {
                    'success': True,
                    'notifications': [],
                    'unreadCount': 0
                }
            
            case_id = case.get('id') or case.get('_id')
            
            # Get recent document updates (validated or rejected)
            documents_cursor = db.visa_client_documents.find({
                'caseId': case_id,
                'status': {'$in': ['validated', 'rejected']},
                'reviewedAt': {'$exists': True}
            }).sort('reviewedAt', -1).limit(10)
            
            documents = await documents_cursor.to_list(length=None)
            
            notifications = []
            for doc in documents:
                notifications.append({
                    'id': str(uuid.uuid4()),
                    'type': 'document_validated' if doc.get('status') == 'validated' else 'document_rejected',
                    'documentId': doc.get('_id'),
                    'documentName': doc.get('name', {}).get('es', 'Documento'),
                    'status': doc.get('status'),
                    'message': doc.get('rejectionReason') if doc.get('status') == 'rejected' else 'Documento validado correctamente',
                    'timestamp': doc.get('reviewedAt'),
                    'read': False
                })
            
            return {
                'success': True,
                'notifications': notifications,
                'unreadCount': len(notifications)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Get notifications error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @client_router.post("/my-case/create")
    async def create_my_case(
        user_payload: dict = Depends(verify_token),
        templateId: str = None
    ):
        """Allow client to create their own visa case - uses master case template from MongoDB"""
        try:
            user_id = user_payload.get('id') or user_payload.get('_id')
            
            # Check if user already has an active case
            existing_case = await get_client_case(db, user_id)
            if existing_case:
                raise HTTPException(status_code=400, detail="You already have an active case")
            
            # Use master case from MongoDB instead of hardcoded templates
            MASTER_CASE_ID = "master_case_eb2_niw"
            master_case = await db.visa_cases.find_one({"caseId": MASTER_CASE_ID, "isMasterCase": True})
            
            if not master_case:
                raise HTTPException(status_code=500, detail="Master case template not found in database")
            
            # Create case
            case_id = str(uuid.uuid4())
            case = {
                '_id': case_id,
                'id': case_id,
                'caseId': case_id,
                'userId': user_id,
                'visaType': master_case.get("visaType", "EB-2 NIW"),
                'coordinatorId': None,  # Will be assigned later by admin
                'status': 'eligibility_approved',
                'currentStage': 1,
                'overallProgress': 0,
                'eligibilityDate': datetime.now(timezone.utc).isoformat(),
                'notes': 'Case created from master template',
                'createdAt': datetime.now(timezone.utc).isoformat(),
                'updatedAt': datetime.now(timezone.utc).isoformat()
            }
            
            await db.visa_cases.insert_one(case)
            logger.info(f"✅ Case created: {case_id} for user {user_id}")
            
            # Copy stages from master case
            master_stages_cursor = db.visa_stages.find({'caseId': MASTER_CASE_ID}).sort('stageNumber', 1)
            master_stages = await master_stages_cursor.to_list(length=None)
            
            logger.info(f"📋 Copying {len(master_stages)} stages from master case...")
            
            stages = []
            for master_stage in master_stages:
                stage_id = str(uuid.uuid4())
                stage = {
                    "_id": stage_id,
                    "id": stage_id,
                    "caseId": case_id,
                    "stageNumber": master_stage["stageNumber"],
                    "name": master_stage["name"],
                    "description": master_stage.get("description", ""),
                    "percentage": master_stage.get("percentage", 0),
                    "amount": master_stage.get("amount", 0),
                    "status": master_stage.get("status", "locked"),
                    "isPaid": False,  # Always start as unpaid for new cases
                    "completedDeliverablesCount": 0,
                    "totalDeliverablesCount": master_stage.get("totalDeliverablesCount", 0),
                    "startDate": None,
                    "completionDate": None,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                stages.append(stage)
            
            if stages:
                await db.visa_stages.insert_many(stages)
                logger.info(f"✅ Created {len(stages)} stages for case {case_id}")
            
            # Copy deliverables from master case
            master_deliverables_cursor = db.visa_deliverables.find({'caseId': MASTER_CASE_ID})
            master_deliverables = await master_deliverables_cursor.to_list(length=None)
            
            logger.info(f"📦 Copying {len(master_deliverables)} deliverables from master case...")
            
            all_deliverables = []
            stage_id_map = {s["stageNumber"]: s["_id"] for s in stages}
            
            for master_deliv in master_deliverables:
                deliverable_id = str(uuid.uuid4())
                new_stage_id = stage_id_map.get(master_deliv["stageNumber"])
                
                deliverable = {
                    "_id": deliverable_id,
                    "id": deliverable_id,
                    "caseId": case_id,
                    "stageId": new_stage_id,
                    "stageNumber": master_deliv["stageNumber"],
                    "deliverableName": master_deliv.get("deliverableName", ""),
                    "name": master_deliv.get("name", {}),
                    "description": master_deliv.get("description", ""),
                    "status": "draft",
                    "fileUrl": None,
                    "fileName": None,
                    "fileSize": None,
                    "uploadedAt": None,
                    "uploadedBy": None,
                    "validatedAt": None,
                    "validatedBy": None,
                    "notes": None,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                all_deliverables.append(deliverable)
            
            if all_deliverables:
                await db.visa_deliverables.insert_many(all_deliverables)
                logger.info(f"✅ Created {len(all_deliverables)} deliverables")
            
            # Copy required documents from master case
            master_documents_cursor = db.visa_client_documents.find({'caseId': MASTER_CASE_ID})
            master_documents = await master_documents_cursor.to_list(length=None)
            
            logger.info(f"📄 Copying {len(master_documents)} required documents from master case...")
            
            all_documents = []
            for master_doc in master_documents:
                document_id = str(uuid.uuid4())
                document = {
                    "_id": document_id,
                    "id": document_id,
                    "caseId": case_id,
                    "stageNumber": master_doc["stageNumber"],
                    "documentName": master_doc.get("documentName", ""),
                    "name": master_doc.get("name", {}),
                    "description": master_doc.get("description", ""),
                    "status": "pending",
                    "required": master_doc.get("required", False),
                    "requiresPhysicalCopy": master_doc.get("requiresPhysicalCopy", False),
                    "fileUrl": None,
                    "fileName": None,
                    "fileSize": None,
                    "uploadedAt": None,
                    "reviewedAt": None,
                    "reviewedBy": None,
                    "rejectionReason": None,
                    "notes": None,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                all_documents.append(document)
            
            if all_documents:
                await db.visa_client_documents.insert_many(all_documents)
                logger.info(f"✅ Created {len(all_documents)} required documents")
            
            logger.info(f"✅ Case creation complete: {case_id}")
            logger.info(f"   - {len(stages)} stages")
            logger.info(f"   - {len(all_deliverables)} deliverables")
            logger.info(f"   - {len(all_documents)} required documents")
            
            return {
                'success': True,
                'message': 'Case created successfully from master template',
                'case': serialize_doc(case),
                'stages': serialize_doc(stages),
                'deliverables': serialize_doc(all_deliverables),
                'documents': serialize_doc(all_documents)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Create my case error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # =========================================================================
    # BOOK PREPARATION ENDPOINTS (Idea & Title selection by client)
    # =========================================================================

    @client_router.get("/book/preparation")
    async def get_book_preparation(user_payload: dict = Depends(verify_token)):
        """Get current book preparation state for the client's case.

        Called on every StageDetailPage open by the client portal, so it must
        return quickly without 500-ing when there's no preparation yet."""
        from db.supabase_client import select as sb_select

        user_id = user_payload.get('id') or user_payload.get('_id')
        cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
        case = next((c for c in (cases or []) if not c.get('is_master_case')), None)
        if not case:
            return {"preparation": None}

        prep = sb_select("book_preparations", filters={"case_id": case.get('id')}, single=True)
        return {"preparation": prep}

    @client_router.post("/book/suggest-ideas")
    async def client_suggest_book_ideas(user_payload: dict = Depends(verify_token)):
        """Extract CV + BP locally and generate 3 book ideas with GPT-5.2"""
        from bson import ObjectId as OId
        import httpx
        import io

        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')
        case_user_id = str(case.get('userId', user_id))

        # Get user info
        try:
            user = await db.users.find_one({"_id": OId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        client_name = user.get("name", user.get("email", ""))
        client_email = user.get("email", "")

        # === LOCAL PDF TEXT EXTRACTION ===
        async def download_and_extract_pdf(url):
            """Download file and extract text locally using pypdf"""
            try:
                async with httpx.AsyncClient(timeout=60, follow_redirects=True) as http:
                    resp = await http.get(url)
                    resp.raise_for_status()
                    file_bytes = resp.content

                # Try pypdf first
                try:
                    from pypdf import PdfReader
                    reader = PdfReader(io.BytesIO(file_bytes))
                    text = ""
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    if text.strip():
                        return text.strip()
                except Exception as e:
                    logger.warning(f"pypdf extraction failed: {e}")

                # Try PyMuPDF as fallback
                try:
                    import fitz
                    doc = fitz.open(stream=file_bytes, filetype="pdf")
                    text = ""
                    for page in doc:
                        text += page.get_text() + "\n"
                    doc.close()
                    if text.strip():
                        return text.strip()
                except Exception as e:
                    logger.warning(f"PyMuPDF extraction failed: {e}")

                # Try as plain text
                try:
                    text = file_bytes.decode('utf-8', errors='ignore')
                    if len(text.strip()) > 50:
                        return text.strip()
                except Exception:
                    pass

                return ""
            except Exception as e:
                logger.error(f"File download/extraction failed: {e}")
                return ""

        # Find CV URL
        cv_url = None
        search_ids = list(set([case_user_id, user_id]))
        logger.info(f"Book suggest-ideas: looking for CV with userIds: {search_ids}, caseId: {case_id}")

        for uid in search_ids:
            cv = await db.user_cvs.find_one({"userId": uid}, {"_id": 0, "url": 1, "fileName": 1})
            if cv and cv.get("url"):
                cv_url = cv["url"]
                logger.info(f"Book suggest-ideas: Found CV in user_cvs with userId={uid}")
                break
            try:
                cv = await db.user_cvs.find_one({"userId": OId(uid)}, {"_id": 0, "url": 1, "fileName": 1})
                if cv and cv.get("url"):
                    cv_url = cv["url"]
                    break
            except Exception:
                pass

        # Try by email
        if not cv_url and client_email:
            cv = await db.user_cvs.find_one({"email": client_email}, {"_id": 0, "url": 1})
            if cv and cv.get("url"):
                cv_url = cv["url"]

        # Try visa_deliverables (Hoja de Vida)
        if not cv_url:
            del_cv = await db.visa_deliverables.find_one(
                {"caseId": case_id, "deliverableName": {"$regex": "hoja de vida|curriculum|resume|cv", "$options": "i"}},
                {"_id": 0, "files": 1, "fileUrl": 1}
            )
            if del_cv:
                files = del_cv.get("files", [])
                if files:
                    cv_url = files[0].get("fileUrl")
                elif del_cv.get("fileUrl"):
                    cv_url = del_cv["fileUrl"]

        if not cv_url:
            raise HTTPException(status_code=400, detail="No se encontro el CV del cliente. Por favor sube el CV primero.")

        # Extract text from CV
        profile_summary = await download_and_extract_pdf(cv_url)
        if not profile_summary:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del CV. Asegurate de que sea un archivo PDF o DOCX valido.")

        logger.info(f"Book suggest-ideas: CV text extracted ({len(profile_summary)} chars)")

        # Extract Business Plan text (optional)
        project_description = ""
        bp = await db.visa_deliverables.find_one(
            {"caseId": case_id, "stageNumber": 3},
            {"_id": 0, "files": 1, "fileUrl": 1}
        )
        bp_url = None
        if bp:
            files = bp.get("files", [])
            if files:
                bp_url = files[0].get("fileUrl")
            elif bp.get("fileUrl"):
                bp_url = bp["fileUrl"]

        if bp_url:
            project_description = await download_and_extract_pdf(bp_url)

        # === GENERATE IDEAS WITH GPT-5.2 ===
        prompt = f"""Basado en el siguiente perfil del autor, sugiere 3 ideas de libros convincentes y comercializables que se alineen con la experiencia e intereses del autor.

PERFIL DEL AUTOR:
Nombre: {client_name}

Resumen del perfil:
{profile_summary[:4000]}

{"CONTEXTO DEL PROYECTO: " + project_description[:3000] if project_description else ""}

REQUISITOS:
- Sugiere exactamente 3 ideas de libros en Español
- Cada idea debe ser unica, atractiva y comercializable
- Las ideas deben aprovechar el background y experiencia del autor
- Incluye genero y concepto breve (3-5 oraciones con detalles especificos)
- Evita conceptos genericos o vagos
- Haz cada idea distintiva y comercialmente atractiva
- Si hay proyecto/patente, usalos para crear conceptos innovadores y relevantes
- Recomienda cual idea es la MEJOR (agrega la palabra RECOMENDADA al final de la mejor)

FORMATO DE RESPUESTA:
1. [Genero]: [Concepto detallado de la idea con gancho narrativo]
2. [Genero]: [Concepto detallado de la idea con gancho narrativo]
3. [Genero]: [Concepto detallado de la idea con gancho narrativo] (RECOMENDADA)

Solo proporciona las 3 ideas numeradas, nada mas."""

        client = _get_openai_async_client()
        llm_response = await client.chat.completions.create(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": "Eres un experto en publicaciones academicas y editoriales. Generas ideas de libros innovadoras basadas en el perfil profesional del autor."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_completion_tokens=4000
        )
        response = llm_response.choices[0].message.content
        logger.info(f"Book suggest-ideas: GPT response received ({len(response)} chars)")

        # Parse response into ideas array
        ideas = []
        best_idx = -1
        lines = response.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Match lines starting with 1., 2., 3.
            for prefix in ['1.', '2.', '3.']:
                if line.startswith(prefix):
                    idea_text = line[len(prefix):].strip()
                    if 'RECOMENDADA' in idea_text.upper():
                        best_idx = len(ideas)
                        idea_text = idea_text.replace('(RECOMENDADA)', '').replace('(Recomendada)', '').replace('RECOMENDADA', '').strip()
                    ideas.append(idea_text)
                    break

        if len(ideas) < 3:
            # Fallback: split by double newline or numbered pattern
            ideas = [response.strip()]
            best_idx = 0

        evaluation = {
            "best_idea_number": str(best_idx) if best_idx >= 0 else "2",
            "passed": True
        }

        # Save to DB
        await db.book_preparations.update_one(
            {"caseId": case_id},
            {"$set": {
                "caseId": case_id,
                "userId": user_id,
                "step": "ideas_shown",
                "suggestedIdeas": ideas,
                "ideasEvaluation": evaluation,
                "profileSummary": profile_summary[:5000],
                "projectDescription": project_description[:5000],
                "authorName": client_name,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True
        )

        return {
            "suggestions": ideas,
            "evaluation": evaluation
        }

    class SelectIdeaRequest(BaseModel):
        selectedIdea: str
        isCustom: bool = False

    @client_router.post("/book/select-idea")
    async def client_select_book_idea(body: SelectIdeaRequest, user_payload: dict = Depends(verify_token)):
        """Save the client's selected book idea"""
        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        await db.book_preparations.update_one(
            {"caseId": case_id},
            {"$set": {
                "selectedIdea": body.selectedIdea,
                "isCustomIdea": body.isCustom,
                "step": "idea_selected",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )

        return {"success": True, "message": "Idea seleccionada"}

    @client_router.post("/book/suggest-titles")
    async def client_suggest_book_titles(user_payload: dict = Depends(verify_token)):
        """Generate 3 title suggestions based on the selected idea using GPT-5.2"""
        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        prep = await db.book_preparations.find_one({"caseId": case_id}, {"_id": 0})
        if not prep or not prep.get("selectedIdea"):
            raise HTTPException(status_code=400, detail="Primero debes seleccionar una idea")

        prompt = f"""Basado en la siguiente idea de libro y el perfil del autor, sugiere 3 titulos atractivos y comercializables.

IDEA DEL LIBRO:
{prep['selectedIdea']}

PERFIL DEL AUTOR:
{prep.get('profileSummary', '')[:3000]}

REQUISITOS:
- Sugiere exactamente 3 titulos en Español
- Cada titulo debe ser corto, memorable y profesional (maximo 8 palabras)
- Los titulos deben reflejar la esencia de la idea
- Evita titulos genericos
- Recomienda cual titulo es el MEJOR (agrega la palabra RECOMENDADO al final del mejor)

FORMATO DE RESPUESTA:
1. [Titulo]
2. [Titulo]
3. [Titulo] (RECOMENDADO)

Solo proporciona los 3 titulos numerados, nada mas."""

        client = _get_openai_async_client()
        llm_response = await client.chat.completions.create(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": "Eres un experto en publicaciones academicas. Generas titulos de libros concisos y atractivos."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_completion_tokens=4000
        )
        response = llm_response.choices[0].message.content

        titles = []
        best_idx = -1
        for line in response.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            for prefix in ['1.', '2.', '3.']:
                if line.startswith(prefix):
                    title_text = line[len(prefix):].strip()
                    if 'RECOMENDADO' in title_text.upper():
                        best_idx = len(titles)
                        title_text = title_text.replace('(RECOMENDADO)', '').replace('(Recomendado)', '').replace('RECOMENDADO', '').strip()
                    titles.append(title_text)
                    break

        evaluation = {
            "best_title_number": str(best_idx) if best_idx >= 0 else "2",
            "passed": True
        }

        await db.book_preparations.update_one(
            {"caseId": case_id},
            {"$set": {
                "suggestedTitles": titles,
                "titlesEvaluation": evaluation,
                "step": "titles_shown",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )

        return {
            "suggestions": titles,
            "evaluation": evaluation
        }

    class SelectTitleRequest(BaseModel):
        selectedTitle: str

    @client_router.post("/book/select-title")
    async def client_select_book_title(body: SelectTitleRequest, user_payload: dict = Depends(verify_token)):
        """Save the selected title and auto-start book generation"""
        import asyncio as _asyncio

        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        prep = await db.book_preparations.find_one({"caseId": case_id}, {"_id": 0})
        if not prep or not prep.get("selectedIdea"):
            raise HTTPException(status_code=400, detail="Primero debes seleccionar una idea")

        await db.book_preparations.update_one(
            {"caseId": case_id},
            {"$set": {
                "selectedTitle": body.selectedTitle,
                "step": "ready",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )

        # Auto-start book generation
        from services.whitepaper_service import run_book_generation
        job_id = str(uuid.uuid4())
        await db.book_jobs.insert_one({
            "_id": job_id,
            "caseId": case_id,
            "status": "queued",
            "currentStep": "Iniciando generacion del libro...",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "startedBy": "client-auto",
        })
        _asyncio.create_task(run_book_generation(db, case_id, job_id))

        return {
            "success": True,
            "message": "Titulo seleccionado. La generacion del libro ha iniciado automaticamente.",
            "jobId": job_id
        }

    @client_router.post("/book/reset")
    async def client_reset_book_preparation(user_payload: dict = Depends(verify_token)):
        """Reset book preparation to start over"""
        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        await db.book_preparations.delete_one({"caseId": case_id})
        return {"success": True, "message": "Preparacion reiniciada"}

    # =========================================================================
    # BUSINESS PLAN (Propuesta de Proyecto NIW) PREPARATION ENDPOINTS
    # =========================================================================

    @client_router.get("/bp/preparation")
    async def get_bp_preparation(user_payload: dict = Depends(verify_token)):
        """Get current business plan preparation state"""
        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')
        prep = await db.bp_preparations.find_one({"caseId": case_id}, {"_id": 0})
        return {"preparation": prep}

    @client_router.post("/bp/suggest-names")
    async def client_suggest_bp_names(user_payload: dict = Depends(verify_token)):
        """Extract CV locally and call redaccion API to suggest project names (async)"""
        from bson import ObjectId as OId
        import httpx
        import io

        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')
        case_user_id = str(case.get('userId', user_id))

        try:
            user = await db.users.find_one({"_id": OId(user_id)}, {"_id": 0, "name": 1, "email": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        client_name = user.get("name", user.get("email", ""))

        # === Extract CV text locally (same as libro) ===
        async def download_and_extract_pdf(url):
            try:
                async with httpx.AsyncClient(timeout=60, follow_redirects=True) as http:
                    resp = await http.get(url)
                    resp.raise_for_status()
                    file_bytes = resp.content
                try:
                    from pypdf import PdfReader
                    reader = PdfReader(io.BytesIO(file_bytes))
                    text = ""
                    for page in reader.pages:
                        pt = page.extract_text()
                        if pt:
                            text += pt + "\n"
                    if text.strip():
                        return text.strip()
                except Exception:
                    pass
                try:
                    import fitz
                    doc = fitz.open(stream=file_bytes, filetype="pdf")
                    text = ""
                    for page in doc:
                        text += page.get_text() + "\n"
                    doc.close()
                    if text.strip():
                        return text.strip()
                except Exception:
                    pass
                try:
                    return file_bytes.decode('utf-8', errors='ignore').strip()
                except Exception:
                    pass
                return ""
            except Exception as e:
                logger.error(f"BP PDF extraction failed: {e}")
                return ""

        # Find CV URL
        cv_url = None
        search_ids = list(set([case_user_id, user_id]))
        for uid in search_ids:
            cv = await db.user_cvs.find_one({"userId": uid}, {"_id": 0, "url": 1})
            if cv and cv.get("url"):
                cv_url = cv["url"]
                break
            try:
                cv = await db.user_cvs.find_one({"userId": OId(uid)}, {"_id": 0, "url": 1})
                if cv and cv.get("url"):
                    cv_url = cv["url"]
                    break
            except Exception:
                pass

        if not cv_url:
            del_cv = await db.visa_deliverables.find_one(
                {"caseId": case_id, "deliverableName": {"$regex": "hoja de vida|curriculum|resume|cv", "$options": "i"}},
                {"_id": 0, "files": 1, "fileUrl": 1}
            )
            if del_cv:
                files = del_cv.get("files", [])
                if files:
                    cv_url = files[0].get("fileUrl")
                elif del_cv.get("fileUrl"):
                    cv_url = del_cv["fileUrl"]

        if not cv_url:
            raise HTTPException(status_code=400, detail="No se encontro el CV del cliente. Por favor sube el CV primero.")

        cv_text = await download_and_extract_pdf(cv_url)
        if not cv_text:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del CV.")

        # Call external API to suggest project names (async)
        from services.whitepaper_service import _get_redaccion_token
        token = await _get_redaccion_token()

        async with httpx.AsyncClient(timeout=60) as http:
            resp = await http.post(
                f"{os.environ.get('REDACCION_API_URL', '').rstrip('/')}/api/business-plans/suggest-project-names-async",
                json={
                    "applicant_name": client_name,
                    "applicant_cv": cv_text[:8000],
                    "language": "es"
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            resp.raise_for_status()
            data = resp.json()
            task_id = data.get("task_id")

        if not task_id:
            raise HTTPException(status_code=500, detail="No se obtuvo task_id del sistema")

        # Save initial state
        await db.bp_preparations.update_one(
            {"caseId": case_id},
            {"$set": {
                "caseId": case_id,
                "userId": user_id,
                "step": "suggesting",
                "taskId": task_id,
                "cvText": cv_text[:8000],
                "authorName": client_name,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True
        )

        return {"task_id": task_id, "status": "pending"}

    @client_router.get("/bp/suggest-names-status/{task_id}")
    async def client_bp_suggest_status(task_id: str, user_payload: dict = Depends(verify_token)):
        """Poll external API for project name suggestions"""
        import httpx
        from services.whitepaper_service import _get_redaccion_token

        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        token = await _get_redaccion_token()

        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(
                f"{os.environ.get('REDACCION_API_URL', '').rstrip('/')}/api/business-plans/suggest-project-status/{task_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            resp.raise_for_status()
            data = resp.json()

        status = data.get("status", "pending")

        if status == "completed":
            result = data.get("result", {})
            suggestions = result.get("suggestions", [])
            recommendation = result.get("recommendation", {})

            await db.bp_preparations.update_one(
                {"caseId": case_id},
                {"$set": {
                    "step": "names_shown",
                    "suggestedNames": suggestions,
                    "recommendation": recommendation,
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }}
            )

            return {
                "status": "completed",
                "suggestions": suggestions,
                "recommendation": recommendation
            }

        return {"status": status}

    class SelectBpNameRequest(BaseModel):
        selectedName: str
        selectedDescription: str = ""

    @client_router.post("/bp/select-name")
    async def client_select_bp_name(body: SelectBpNameRequest, user_payload: dict = Depends(verify_token)):
        """Save selected project name and auto-start BP generation"""
        import asyncio as _asyncio

        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        prep = await db.bp_preparations.find_one({"caseId": case_id}, {"_id": 0})
        if not prep:
            raise HTTPException(status_code=400, detail="Primero debes generar sugerencias de proyecto")

        await db.bp_preparations.update_one(
            {"caseId": case_id},
            {"$set": {
                "selectedName": body.selectedName,
                "selectedDescription": body.selectedDescription,
                "step": "ready",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )

        # Auto-start BP generation in background
        job_id = str(uuid.uuid4())
        await db.bp_jobs.insert_one({
            "_id": job_id,
            "caseId": case_id,
            "status": "queued",
            "currentStep": "Iniciando generacion del Business Plan...",
            "progress": 0,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "startedBy": "client-auto",
        })

        _asyncio.create_task(_run_bp_generation(
            db, case_id, job_id,
            project_title=body.selectedName,
            project_idea=body.selectedDescription or body.selectedName,
            applicant_name=prep.get("authorName", ""),
            cv_text=prep.get("cvText", ""),
        ))

        return {
            "success": True,
            "message": "Proyecto seleccionado. La generacion del Business Plan ha iniciado.",
            "jobId": job_id
        }

    @client_router.get("/bp/job")
    async def get_bp_job(user_payload: dict = Depends(verify_token)):
        """Get latest BP generation job status"""
        import httpx
        from services.whitepaper_service import _get_redaccion_token

        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')

        job = await db.bp_jobs.find_one(
            {"caseId": case_id},
            {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "progress": 1, "externalNiwId": 1, "updatedAt": 1},
            sort=[("createdAt", -1)]
        )
        if not job:
            return {"job": None}

        # Poll external API if generating
        if job.get("status") == "generating" and job.get("externalNiwId"):
            try:
                token = await _get_redaccion_token()
                async with httpx.AsyncClient(timeout=30) as http:
                    resp = await http.get(
                        f"{os.environ.get('REDACCION_API_URL', '').rstrip('/')}/api/business-plans/generation-status/{job['externalNiwId']}",
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    if resp.status_code == 200:
                        ext = resp.json()
                        ext_status = ext.get("status", "")
                        progress = ext.get("progress", 0)
                        msg = ext.get("progress_message", "")

                        update = {"progress": progress, "currentStep": msg or job.get("currentStep", ""), "updatedAt": datetime.now(timezone.utc).isoformat()}

                        if ext_status == "completed":
                            update["status"] = "completed"
                            update["currentStep"] = "Business Plan generado exitosamente"
                        elif ext_status == "generation_failed":
                            update["status"] = "error"
                            update["error"] = ext.get("error", "Error en generacion")

                        await db.bp_jobs.update_one({"_id": job["_id"]}, {"$set": update})
                        job.update(update)
            except Exception as e:
                logger.warning(f"BP job poll failed: {e}")

        job["id"] = job.pop("_id")
        return {"job": job}

    @client_router.post("/bp/reset")
    async def client_reset_bp_preparation(user_payload: dict = Depends(verify_token)):
        """Reset BP preparation"""
        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await get_client_case(db, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id') or case.get('_id')
        await db.bp_preparations.delete_one({"caseId": case_id})
        return {"success": True, "message": "Preparacion reiniciada"}

    class _ClientZipItem(BaseModel):
        type: str  # 'deliverable' | 'document'
        itemId: str
        fileId: Optional[str] = None

    class _ClientZipRequest(BaseModel):
        items: List[_ClientZipItem]

    @client_router.post("/my-case/download-zip")
    async def client_download_case_files_zip(
        request: _ClientZipRequest,
        user_payload: dict = Depends(verify_token),
    ):
        """Bundle entregables/documentos del cliente en un ZIP.

        - Verifica ownership: cada item debe pertenecer al case del cliente
        - Rechaza items en etapas bloqueadas (sólo paid / free / unlocked / completed)
        - Estructura: Etapa N - Nombre/<entregable o documento>/<archivo>
        """
        import re
        import zipfile
        from io import BytesIO
        from pathlib import Path as _Path
        import httpx
        from db.supabase_client import select as sb_select

        def _safe_segment(name: str) -> str:
            if not name:
                return 'sin_nombre'
            cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', str(name)).strip().strip('.')
            return cleaned or 'sin_nombre'

        def _name_to_text(name_field, fallback='item'):
            if isinstance(name_field, dict):
                return name_field.get('es') or name_field.get('en') or fallback
            return name_field or fallback

        user_id = user_payload.get('id')
        if not request.items:
            raise HTTPException(status_code=400, detail="No items selected")

        cases = sb_select("visa_cases", filters={"client_id": user_id}, order="created_at", order_desc=True)
        case = next((c for c in cases if not c.get('is_master_case')), None)
        if not case:
            raise HTTPException(status_code=404, detail="No active visa case found")
        case_id = case.get('id')

        # Mapa stage_number → unlocked? (paid OR free OR status in {unlocked, completed})
        stages = sb_select("visa_stages", filters={"case_id": case_id}, columns="stage_number,status,amount,is_paid", limit=200)
        unlocked_stages: set = set()
        for s in stages:
            sn = s.get('stage_number') or s.get('stageNumber')
            if sn is None:
                continue
            status = (s.get('status') or '').lower()
            is_paid = bool(s.get('is_paid') or s.get('isPaid'))
            try:
                amount = float(s.get('amount') or 0)
            except (TypeError, ValueError):
                amount = 0
            if is_paid or amount == 0 or status in ('unlocked', 'completed'):
                unlocked_stages.add(int(sn))

        async def _read_file_bytes(file_url: str):
            if not file_url:
                return None
            if file_url.startswith('/api/documents/download/'):
                fname = file_url.rsplit('/', 1)[-1]
                fpath = _Path("/app/backend/uploads") / fname
                if fpath.exists():
                    return fpath.read_bytes()
                fpath_local = _Path(__file__).parent / "uploads" / fname
                if fpath_local.exists():
                    return fpath_local.read_bytes()
                return None
            if file_url.startswith('http://') or file_url.startswith('https://'):
                async with httpx.AsyncClient(timeout=60) as http:
                    resp = await http.get(file_url)
                    if resp.status_code == 200:
                        return resp.content
                    return None
            fname = file_url.rsplit('/', 1)[-1]
            fpath = _Path("/app/backend/uploads") / fname
            if fpath.exists():
                return fpath.read_bytes()
            return None

        deliverables_cache: dict = {}
        documents_cache: dict = {}

        buf = BytesIO()
        used_paths: set = set()
        included = 0
        rejected_locked = 0

        with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            for sel in request.items:
                if sel.type == 'deliverable':
                    item = deliverables_cache.get(sel.itemId)
                    if not item:
                        item = sb_select("visa_deliverables", filters={"id": sel.itemId}, single=True)
                        if not item or (item.get('case_id') or item.get('caseId')) != case_id:
                            continue
                        deliverables_cache[sel.itemId] = item
                    parent_label = _safe_segment(_name_to_text(item.get('name') or item.get('deliverable_name') or item.get('deliverableName'), 'Entregable'))
                    files_arr = item.get('files') or []
                    if not files_arr and (item.get('file_url') or item.get('fileUrl')):
                        files_arr = [{
                            'id': 'legacy',
                            'fileName': item.get('file_name') or item.get('fileName') or 'archivo',
                            'fileUrl': item.get('file_url') or item.get('fileUrl'),
                        }]
                elif sel.type == 'document':
                    item = documents_cache.get(sel.itemId)
                    if not item:
                        item = sb_select("visa_documents", filters={"id": sel.itemId}, single=True)
                        if not item or (item.get('case_id') or item.get('caseId')) != case_id:
                            continue
                        documents_cache[sel.itemId] = item
                    parent_label = _safe_segment(_name_to_text(item.get('name') or item.get('document_name') or item.get('documentName'), 'Documento'))
                    files_arr = item.get('files') or []
                    if not files_arr and (item.get('file_url') or item.get('fileUrl')):
                        files_arr = [{
                            'id': 'legacy',
                            'fileName': item.get('file_name') or item.get('fileName') or 'archivo',
                            'fileUrl': item.get('file_url') or item.get('fileUrl'),
                        }]
                else:
                    continue

                # Gate: la etapa de este item debe estar desbloqueada
                stage_num = item.get('stage_number') or item.get('stageNumber')
                try:
                    stage_num_int = int(stage_num) if stage_num is not None else None
                except (TypeError, ValueError):
                    stage_num_int = None
                if stage_num_int is None or stage_num_int not in unlocked_stages:
                    rejected_locked += 1
                    continue

                if sel.fileId:
                    files_arr = [f for f in files_arr if isinstance(f, dict) and f.get('id') == sel.fileId]

                # Excluir borradores (published=False). Sólo aplica a entregables —
                # los documentos requeridos los sube el cliente, no tienen este flag.
                if sel.type == 'deliverable':
                    files_arr = [f for f in files_arr if not (isinstance(f, dict) and f.get('published') is False)]

                folder = f"Etapa {stage_num_int} - {parent_label}"
                for f in files_arr:
                    if not isinstance(f, dict):
                        continue
                    file_url = f.get('fileUrl') or f.get('file_url')
                    file_name = _safe_segment(f.get('fileName') or f.get('file_name') or 'archivo')
                    payload = await _read_file_bytes(file_url)
                    if payload is None:
                        logger.warning(f"client download-zip: skip unreadable {file_url}")
                        continue
                    zip_path = f"{folder}/{file_name}"
                    base_path = zip_path
                    counter = 1
                    while zip_path in used_paths:
                        if '.' in file_name:
                            stem, ext = file_name.rsplit('.', 1)
                            zip_path = f"{folder}/{stem}_{counter}.{ext}"
                        else:
                            zip_path = f"{base_path}_{counter}"
                        counter += 1
                    used_paths.add(zip_path)
                    zf.writestr(zip_path, payload)
                    included += 1

        if included == 0:
            detail = "No se pudo recuperar ningún archivo"
            if rejected_locked:
                detail += f" ({rejected_locked} archivo(s) ignorados por estar en etapas bloqueadas)"
            raise HTTPException(status_code=404, detail=detail)

        buf.seek(0)
        from fastapi.responses import StreamingResponse
        client_label = (case.get('client_name') or case.get('clientName') or 'caso').replace(' ', '_')
        zip_name = f"mis_documentos_{client_label}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.zip"
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{zip_name}"',
                "Content-Length": str(buf.getbuffer().nbytes),
            },
        )

    return client_router


async def _run_bp_generation(db, case_id, job_id, project_title, project_idea, applicant_name, cv_text):
    """Background task: orchestrate Business Plan NIW generation via external API"""
    import httpx
    from services.whitepaper_service import _get_redaccion_token, _search_client, _create_client

    async def update_status(status, step="", error="", **extra):
        update = {"status": status, "currentStep": step, "updatedAt": datetime.now(timezone.utc).isoformat()}
        if error:
            update["error"] = error
        update.update(extra)
        await db.bp_jobs.update_one({"_id": job_id}, {"$set": update})

    try:
        await update_status("processing", "Autenticando...")

        token = await _get_redaccion_token()

        # Get user email for client lookup
        case = await db.visa_cases.find_one({"_id": case_id}, {"userId": 1})
        user_id = case.get("userId", "") if case else ""
        user = None
        try:
            from bson import ObjectId
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "email": 1, "phone": 1})
        except Exception:
            user = await db.users.find_one({"_id": user_id}, {"_id": 0, "email": 1, "phone": 1})

        client_email = (user or {}).get("email", "")
        client_phone = (user or {}).get("phone", "")

        # Search/create client in redaccion
        await update_status("processing", "Buscando cliente en sistema...")
        client_uuid = await _search_client(token, client_email)
        if not client_uuid:
            client_uuid = await _create_client(token, applicant_name, client_email, client_phone)

        # Step 1: Create the plan (start-interactive)
        await update_status("processing", "Creando Business Plan...")
        async with httpx.AsyncClient(timeout=120) as http:
            resp = await http.post(
                f"{os.environ.get('REDACCION_API_URL', '').rstrip('/')}/api/business-plans/start-interactive",
                json={
                    "project_title": project_title,
                    "applicant_name": applicant_name,
                    "applicant_cv": cv_text[:8000],
                    "project_idea": project_idea[:3000],
                    "language": "es",
                    "client_id": client_uuid,
                    "apply_graphic_design": False,
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            resp.raise_for_status()
            data = resp.json()
            niw_id = data.get("id")

        if not niw_id:
            await update_status("error", error="No se obtuvo niw_id")
            return

        await update_status("processing", "Iniciando generacion de 9 secciones...", externalNiwId=niw_id)

        # Step 2: Start generation in background
        async with httpx.AsyncClient(timeout=60) as http:
            resp = await http.post(
                f"{os.environ.get('REDACCION_API_URL', '').rstrip('/')}/api/business-plans/generate-complete-v3/{niw_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            resp.raise_for_status()

        await update_status("generating", "Generando Business Plan (8-15 minutos)...", externalNiwId=niw_id, progress=5)

    except Exception as e:
        logger.error(f"BP generation error for case {case_id}: {e}")
        await update_status("error", error=str(e))
