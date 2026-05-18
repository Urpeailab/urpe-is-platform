"""
Batch Processing Service for Self-Petition V2
Sistema de procesamiento por lotes inspirado en la sugerencia del usuario.

Características:
- Procesa documentos en lotes pequeños (ej. 7 a la vez)
- Genera resúmenes intermedios después de cada lote
- Permite al usuario ver el progreso en tiempo real
- Solo genera la carta final cuando todos los lotes están procesados
- Diseñado para no bloquear el servidor y evitar errores 520
"""
import asyncio
import logging
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# These will be injected from the main app
db = None
openai_client = None

# Configuration
BATCH_SIZE = 7  # Process 7 documents at a time
TIMEOUT_PER_DOC = 30  # 30 seconds per document
MAX_TEXT_LENGTH = 5000  # Max text to send to GPT for classification


def init_service(database, client):
    """Initialize the service with database and OpenAI client"""
    global db, openai_client
    db = database
    openai_client = client


async def extract_text_from_file_safe(file_path: str, filename: str, timeout: int = 15) -> str:
    """Extract text from file safely with timeout"""
    from patent_extractor.file_handler import extract_text_from_file
    
    try:
        if not file_path or not Path(file_path).exists():
            logging.warning(f"      ⚠️ File not found: {filename}")
            return f"[Archivo: {filename}]"
        
        logging.warning(f"      📄 Extracting text from {filename[:20]}...")
        
        def read_and_extract():
            with open(file_path, 'rb') as f:
                content = f.read(10 * 1024 * 1024)  # Max 10MB
            return extract_text_from_file(content, filename)
        
        text = await asyncio.wait_for(
            asyncio.to_thread(read_and_extract),
            timeout=timeout
        )
        
        text_len = len(text) if text else 0
        logging.warning(f"      ✅ Extracted {text_len} chars from {filename[:20]}")
        return text if text else f"[Archivo: {filename}]"
        
    except asyncio.TimeoutError:
        logging.warning(f"      ⏱️ Timeout extracting text from {filename[:20]}")
        return f"[Archivo: {filename} - Timeout extrayendo texto]"
    except Exception as e:
        logging.error(f"      ❌ Error extracting text from {filename}: {e}")
        return f"[Archivo: {filename} - Error: {str(e)[:50]}]"


async def classify_single_document(file_id: str, filename: str, text_content: str) -> dict:
    """
    Classify a single document using GPT-4o.
    Returns classification result with summary.
    """
    text_sample = text_content[:MAX_TEXT_LENGTH] if text_content else f"[Archivo: {filename}]"
    
    # If no meaningful content, return immediately
    if len(text_sample.strip()) < 30:
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": "Sin contenido extraíble. Sube en otro formato (PDF texto, no imagen).",
            "status": "needs_retry",
            "error": "no_content"
        }
    
    prompt = f"""Clasifica este documento para una petición EB-2 NIW. Responde SOLO JSON:

ARCHIVO: {filename}
TEXTO (primeros {len(text_sample)} caracteres):
{text_sample[:3500]}

JSON (sin explicaciones):
{{
    "document_type": "passport|recommendation_letter|diploma|cv|publication|project|employment_verification|certificate|award|other",
    "confidence": 0.0-1.0,
    "summary": "Resumen detallado en español (3-4 oraciones describiendo el contenido y relevancia para NIW)",
    "signer_name": "nombre del firmante si es carta de recomendación, null si no",
    "key_information": ["punto clave 1", "punto clave 2", "punto clave 3"]
}}"""

    try:
        logging.warning(f"      🤖 Calling OpenAI for {filename[:20]}...")
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Clasificador de documentos para peticiones EB-2 NIW. Responde solo JSON válido. Extrae información clave."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=800,
                timeout=20,  # OpenAI SDK timeout
                response_format={"type": "json_object"}
            ),
            timeout=25  # asyncio timeout as backup
        )
        logging.warning(f"      ✅ OpenAI response received for {filename[:20]}")
        
        result = json.loads(response.choices[0].message.content)
        result['file_id'] = file_id
        result['filename'] = filename
        result['status'] = 'classified'
        return result
        
    except asyncio.TimeoutError:
        logging.warning(f"      ⏱️ asyncio.TimeoutError for {filename[:20]}")
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": "⏱️ Timeout en clasificación. Reintenta o sube en formato más ligero.",
            "status": "needs_retry",
            "error": "timeout"
        }
    except Exception as e:
        logging.warning(f"      ❌ Exception for {filename[:20]}: {type(e).__name__}: {str(e)[:50]}")
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": f"Error en clasificación: {str(e)[:60]}",
            "status": "needs_retry",
            "error": str(e)[:150]
        }


async def process_single_file_with_classification(file_id: str, filename: str, file_path: str) -> dict:
    """
    Process a single file: extract text and classify.
    This is wrapped with a timeout in the batch processor.
    """
    # Extract text
    text_content = await extract_text_from_file_safe(file_path, filename, timeout=15)
    
    # Classify
    classification = await classify_single_document(file_id, filename, text_content)
    
    return classification


