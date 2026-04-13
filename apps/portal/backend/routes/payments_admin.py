"""Admin payments management endpoints."""
from fastapi import APIRouter, HTTPException, Header
from typing import Annotated, List
from config import db, logger
from utils.auth_helpers import verify_staff_token_impl
from utils.date_helpers import get_utc_now

router = APIRouter(prefix="/admin/payments", tags=["Admin Payments"])

@router.get("/case/{case_id}")
async def get_case_payments(
    case_id: str,
    authorization: Annotated[str, Header()]
):
    """Get all payments for a specific case."""
    try:
        verify_staff_token_impl(authorization)
        
        # Get payments from case document
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        payments = case.get('payments', [])
        
        return {
            'caseId': case_id,
            'payments': payments,
            'total': len(payments)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting case payments: {e}")
        raise HTTPException(status_code=500, detail="Error getting payments")

@router.post("/register")
async def register_payment(
    payment_data: dict,
    authorization: Annotated[str, Header()]
):
    """Register a single payment for a case."""
    try:
        payload = verify_staff_token_impl(authorization)
        
        case_id = payment_data.get('caseId')
        if not case_id:
            raise HTTPException(status_code=400, detail="Case ID is required")
        
        # Verify case exists
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Create payment object
        payment = {
            'amount': payment_data.get('amount'),
            'currency': payment_data.get('currency', 'USD'),
            'method': payment_data.get('method'),
            'reference': payment_data.get('reference', ''),
            'paidAt': payment_data.get('paidAt') or get_utc_now(),
            'stages': payment_data.get('stages', []),
            'notes': payment_data.get('notes', ''),
            'createdBy': {
                'id': payload['id'],
                'name': payload.get('name', ''),
                'email': payload.get('email', '')
            },
            'createdAt': get_utc_now()
        }
        
        # Add payment to case
        result = await db.visa_cases.update_one(
            {'_id': case_id},
            {'$push': {'payments': payment}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to register payment")
        
        logger.info(f"✅ Payment registered for case {case_id} by {payload['id']}")
        
        return {
            'success': True,
            'message': 'Payment registered successfully',
            'payment': payment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering payment: {e}")
        raise HTTPException(status_code=500, detail="Error registering payment")

@router.post("/register-multiple")
async def register_multiple_payments(
    payments_data: dict,
    authorization: Annotated[str, Header()]
):
    """Register multiple payments for different cases."""
    try:
        payload = verify_staff_token_impl(authorization)
        
        payments_list = payments_data.get('payments', [])
        if not payments_list:
            raise HTTPException(status_code=400, detail="No payments provided")
        
        results = []
        errors = []
        
        for payment_data in payments_list:
            try:
                case_id = payment_data.get('caseId')
                if not case_id:
                    errors.append({'caseId': 'unknown', 'error': 'Case ID missing'})
                    continue
                
                # Create payment
                payment = {
                    'amount': payment_data.get('amount'),
                    'currency': payment_data.get('currency', 'USD'),
                    'method': payment_data.get('method'),
                    'reference': payment_data.get('reference', ''),
                    'paidAt': payment_data.get('paidAt') or get_utc_now(),
                    'stages': payment_data.get('stages', []),
                    'notes': payment_data.get('notes', ''),
                    'createdBy': {
                        'id': payload['id'],
                        'name': payload.get('name', ''),
                        'email': payload.get('email', '')
                    },
                    'createdAt': get_utc_now()
                }
                
                # Add to case
                result = await db.visa_cases.update_one(
                    {'_id': case_id},
                    {'$push': {'payments': payment}}
                )
                
                if result.modified_count > 0:
                    results.append({
                        'caseId': case_id,
                        'success': True
                    })
                else:
                    errors.append({
                        'caseId': case_id,
                        'error': 'Failed to update case'
                    })
                    
            except Exception as e:
                errors.append({
                    'caseId': payment_data.get('caseId', 'unknown'),
                    'error': str(e)
                })
        
        logger.info(f"✅ Registered {len(results)} payments, {len(errors)} errors")
        
        return {
            'success': True,
            'registered': len(results),
            'failed': len(errors),
            'results': results,
            'errors': errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering multiple payments: {e}")
        raise HTTPException(status_code=500, detail="Error registering payments")

@router.get("")
async def get_all_payments(
    authorization: Annotated[str, Header()],
    page: int = 1,
    limit: int = 50,
    caseId: str = None
):
    """Get all payments from manual_payments collection, with optional caseId filter."""
    try:
        verify_staff_token_impl(authorization)
        
        # Add logging message as requested
        logger.info(f"📊 GET /admin/payments called with caseId={caseId}, page={page}, limit={limit}")
        
        # Build query for manual_payments collection
        query = {}
        if caseId:
            query['caseId'] = caseId
        
        # Get payments from manual_payments collection in reverse chronological order (newest first)
        skip = (page - 1) * limit
        payments_raw = await db.manual_payments.find(query, {'_id': 0}).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
        
        logger.info(f"📊 Found {len(payments_raw)} raw payments in manual_payments collection")
        
        # Enrich payment data with user and case information
        all_payments = []
        for payment in payments_raw:
            try:
                # Get user info
                user_id = payment.get('userId')
                user_info = {}
                if user_id:
                    from bson import ObjectId
                    try:
                        user_object_id = ObjectId(user_id)
                        user = await db.users.find_one({'_id': user_object_id}, {'_id': 0, 'name': 1, 'email': 1, 'phone': 1})
                    except:
                        user = await db.users.find_one({'id': user_id}, {'_id': 0, 'name': 1, 'email': 1, 'phone': 1})
                    
                    if user:
                        user_info = {
                            'userName': user.get('name'),
                            'userEmail': user.get('email'),
                            'userPhone': user.get('phone')
                        }
                
                # Get case info
                case_id = payment.get('caseId')
                case_info = {}
                if case_id:
                    case = await db.visa_cases.find_one({'id': case_id}, {'_id': 0, 'visaType': 1, 'status': 1, 'overallProgress': 1})
                    if case:
                        case_info = {
                            'visaType': case.get('visaType'),
                            'caseStatus': case.get('status'),
                            'overallProgress': case.get('overallProgress', 0)
                        }
                
                # Normalize registeredBy data
                if 'createdBy' in payment and isinstance(payment['createdBy'], dict):
                    payment['registeredByName'] = payment['createdBy'].get('name', 'N/A')
                    payment['registeredBy'] = payment['createdBy'].get('id', '')
                elif 'registeredByName' not in payment:
                    payment['registeredByName'] = 'N/A'
                
                # Add enriched data to payment
                enriched_payment = {
                    **payment,
                    **user_info,
                    **case_info
                }
                all_payments.append(enriched_payment)
            except Exception as e:
                # If there's an error enriching this payment, still include it with basic data
                logger.error(f"Error enriching payment {payment.get('id', 'unknown')}: {e}")
                all_payments.append(payment)
        
        # Count total payments
        total_payments = await db.manual_payments.count_documents(query)
        
        logger.info(f"📊 GET /admin/payments returning {len(all_payments)} payments for caseId={caseId}")
        
        return {
            'payments': all_payments,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_payments,
                'pages': (total_payments + limit - 1) // limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all payments: {e}")
        raise HTTPException(status_code=500, detail="Error getting payments")
