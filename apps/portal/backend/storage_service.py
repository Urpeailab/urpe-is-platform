"""
Supabase Storage Service - SOLO para almacenamiento de archivos
NO afecta la autenticación existente del sistema
"""
import os
import uuid
from supabase import create_client, Client
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

# Usa las mismas credenciales del cliente principal de Supabase
SUPABASE_URL = os.environ.get('SUPABASE_STORAGE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_STORAGE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
BUCKET_NAME = os.environ.get('SUPABASE_STORAGE_BUCKET', 'urpe-documents')

# Cliente de Supabase (SOLO para storage)
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"✅ Supabase Storage conectado: {SUPABASE_URL}")
        logger.info(f"📦 Bucket configurado: {BUCKET_NAME}")
    except Exception as e:
        logger.error(f"❌ Error al conectar Supabase Storage: {e}")
else:
    logger.warning("⚠️ Supabase Storage no configurado - usando modo fallback")


def upload_file(file_content: bytes, filename: str, folder: str = "documents") -> Dict[str, str]:
    """
    Sube un archivo a Supabase Storage
    
    Args:
        file_content: Contenido del archivo en bytes
        filename: Nombre original del archivo
        folder: Carpeta dentro del bucket (documents, deliverables, etc.)
    
    Returns:
        Dict con 'success', 'fileUrl', 'filePath'
    """
    try:
        if not supabase:
            raise Exception("Supabase Storage no está configurado")
        
        # Generar nombre único para el archivo
        file_extension = filename.split('.')[-1] if '.' in filename else 'pdf'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = f"{folder}/{unique_filename}"
        
        logger.info(f"📤 Subiendo archivo a Supabase: {file_path}")
        
        # Subir archivo a Supabase Storage
        supabase.storage.from_(BUCKET_NAME).upload(
            file_path,
            file_content,
            file_options={
                "content-type": get_content_type(file_extension),
                "upsert": "false"
            }
        )
        
        # Obtener URL pública del archivo
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)
        
        logger.info(f"✅ Archivo subido exitosamente: {public_url}")
        
        return {
            "success": True,
            "fileUrl": public_url,
            "filePath": file_path,
            "originalName": filename
        }
        
    except Exception as e:
        logger.error(f"❌ Error al subir archivo a Supabase: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def delete_file(file_path: str) -> Dict[str, bool]:
    """
    Elimina un archivo de Supabase Storage
    
    Args:
        file_path: Ruta del archivo en el bucket (ej: "documents/uuid.pdf")
    
    Returns:
        Dict con 'success' y opcionalmente 'error'
    """
    try:
        if not supabase:
            raise Exception("Supabase Storage no está configurado")
        
        logger.info(f"🗑️ Eliminando archivo de Supabase: {file_path}")
        
        supabase.storage.from_(BUCKET_NAME).remove([file_path])
        
        logger.info(f"✅ Archivo eliminado exitosamente: {file_path}")
        
        return {
            "success": True
        }
        
    except Exception as e:
        logger.error(f"❌ Error al eliminar archivo de Supabase: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def get_content_type(extension: str) -> str:
    """
    Obtiene el content-type basado en la extensión del archivo
    """
    content_types = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'txt': 'text/plain',
        'zip': 'application/zip'
    }
    return content_types.get(extension.lower(), 'application/octet-stream')


def get_file_url(file_path: str) -> Optional[str]:
    """
    Obtiene la URL pública de un archivo
    
    Args:
        file_path: Ruta del archivo en el bucket
    
    Returns:
        URL pública o None si hay error
    """
    try:
        if not supabase:
            return None
        
        return supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)
        
    except Exception as e:
        logger.error(f"❌ Error al obtener URL del archivo: {e}")
        return None


# Función para verificar conexión (útil para debugging)
def test_connection() -> bool:
    """
    Prueba la conexión con Supabase Storage
    """
    try:
        if not supabase:
            logger.error("❌ Cliente de Supabase no inicializado")
            return False
        
        # Intentar listar buckets para verificar conexión
        buckets = supabase.storage.list_buckets()
        logger.info(f"✅ Conexión exitosa. Buckets disponibles: {len(buckets)}")
        
        # Verificar si nuestro bucket existe
        bucket_exists = any(b['name'] == BUCKET_NAME for b in buckets)
        if bucket_exists:
            logger.info(f"✅ Bucket '{BUCKET_NAME}' encontrado")
        else:
            logger.warning(f"⚠️ Bucket '{BUCKET_NAME}' no encontrado. Créalo en Supabase Dashboard")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error al probar conexión: {e}")
        return False
