"""
Sistema de Borradores (Drafts)
Permite guardar documentos en progreso como borradores
"""

from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class Draft(BaseModel):
    """Modelo para borradores de documentos"""
    draft_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Tipo de documento
    document_type: str  # 'niw', 'patent', 'book', 'econometric_study', etc.
    
    # Contenido del borrador
    title: str  # Título descriptivo del borrador
    content: Dict  # Todo el contenido del formulario/documento
    
    # Metadata
    user_id: str
    client_id: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Información adicional
    notes: Optional[str] = None  # Notas del usuario sobre el borrador
    completion_percentage: Optional[int] = 0  # % completado (0-100)


class DraftsManager:
    """Gestiona borradores de documentos"""
    
    def __init__(self, db):
        self.db = db
        self.drafts_collection = db['drafts'] if db is not None else None
    
    async def create_draft(
        self,
        document_type: str,
        title: str,
        content: Dict,
        user_id: str,
        client_id: Optional[str] = None,
        notes: Optional[str] = None,
        completion_percentage: int = 0
    ) -> Dict:
        """Crea un nuevo borrador"""
        
        draft = Draft(
            document_type=document_type,
            title=title,
            content=content,
            user_id=user_id,
            client_id=client_id,
            notes=notes,
            completion_percentage=completion_percentage
        )
        
        draft_dict = draft.dict()
        draft_dict['created_at'] = draft_dict['created_at'].isoformat()
        draft_dict['updated_at'] = draft_dict['updated_at'].isoformat()
        
        result = await self.drafts_collection.insert_one(draft_dict)
        
        return {
            'success': True,
            'draft_id': draft.draft_id,
            'message': 'Borrador guardado exitosamente'
        }
    
    async def get_user_drafts(
        self,
        user_id: str,
        document_type: Optional[str] = None
    ) -> List[Dict]:
        """Obtiene todos los borradores de un usuario"""
        
        query = {'user_id': user_id}
        if document_type:
            query['document_type'] = document_type
        
        cursor = self.drafts_collection.find(query, {'_id': 0}).sort('updated_at', -1)
        
        drafts = []
        async for draft in cursor:
            drafts.append(draft)
        
        return drafts
    
    async def get_draft_by_id(
        self,
        draft_id: str,
        user_id: str
    ) -> Optional[Dict]:
        """Obtiene un borrador específico"""
        
        draft = await self.drafts_collection.find_one(
            {'draft_id': draft_id, 'user_id': user_id},
            {'_id': 0}
        )
        
        return draft
    
    async def update_draft(
        self,
        draft_id: str,
        user_id: str,
        title: Optional[str] = None,
        content: Optional[Dict] = None,
        notes: Optional[str] = None,
        completion_percentage: Optional[int] = None
    ) -> Dict:
        """Actualiza un borrador existente"""
        
        update_fields = {'updated_at': datetime.now().isoformat()}
        
        if title is not None:
            update_fields['title'] = title
        if content is not None:
            update_fields['content'] = content
        if notes is not None:
            update_fields['notes'] = notes
        if completion_percentage is not None:
            update_fields['completion_percentage'] = completion_percentage
        
        result = await self.drafts_collection.update_one(
            {'draft_id': draft_id, 'user_id': user_id},
            {'$set': update_fields}
        )
        
        if result.modified_count == 0:
            return {
                'success': False,
                'message': 'Borrador no encontrado o no se pudo actualizar'
            }
        
        return {
            'success': True,
            'message': 'Borrador actualizado exitosamente'
        }
    
    async def delete_draft(
        self,
        draft_id: str,
        user_id: str
    ) -> Dict:
        """Elimina un borrador"""
        
        result = await self.drafts_collection.delete_one({
            'draft_id': draft_id,
            'user_id': user_id
        })
        
        if result.deleted_count == 0:
            return {
                'success': False,
                'message': 'Borrador no encontrado'
            }
        
        return {
            'success': True,
            'message': 'Borrador eliminado exitosamente'
        }
    
    async def get_drafts_stats(self, user_id: str) -> Dict:
        """Obtiene estadísticas de borradores del usuario"""
        
        # Total de borradores
        total = await self.drafts_collection.count_documents({'user_id': user_id})
        
        # Por tipo de documento
        pipeline = [
            {'$match': {'user_id': user_id}},
            {'$group': {
                '_id': '$document_type',
                'count': {'$sum': 1}
            }}
        ]
        
        cursor = self.drafts_collection.aggregate(pipeline)
        by_type = {}
        async for doc in cursor:
            by_type[doc['_id']] = doc['count']
        
        return {
            'total': total,
            'by_type': by_type
        }
    
    async def convert_draft_to_document(
        self,
        draft_id: str,
        user_id: str
    ) -> Dict:
        """
        Convierte un borrador en un documento en progreso
        Esto dependerá del tipo de documento
        """
        
        draft = await self.get_draft_by_id(draft_id, user_id)
        
        if not draft:
            return {
                'success': False,
                'message': 'Borrador no encontrado'
            }
        
        # El contenido del borrador se usará para crear el documento
        # La lógica específica de creación se maneja en los endpoints correspondientes
        
        return {
            'success': True,
            'draft': draft,
            'message': 'Borrador listo para convertir a documento'
        }
