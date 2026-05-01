"""
Classification service for Self-Petition V2 documents
SISTEMA ROBUSTO - Diseñado para 50+ archivos sin caerse

Características:
- Procesamiento en batches paralelos (3 archivos simultáneos)
- Timeout agresivo de 20 segundos por archivo
- Si un archivo falla, continúa inmediatamente con el siguiente
- Guarda progreso después de cada batch
- Extracción de texto simplificada si falla la normal
- Nunca se bloquea - siempre termina
"""
import asyncio
import logging
import time
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# These will be injected from the main app
db = None
openai_client = None


def init_service(database, client):
    """Initialize the service with database and OpenAI client"""
    global db, openai_client
    db = database
    openai_client = client


async def classify_single_document_fast(file_id: str, filename: str, text_content: str) -> dict:
    """
    Clasificación RÁPIDA de documento con GPT-4o.
    Prompt optimizado para respuestas rápidas.
    """
    text_sample = text_content[:5000] if text_content else f"[Archivo: {filename}]"
    
    # If no meaningful content, return immediately
    if len(text_sample.strip()) < 30:
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": "Sin contenido extraíble. Re-sube en otro formato.",
            "status": "needs_retry",
            "error": "no_content"
        }
    
    # Simplified prompt for faster response
    prompt = f"""Clasifica este documento para EB-2 NIW. Responde SOLO JSON:

ARCHIVO: {filename}
TEXTO: {text_sample[:3000]}

JSON (sin explicaciones):
{{"document_type":"passport|recommendation_letter|diploma|cv|publication|project|employment_verification|certificate|award|other","confidence":0.0-1.0,"summary":"resumen en español (1-2 oraciones)","signer_name":"nombre o null"}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Clasificador rápido. Solo JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        result['file_id'] = file_id
        result['filename'] = filename
        result['status'] = 'classified'
        return result
        
    except Exception as e:
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": f"Error GPT: {str(e)[:60]}",
            "status": "needs_retry",
            "error": str(e)[:150]
        }


async def _process_file_internal(file_data: dict, max_text: int, exhibit_num: int) -> dict:
    """Procesamiento interno de un archivo"""
    from patent_extractor.file_handler import extract_text_from_file
    
    file_id = file_data['file_id']
    filename = file_data['filename']
    file_path = file_data.get('file_path')
    
    # Step 1: Read file (non-blocking)
    content_bytes = b""
    if file_path and Path(file_path).exists():
        try:
            def read_file():
                with open(file_path, 'rb') as f:
                    return f.read(10 * 1024 * 1024)  # Max 10MB
            content_bytes = await asyncio.to_thread(read_file)
        except Exception as e:
            logging.warning(f"Error reading {filename}: {e}")
    
    # Step 2: Extract text (with internal timeout)
    text_content = ""
    if content_bytes:
        try:
            text_content = await asyncio.wait_for(
                asyncio.to_thread(extract_text_from_file, content_bytes, filename),
                timeout=15
            )
        except asyncio.TimeoutError:
            text_content = f"[Archivo: {filename}]"
        except Exception as e:
            text_content = f"[Archivo: {filename} - Error: {str(e)[:50]}]"
    else:
        text_content = f"[Archivo: {filename}]"
    
    # Step 3: Classify with GPT-4o
    classification = await classify_single_document_fast(file_id, filename, text_content[:max_text])
    classification['exhibit_number'] = exhibit_num
    
    return classification


async def process_single_file_safe(file_data: dict, timeout: int, max_text: int, exhibit_num: int) -> dict:
    """
    Procesa un solo archivo de forma segura con timeout.
    NUNCA lanza excepciones - siempre devuelve un resultado.
    """
    file_id = file_data['file_id']
    filename = file_data['filename']
    
    try:
        return await asyncio.wait_for(
            _process_file_internal(file_data, max_text, exhibit_num),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": f"⏱️ Timeout ({timeout}s). Sube en formato más ligero.",
            "status": "needs_retry",
            "error": "timeout",
            "exhibit_number": exhibit_num
        }
    except Exception as e:
        return {
            "file_id": file_id,
            "filename": filename,
            "document_type": "other",
            "confidence": 0.0,
            "summary": f"Error: {str(e)[:80]}",
            "status": "needs_retry",
            "error": str(e)[:200],
            "exhibit_number": exhibit_num
        }


async def classify_v2_documents_background(session_id: str):
    """
    SISTEMA ROBUSTO DE CLASIFICACIÓN - Diseñado para 50+ archivos
    """
    BATCH_SIZE = 3
    TIMEOUT_PER_DOC = 20
    MAX_TEXT_LENGTH = 5000
    
    logging.warning(f"🚀 [V2-CLASSIFY] INICIANDO - Session: {session_id}")
    start_time = time.time()
    
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            logging.error(f"❌ Sesión no encontrada: {session_id}")
            return
        
        files = session.get('files', [])
        total_files = len(files)
        
        # Get existing successful classifications
        existing_classifications = session.get('classifications', [])
        existing_file_ids = {c.get('file_id') for c in existing_classifications if c.get('status') == 'classified'}
        classifications = [c for c in existing_classifications if c.get('status') == 'classified']
        
        # Filter files that need processing
        files_to_process = [f for f in files if f['file_id'] not in existing_file_ids]
        
        logging.warning(f"📁 Total: {total_files} | Ya clasificados: {len(classifications)} | Por procesar: {len(files_to_process)}")
        
        if not files_to_process:
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {"status": "reviewing", "progress": 30}}
            )
            return
        
        success_count = len(classifications)
        error_count = 0
        
        # Process in batches
        for batch_start in range(0, len(files_to_process), BATCH_SIZE):
            batch = files_to_process[batch_start:batch_start + BATCH_SIZE]
            batch_num = (batch_start // BATCH_SIZE) + 1
            total_batches = (len(files_to_process) + BATCH_SIZE - 1) // BATCH_SIZE
            
            logging.warning(f"📦 BATCH {batch_num}/{total_batches}")
            
            # Update progress
            progress = 5 + int((len(classifications) / total_files) * 25)
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    "progress": progress,
                    "progress_message": f"Batch {batch_num}/{total_batches}..."
                }}
            )
            
            # Process batch in parallel
            tasks = [
                process_single_file_safe(f, TIMEOUT_PER_DOC, MAX_TEXT_LENGTH, len(classifications) + i + 1)
                for i, f in enumerate(batch)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    classification = {
                        "file_id": batch[i]['file_id'],
                        "filename": batch[i]['filename'],
                        "document_type": "other",
                        "summary": f"Error: {str(result)[:80]}",
                        "status": "needs_retry",
                        "exhibit_number": len(classifications) + 1
                    }
                    error_count += 1
                else:
                    classification = result
                    if result.get('status') == 'classified':
                        success_count += 1
                    else:
                        error_count += 1
                
                classifications.append(classification)
            
            # Save after each batch
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {"classifications": classifications}}
            )
            
            await asyncio.sleep(0.2)
        
        # Final update
        total_time = time.time() - start_time
        needs_retry_count = len([c for c in classifications if c.get('status') == 'needs_retry'])
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "classifications": classifications,
                "status": "reviewing",
                "progress": 30,
                "progress_message": f"✅ {success_count} OK, {needs_retry_count} requieren atención",
                "classification_stats": {
                    "total": total_files,
                    "success": success_count,
                    "needs_retry": needs_retry_count
                },
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logging.warning(f"✅ COMPLETADO en {total_time:.1f}s - OK: {success_count}, Errores: {needs_retry_count}")
        
    except Exception as e:
        logging.error(f"❌ ERROR CRÍTICO: {str(e)}")
        try:
            await db.self_petition_v2_sessions.update_one(
                {"id": session_id},
                {"$set": {"status": "reviewing", "progress": 30, "error_message": str(e)}}
            )
        except:
            pass


async def reclassify_single_file(session_id: str, file_id: str, new_file_path: str = None, new_filename: str = None):
    """Re-classify a single file that previously failed."""
    from patent_extractor.file_handler import extract_text_from_file
    
    try:
        session = await db.self_petition_v2_sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            return {"error": "Sesión no encontrada"}
        
        files = session.get('files', [])
        file_data = next((f for f in files if f['file_id'] == file_id), None)
        
        if not file_data:
            return {"error": "Archivo no encontrado"}
        
        file_path = new_file_path or file_data.get('file_path')
        filename = new_filename or file_data.get('filename')
        
        # Read and extract text
        content_bytes = b""
        if file_path and Path(file_path).exists():
            with open(file_path, 'rb') as f:
                content_bytes = f.read()
        
        text_content = ""
        if content_bytes:
            try:
                text_content = extract_text_from_file(content_bytes, filename)
            except Exception as e:
                logging.error(f"Error extracting text: {e}")
        
        # Classify
        classification = await classify_single_document_fast(file_id, filename, text_content)
        
        # Update session
        classifications = session.get('classifications', [])
        updated = False
        for i, c in enumerate(classifications):
            if c.get('file_id') == file_id:
                classification['exhibit_number'] = c.get('exhibit_number', i + 1)
                classifications[i] = classification
                updated = True
                break
        
        if not updated:
            classification['exhibit_number'] = len(classifications) + 1
            classifications.append(classification)
        
        # Update stats
        success_count = len([c for c in classifications if c.get('status') == 'classified'])
        needs_retry_count = len([c for c in classifications if c.get('status') == 'needs_retry'])
        
        await db.self_petition_v2_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "classifications": classifications,
                "classification_stats": {
                    "total": len(files),
                    "success": success_count,
                    "needs_retry": needs_retry_count
                }
            }}
        )
        
        return classification
        
    except Exception as e:
        logging.error(f"Error reclassifying file: {e}")
        return {"error": str(e)}
