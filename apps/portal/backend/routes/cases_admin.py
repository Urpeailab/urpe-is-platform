"""Admin visa cases management endpoints."""
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Annotated, Optional
from datetime import datetime, timezone
from config import db, logger
from utils.auth_helpers import verify_staff_token_impl, verify_admin_only
from utils.activity_log import ActivityLog
from utils.date_helpers import get_utc_now
from bson import ObjectId

router = APIRouter(prefix="/admin/visa-cases", tags=["Admin Visa Cases"])

def sanitize_mongo_doc(doc):
    """Convert all ObjectId fields to strings recursively."""
    if doc is None:
        return None
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    if isinstance(doc, dict):
        return {k: sanitize_mongo_doc(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [sanitize_mongo_doc(item) for item in doc]
    # Handle any other non-serializable types
    try:
        # Check if it's a basic type
        if isinstance(doc, (str, int, float, bool)):
            return doc
        # Try to convert to string as fallback
        return str(doc)
    except:
        return None

async def calculate_case_priority_score(case_id: str) -> dict:
    """Calculate priority score for a visa case."""
    try:
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            return {'score': 0, 'breakdown': {}}
        
        score = 0
        breakdown = {
            'document_status': {'score': 0, 'details': []},
            'case_age': {'score': 0, 'days': 0},
            'pending_deliverables': {'score': 0, 'count': 0},
            'progress': {'score': 0, 'percentage': 0, 'details': []}
        }
        
        # 1. Document Status Score (0-40 points)
        documents = await db.visa_client_documents.find({'caseId': case_id}).to_list(length=1000)
        total_required_docs = sum(1 for doc in documents if doc.get('required', False))
        
        if total_required_docs > 0:
            validated_docs = sum(1 for doc in documents if doc.get('required', False) and doc.get('status') == 'validated')
            doc_percentage = (validated_docs / total_required_docs) * 100
            
            if doc_percentage == 100:
                score += 40
                breakdown['document_status']['details'].append('Todos los documentos validados (+40)')
            elif doc_percentage >= 75:
                score += 25
                breakdown['document_status']['details'].append(f'{doc_percentage:.0f}% documentos validados (+25)')
            elif doc_percentage >= 50:
                score += 15
                breakdown['document_status']['details'].append(f'{doc_percentage:.0f}% documentos validados (+15)')
            else:
                score += 5
                breakdown['document_status']['details'].append(f'{doc_percentage:.0f}% documentos validados (+5)')
            
            breakdown['document_status']['score'] = score
        
        # 2. Case Age Score (0-30 points)
        created_at = case.get('createdAt')
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            elif isinstance(created_at, datetime) and created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            days_old = (datetime.now(timezone.utc) - created_at).days
            breakdown['case_age']['days'] = days_old
            
            if days_old >= 90:
                age_score = 30
                breakdown['case_age']['details'] = f'Caso con {days_old} días (+30)'
            elif days_old >= 60:
                age_score = 20
                breakdown['case_age']['details'] = f'Caso con {days_old} días (+20)'
            elif days_old >= 30:
                age_score = 10
                breakdown['case_age']['details'] = f'Caso con {days_old} días (+10)'
            else:
                age_score = 5
                breakdown['case_age']['details'] = f'Caso con {days_old} días (+5)'
            
            score += age_score
            breakdown['case_age']['score'] = age_score
        
        # 3. Pending Deliverables Score (0-20 points)
        deliverables = await db.visa_deliverables.find({'caseId': case_id}).to_list(length=1000)
        pending_deliverables = [d for d in deliverables if d.get('status') in ['pending', 'in_progress']]
        pending_count = len(pending_deliverables)
        
        if pending_count >= 5:
            deliv_score = 20
        elif pending_count >= 3:
            deliv_score = 15
        elif pending_count >= 1:
            deliv_score = 10
        else:
            deliv_score = 0
        
        score += deliv_score
        breakdown['pending_deliverables']['score'] = deliv_score
        breakdown['pending_deliverables']['count'] = pending_count
        
        # 4. Progress Score (0-10 points)
        progress = case.get('progress', 0)
        breakdown['progress']['percentage'] = progress
        
        if progress < 25:
            prog_score = 10
            breakdown['progress']['details'].append(f'Progreso bajo ({progress}%) - requiere atención (+10)')
        elif progress < 50:
            prog_score = 5
            breakdown['progress']['details'].append(f'Progreso medio ({progress}%) (+5)')
        else:
            prog_score = 0
            breakdown['progress']['details'].append(f'Buen progreso ({progress}%)')
        
        score += prog_score
        breakdown['progress']['score'] = prog_score
        
        return {'score': score, 'breakdown': breakdown}
        
    except Exception as e:
        logger.error(f"Error calculating priority score: {e}")
        return {'score': 0, 'breakdown': {}}

@router.get("")
async def get_all_visa_cases(
    authorization: Annotated[str, Header()],
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    visaType: Optional[str] = None,
    coordinatorId: Optional[str] = None,
    search: Optional[str] = None,
    sortBy: str = "createdAt"
):
    """Get list of all visa cases with filters and search."""
    try:
        staff_payload = verify_staff_token_impl(authorization)
        
        # Build query
        query = {}
        if status:
            query['status'] = status
        if visaType:
            query['visaType'] = visaType
        if coordinatorId:
            query['coordinatorId'] = coordinatorId
        
        # If coordinator or advisor, only see assigned cases (as coordinator OR seller)
        user_role = staff_payload.get('role', 'advisor')
        staff_id = staff_payload['id']
        if user_role in ['coordinator', 'advisor']:
            # Can see cases where they are coordinator OR seller
            query['$or'] = [
                {'coordinatorId': staff_id},
                {'sellerId': staff_id}
            ]
        
        # Search by user info
        if search:
            user_query = {
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}},
                    {'phone': {'$regex': search, '$options': 'i'}}
                ]
            }
            matching_users = await db.users.find(user_query, {'_id': 1, 'id': 1}).to_list(length=1000)
            user_ids = []
            for user in matching_users:
                if '_id' in user:
                    user_ids.append(user['_id'])
                    user_ids.append(str(user['_id']))
                if 'id' in user and user['id'] not in user_ids:
                    user_ids.append(user['id'])
            
            if user_ids:
                query['userId'] = {'$in': user_ids}
        
        # Count total
        total = await db.visa_cases.count_documents(query)
        
        # Get paginated cases
        skip = (page - 1) * limit
        
        # Sorting
        sort_field = sortBy if sortBy != "priority" else "createdAt"
        sort_direction = -1
        
        cases_cursor = db.visa_cases.find(query).sort(sort_field, sort_direction).skip(skip).limit(limit)
        cases = await cases_cursor.to_list(length=limit)
        
        # Populate user data and staff data (coordinator and seller)
        for case in cases:
            # Convert case _id to string if it's ObjectId
            if '_id' in case and hasattr(case['_id'], '__str__') and not isinstance(case['_id'], str):
                case['_id'] = str(case['_id'])
            
            user_id = case.get('userId')
            if user_id:
                # Try to find user by string ID first, then by ObjectId
                user = await db.users.find_one({'_id': user_id}, {'password': 0})
                if not user:
                    # Try with ObjectId
                    try:
                        user = await db.users.find_one({'_id': ObjectId(user_id)}, {'password': 0})
                    except:
                        pass
                if user:
                    case['user'] = {
                        'id': str(user.get('_id', '')) or str(user.get('id', '')),
                        'name': user.get('name', 'Cliente'),
                        'email': user.get('email', ''),
                        'phone': user.get('phone', ''),
                        'userState': user.get('userState', 'U3')
                    }
            
            # Populate coordinator data
            coordinator_id = case.get('coordinatorId')
            if coordinator_id:
                coordinator = await db.staff.find_one({'_id': coordinator_id})
                if coordinator:
                    case['coordinator'] = {
                        'id': str(coordinator['_id']),
                        'name': coordinator.get('name', ''),
                        'email': coordinator.get('email', '')
                    }
                    # Add coordinatorName for frontend compatibility
                    case['coordinatorName'] = coordinator.get('name', '')
            
            # Populate seller data
            seller_id = case.get('sellerId')
            if seller_id:
                seller = await db.staff.find_one({'_id': seller_id})
                if seller:
                    case['seller'] = {
                        'id': str(seller['_id']),
                        'name': seller.get('name', ''),
                        'email': seller.get('email', '')
                    }
                    # Add advisorName for frontend compatibility (vendedor)
                    case['advisorName'] = seller.get('name', '')
            
            # Calculate priority score if sorting by priority
            if sortBy == "priority":
                priority_data = await calculate_case_priority_score(case['_id'])
                case['priorityScore'] = priority_data['score']
                case['scoreBreakdown'] = priority_data['breakdown']
        
        # Sort by priority if requested
        if sortBy == "priority":
            cases.sort(key=lambda x: x.get('priorityScore', 0), reverse=True)
        
        # Sanitize all MongoDB documents to convert ObjectIds to strings
        cases = [sanitize_mongo_doc(case) for case in cases]
        
        return {
            'cases': cases,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting visa cases: {e}")
        raise HTTPException(status_code=500, detail="Error getting visa cases")

@router.get("/{case_id}")
async def get_visa_case_detail(
    case_id: str,
    authorization: Annotated[str, Header()]
):
    """Get detailed information about a specific visa case."""
    try:
        staff_payload = verify_staff_token_impl(authorization)
        staff_id = staff_payload['id']
        user_role = staff_payload.get('role', 'advisor')
        
        # Get case
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Check access for coordinator/advisor roles
        if user_role in ['coordinator', 'advisor']:
            is_coordinator = case.get('coordinatorId') == staff_id
            is_seller = case.get('sellerId') == staff_id
            if not is_coordinator and not is_seller:
                raise HTTPException(status_code=403, detail="No tienes acceso a este caso")
        
        # Get user data
        user_id = case.get('userId')
        if user_id:
            # Try to find user by string ID first, then by ObjectId
            user = await db.users.find_one({'_id': user_id}, {'password': 0})
            if not user:
                # Try with ObjectId
                try:
                    user = await db.users.find_one({'_id': ObjectId(user_id)}, {'password': 0})
                except:
                    pass
            if user:
                case['user'] = {
                    'id': str(user.get('_id', '')) or str(user.get('id', '')),
                    'name': user.get('name', 'Cliente'),
                    'email': user.get('email', ''),
                    'phone': user.get('phone', ''),
                    'userState': user.get('userState', 'U3')
                }
        
        # Convert any ObjectId in case to string
        if '_id' in case and hasattr(case['_id'], '__str__'):
            case['_id'] = str(case['_id'])
        
        # Get coordinator data if exists
        coordinator_id = case.get('coordinatorId')
        if coordinator_id:
            coordinator = await db.staff.find_one({'_id': coordinator_id})
            if coordinator:
                case['coordinator'] = {
                    'id': str(coordinator['_id']),
                    'name': coordinator.get('name', ''),
                    'email': coordinator.get('email', '')
                }
                # Add coordinatorName for frontend compatibility
                case['coordinatorName'] = coordinator.get('name', '')
        
        # Get seller data if exists
        seller_id = case.get('sellerId')
        if seller_id:
            seller = await db.staff.find_one({'_id': seller_id})
            if seller:
                case['seller'] = {
                    'id': str(seller['_id']),
                    'name': seller.get('name', ''),
                    'email': seller.get('email', '')
                }
                # Add advisorName for frontend compatibility (vendedor)
                case['advisorName'] = seller.get('name', '')
        
        # Sanitize all MongoDB documents to convert ObjectIds to strings
        return sanitize_mongo_doc(case)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting case detail: {e}")
        raise HTTPException(status_code=500, detail="Error getting case detail")

@router.delete("/{case_id}")
async def delete_visa_case(
    case_id: str,
    authorization: Annotated[str, Header()]
):
    """Delete a visa case (Super Admin only)."""
    try:
        payload = verify_staff_token_impl(authorization)
        verify_admin_only(payload)
        
        # Check if case exists
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Delete all related data
        stages_result = await db.visa_stages.delete_many({'caseId': case_id})
        deliverables_result = await db.visa_deliverables.delete_many({'caseId': case_id})
        documents_result = await db.visa_client_documents.delete_many({'caseId': case_id})
        payments_result = await db.visa_payments.delete_many({'caseId': case_id})
        meetings_result = await db.visa_meetings.delete_many({'caseId': case_id})
        
        # Delete the case
        case_result = await db.visa_cases.delete_one({'_id': case_id})
        
        if case_result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Error deleting case")
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=payload['id'],
            action='delete',
            resource='visa_case',
            resource_id=case_id,
            details={
                'visaType': case.get('visaType'),
                'userId': case.get('userId'),
                'deletedStages': stages_result.deleted_count,
                'deletedDeliverables': deliverables_result.deleted_count,
                'deletedDocuments': documents_result.deleted_count,
                'deletedPayments': payments_result.deleted_count,
                'deletedMeetings': meetings_result.deleted_count
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"✅ Case {case_id} deleted by {payload['id']}")
        
        return {
            'success': True,
            'message': 'Case deleted successfully',
            'deletedItems': {
                'stages': stages_result.deleted_count,
                'deliverables': deliverables_result.deleted_count,
                'documents': documents_result.deleted_count,
                'payments': payments_result.deleted_count,
                'meetings': meetings_result.deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting case: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting case: {str(e)}")
