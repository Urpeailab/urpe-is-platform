"""
Self-Petition V2 Router
Handles all endpoints for the V2 self-petition letter generation flow
"""
import logging
import uuid
import io
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_utils import pdf_safe as _pdf_safe

from models.self_petition_v2 import SelfPetitionV2Session, SelfPetitionV2Letter
from services import classification_service, extraction_service, letter_generation_service
from services import batch_processing_service
from services import letter_generation_v2

# These will be injected from the main app
db = None
openai_client = None
_get_current_user_func = None
_User_class = None

security = HTTPBearer()


def init_router(database, client, auth_dependency, user_model):
    """Initialize the router with dependencies from main app"""
    global db, openai_client, _get_current_user_func, _User_class
    db = database
    openai_client = client
    _get_current_user_func = auth_dependency
    _User_class = user_model
    
    # Initialize services
    classification_service.init_service(database, client)
    extraction_service.init_service(database, client)
    letter_generation_service.init_service(database, client)
    batch_processing_service.init_service(database, client)


async def get_current_user_dep(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Wrapper dependency that calls the injected auth function"""
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Router not initialized")
    return await _get_current_user_func(credentials)


router = APIRouter(prefix="/self-petition-v2", tags=["Self-Petition V2"])


@router.post("/create-session")
async def create_self_petition_v2_session(
    client_id: Optional[str] = None,
    current_user = Depends(get_current_user_dep)
):
    """Create a new V2 self-petition session, pre-loading the client name as applicant name."""
    try:
        # Pre-load client name if client_id is provided
        applicant_name = ""
        if client_id:
            client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0, "full_name": 1, "name": 1, "first_name": 1, "last_name": 1})
            if client_doc:
                applicant_name = (
                    client_doc.get("full_name")
                    or client_doc.get("name")
                    or f"{client_doc.get('first_name', '')} {client_doc.get('last_name', '')}".strip()
                    or ""
                )

        session = SelfPetitionV2Session(
            user_id=current_user.id if hasattr(current_user, 'id') else str(current_user.get('id', '')),
            client_id=client_id,
            applicant_name=applicant_name,
            status="uploading",
            progress=0,
            progress_message="Listo para recibir documentos"
        )
        
        await db.self_petition_v2_sessions.insert_one(session.model_dump())
        
        return {
            "session_id": session.id,
            "status": session.status,
            "applicant_name": applicant_name,
            "message": "Sesión creada. Sube los documentos del solicitante."
        }
    except Exception as e:
        logging.error(f"Error creating V2 session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/upload-document")
async def upload_v2_document(
    session_id: str,
    file: UploadFile = File(...),
    classify_immediately: bool = True,
    current_user = Depends(get_current_user_dep)
):
    """
    Upload a document to the V2 session - stores on filesystem.
    If classify_immediately=True (default), classifies the document right away.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        # Read file content
        content = await file.read()
        
        # Save to filesystem instead of MongoDB
        upload_dir = Path(f"/app/backend/uploads/self_petition_v2/{session_id}")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_id = str(uuid.uuid4())
        safe_filename = file.filename.replace("/", "_").replace("\\", "_")
        file_path = upload_dir / f"{file_id}_{safe_filename}"
        
        with open(file_path, 'wb') as f:
            f.write(content)
        
        file_data = {
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "file_path": str(file_path),
            "upload_status": "completed"
        }
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {
                "$push": {"files": file_data},
                "$inc": {"total_files": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        # Classify immediately if requested
        classification = None
        if classify_immediately:
            try:
                logging.warning(f"🔄 Classifying uploaded file immediately: {file.filename}")
                classification = await batch_processing_service.process_single_file_with_classification(
                    file_id, file.filename, str(file_path)
                )
                classification['exhibit_number'] = len(session.get('classifications', [])) + 1
                classification['batch_number'] = 0  # Immediate classification
                
                # Save classification result
                await db.self_petition_v2_sessions.update_one(
                    {"id": session_id},
                    {
                        "$push": {"classifications": classification},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
                logging.warning(f"✅ Classification result: {classification.get('status')} - {classification.get('document_type')}")
            except Exception as classify_error:
                logging.error(f"Error classifying immediately: {classify_error}")
                classification = {
                    "file_id": file_id,
                    "filename": file.filename,
                    "document_type": "other",
                    "confidence": 0.0,
                    "summary": f"Error al clasificar: {str(classify_error)[:50]}",
                    "status": "needs_retry",
                    "error": str(classify_error)[:150],
                    "exhibit_number": len(session.get('classifications', [])) + 1,
                    "batch_number": 0
                }
                await db.self_petition_v2_sessions.update_one(
                    {"id": session_id},
                    {"$push": {"classifications": classification}}
                )
        
        return {
            "file_id": file_id,
            "filename": file.filename,
            "size": len(content),
            "status": "uploaded",
            "classification": classification
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading V2 document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/{session_id}/upload-documents-bulk")
async def upload_v2_documents_bulk(
    session_id: str,
    files: list[UploadFile] = File(...),
    current_user = Depends(get_current_user_dep)
):
    """
    Upload multiple documents at once without classification.
    Designed for bulk uploads of 50-150 files.
    Returns the list of uploaded file IDs for tracking.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesion no encontrada")
        
        upload_dir = Path(f"/app/backend/uploads/self_petition_v2/{session_id}")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        results = []
        files_to_push = []
        
        for file in files:
            try:
                content = await file.read()
                
                file_id = str(uuid.uuid4())
                safe_filename = file.filename.replace("/", "_").replace("\\", "_")
                file_path = upload_dir / f"{file_id}_{safe_filename}"
                
                with open(file_path, 'wb') as f:
                    f.write(content)
                
                file_data = {
                    "file_id": file_id,
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(content),
                    "file_path": str(file_path),
                    "upload_status": "completed"
                }
                files_to_push.append(file_data)
                results.append({"file_id": file_id, "filename": file.filename, "size": len(content), "status": "uploaded"})
            except Exception as file_error:
                logging.error(f"Error uploading file {file.filename}: {file_error}")
                results.append({"file_id": None, "filename": file.filename, "size": 0, "status": "error", "error": str(file_error)[:100]})
        
        # Batch update MongoDB once
        if files_to_push:
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {
                    "$push": {"files": {"$each": files_to_push}},
                    "$inc": {"total_files": len(files_to_push)},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        
        success_count = len([r for r in results if r["status"] == "uploaded"])
        error_count = len([r for r in results if r["status"] == "error"])
        
        return {
            "total": len(files),
            "uploaded": success_count,
            "errors": error_count,
            "files": results
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in bulk upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/{session_id}/start-classification")
async def start_v2_classification(
    session_id: str,
    background_tasks: BackgroundTasks,
    use_batch_mode: bool = True,
    current_user = Depends(get_current_user_dep)
):
    """
    Start the document classification process.
    
    By default uses batch mode (use_batch_mode=True) which processes documents in small batches
    and generates intermediate summaries. This is more stable for large document sets.
    
    Set use_batch_mode=False to use the legacy sequential processing.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        if not session.get('files'):
            raise HTTPException(status_code=400, detail="No hay documentos para clasificar")
        
        # Check if we're resuming a previous classification
        existing_classifications = session.get('classifications', [])
        files_to_process = session.get('files', [])
        
        if len(existing_classifications) == len(files_to_process):
            # All files already classified
            return {
                "session_id": session_id,
                "status": "reviewing",
                "message": "Todos los documentos ya están clasificados."
            }
        
        # Initialize batch tracking
        if 'batch_summaries' not in session:
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {"batch_summaries": []}}
            )
        
        # Update status to classifying
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "classifying",
                "progress": 5,
                "progress_message": f"Iniciando clasificación de {len(files_to_process)} documentos (modo {'lotes' if use_batch_mode else 'secuencial'})...",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if use_batch_mode:
            # Use new batch processing system - processes all batches automatically
            background_tasks.add_task(batch_processing_service.process_all_batches_background, session_id)
            return {
                "session_id": session_id,
                "status": "classifying",
                "mode": "batch",
                "batch_size": 7,
                "total_files": len(files_to_process),
                "already_classified": len(existing_classifications),
                "message": f"Clasificación por lotes iniciada. {len(files_to_process)} documentos se procesarán en lotes de 7."
            }
        else:
            # Legacy sequential processing
            background_tasks.add_task(classification_service.classify_v2_documents_background, session_id)
            return {
                "session_id": session_id,
                "status": "classifying",
                "mode": "sequential",
                "total_files": len(files_to_process),
                "already_classified": len(existing_classifications),
                "message": f"Clasificación secuencial iniciada. Procesando {len(files_to_process) - len(existing_classifications)} documentos pendientes."
            }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting V2 classification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/retry-classification")
async def retry_v2_classification(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user_dep)
):
    """Retry classification for documents that failed"""
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        # Update status
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "classifying",
                "progress": 5,
                "progress_message": "Reintentando clasificación...",
                "error_message": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Start background classification (it will skip already classified docs)
        background_tasks.add_task(classification_service.classify_v2_documents_background, session_id)
        
        return {
            "session_id": session_id,
            "status": "classifying",
            "message": "Reintentando clasificación de documentos pendientes."
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error retrying V2 classification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/reupload-file/{file_id}")
async def reupload_and_reclassify_file(
    session_id: str,
    file_id: str,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user_dep)
):
    """
    Re-upload a file that failed classification (in a different format).
    This replaces the old file and triggers re-classification.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        # Find the original file
        files = session.get('files', [])
        file_index = next((i for i, f in enumerate(files) if f['file_id'] == file_id), None)
        
        if file_index is None:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
        # Read new file content
        content = await file.read()
        
        # Save new file to filesystem
        upload_dir = Path(f"/app/backend/uploads/self_petition_v2/{session_id}")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        safe_filename = file.filename.replace("/", "_").replace("\\", "_")
        new_file_path = upload_dir / f"{file_id}_reupload_{safe_filename}"
        
        with open(new_file_path, 'wb') as f:
            f.write(content)
        
        # Update file data
        old_filename = files[file_index].get('filename', '')
        files[file_index]['file_path'] = str(new_file_path)
        files[file_index]['filename'] = file.filename
        files[file_index]['content_type'] = file.content_type
        files[file_index]['size'] = len(content)
        files[file_index]['reuploaded'] = True
        files[file_index]['original_filename'] = old_filename
        
        # Update session with new file data
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "files": files,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Re-classify this specific file
        result = await classification_service.reclassify_single_file(
            session_id, 
            file_id, 
            str(new_file_path),
            file.filename
        )
        
        return {
            "file_id": file_id,
            "new_filename": file.filename,
            "old_filename": old_filename,
            "status": result.get('status', 'unknown'),
            "classification": result,
            "message": "Archivo re-subido y re-clasificado" if result.get('status') == 'classified' else "Archivo re-subido pero clasificación falló"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reuploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/reclassify-file/{file_id}")
async def reclassify_existing_file(
    session_id: str,
    file_id: str,
    current_user = Depends(get_current_user_dep)
):
    """
    Re-classify an existing file without re-uploading.
    Useful for retrying after a timeout or temporary error.
    """
    try:
        result = await classification_service.reclassify_single_file(session_id, file_id)
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "file_id": file_id,
            "status": result.get('status', 'unknown'),
            "classification": result,
            "message": "Re-clasificación exitosa" if result.get('status') == 'classified' else "Re-clasificación falló"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reclassifying file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/status")
async def get_v2_session_status(
    session_id: str,
    current_user = Depends(get_current_user_dep)
):
    """Get the current status of a V2 session including batch information"""
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        # LIGHTWEIGHT files summary (no file content - reduces response from 500KB to 5KB)
        files_summary = []
        for f in session.get('files', []):
            files_summary.append({
                "file_id": f.get('file_id'),
                "filename": f.get('filename'),
                "size": f.get('size'),
                "upload_status": f.get('upload_status')
            })
        
        # Summarized classifications (only status fields, no large text blocks)
        classifications = session.get('classifications', [])
        classifications_summary = [
            {
                "file_id":       c.get('file_id'),
                "filename":      c.get('filename'),
                "document_type": c.get('document_type'),
                "confidence":    c.get('confidence'),
                "summary":       c.get('summary'),
                "status":        c.get('status'),
                "exhibit_number":c.get('exhibit_number'),
                "batch_number":  c.get('batch_number'),
                "signer_name":   c.get('signer_name'),
                "error":         c.get('error'),
            }
            for c in classifications
        ]

        batch_summaries = session.get('batch_summaries', [])
        classified_count   = len([c for c in classifications if c.get('status') == 'classified'])
        needs_retry_count  = len([c for c in classifications if c.get('status') == 'needs_retry'])
        
        return {
            "session_id":            session['id'],
            "status":                session.get('status'),
            "progress":              session.get('progress', 0),
            "progress_message":      session.get('progress_message', ''),
            "total_files":           session.get('total_files', 0) or len(session.get('files', [])),
            "processed_files":       session.get('processed_files', 0) or len(classifications),
            "files":                 files_summary,
            "classifications":       classifications_summary,       # ← lightweight version
            "classification_reviewed": session.get('classification_reviewed', False),
            "applicant_name":        session.get('applicant_name', ''),
            "error_message":         session.get('error_message'),
            "batch_summaries":       batch_summaries,
            "completed_batches":     len(batch_summaries),
            "classified_count":      classified_count,
            "needs_retry_count":     needs_retry_count,
            "current_batch":         session.get('current_batch', 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting V2 session status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{session_id}/update-classification")
async def update_v2_classification(
    session_id: str,
    classification_id: str,
    updates: dict,
    current_user = Depends(get_current_user_dep)
):
    """Update a single document classification (user review)"""
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        # Find and update the classification
        classifications = session.get('classifications', [])
        updated = False
        for i, c in enumerate(classifications):
            if c.get('file_id') == classification_id:
                classifications[i].update(updates)
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Clasificación no encontrada")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "classifications": classifications,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Clasificación actualizada", "classification_id": classification_id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating V2 classification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/confirm-classifications")
async def confirm_v2_classifications(
    session_id: str,
    applicant_name: str,
    current_user = Depends(get_current_user_dep)
):
    """Confirm classifications and set applicant name before extraction"""
    try:
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "classification_reviewed": True,
                "applicant_name": applicant_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Clasificaciones confirmadas", "applicant_name": applicant_name}
    except Exception as e:
        logging.error(f"Error confirming V2 classifications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/start-generation")
async def start_v2_generation(
    session_id: str,
    background_tasks: BackgroundTasks,
    use_improved_v2: bool = True,
    current_user = Depends(get_current_user_dep)
):
    """
    Start the full extraction, synthesis, and generation process.
    
    By default uses the improved V2 generation (use_improved_v2=True) which does
    deeper document analysis and produces higher quality letters.
    
    Set use_improved_v2=False to use the legacy generation.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        if not session.get('classification_reviewed'):
            raise HTTPException(status_code=400, detail="Debes confirmar las clasificaciones primero")
        
        if not session.get('applicant_name'):
            raise HTTPException(status_code=400, detail="Debes ingresar el nombre del solicitante")
        
        # Update status
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "extracting",
                "progress": 35,
                "progress_message": f"Iniciando generación {'mejorada' if use_improved_v2 else 'estándar'}...",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if use_improved_v2:
            # Use improved V2 generation with deeper document analysis
            background_tasks.add_task(
                letter_generation_v2.generate_v2_letter_improved,
                session_id, db, openai_client
            )
            return {
                "session_id": session_id,
                "status": "extracting",
                "mode": "improved_v2",
                "message": "Generación mejorada iniciada. Este proceso analiza cada documento en profundidad (15-20 min)."
            }
        else:
            # Use legacy generation
            background_tasks.add_task(generate_v2_letter_background, session_id)
            return {
                "session_id": session_id,
                "status": "extracting",
                "mode": "legacy",
                "message": "Generación estándar iniciada. Este proceso puede tomar varios minutos."
            }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting V2 generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def generate_v2_letter_background(session_id: str):
    """Background task to generate the complete V2 self-petition letter"""
    from patent_extractor.file_handler import extract_text_from_file
    
    try:
        logging.warning(f"✍️ [V2] Starting letter generation for session {session_id}")
        
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            return
        
        applicant_name = session.get('applicant_name', 'The Applicant')
        classifications = session.get('classifications', [])
        files = session.get('files', [])
        
        # =====================================================================
        # PHASE 1: DETAILED EXTRACTION FROM EACH DOCUMENT
        # =====================================================================
        logging.warning(f"📝 [V2] Phase 1: Extracting detailed information from {len(classifications)} documents")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "extracting", "progress": 40, "progress_message": "Fase 1: Extrayendo información detallada..."}}
        )
        
        extracted_data = {
            "recommendation_letters": [],
            "academic_credentials": [],
            "professional_experience": [],
            "publications": [],
            "projects": [],
            "certificates": [],
            "studies": [],
            "other": []
        }
        
        for i, classification in enumerate(classifications):
            try:
                progress = 40 + int((i / len(classifications)) * 20)
                await db.self_petition_v2_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        "progress": progress,
                        "progress_message": f"Extrayendo de: {classification.get('filename', 'documento')} ({i+1}/{len(classifications)})"
                    }}
                )
                
                # Get file content
                file_data = next((f for f in files if f['file_id'] == classification['file_id']), None)
                if not file_data:
                    continue
                
                # Read file content from filesystem
                file_path = file_data.get('file_path')
                if file_path and Path(file_path).exists():
                    with open(file_path, 'rb') as f:
                        content_bytes = f.read()
                else:
                    logging.warning(f"File not found: {file_path}")
                    content_bytes = b""
                
                try:
                    text_content = extract_text_from_file(content_bytes, file_data['filename'])
                except Exception:
                    text_content = ""
                
                # Detailed extraction based on document type
                doc_type = classification.get('document_type', 'other')
                
                if doc_type == 'recommendation_letter':
                    extracted = await extraction_service.extract_recommendation_letter_details(text_content, classification)
                    extracted_data['recommendation_letters'].append(extracted)
                elif doc_type in ['diploma', 'certificate']:
                    extracted = await extraction_service.extract_credential_details(text_content, classification)
                    extracted_data['academic_credentials'].append(extracted)
                elif doc_type == 'cv':
                    extracted = await extraction_service.extract_cv_details(text_content, classification)
                    extracted_data['professional_experience'].append(extracted)
                elif doc_type == 'publication':
                    extracted = await extraction_service.extract_publication_details(text_content, classification)
                    extracted_data['publications'].append(extracted)
                elif doc_type in ['project', 'study']:
                    extracted = await extraction_service.extract_project_details(text_content, classification)
                    extracted_data['projects'].append(extracted)
                else:
                    extracted_data['other'].append({
                        "filename": classification.get('filename'),
                        "summary": classification.get('summary', ''),
                        "key_quotes": classification.get('key_quotes', [])
                    })
                    
            except Exception as e:
                logging.error(f"❌ Error extracting from {classification.get('filename')}: {e}")
        
        logging.warning(f"✅ [V2] Phase 1 complete. Extracted: {len(extracted_data['recommendation_letters'])} rec letters, {len(extracted_data['academic_credentials'])} credentials")
        
        # =====================================================================
        # PHASE 2: SYNTHESIZE INTO APPLICANT PROFILE
        # =====================================================================
        logging.warning("🧠 [V2] Phase 2: Synthesizing applicant profile")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "synthesizing", "progress": 65, "progress_message": "Fase 2: Sintetizando perfil del solicitante..."}}
        )
        
        applicant_profile = await extraction_service.synthesize_applicant_profile(applicant_name, extracted_data)
        
        # =====================================================================
        # PHASE 3: DRAFT THE LETTER IN ENGLISH
        # =====================================================================
        logging.warning("✍️ [V2] Phase 3: Drafting letter in English")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "drafting", "progress": 75, "progress_message": "Fase 3: Redactando carta en inglés..."}}
        )
        
        content_en = await letter_generation_service.draft_v2_letter_english(applicant_name, applicant_profile, extracted_data, classifications)
        
        # Clean the content to remove AI notes and meta-commentary
        content_en = letter_generation_service.clean_content(content_en)
        
        # =====================================================================
        # PHASE 4: TRANSLATE TO SPANISH
        # =====================================================================
        logging.warning("🌐 [V2] Phase 4: Translating to Spanish")
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "translating", "progress": 90, "progress_message": "Fase 4: Traduciendo al español..."}}
        )
        
        content_es = await letter_generation_service.translate_v2_letter_to_spanish(content_en)
        
        # Clean the translated content as well
        content_es = letter_generation_service.clean_content(content_es)
        
        # =====================================================================
        # SAVE FINAL LETTER
        # =====================================================================
        logging.warning("💾 [V2] Saving final letter")
        
        # Create the final letter document
        letter = SelfPetitionV2Letter(
            user_id=session.get('user_id'),
            client_id=session.get('client_id'),
            session_id=session_id,
            applicant_name=applicant_name,
            total_documents=len(classifications),
            document_summary=[{
                "filename": c.get('filename'),
                "type": c.get('document_type'),
                "exhibit": c.get('exhibit_number')
            } for c in classifications],
            content_en=content_en,
            content_es=content_es,
            status="completed"
        )
        
        await db.self_petition_v2_letters.insert_one(letter.model_dump())
        
        # Update session as completed
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "completed",
                "progress": 100,
                "progress_message": "¡Carta completada!",
                "content_en": content_en,
                "content_es": content_es,
                "applicant_profile": applicant_profile,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logging.warning(f"✅ [V2] Letter generation complete for session {session_id}")
        
    except Exception as e:
        logging.error(f"❌ [V2] Error generating letter: {str(e)}")
        import traceback
        traceback.print_exc()
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "error",
                "error_message": f"Error en generación: {str(e)}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )


