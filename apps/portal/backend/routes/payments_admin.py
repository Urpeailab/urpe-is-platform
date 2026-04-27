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
    caseId: str = None,
    userId: str = None
):
    """Get all payments with optional caseId/userId filter (Supabase)."""
    try:
        verify_staff_token_impl(authorization)
        from db.supabase_client import get_supabase, _add_camel_aliases
        sb = get_supabase()

        logger.info(f"📊 GET /admin/payments called with caseId={caseId}, userId={userId}, page={page}, limit={limit}")

        # Build query on payments (unified table)
        q = sb.table("payments").select("*", count="exact")
        if caseId:
            q = q.eq("case_id", caseId)
        if userId:
            q = q.eq("client_id", userId)
        q = q.order("created_at", desc=True).range((page - 1) * limit, (page - 1) * limit + limit - 1)
        res = q.execute()
        payments_raw = [_add_camel_aliases(p) for p in (res.data or [])]
        total_payments = res.count or 0

        # Batch enrich — collect ids
        user_ids = list({p.get('client_id') or p.get('userId') or p.get('clientId') for p in payments_raw if (p.get('client_id') or p.get('userId') or p.get('clientId'))})
        case_ids = list({p.get('case_id') or p.get('caseId') for p in payments_raw if (p.get('case_id') or p.get('caseId'))})

        users_map = {}
        if user_ids:
            u_res = sb.table("clients").select("id,name,email,phone").in_("id", user_ids).execute()
            for u in (u_res.data or []):
                users_map[str(u['id'])] = u

        cases_map = {}
        if case_ids:
            c_res = sb.table("visa_cases").select("id,visa_type,status,overall_progress").in_("id", case_ids).execute()
            for c in (c_res.data or []):
                cases_map[str(c['id'])] = c

        all_payments = []
        for p in payments_raw:
            uid = p.get('client_id') or p.get('userId') or p.get('clientId')
            cid = p.get('case_id') or p.get('caseId')
            user = users_map.get(str(uid)) if uid else None
            case = cases_map.get(str(cid)) if cid else None
            if user:
                p['userName'] = user.get('name')
                p['userEmail'] = user.get('email')
                p['userPhone'] = user.get('phone')
            if case:
                p['visaType'] = case.get('visa_type')
                p['caseStatus'] = case.get('status')
                p['overallProgress'] = case.get('overall_progress', 0)
            if 'createdBy' in p and isinstance(p['createdBy'], dict):
                p['registeredByName'] = p['createdBy'].get('name', 'N/A')
                p['registeredBy'] = p['createdBy'].get('id', '')
            elif 'registeredByName' not in p:
                p['registeredByName'] = p.get('created_by_name') or 'N/A'
            all_payments.append(p)

        return {
            'payments': all_payments,
            'pagination': {
                'page': page, 'limit': limit, 'total': total_payments,
                'pages': (total_payments + limit - 1) // limit if total_payments else 1
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all payments: {e}")
        raise HTTPException(status_code=500, detail="Error getting payments")
