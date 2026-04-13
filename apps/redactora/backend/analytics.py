"""
Sistema de Analytics Avanzado
Calcula métricas agregadas para dashboard de insights
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import statistics


class AnalyticsManager:
    """Gestiona cálculos de analytics y métricas"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_document_generation_times(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Calcula tiempo promedio de generación por tipo de documento
        Tiempo = (created_at final - created_at inicial)
        """
        
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=90)  # Últimos 90 días por defecto
        
        results = {}
        
        # Tipos de documentos a analizar
        document_types = {
            'NIW Proposals': {
                'in_progress': 'business_plans_in_progress',
                'completed': 'business_plans'
            },
            'Patents': {
                'in_progress': 'patents_in_progress',
                'completed': 'patents'
            },
            'Books': {
                'in_progress': 'books_in_progress',
                'completed': 'books'
            },
            'Econometric Studies': {
                'in_progress': 'econometric_studies_in_progress',
                'completed': 'econometric_studies'
            }
        }
        
        for doc_type, collections in document_types.items():
            times = []
            
            # Query para documentos completados
            query = {}
            if user_id:
                query['user_id'] = user_id
            
            # Buscar en completados
            cursor = self.db[collections['completed']].find(query)
            async for doc in cursor:
                created_at = doc.get('created_at')
                updated_at = doc.get('updated_at') or doc.get('created_at')
                
                if created_at and updated_at:
                    # Parsear fechas
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    if isinstance(updated_at, str):
                        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                    
                    # Calcular diferencia en minutos
                    diff = (updated_at - created_at).total_seconds() / 60
                    if diff > 0 and diff < 10080:  # Máximo 1 semana (razonable)
                        times.append(diff)
            
            if times:
                results[doc_type] = {
                    'avg_minutes': round(statistics.mean(times), 2),
                    'median_minutes': round(statistics.median(times), 2),
                    'min_minutes': round(min(times), 2),
                    'max_minutes': round(max(times), 2),
                    'count': len(times)
                }
            else:
                results[doc_type] = {
                    'avg_minutes': 0,
                    'median_minutes': 0,
                    'min_minutes': 0,
                    'max_minutes': 0,
                    'count': 0
                }
        
        return results
    
    async def get_section_approval_rate(
        self,
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Calcula tasa de aprobación de secciones
        Tasa = (secciones aprobadas sin edición) / (total secciones)
        """
        
        results = {}
        
        # Analizar versiones para ver ediciones
        version_query = {}
        if user_id:
            version_query['created_by'] = user_id
        
        # Agrupar por tipo de documento
        pipeline = [
            {'$match': version_query},
            {'$group': {
                '_id': '$document_type',
                'total_changes': {'$sum': 1},
                'section_approvals': {
                    '$sum': {'$cond': [{'$eq': ['$change_type', 'section_approval']}, 1, 0]}
                },
                'manual_edits': {
                    '$sum': {'$cond': [{'$eq': ['$change_type', 'manual_edit']}, 1, 0]}
                }
            }}
        ]
        
        cursor = self.db.document_versions.aggregate(pipeline)
        async for doc in cursor:
            doc_type = doc['_id']
            total = doc['total_changes']
            approvals = doc['section_approvals']
            edits = doc['manual_edits']
            
            # Calcular tasa de aprobación (aprobaciones directas vs. con ediciones)
            if approvals > 0:
                approval_rate = (approvals / (approvals + edits)) * 100 if (approvals + edits) > 0 else 0
            else:
                approval_rate = 0
            
            results[doc_type] = {
                'approval_rate': round(approval_rate, 2),
                'total_approvals': approvals,
                'total_edits': edits,
                'total_changes': total
            }
        
        return results
    
    async def get_quality_scores_history(
        self,
        user_id: Optional[str] = None,
        days: int = 30
    ) -> Dict:
        """
        Obtiene quality scores históricos para gráficos
        """
        
        start_date = datetime.now() - timedelta(days=days)
        
        results = {
            'niw_proposals': [],
            'books': [],
            'dates': []
        }
        
        # NIW Proposals
        query = {'quality_score': {'$exists': True, '$ne': None}}
        if user_id:
            query['user_id'] = user_id
        
        cursor = self.db.business_plans.find(query).sort('created_at', 1)
        async for doc in cursor:
            created_at = doc.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            if created_at and created_at >= start_date:
                results['niw_proposals'].append({
                    'date': created_at.strftime('%Y-%m-%d'),
                    'score': doc.get('quality_score', 0),
                    'title': doc.get('project_title', 'Untitled')[:30]
                })
        
        # Books
        cursor = self.db.books.find(query).sort('created_at', 1)
        async for doc in cursor:
            created_at = doc.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            if created_at and created_at >= start_date:
                results['books'].append({
                    'date': created_at.strftime('%Y-%m-%d'),
                    'score': doc.get('quality_score', 0),
                    'title': doc.get('title', 'Untitled')[:30]
                })
        
        return results
    
    async def get_documents_by_month(
        self,
        months: int = 12,
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Documentos creados por mes (últimos N meses)
        """
        
        results = defaultdict(lambda: defaultdict(int))
        
        # Calcular fecha de inicio
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        collections = {
            'NIW Proposals': 'business_plans',
            'Patents': 'patents',
            'Books': 'books',
            'Econometric Studies': 'econometric_studies'
        }
        
        for doc_type, collection_name in collections.items():
            query = {}
            if user_id:
                query['user_id'] = user_id
            
            cursor = self.db[collection_name].find(query)
            async for doc in cursor:
                created_at = doc.get('created_at')
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
                if created_at and created_at >= start_date:
                    month_key = created_at.strftime('%Y-%m')
                    results[month_key][doc_type] += 1
        
        # Convertir a formato para gráficos
        sorted_months = sorted(results.keys())
        formatted_results = []
        
        for month in sorted_months:
            month_data = {'month': month}
            month_data.update(results[month])
            formatted_results.append(month_data)
        
        return {
            'data': formatted_results,
            'total_documents': sum(sum(month.values()) for month in results.values())
        }
    
    async def get_client_roi(
        self,
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Calcula ROI por cliente (tiempo ahorrado)
        Asume que crear documento manualmente toma 40 horas
        El sistema lo hace en promedio 1-2 horas
        """
        
        # Tiempo estimado manual vs. automatizado (en horas)
        MANUAL_TIME = {
            'NIW Proposals': 40,
            'Patents': 60,
            'Books': 80,
            'Econometric Studies': 50
        }
        
        AUTOMATED_TIME = {
            'NIW Proposals': 2,
            'Patents': 3,
            'Books': 4,
            'Econometric Studies': 2.5
        }
        
        # Costo por hora (estimado)
        HOURLY_RATE = 150  # USD
        
        results = {}
        total_saved_hours = 0
        total_saved_money = 0
        
        collections = {
            'NIW Proposals': 'business_plans',
            'Patents': 'patents',
            'Books': 'books',
            'Econometric Studies': 'econometric_studies'
        }
        
        for doc_type, collection_name in collections.items():
            query = {}
            if user_id:
                query['user_id'] = user_id
            
            count = await self.db[collection_name].count_documents(query)
            
            manual_hours = MANUAL_TIME[doc_type] * count
            automated_hours = AUTOMATED_TIME[doc_type] * count
            saved_hours = manual_hours - automated_hours
            saved_money = saved_hours * HOURLY_RATE
            
            total_saved_hours += saved_hours
            total_saved_money += saved_money
            
            results[doc_type] = {
                'count': count,
                'manual_hours': manual_hours,
                'automated_hours': automated_hours,
                'saved_hours': saved_hours,
                'saved_money': saved_money,
                'efficiency_gain': round((saved_hours / manual_hours * 100), 2) if manual_hours > 0 else 0
            }
        
        return {
            'by_document_type': results,
            'totals': {
                'total_saved_hours': round(total_saved_hours, 2),
                'total_saved_money': round(total_saved_money, 2),
                'hourly_rate': HOURLY_RATE
            }
        }
    
    async def get_dashboard_summary(
        self,
        user_id: Optional[str] = None
    ) -> Dict:
        """
        Resumen general del dashboard con métricas clave
        """
        
        query = {}
        if user_id:
            query['user_id'] = user_id
        
        # Contar documentos por tipo
        niw_count = await self.db.business_plans.count_documents(query)
        patent_count = await self.db.patents.count_documents(query)
        book_count = await self.db.books.count_documents(query)
        study_count = await self.db.econometric_studies.count_documents(query)
        
        total_documents = niw_count + patent_count + book_count + study_count
        
        # Documentos en progreso
        niw_progress = await self.db.business_plans_in_progress.count_documents(query)
        patent_progress = await self.db.patents_in_progress.count_documents(query)
        book_progress = await self.db.books_in_progress.count_documents(query)
        study_progress = await self.db.econometric_studies_in_progress.count_documents(query)
        
        total_in_progress = niw_progress + patent_progress + book_progress + study_progress
        
        # Quality score promedio
        avg_scores = []
        
        # NIW average
        pipeline = [
            {'$match': {**query, 'quality_score': {'$exists': True, '$ne': None}}},
            {'$group': {'_id': None, 'avg_score': {'$avg': '$quality_score'}}}
        ]
        
        cursor = self.db.business_plans.aggregate(pipeline)
        async for doc in cursor:
            if doc.get('avg_score'):
                avg_scores.append(doc['avg_score'])
        
        # Books average
        cursor = self.db.books.aggregate(pipeline)
        async for doc in cursor:
            if doc.get('avg_score'):
                avg_scores.append(doc['avg_score'])
        
        overall_avg_score = round(statistics.mean(avg_scores), 2) if avg_scores else 0
        
        # Comentarios totales
        comments_query = {}
        if user_id:
            comments_query['author_id'] = user_id
        
        total_comments = await self.db.document_comments.count_documents(comments_query)
        open_comments = await self.db.document_comments.count_documents({
            **comments_query,
            'status': 'open'
        })
        
        return {
            'total_documents': total_documents,
            'by_type': {
                'niw_proposals': niw_count,
                'patents': patent_count,
                'books': book_count,
                'econometric_studies': study_count
            },
            'in_progress': {
                'total': total_in_progress,
                'by_type': {
                    'niw_proposals': niw_progress,
                    'patents': patent_progress,
                    'books': book_progress,
                    'econometric_studies': study_progress
                }
            },
            'quality_metrics': {
                'average_score': overall_avg_score,
                'documents_evaluated': len(avg_scores)
            },
            'collaboration': {
                'total_comments': total_comments,
                'open_comments': open_comments,
                'resolved_comments': total_comments - open_comments
            }
        }
    
    async def get_user_activity_timeline(
        self,
        user_id: str,
        days: int = 30
    ) -> List[Dict]:
        """
        Timeline de actividad del usuario
        """
        
        start_date = datetime.now() - timedelta(days=days)
        activities = []
        
        # Documentos creados
        collections = [
            ('business_plans', 'NIW Proposal'),
            ('patents', 'Patent'),
            ('books', 'Book'),
            ('econometric_studies', 'Econometric Study')
        ]
        
        for collection_name, doc_type in collections:
            cursor = self.db[collection_name].find({'user_id': user_id})
            async for doc in cursor:
                created_at = doc.get('created_at')
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
                if created_at and created_at >= start_date:
                    activities.append({
                        'date': created_at.isoformat(),
                        'type': 'document_created',
                        'document_type': doc_type,
                        'title': doc.get('project_title') or doc.get('invention_title') or doc.get('title') or doc.get('study_title', 'Untitled')
                    })
        
        # Comentarios
        cursor = self.db.document_comments.find({'author_id': user_id})
        async for comment in cursor:
            created_at = comment.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            if created_at and created_at >= start_date:
                activities.append({
                    'date': created_at.isoformat(),
                    'type': 'comment_added',
                    'document_type': comment.get('document_type', 'Unknown'),
                    'preview': comment.get('content', '')[:50]
                })
        
        # Ordenar por fecha
        activities.sort(key=lambda x: x['date'], reverse=True)
        
        return activities[:50]  # Últimas 50 actividades