@router.get("/letters")
async def get_v2_letters(
    client_id: Optional[str] = None,
    current_user = Depends(get_current_user_dep)
):
    """Get all V2 self-petition letters"""
    try:
        query = {}
        if client_id:
            query["client_id"] = client_id
        
        letters = await db.self_petition_v2_letters.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return letters
    except Exception as e:
        logging.error(f"Error getting V2 letters: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/letters/{letter_id}")
async def get_v2_letter(
    letter_id: str,
    current_user = Depends(get_current_user_dep)
):
    """Get a specific V2 letter"""
    try:
        letter = await db.self_petition_v2_letters.find_one({"id": letter_id}, {"_id": 0})
        if not letter:
            raise HTTPException(status_code=404, detail="Carta no encontrada")
        return letter
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting V2 letter: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/letters/{letter_id}/download")
async def download_v2_letter(
    letter_id: str,
    language: str = "en",
    current_user = Depends(get_current_user_dep)
):
    """Download V2 letter as PDF"""
    try:
        letter = await db.self_petition_v2_letters.find_one({"id": letter_id}, {"_id": 0})
        if not letter:
            raise HTTPException(status_code=404, detail="Carta no encontrada")
        
        content = letter.get('content_es') if language == 'es' else letter.get('content_en')
        applicant_name = letter.get('applicant_name', 'Applicant')
        
        # Generate PDF with proper HTML parsing
        from reportlab.lib.pagesizes import letter as LETTER_SIZE
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
        from reportlab.lib import colors
        from bs4 import BeautifulSoup, NavigableString, Tag
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=LETTER_SIZE,
                               leftMargin=1*inch, rightMargin=1*inch,
                               topMargin=1*inch, bottomMargin=1*inch)
        
        base_styles = getSampleStyleSheet()
        
        h1_style = ParagraphStyle('H1', parent=base_styles['Heading1'], fontSize=14, spaceAfter=10, spaceBefore=16, textColor=colors.HexColor('#1a1a2e'))
        h2_style = ParagraphStyle('H2', parent=base_styles['Heading2'], fontSize=12, spaceAfter=8, spaceBefore=14, textColor=colors.HexColor('#1a1a2e'))
        h3_style = ParagraphStyle('H3', parent=base_styles['Heading3'], fontSize=11, spaceAfter=6, spaceBefore=12, textColor=colors.HexColor('#1a1a2e'))
        h4_style = ParagraphStyle('H4', parent=base_styles['Normal'], fontSize=10, spaceAfter=4, spaceBefore=10, fontName='Helvetica-Bold')
        body_style = ParagraphStyle('Body', parent=base_styles['Normal'], fontSize=10, spaceAfter=6, leading=14, alignment=TA_JUSTIFY)
        bullet_style = ParagraphStyle('Bullet', parent=base_styles['Normal'], fontSize=10, spaceAfter=3, leading=14, leftIndent=20, bulletIndent=10)
        
        def element_to_rl_markup(elem):
            """Convert a single inline element to ReportLab XML markup string."""
            if isinstance(elem, NavigableString):
                txt = _pdf_safe(str(elem)).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                return txt
            if not isinstance(elem, Tag):
                return ''
            inner = ''.join(element_to_rl_markup(c) for c in elem.children)
            tag = elem.name.lower()
            if tag in ('strong', 'b'):
                return f'<b>{inner}</b>'
            elif tag in ('em', 'i'):
                return f'<i>{inner}</i>'
            elif tag == 'u':
                return f'<u>{inner}</u>'
            elif tag == 'br':
                return '<br/>'
            elif tag == 'span':
                return inner
            elif tag == 'a':
                return inner
            else:
                return inner

        def safe_para(markup, style):
            """Build a Paragraph, stripping tags on failure."""
            try:
                return Paragraph(markup, style)
            except Exception:
                clean = re.sub(r'<[^>]+>', '', markup)
                return Paragraph(clean, style)

        # ── Pre-process content: strip CSS blocks, replace placeholders ──────
        from datetime import date as _date
        today_str = _date.today().strftime("%B %d, %Y")  # e.g. "February 27, 2026"

        content_proc = content or ''
        # Remove inline <style>...</style> blocks entirely
        content_proc = re.sub(r'<style[^>]*>.*?</style>', '', content_proc, flags=re.DOTALL | re.IGNORECASE)
        # Remove <script>...</script> blocks
        content_proc = re.sub(r'<script[^>]*>.*?</script>', '', content_proc, flags=re.DOTALL | re.IGNORECASE)
        # Replace [Date] / [date] placeholders with today's date
        content_proc = re.sub(r'\[Date\]', today_str, content_proc, flags=re.IGNORECASE)
        # Replace [Service Center Address] with standard label
        content_proc = re.sub(r'\[Service Center Address\]', 'USCIS Service Center', content_proc, flags=re.IGNORECASE)
        # Highlight any surviving bracket placeholders ([VERIFY], [Project Name], etc.)
        # in red+bold so reviewers can spot and fix them. Previously this regex SILENTLY
        # stripped the brackets and left the placeholder text inline as regular prose
        # (e.g. "[Physical Address]" → "Physical Address"), which is the bug the user
        # was hitting. Keeping the brackets visible and red makes review trivial.
        content_proc = re.sub(
            r'\[([A-Z][A-Za-z0-9\s/_.-]{1,80})\]',
            r'<font color="#B91C1C"><b>[\1]</b></font>',
            content_proc,
        )

        SKIP_TAGS = {'head', 'style', 'script', 'meta', 'title', 'link', 'noscript'}

        def process_node(node, story):
            """Recursively process HTML nodes into ReportLab story elements."""
            if isinstance(node, NavigableString):
                text = str(node).strip()
                if text:
                    story.append(safe_para(text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), body_style))
                return
            if not isinstance(node, Tag):
                return
            tag = node.name.lower() if node.name else ''

            # Skip non-visible structural/meta tags
            if tag in SKIP_TAGS:
                return

            if tag == 'h1':
                markup = ''.join(element_to_rl_markup(c) for c in node.children)
                story.append(safe_para(markup, h1_style))
            elif tag == 'h2':
                markup = ''.join(element_to_rl_markup(c) for c in node.children)
                story.append(safe_para(markup, h2_style))
            elif tag == 'h3':
                markup = ''.join(element_to_rl_markup(c) for c in node.children)
                story.append(safe_para(markup, h3_style))
            elif tag in ('h4', 'h5', 'h6'):
                markup = ''.join(element_to_rl_markup(c) for c in node.children)
                story.append(safe_para(markup, h4_style))
            elif tag == 'p':
                markup = ''.join(element_to_rl_markup(c) for c in node.children).strip()
                if markup:
                    story.append(safe_para(markup, body_style))
                    story.append(Spacer(1, 3))
            elif tag in ('ul', 'ol'):
                for child in node.children:
                    if isinstance(child, Tag) and child.name == 'li':
                        markup = ''.join(element_to_rl_markup(c) for c in child.children).strip()
                        if markup:
                            story.append(safe_para(f'• {markup}', bullet_style))
            elif tag in ('div', 'section', 'article', 'body', 'html'):
                for child in node.children:
                    process_node(child, story)
            elif tag in ('strong', 'b', 'em', 'i', 'span'):
                markup = ''.join(element_to_rl_markup(c) for c in node.children).strip()
                if markup:
                    story.append(safe_para(markup, body_style))
            elif tag == 'br':
                story.append(Spacer(1, 4))
            else:
                for child in node.children:
                    process_node(child, story)

        soup = BeautifulSoup(content_proc, 'html.parser')
        story = []

        # If the content has no HTML structure, treat it as plain text
        if not soup.find(['h1','h2','h3','h4','p','ul','li']):
            for line in content_proc.split('\n'):
                line = line.strip()
                if line:
                    clean = _pdf_safe(re.sub(r'<[^>]+>', '', line))
                    story.append(safe_para(clean.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), body_style))
                    story.append(Spacer(1, 4))
        else:
            for child in soup.children:
                process_node(child, story)
        
        if not story:
            story.append(Paragraph("No content available", base_styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        
        lang_suffix = "ES" if language == "es" else "EN"
        filename = f"Self_Petition_V2_{applicant_name.replace(' ', '_')}_{lang_suffix}.pdf"
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error downloading V2 letter: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/letters/{letter_id}/download-docx")
async def download_v2_letter_docx(
    letter_id: str,
    language: str = "en",
    current_user = Depends(get_current_user_dep)
):
    """Download Self-Petition V2 letter as Microsoft Word (.docx)."""
    from docx_utils import build_docx_response

    letter = await db.self_petition_v2_letters.find_one({"id": letter_id}, {"_id": 0})
    if not letter:
        raise HTTPException(status_code=404, detail="Carta no encontrada")
    content = letter.get('content_es') if language == 'es' else letter.get('content_en')
    if not content:
        raise HTTPException(status_code=404, detail=f"Content not available in {language}")
    applicant_name = letter.get('applicant_name', 'Applicant')
    project_title = letter.get('project_title') or f"EB-2 NIW Self-Petition Letter ({applicant_name})"
    is_html = bool(re.search(r'<(p|h[1-6]|div|table|ul|ol)\b', content, re.IGNORECASE)) if isinstance(content, str) else False
    return build_docx_response(
        content=content,
        title=project_title,
        filename_stem=f"Self_Petition_V2_{applicant_name.replace(' ', '_')}",
        doc_type="Self-Petition Letter" if language == 'en' else "Carta de Auto-Petición",
        author=applicant_name,
        language=language,
        is_html=is_html,
        add_cover=False,
    )



# ============================================================================
# BATCH PROCESSING ENDPOINTS - Procesamiento por lotes
# ============================================================================

@router.get("/{session_id}/batch-status")
async def get_batch_status(
    session_id: str,
    current_user = Depends(get_current_user_dep)
):
    """
    Get the current batch processing status for a session.
    Returns information about completed batches, remaining files, and batch summaries.
    """
    try:
        result = await batch_processing_service.get_batch_status(session_id)
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting batch status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/process-next-batch")
async def process_next_batch(
    session_id: str,
    current_user = Depends(get_current_user_dep)
):
    """
    Process the next batch of documents.
    This is called by the frontend when user is ready to continue.
    Returns the batch results including synthesis summary.
    """
    try:
        result = await batch_processing_service.start_next_batch(session_id)
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing next batch: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/force-continue")
async def force_continue_classification(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user_dep)
):
    """
    Force the classification to continue if it's stuck.
    This will mark any stuck files as 'needs_retry' and continue with the next batch.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        current_status = session.get('status', '')

        # Accept ANY non-terminal status — also allows recovery from unexpected crash states
        terminal_statuses = ['letter_complete', 'complete', 'draft_ready']
        if current_status in terminal_statuses:
            return {
                "message": f"La carta ya está generada (estado: {current_status}). No se requiere forzar.",
                "status": current_status
            }
        
        # Mark current progress and restart
        files = session.get('files', [])
        classifications = session.get('classifications', [])
        classified_ids = {c.get('file_id') for c in classifications}
        stuck_files = [f for f in files if f['file_id'] not in classified_ids]
        
        # Reset to classifying so the new background task takes over cleanly
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "classifying",
                "progress_message": f"Reiniciando clasificación. {len(stuck_files)} archivos pendientes.",
                "error_message": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Start fresh batch processing
        background_tasks.add_task(batch_processing_service.process_all_batches_background, session_id)
        
        return {
            "session_id": session_id,
            "status": "restarted",
            "classified_so_far": len(classifications),
            "remaining": len(stuck_files),
            "message": f"Clasificación reiniciada. {len(stuck_files)} archivos pendientes de {len(files)} totales."
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error forcing continue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/{session_id}/start-batch-classification")
async def start_batch_classification(
    session_id: str,
    background_tasks: BackgroundTasks,
    process_all: bool = False,
    current_user = Depends(get_current_user_dep)
):
    """
    Start batch-based classification process.
    
    If process_all=True, processes all batches in background automatically.
    If process_all=False (default), processes only the first batch and waits for user to trigger next.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        if not session.get('files'):
            raise HTTPException(status_code=400, detail="No hay documentos para clasificar")
        
        # Initialize batch tracking if not present
        if 'batch_summaries' not in session:
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {"batch_summaries": []}}
            )
        
        if process_all:
            # Process all batches in background
            background_tasks.add_task(batch_processing_service.process_all_batches_background, session_id)
            return {
                "session_id": session_id,
                "status": "classifying",
                "mode": "automatic",
                "message": "Clasificación automática iniciada. Los documentos se procesarán en lotes."
            }
        else:
            # Process first batch synchronously (or return immediately if already started)
            result = await batch_processing_service.start_next_batch(session_id)
            return {
                "session_id": session_id,
                "status": "batch_complete" if result.get('status') == 'completed' else result.get('status'),
                "mode": "manual",
                "batch_result": result,
                "message": "Primer lote procesado. Revisa los resultados y continúa con el siguiente lote."
            }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting batch classification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/start-generation-v2")
async def start_generation_v2(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user_dep)
):
    """
    Start the improved V2 generation process using the new letter_generation_v2 service.
    This uses deeper document analysis and produces higher quality letters.
    """
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        if not session.get('classification_reviewed'):
            raise HTTPException(status_code=400, detail="Debes confirmar las clasificaciones primero")
        
        if not session.get('applicant_name'):
            raise HTTPException(status_code=400, detail="Debes ingresar el nombre del solicitante")
        
        # Update status
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "extracting",
                "progress": 35,
                "progress_message": "Iniciando generación mejorada de carta...",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Start improved background generation
        background_tasks.add_task(
            letter_generation_v2.generate_v2_letter_improved,
            session_id, db, openai_client
        )
        
        return {
            "session_id": session_id,
            "status": "extracting",
            "message": "Generación mejorada iniciada. Este proceso analiza cada documento en profundidad y puede tomar 15-20 minutos."
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting V2 generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
