"""
Sistema de Control de Versiones para Documentos
Maneja versionado, comparación y rollback para todos los tipos de documentos
"""

import difflib
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class DocumentVersion(BaseModel):
    """Modelo para almacenar versiones de documentos"""
    version_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Referencias
    document_id: str  # ID del documento original
    document_type: str  # 'niw', 'patent', 'book', 'econometric_study', 'white_paper', etc.
    
    # Información de versión
    version_number: int  # 1, 2, 3, 4...
    is_snapshot: bool = False  # True cada 10 versiones
    
    # Contenido
    content: Optional[Dict] = None  # Snapshot completo si is_snapshot=True
    diff: Optional[Dict] = None  # Solo cambios si is_snapshot=False
    
    # Metadata
    created_by: str  # user_id
    created_at: datetime = Field(default_factory=datetime.now)
    change_description: Optional[str] = None  # "Mejorado sección 3"
    change_type: str  # 'manual_edit', 'ai_regeneration', 'section_approval', 'rollback'
    
    # Métricas
    sections_changed: List[int] = []  # [1, 3, 5]
    characters_added: int = 0
    characters_removed: int = 0
    time_spent_seconds: Optional[int] = None
    
    # Estado del documento en ese momento
    status: str  # 'draft', 'in_progress', 'completed'
    quality_score: Optional[float] = None


