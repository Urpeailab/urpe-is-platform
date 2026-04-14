"""
Sistema de Comentarios Colaborativos
Soporta comentarios en secciones específicas, menciones, hilos y resolución
"""

from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field
import uuid
import re


class Comment(BaseModel):
    """Modelo para comentarios en documentos"""
    comment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Referencias
    document_id: str  # ID del documento
    document_type: str  # 'niw', 'patent', 'book', etc.
    section_number: Optional[int] = None  # Sección específica (None = comentario general)
    
    # Contenido
    content: str  # Contenido del comentario
    mentions: List[str] = []  # Lista de user_ids mencionados (@usuario)
    
    # Autor
    author_id: str
    author_name: str
    author_email: str
    
    # Hilo (para respuestas)
    parent_comment_id: Optional[str] = None  # None si es comentario principal
    replies: List[str] = []  # IDs de comentarios hijos
    
    # Estado
    status: str = "open"  # 'open' o 'resolved'
    resolved_by: Optional[str] = None  # user_id quien resolvió
    resolved_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    edited: bool = False  # Si fue editado después de creación


class CommentsManager:
    """Gestiona comentarios en documentos"""
    
    # Mapeo de tipos de documentos a colecciones
    DOCUMENT_COLLECTIONS = {
        'niw': 'business_plans',
        'niw_in_progress': 'business_plans_in_progress',
        'patent': 'patents',
        'patent_in_progress': 'patents_in_progress',
        'book': 'books',
        'book_in_progress': 'books_in_progress',
        'econometric_study': 'econometric_studies',
        'econometric_study_in_progress': 'econometric_studies_in_progress',
        'white_paper': 'white_papers',
        'case_study': 'case_studies',
        'policy_paper': 'policy_papers',
        'self_petition_letter': 'self_petition_letters',
        'recommendation_letter': 'recommendation_letters',
        'expert_letter': 'expert_letters',
        'business_plan': 'business_plans'  # Alias para NIW
    }
    
    def __init__(self, db):
        self.db = db
        self.comments_collection = db['document_comments'] if db is not None else None
        self.notifications_collection = db['comment_notifications'] if db is not None else None
    
    async def check_document_access(
        self,
        document_id: str,
        document_type: str,
        user_id: str,
        user_role: str = None
    ) -> Dict:
        """
        Verifica si el usuario tiene acceso al documento
        
        Reglas:
        - Admin: Acceso a todo
        - Cliente/Abogado: Solo sus documentos (user_id coincide)
        - Cliente: Documentos donde es el client_id
        """
        
        # Administradores tienen acceso total
        if user_role == 'admin':
            return {
                'has_access': True,
                'access_type': 'admin',
                'reason': 'Administrator access'
            }
        
        # Buscar el documento
        collection_name = self.DOCUMENT_COLLECTIONS.get(document_type)
        if not collection_name:
            # Intentar con sufijo _in_progress
            collection_name = self.DOCUMENT_COLLECTIONS.get(f"{document_type}_in_progress")
        
        if not collection_name:
            return {
                'has_access': False,
                'access_type': None,
                'reason': f'Unknown document type: {document_type}'
            }
        
        # Buscar en colección principal
        document = await self.db[collection_name].find_one({
            '$or': [
                {'id': document_id},
                {'niw_id': document_id},
                {'patent_id': document_id},
                {'book_id': document_id},
                {'study_id': document_id}
            ]
        })
        
        # Si no se encuentra, intentar en colección in_progress
        if not document and not collection_name.endswith('_in_progress'):
            in_progress_collection = f"{collection_name}_in_progress"
            if in_progress_collection in self.DOCUMENT_COLLECTIONS.values():
                document = await self.db[in_progress_collection].find_one({
                    '$or': [
                        {'id': document_id},
                        {'niw_id': document_id},
                        {'patent_id': document_id},
                        {'book_id': document_id},
                        {'study_id': document_id}
                    ]
                })
        
        if not document:
            return {
                'has_access': False,
                'access_type': None,
                'reason': 'Document not found'
            }
        
        # Verificar si es el dueño del documento
        if document.get('user_id') == user_id:
            return {
                'has_access': True,
                'access_type': 'owner',
                'reason': 'Document owner'
            }
        
        # Verificar si es el cliente asociado al documento
        if document.get('client_id') == user_id:
            return {
                'has_access': True,
                'access_type': 'client',
                'reason': 'Associated client'
            }
        
        # Sin acceso
        return {
            'has_access': False,
            'access_type': None,
            'reason': 'User does not have access to this document'
        }
    
    async def create_comment(
        self,
        document_id: str,
        document_type: str,
        content: str,
        author_id: str,
        author_name: str,
        author_email: str,
        user_role: str = None,
        section_number: Optional[int] = None,
        parent_comment_id: Optional[str] = None
    ) -> Dict:
        """Crea un nuevo comentario"""
        
        # Verificar acceso al documento
        access_check = await self.check_document_access(
            document_id=document_id,
            document_type=document_type,
            user_id=author_id,
            user_role=user_role
        )
        
        if not access_check['has_access']:
            raise PermissionError(f"Access denied: {access_check['reason']}")
        
        # Extraer menciones del contenido
        mentions = self._extract_mentions(content)
        
        # Crear comentario
        comment = Comment(
            document_id=document_id,
            document_type=document_type,
            section_number=section_number,
            content=content,
            mentions=mentions,
            author_id=author_id,
            author_name=author_name,
            author_email=author_email,
            parent_comment_id=parent_comment_id
        )
        
        comment_dict = comment.dict()
        comment_dict['created_at'] = comment_dict['created_at'].isoformat()
        comment_dict['updated_at'] = comment_dict['updated_at'].isoformat()
        
        # Guardar en MongoDB
        await self.comments_collection.insert_one(comment_dict)
        
        # Si es una respuesta, actualizar comentario padre
        if parent_comment_id:
            await self.comments_collection.update_one(
                {'comment_id': parent_comment_id},
                {
                    '$push': {'replies': comment.comment_id},
                    '$set': {'updated_at': datetime.now().isoformat()}
                }
            )
        
        # Crear notificaciones para menciones
        await self._create_mention_notifications(comment, author_name)
        
        # Si es respuesta, notificar al autor del comentario padre
        if parent_comment_id:
            await self._create_reply_notification(comment, parent_comment_id, author_name)
        
        return {
            'success': True,
            'comment_id': comment.comment_id,
            'comment': comment_dict,
            'mentions_count': len(mentions)
        }
    
    def _extract_mentions(self, content: str) -> List[str]:
        """Extrae menciones @usuario del contenido"""
        # Patrón para @usuario (alfanumérico, guiones, puntos)
        pattern = r'@([\w\.\-]+)'
        matches = re.findall(pattern, content)
        return list(set(matches))  # Eliminar duplicados
    
    async def _create_mention_notifications(self, comment: Comment, author_name: str):
        """Crea notificaciones para usuarios mencionados"""
        if not comment.mentions:
            return
        
        # Buscar usuarios mencionados
        for mention in comment.mentions:
            # Buscar por username o email
            user = await self.db.users.find_one({
                '$or': [
                    {'email': mention},
                    {'email': f"{mention}@*"},  # Búsqueda parcial
                    {'full_name': {'$regex': mention, '$options': 'i'}}
                ]
            })
            
            if user:
                notification = {
                    'notification_id': str(uuid.uuid4()),
                    'type': 'mention',
                    'user_id': user['id'],
                    'comment_id': comment.comment_id,
                    'document_id': comment.document_id,
                    'document_type': comment.document_type,
                    'section_number': comment.section_number,
                    'message': f"{author_name} te mencionó en un comentario",
                    'content_preview': comment.content[:100],
                    'read': False,
                    'created_at': datetime.now().isoformat()
                }
                await self.notifications_collection.insert_one(notification)
    
    async def _create_reply_notification(self, comment: Comment, parent_comment_id: str, author_name: str):
        """Crea notificación para el autor del comentario padre"""
        parent_comment = await self.comments_collection.find_one({'comment_id': parent_comment_id})
        
        if parent_comment and parent_comment['author_id'] != comment.author_id:
            notification = {
                'notification_id': str(uuid.uuid4()),
                'type': 'reply',
                'user_id': parent_comment['author_id'],
                'comment_id': comment.comment_id,
                'parent_comment_id': parent_comment_id,
                'document_id': comment.document_id,
                'document_type': comment.document_type,
                'section_number': comment.section_number,
                'message': f"{author_name} respondió a tu comentario",
                'content_preview': comment.content[:100],
                'read': False,
                'created_at': datetime.now().isoformat()
            }
            await self.notifications_collection.insert_one(notification)
    
    async def get_comments(
        self,
        document_id: str,
        document_type: str,
        user_id: str,
        user_role: str = None,
        section_number: Optional[int] = None,
        status: Optional[str] = None,
        include_replies: bool = True
    ) -> List[Dict]:
        """Obtiene comentarios de un documento"""
        
        # Verificar acceso al documento
        access_check = await self.check_document_access(
            document_id=document_id,
            document_type=document_type,
            user_id=user_id,
            user_role=user_role
        )
        
        if not access_check['has_access']:
            raise PermissionError(f"Access denied: {access_check['reason']}")
        
        query = {
            'document_id': document_id,
            'parent_comment_id': None  # Solo comentarios principales
        }
        
        if section_number is not None:
            query['section_number'] = section_number
        
        if status:
            query['status'] = status
        
        cursor = self.comments_collection.find(query, {'_id': 0})
        comments = []
        
        async for comment in cursor:
            if include_replies and comment.get('replies'):
                # Cargar respuestas
                replies_cursor = self.comments_collection.find(
                    {'comment_id': {'$in': comment['replies']}},
                    {'_id': 0}
                )
                comment['replies_data'] = []
                async for reply in replies_cursor:
                    comment['replies_data'].append(reply)
            
            comments.append(comment)
        
        # Ordenar por fecha
        comments.sort(key=lambda x: x['created_at'], reverse=True)
        
        return comments
    
    async def get_comment_by_id(self, comment_id: str) -> Optional[Dict]:
        """Obtiene un comentario específico"""
        comment = await self.comments_collection.find_one(
            {'comment_id': comment_id},
            {'_id': 0}
        )
        return comment
    
    async def update_comment(
        self,
        comment_id: str,
        content: str,
        user_id: str,
        user_role: str = None
    ) -> Dict:
        """Actualiza el contenido de un comentario"""
        
        # Verificar que el usuario sea el autor
        comment = await self.comments_collection.find_one({'comment_id': comment_id})
        
        if not comment:
            raise ValueError("Comentario no encontrado")
        
        # Admin puede editar cualquier comentario
        if user_role != 'admin' and comment['author_id'] != user_id:
            raise PermissionError("No autorizado para editar este comentario")
        
        # Extraer nuevas menciones
        mentions = self._extract_mentions(content)
        
        # Actualizar
        result = await self.comments_collection.update_one(
            {'comment_id': comment_id},
            {
                '$set': {
                    'content': content,
                    'mentions': mentions,
                    'edited': True,
                    'updated_at': datetime.now().isoformat()
                }
            }
        )
        
        return {
            'success': True,
            'modified_count': result.modified_count
        }
    
    async def delete_comment(
        self,
        comment_id: str,
        user_id: str,
        user_role: str = None
    ) -> Dict:
        """Elimina un comentario (soft delete - marca como eliminado)"""
        
        comment = await self.comments_collection.find_one({'comment_id': comment_id})
        
        if not comment:
            raise ValueError("Comentario no encontrado")
        
        # Admin puede eliminar cualquier comentario
        if user_role != 'admin' and comment['author_id'] != user_id:
            raise PermissionError("No autorizado para eliminar este comentario")
        
        # Marcar como eliminado en lugar de borrar
        result = await self.comments_collection.update_one(
            {'comment_id': comment_id},
            {
                '$set': {
                    'content': '[Comentario eliminado]',
                    'deleted': True,
                    'updated_at': datetime.now().isoformat()
                }
            }
        )
        
        return {
            'success': True,
            'modified_count': result.modified_count
        }
    
    async def resolve_comment(
        self,
        comment_id: str,
        user_id: str,
        user_name: str
    ) -> Dict:
        """Marca un comentario como resuelto"""
        
        result = await self.comments_collection.update_one(
            {'comment_id': comment_id},
            {
                '$set': {
                    'status': 'resolved',
                    'resolved_by': user_id,
                    'resolved_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
            }
        )
        
        # Notificar al autor del comentario
        comment = await self.comments_collection.find_one({'comment_id': comment_id})
        if comment and comment['author_id'] != user_id:
            notification = {
                'notification_id': str(uuid.uuid4()),
                'type': 'resolved',
                'user_id': comment['author_id'],
                'comment_id': comment_id,
                'document_id': comment['document_id'],
                'document_type': comment['document_type'],
                'message': f"{user_name} resolvió tu comentario",
                'read': False,
                'created_at': datetime.now().isoformat()
            }
            await self.notifications_collection.insert_one(notification)
        
        return {
            'success': True,
            'modified_count': result.modified_count
        }
    
    async def reopen_comment(
        self,
        comment_id: str
    ) -> Dict:
        """Reabre un comentario resuelto"""
        
        result = await self.comments_collection.update_one(
            {'comment_id': comment_id},
            {
                '$set': {
                    'status': 'open',
                    'updated_at': datetime.now().isoformat()
                },
                '$unset': {
                    'resolved_by': '',
                    'resolved_at': ''
                }
            }
        )
        
        return {
            'success': True,
            'modified_count': result.modified_count
        }
    
    async def get_comment_stats(
        self,
        document_id: str,
        document_type: str,
        user_id: str,
        user_role: str = None
    ) -> Dict:
        """Obtiene estadísticas de comentarios para un documento"""
        
        # Verificar acceso al documento
        access_check = await self.check_document_access(
            document_id=document_id,
            document_type=document_type,
            user_id=user_id,
            user_role=user_role
        )
        
        if not access_check['has_access']:
            raise PermissionError(f"Access denied: {access_check['reason']}")
        
        total = await self.comments_collection.count_documents({'document_id': document_id})
        open_count = await self.comments_collection.count_documents({
            'document_id': document_id,
            'status': 'open'
        })
        resolved_count = await self.comments_collection.count_documents({
            'document_id': document_id,
            'status': 'resolved'
        })
        
        # Comentarios por sección
        pipeline = [
            {'$match': {'document_id': document_id}},
            {'$group': {
                '_id': '$section_number',
                'count': {'$sum': 1},
                'open': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'open']}, 1, 0]}
                }
            }},
            {'$sort': {'_id': 1}}
        ]
        
        sections_cursor = self.comments_collection.aggregate(pipeline)
        sections_stats = []
        async for section in sections_cursor:
            sections_stats.append({
                'section_number': section['_id'],
                'total': section['count'],
                'open': section['open']
            })
        
        return {
            'total': total,
            'open': open_count,
            'resolved': resolved_count,
            'by_section': sections_stats
        }
    
    async def get_user_notifications(
        self,
        user_id: str,
        unread_only: bool = False
    ) -> List[Dict]:
        """Obtiene notificaciones de un usuario"""
        
        query = {'user_id': user_id}
        if unread_only:
            query['read'] = False
        
        cursor = self.notifications_collection.find(
            query,
            {'_id': 0}
        ).sort('created_at', -1).limit(50)
        
        notifications = []
        async for notif in cursor:
            notifications.append(notif)
        
        return notifications
    
    async def mark_notification_read(
        self,
        notification_id: str
    ) -> Dict:
        """Marca una notificación como leída"""
        
        result = await self.notifications_collection.update_one(
            {'notification_id': notification_id},
            {'$set': {'read': True}}
        )
        
        return {
            'success': True,
            'modified_count': result.modified_count
        }
    
    async def mark_all_notifications_read(
        self,
        user_id: str
    ) -> Dict:
        """Marca todas las notificaciones de un usuario como leídas"""
        
        result = await self.notifications_collection.update_many(
            {'user_id': user_id, 'read': False},
            {'$set': {'read': True}}
        )
        
        return {
            'success': True,
            'modified_count': result.modified_count
        }
    
    async def search_users_for_mention(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict]:
        """Busca usuarios para autocompletar menciones"""
        
        # Buscar por nombre o email
        cursor = self.db.users.find({
            '$or': [
                {'full_name': {'$regex': query, '$options': 'i'}},
                {'email': {'$regex': query, '$options': 'i'}}
            ]
        }, {
            '_id': 0,
            'id': 1,
            'full_name': 1,
            'email': 1
        }).limit(limit)
        
        users = []
        async for user in cursor:
            users.append(user)
        
        return users
