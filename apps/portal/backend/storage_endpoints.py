"""
Storage Management Endpoints
Endpoints para gestionar archivos en Supabase Storage
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import storage_service
import logging

logger = logging.getLogger(__name__)


def setup_storage_endpoints(verify_admin_token, db):
    """
    Setup storage management endpoints
    Args:
        verify_admin_token: Admin authentication dependency
        db: MongoDB database instance
    """
    router = APIRouter(prefix="/api/storage", tags=["storage"])
    
    @router.get("/files", response_model=Dict[str, Any])
    async def list_all_files(admin=Depends(verify_admin_token)):
        """
        Lista todos los archivos en el bucket de Supabase Storage
        Requiere autenticación de admin
        """
        try:
            if not storage_service.supabase:
                raise HTTPException(status_code=503, detail="Supabase Storage no está configurado")
            
            # Listar todos los archivos en el bucket
            files_response = storage_service.supabase.storage.from_(storage_service.BUCKET_NAME).list()
            
            # Procesar archivos y obtener información detallada
            all_files = []
            
            # Función recursiva para listar archivos en todas las carpetas
            def process_folder(folder_path="", files_list=None):
                if files_list is None:
                    files_list = storage_service.supabase.storage.from_(storage_service.BUCKET_NAME).list(folder_path)
                
                for item in files_list:
                    if item.get('id'):  # Es un archivo
                        file_path = f"{folder_path}/{item['name']}" if folder_path else item['name']
                        
                        # Obtener URL pública
                        public_url = storage_service.supabase.storage.from_(storage_service.BUCKET_NAME).get_public_url(file_path)
                        
                        # Extraer información del archivo
                        file_info = {
                            'id': item['id'],
                            'name': item['name'],
                            'path': file_path,
                            'url': public_url,
                            'size': item.get('metadata', {}).get('size', 0),
                            'mimeType': item.get('metadata', {}).get('mimetype', 'unknown'),
                            'createdAt': item.get('created_at'),
                            'updatedAt': item.get('updated_at'),
                            'folder': folder_path or 'root'
                        }
                        all_files.append(file_info)
                    else:  # Es una carpeta
                        folder_name = item['name']
                        new_folder_path = f"{folder_path}/{folder_name}" if folder_path else folder_name
                        process_folder(new_folder_path)
            
            # Procesar todas las carpetas
            process_folder()
            
            # Enriquecer archivos con información del usuario
            for file in all_files:
                file_url = file['url']
                
                # Buscar en documents (documentos subidos por clientes)
                document = await db.documents.find_one({'fileUrl': file_url}, {'_id': 0, 'userId': 1, 'documentType': 1})
                
                if document:
                    user_id = document.get('userId')
                    if user_id:
                        # Buscar información del usuario
                        user = await db.users.find_one({'id': user_id}, {'_id': 0, 'name': 1, 'email': 1})
                        if user:
                            file['userName'] = user.get('name', 'N/A')
                            file['userEmail'] = user.get('email', 'N/A')
                            file['uploadedBy'] = 'Cliente'
                            file['documentType'] = document.get('documentType', 'N/A')
                        else:
                            file['userName'] = 'Usuario no encontrado'
                            file['userEmail'] = 'N/A'
                            file['uploadedBy'] = 'Cliente'
                    continue
                
                # Buscar en deliverables (archivos subidos por admin)
                deliverable = await db.deliverables.find_one({'fileUrl': file_url}, {'_id': 0, 'caseId': 1, 'type': 1})
                
                if deliverable:
                    case_id = deliverable.get('caseId')
                    if case_id:
                        # Buscar el caso y su usuario
                        case = await db.cases.find_one({'id': case_id}, {'_id': 0, 'userId': 1})
                        if case:
                            user_id = case.get('userId')
                            user = await db.users.find_one({'id': user_id}, {'_id': 0, 'name': 1, 'email': 1})
                            if user:
                                file['userName'] = user.get('name', 'N/A')
                                file['userEmail'] = user.get('email', 'N/A')
                                file['uploadedBy'] = 'Admin (para cliente)'
                                file['documentType'] = deliverable.get('type', 'N/A')
                            else:
                                file['userName'] = 'Usuario no encontrado'
                                file['userEmail'] = 'N/A'
                                file['uploadedBy'] = 'Admin'
                        else:
                            file['userName'] = 'Caso no encontrado'
                            file['userEmail'] = 'N/A'
                            file['uploadedBy'] = 'Admin'
                    continue
                
                # Si no se encuentra en ninguna colección
                file['userName'] = 'Sistema/Prueba'
                file['userEmail'] = 'N/A'
                file['uploadedBy'] = 'Sistema'
                file['documentType'] = 'N/A'
            
            # Calcular estadísticas
            total_size = sum(file['size'] for file in all_files)
            total_files = len(all_files)
            
            # Agrupar por tipo de archivo
            by_type = {}
            for file in all_files:
                mime_type = file['mimeType']
                if mime_type not in by_type:
                    by_type[mime_type] = {'count': 0, 'size': 0}
                by_type[mime_type]['count'] += 1
                by_type[mime_type]['size'] += file['size']
            
            # Agrupar por carpeta
            by_folder = {}
            for file in all_files:
                folder = file['folder']
                if folder not in by_folder:
                    by_folder[folder] = {'count': 0, 'size': 0}
                by_folder[folder]['count'] += 1
                by_folder[folder]['size'] += file['size']
            
            return {
                'success': True,
                'files': all_files,
                'stats': {
                    'totalFiles': total_files,
                    'totalSize': total_size,
                    'totalSizeMB': round(total_size / (1024 * 1024), 2),
                    'byType': by_type,
                    'byFolder': by_folder
                }
            }
            
        except Exception as e:
            logger.error(f"Error al listar archivos: {e}")
            raise HTTPException(status_code=500, detail=f"Error al listar archivos: {str(e)}")

    @router.delete("/files/{file_path:path}")
    async def delete_file(file_path: str, admin=Depends(verify_admin_token)):
        """
        Elimina un archivo del bucket de Supabase Storage
        Requiere autenticación de admin
        """
        try:
            logger.info(f"Admin {admin.get('email')} solicitando eliminar archivo: {file_path}")
            
            result = storage_service.delete_file(file_path)
            
            if not result.get('success'):
                raise HTTPException(status_code=500, detail=result.get('error', 'Error al eliminar archivo'))
            
            return {
                'success': True,
                'message': f'Archivo {file_path} eliminado exitosamente'
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error al eliminar archivo: {e}")
            raise HTTPException(status_code=500, detail=f"Error al eliminar archivo: {str(e)}")

    @router.get("/stats")
    async def get_storage_stats(admin=Depends(verify_admin_token)):
        """
        Obtiene estadísticas generales del almacenamiento
        Requiere autenticación de admin
        """
        try:
            if not storage_service.supabase:
                raise HTTPException(status_code=503, detail="Supabase Storage no está configurado")
            
            # Listar todos los archivos
            files_response = storage_service.supabase.storage.from_(storage_service.BUCKET_NAME).list()
            
            total_files = 0
            total_size = 0
            
            def calculate_folder_stats(folder_path=""):
                nonlocal total_files, total_size
                files = storage_service.supabase.storage.from_(storage_service.BUCKET_NAME).list(folder_path)
                
                for item in files:
                    if item.get('id'):  # Es un archivo
                        total_files += 1
                        total_size += item.get('metadata', {}).get('size', 0)
                    else:  # Es una carpeta
                        folder_name = item['name']
                        new_path = f"{folder_path}/{folder_name}" if folder_path else folder_name
                        calculate_folder_stats(new_path)
            
            calculate_folder_stats()
            
            return {
                'success': True,
                'stats': {
                    'totalFiles': total_files,
                    'totalSize': total_size,
                    'totalSizeMB': round(total_size / (1024 * 1024), 2),
                    'totalSizeGB': round(total_size / (1024 * 1024 * 1024), 3)
                }
            }
            
        except Exception as e:
            logger.error(f"Error al obtener estadísticas: {e}")
            raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")
    
    return router