class VersionManager:
    """Gestiona el versionado de documentos"""
    
    # Mapeo de tipos de documentos a colecciones de MongoDB
    COLLECTION_MAP = {
        'niw': 'niw_in_progress',
        'niw_completed': 'business_plans',
        'patent': 'patents_in_progress',
        'patent_completed': 'patents',
        'book': 'books_in_progress',
        'book_completed': 'books',
        'econometric_study': 'econometric_studies_in_progress',
        'econometric_study_completed': 'econometric_studies',
        'white_paper': 'white_papers_in_progress',
        'white_paper_completed': 'white_papers',
        'case_study': 'case_studies_in_progress',
        'case_study_completed': 'case_studies',
        'policy_paper': 'policy_papers_in_progress',
        'policy_paper_completed': 'policy_papers',
        'self_petition_letter': 'self_petition_letters_in_progress',
        'self_petition_letter_completed': 'self_petition_letters',
        'recommendation_letter': 'recommendation_letters_in_progress',
        'recommendation_letter_completed': 'recommendation_letters',
        'expert_letter': 'expert_letters_in_progress',
        'expert_letter_completed': 'expert_letters'
    }
    
    # Mapeo de tipos a campos ID
    ID_FIELD_MAP = {
        'niw': 'id',
        'niw_completed': 'id',
        'patent': 'id',
        'patent_completed': 'id',
        'book': 'id',
        'book_completed': 'id',
        'econometric_study': 'id',
        'econometric_study_completed': 'id',
        'white_paper': 'id',
        'white_paper_completed': 'id',
        'case_study': 'id',
        'case_study_completed': 'id',
        'policy_paper': 'id',
        'policy_paper_completed': 'id',
        'self_petition_letter': 'id',
        'self_petition_letter_completed': 'id',
        'recommendation_letter': 'id',
        'recommendation_letter_completed': 'id',
        'expert_letter': 'id',
        'expert_letter_completed': 'id'
    }
    
    def __init__(self, db):
        self.db = db
        self.versions_collection = db['document_versions']
    
    async def create_version(
        self,
        document_id: str,
        document_type: str,
        content: Dict,
        user_id: str,
        change_description: Optional[str] = None,
        change_type: str = 'manual_edit',
        sections_changed: List[int] = []
    ) -> str:
        """Crea una nueva versión del documento"""
        
        # Obtener última versión
        last_version = await self.get_latest_version(document_id)
        new_version_number = (last_version['version_number'] + 1) if last_version else 1
        
        # Decidir si es snapshot o diff
        is_snapshot = (new_version_number % 10 == 0) or (new_version_number == 1)
        
        # Calcular diff si no es snapshot
        diff_data = None
        stats = {'added': 0, 'removed': 0}
        
        if not is_snapshot and last_version:
            # Reconstruir contenido de última versión para comparar
            last_content = await self.reconstruct_version(document_id, last_version['version_number'])
            diff_data, stats = self._calculate_diff(last_content, content)
        
        version = DocumentVersion(
            document_id=document_id,
            document_type=document_type,
            version_number=new_version_number,
            is_snapshot=is_snapshot,
            content=content if is_snapshot else None,
            diff=diff_data if not is_snapshot else None,
            created_by=user_id,
            created_at=datetime.now(),
            change_description=change_description,
            change_type=change_type,
            sections_changed=sections_changed,
            characters_added=stats['added'],
            characters_removed=stats['removed'],
            status=content.get('status', 'in_progress'),
            quality_score=content.get('quality_score')
        )
        
        # Guardar en MongoDB
        version_dict = version.dict()
        version_dict.pop('version_id', None)
        result = await self.versions_collection.insert_one(version_dict)
        
        return str(result.inserted_id)
    
    def _calculate_diff(self, old_content: Dict, new_content: Dict) -> Tuple[Dict, Dict]:
        """Calcula diferencias entre dos versiones"""
        diff = {}
        stats = {'added': 0, 'removed': 0}
        
        # Comparar cada campo
        all_keys = set(list(old_content.keys()) + list(new_content.keys()))
        
        for key in all_keys:
            old_val = old_content.get(key)
            new_val = new_content.get(key)
            
            if old_val != new_val:
                diff[key] = {
                    'old': old_val,
                    'new': new_val
                }
                
                # Calcular stats si es texto
                if isinstance(old_val, str) and isinstance(new_val, str):
                    old_len = len(old_val)
                    new_len = len(new_val)
                    if new_len > old_len:
                        stats['added'] += new_len - old_len
                    else:
                        stats['removed'] += old_len - new_len
        
        return diff, stats
    
    async def get_latest_version(self, document_id: str) -> Optional[Dict]:
        """Obtiene la última versión de un documento"""
        # find_one no acepta sort en CompatCollection; usamos find().sort().limit(1).
        rows = await (
            self.versions_collection
            .find({'document_id': document_id})
            .sort('version_number', -1)
            .limit(1)
            .to_list(1)
        )
        return rows[0] if rows else None
    
    async def get_version_history(
        self,
        document_id: str,
        limit: int = 50
    ) -> List[Dict]:
        """Obtiene historial completo de versiones"""
        
        cursor = self.versions_collection.find(
            {'document_id': document_id}
        ).sort('version_number', -1).limit(limit)
        
        versions = []
        async for version in cursor:
            # Convertir ObjectId a string
            version['_id'] = str(version['_id'])
            versions.append(version)
        
        return versions
    
    async def get_version_by_number(
        self,
        document_id: str,
        version_number: int
    ) -> Optional[Dict]:
        """Obtiene una versión específica"""
        
        version = await self.versions_collection.find_one({
            'document_id': document_id,
            'version_number': version_number
        })
        
        if version:
            version['_id'] = str(version['_id'])
        
        return version
    
    async def reconstruct_version(
        self,
        document_id: str,
        version_number: int
    ) -> Dict:
        """Reconstruye el contenido completo de una versión"""
        
        # Buscar snapshot más cercano anterior o igual
        snapshot = await self.versions_collection.find_one({
            'document_id': document_id,
            'version_number': {'$lte': version_number},
            'is_snapshot': True
        }, sort=[('version_number', -1)])
        
        if not snapshot:
            raise ValueError(f"No snapshot found for document {document_id}")
        
        # Empezar con contenido del snapshot
        content = snapshot['content'].copy() if snapshot.get('content') else {}
        
        # Si el snapshot es exactamente la versión solicitada, retornar
        if snapshot['version_number'] == version_number:
            return content
        
        # Aplicar diffs hasta la versión deseada
        if snapshot['version_number'] < version_number:
            cursor = self.versions_collection.find({
                'document_id': document_id,
                'version_number': {
                    '$gt': snapshot['version_number'],
                    '$lte': version_number
                }
            }).sort('version_number', 1)
            
            async for diff_version in cursor:
                if diff_version.get('diff'):
                    content = self._apply_diff(content, diff_version['diff'])
                elif diff_version.get('content'):
                    # Es otro snapshot intermedio
                    content = diff_version['content'].copy()
        
        return content
    
    def _apply_diff(self, base_content: Dict, diff: Dict) -> Dict:
        """Aplica un diff sobre contenido base"""
        result = base_content.copy()
        
        for key, changes in diff.items():
            if changes.get('new') is not None:
                result[key] = changes['new']
            elif key in result:
                # Si new es None, significa que se eliminó el campo
                del result[key]
        
        return result
    
    async def compare_versions(
        self,
        document_id: str,
        version_from: int,
        version_to: int
    ) -> Dict:
        """Compara dos versiones y genera diff visual"""
        
        # Reconstruir ambas versiones
        content_from = await self.reconstruct_version(document_id, version_from)
        content_to = await self.reconstruct_version(document_id, version_to)
        
        # Generar comparación detallada
        comparison = {
            'version_from': version_from,
            'version_to': version_to,
            'sections_modified': [],
            'summary': {'added': 0, 'removed': 0, 'modified_sections': 0}
        }
        
        # Comparar secciones si existen
        sections_from = content_from.get('sections', [])
        sections_to = content_to.get('sections', [])
        
        max_sections = max(len(sections_from), len(sections_to))
        
        for i in range(max_sections):
            sec_from = sections_from[i] if i < len(sections_from) else {}
            sec_to = sections_to[i] if i < len(sections_to) else {}
            
            content_from_text = sec_from.get('content', '')
            content_to_text = sec_to.get('content', '')
            
            if content_from_text != content_to_text:
                # Generar HTML diff
                diff_html = self._generate_html_diff(
                    content_from_text,
                    content_to_text
                )
                
                chars_added = max(0, len(content_to_text) - len(content_from_text))
                chars_removed = max(0, len(content_from_text) - len(content_to_text))
                
                comparison['sections_modified'].append({
                    'section_number': i + 1,
                    'section_title': sec_to.get('title', sec_from.get('title', f'Section {i+1}')),
                    'old_text': content_from_text,
                    'new_text': content_to_text,
                    'diff_html': diff_html,
                    'chars_added': chars_added,
                    'chars_removed': chars_removed
                })
                
                comparison['summary']['modified_sections'] += 1
                comparison['summary']['added'] += chars_added
                comparison['summary']['removed'] += chars_removed
        
        return comparison
    
    def _generate_html_diff(self, text1: str, text2: str) -> str:
        """Genera HTML con diferencias visuales"""
        
        differ = difflib.HtmlDiff(wrapcolumn=80)
        html_diff = differ.make_table(
            text1.splitlines() if text1 else [''],
            text2.splitlines() if text2 else [''],
            fromdesc='Versión Anterior',
            todesc='Versión Nueva',
            context=True,
            numlines=3
        )
        
        return html_diff
    
    async def rollback_to_version(
        self,
        document_id: str,
        document_type: str,
        version_number: int,
        user_id: str
    ) -> Dict:
        """Restaura documento a una versión anterior"""
        
        # Reconstruir contenido de la versión
        restored_content = await self.reconstruct_version(document_id, version_number)
        
        # Determinar colección correcta
        collection_name = self.COLLECTION_MAP.get(document_type)
        if not collection_name:
            raise ValueError(f"Unknown document type: {document_type}")
        
        # Determinar campo ID
        id_field = self.ID_FIELD_MAP.get(document_type)
        if not id_field:
            raise ValueError(f"Unknown ID field for document type: {document_type}")
        
        # Actualizar documento actual
        result = await self.db[collection_name].update_one(
            {id_field: document_id},
            {'$set': restored_content}
        )
        
        if result.modified_count == 0:
            # Intentar con la colección de completados
            completed_type = f"{document_type}_completed"
            collection_name = self.COLLECTION_MAP.get(completed_type)
            if collection_name:
                result = await self.db[collection_name].update_one(
                    {id_field: document_id},
                    {'$set': restored_content}
                )
        
        # Crear nueva versión marcando el rollback
        await self.create_version(
            document_id=document_id,
            document_type=document_type,
            content=restored_content,
            user_id=user_id,
            change_description=f"Restaurado a versión {version_number}",
            change_type='rollback'
        )
        
        return {
            'success': True,
            'restored_to_version': version_number,
            'message': f'Documento restaurado a versión {version_number}'
        }
    
    async def get_version_stats(self, document_id: str) -> Dict:
        """Obtiene estadísticas del historial de versiones"""
        
        versions = await self.get_version_history(document_id, limit=1000)
        
        if not versions:
            return {
                'total_versions': 0,
                'total_edits': 0,
                'total_chars_added': 0,
                'total_chars_removed': 0
            }
        
        stats = {
            'total_versions': len(versions),
            'total_edits': sum(1 for v in versions if v['change_type'] == 'manual_edit'),
            'total_chars_added': sum(v.get('characters_added', 0) for v in versions),
            'total_chars_removed': sum(v.get('characters_removed', 0) for v in versions),
            'first_version_date': versions[-1]['created_at'],
            'last_version_date': versions[0]['created_at']
        }
        
        return stats