async def process_batch(session_id: str, batch_number: int) -> dict:
    """
    Process a single batch of documents.
    Returns batch results including a synthesis summary.
    """
    logging.warning(f"📦 [BATCH] Processing batch {batch_number} for session {session_id}")
    start_time = time.time()
    
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            return {"error": "Session not found"}
        
        files = session.get('files', [])
        existing_classifications = session.get('classifications', [])
        classified_file_ids = {c.get('file_id') for c in existing_classifications if c.get('status') == 'classified'}
        
        # Get files that need processing
        files_to_process = [f for f in files if f['file_id'] not in classified_file_ids]
        
        if not files_to_process:
            return {
                "batch_number": batch_number,
                "status": "all_processed",
                "message": "Todos los documentos han sido procesados"
            }
        
        # Get the batch for this iteration
        batch_files = files_to_process[:BATCH_SIZE]
        
        logging.warning(f"   Processing {len(batch_files)} files in batch {batch_number}")
        
        # Update progress
        total_files = len(files)
        processed_so_far = len(classified_file_ids)
        progress = 5 + int((processed_so_far / total_files) * 25)
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "classifying",
                "progress": progress,
                "progress_message": f"Lote {batch_number}: Procesando {len(batch_files)} documentos...",
                "current_batch": batch_number,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        batch_results = []
        
        # Semaphore limits concurrent OpenAI calls to 3 to avoid memory spikes
        # For large datasets (>30 files), use only 2 concurrent to be safer
        max_concurrent = 2 if len(files) > 30 else 3
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_with_semaphore(file_data, exhibit_num):
            async with semaphore:
                file_id  = file_data['file_id']
                filename = file_data['filename']
                file_path = file_data.get('file_path')
                try:
                    # Update progress for this specific file
                    await db.self_petition_v2_sessions.update_one(
                        {"id": session_id},
                        {"$set": {"progress_message": f"Lote {batch_number}: Clasificando {filename[:30]}..."}}
                    )
                    result = await asyncio.wait_for(
                        process_single_file_with_classification(file_id, filename, file_path),
                        timeout=45
                    )
                    result['exhibit_number'] = exhibit_num
                    result['batch_number']   = batch_number
                    return result
                except asyncio.TimeoutError:
                    return {
                        "file_id": file_id, "filename": filename,
                        "document_type": "other", "confidence": 0.0,
                        "summary": "⏱️ Timeout (45s). Intenta con formato más ligero.",
                        "status": "needs_retry", "error": "timeout_45s",
                        "exhibit_number": exhibit_num, "batch_number": batch_number
                    }
                except Exception as e:
                    return {
                        "file_id": file_id, "filename": filename,
                        "document_type": "other", "confidence": 0.0,
                        "summary": f"Error: {str(e)[:80]}",
                        "status": "needs_retry", "error": str(e)[:200],
                        "exhibit_number": exhibit_num, "batch_number": batch_number
                    }

        # Fire all files in this batch in parallel (limited by semaphore)
        tasks = [
            process_with_semaphore(file_data, len(existing_classifications) + i + 1)
            for i, file_data in enumerate(batch_files)
        ]
        batch_results = await asyncio.gather(*tasks, return_exceptions=False)
        
        # Generate batch synthesis
        successful_results = [r for r in batch_results if r.get('status') == 'classified']
        batch_synthesis = await generate_batch_synthesis(batch_number, successful_results)
        
        # Update session with batch results
        all_classifications = existing_classifications + batch_results
        batch_summaries = session.get('batch_summaries', [])
        batch_summaries.append({
            "batch_number": batch_number,
            "files_processed": len(batch_results),
            "successful": len(successful_results),
            "failed": len(batch_results) - len(successful_results),
            "synthesis": batch_synthesis,
            "processed_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Calculate remaining files
        remaining = len(files) - len(all_classifications)
        
        new_status = "reviewing" if remaining == 0 else "batch_complete"
        new_progress = 30 if remaining == 0 else 5 + int((len(all_classifications) / len(files)) * 25)
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "classifications": all_classifications,
                "batch_summaries": batch_summaries,
                "status": new_status,
                "progress": new_progress,
                "progress_message": f"Lote {batch_number} completado. {successful_results.__len__()} OK, {len(batch_results) - len(successful_results)} con error. {remaining} pendientes.",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        elapsed = time.time() - start_time
        logging.warning(f"✅ [BATCH] Batch {batch_number} completed in {elapsed:.1f}s")
        
        # ── Free memory between batches to prevent production memory spikes ──
        import gc
        batch_results.clear()
        successful_results.clear()
        gc.collect()
        # Brief yield to the event loop so polling requests can get through
        await asyncio.sleep(0.5)
        
        return {
            "batch_number": batch_number,
            "status": "completed",
            "files_processed": len(batch_results),
            "successful": len(successful_results),
            "failed": len(batch_results) - len(successful_results),
            "remaining_files": remaining,
            "synthesis": batch_synthesis,
            "elapsed_seconds": elapsed,
            "all_done": remaining == 0
        }
        
    except Exception as e:
        logging.error(f"❌ [BATCH] Error in batch {batch_number}: {e}")
        return {
            "batch_number": batch_number,
            "status": "error",
            "error": str(e)
        }


async def generate_batch_synthesis(batch_number: int, classifications: List[dict]) -> str:
    """
    Generate a synthesis summary for a batch of classified documents.
    This helps the user understand what was found in this batch.
    """
    if not classifications:
        return "No se pudo analizar ningún documento en este lote."
    
    # Prepare document summaries for synthesis
    doc_summaries = []
    for c in classifications:
        doc_summaries.append(f"- {c.get('filename')}: [{c.get('document_type')}] {c.get('summary', '')}")
    
    summaries_text = "\n".join(doc_summaries)
    
    prompt = f"""Basándote en los siguientes documentos clasificados en el Lote {batch_number}, genera un resumen ejecutivo breve (3-4 oraciones) de lo que se encontró:

DOCUMENTOS CLASIFICADOS:
{summaries_text}

RESUMEN EJECUTIVO (en español, 3-4 oraciones máximo):"""

    try:
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Genera resúmenes ejecutivos concisos de documentos de inmigración NIW."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=300
            ),
            timeout=20
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error generating batch synthesis: {e}")
        return f"Lote {batch_number}: {len(classifications)} documentos procesados ({', '.join([c.get('document_type', 'otro') for c in classifications[:3]])}...)"


async def get_batch_status(session_id: str) -> dict:
    """
    Get the current batch processing status for a session.
    """
    session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return {"error": "Session not found"}
    
    files = session.get('files', [])
    classifications = session.get('classifications', [])
    batch_summaries = session.get('batch_summaries', [])
    
    classified_count = len([c for c in classifications if c.get('status') == 'classified'])
    needs_retry_count = len([c for c in classifications if c.get('status') == 'needs_retry'])
    remaining = len(files) - len(classifications)
    
    total_batches_needed = (len(files) + BATCH_SIZE - 1) // BATCH_SIZE
    current_batch = len(batch_summaries) + 1 if remaining > 0 else len(batch_summaries)
    
    return {
        "session_id": session_id,
        "total_files": len(files),
        "classified": classified_count,
        "needs_retry": needs_retry_count,
        "remaining": remaining,
        "batch_size": BATCH_SIZE,
        "total_batches": total_batches_needed,
        "completed_batches": len(batch_summaries),
        "current_batch": current_batch,
        "batch_summaries": batch_summaries,
        "all_processed": remaining == 0,
        "status": session.get('status'),
        "progress": session.get('progress', 0),
        "progress_message": session.get('progress_message', '')
    }


async def start_next_batch(session_id: str) -> dict:
    """
    Start processing the next batch of documents.
    This is called by the frontend when user is ready to continue.
    """
    session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return {"error": "Session not found"}
    
    batch_summaries = session.get('batch_summaries', [])
    next_batch_number = len(batch_summaries) + 1
    
    return await process_batch(session_id, next_batch_number)


async def process_all_batches_background(session_id: str):
    """
    Process all remaining batches in background.
    Alternative to processing batch by batch manually.
    """
    logging.warning(f"🚀 [BATCH-ALL] Starting full batch processing for session {session_id}")
    
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            return
        
        files = session.get('files', [])
        classifications = session.get('classifications', [])
        batch_summaries = session.get('batch_summaries', [])
        
        # Calculate how many batches we need
        classified_file_ids = {c.get('file_id') for c in classifications if c.get('status') == 'classified'}
        remaining_files = [f for f in files if f['file_id'] not in classified_file_ids]
        
        batch_number = len(batch_summaries) + 1
        
        while remaining_files:
            result = await process_batch(session_id, batch_number)
            
            if result.get('status') == 'error':
                logging.error(f"Batch {batch_number} failed: {result.get('error')}")
                break
            
            if result.get('all_done'):
                break
            
            # Update session data for next iteration
            session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
            classifications = session.get('classifications', [])
            classified_file_ids = {c.get('file_id') for c in classifications if c.get('status') == 'classified'}
            remaining_files = [f for f in files if f['file_id'] not in classified_file_ids]
            
            batch_number += 1
            
            # Small delay between batches
            await asyncio.sleep(0.5)
        
        logging.warning(f"✅ [BATCH-ALL] All batches completed for session {session_id}")
        
    except Exception as e:
        logging.error(f"❌ [BATCH-ALL] Error in batch processing: {e}")
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "error",
                "error_message": f"Error en procesamiento por lotes: {str(e)}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
