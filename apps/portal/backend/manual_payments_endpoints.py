"""
Manual Payment Management Endpoints
Handles manual payment registration and tracking by admin staff
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
import logging

from manual_payments_models import ManualPaymentCreate, ManualPaymentUpdate

logger = logging.getLogger(__name__)

def setup_manual_payments_router(db, verify_staff_token):
    """Setup manual payments router with dependencies"""
    manual_payments_router = APIRouter()

    @manual_payments_router.post("/admin/payments/register")
    async def register_manual_payment(
        request: ManualPaymentCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin: Register a manual payment for a stage. Automatically unlocks the stage."""
        try:
            staff_id = staff_payload['id']
            staff_name = staff_payload.get('name', staff_payload.get('email', 'Admin'))
            
            # Verify case exists
            case = await db.visa_cases.find_one({'id': request.caseId}, {'_id': 0})
            if not case:
                raise HTTPException(status_code=404, detail="Case not found")
            
            # Verify stage exists
            stage = await db.visa_stages.find_one(
                {'id': request.stageId, 'caseId': request.caseId},
                {'_id': 0}
            )
            if not stage:
                raise HTTPException(status_code=404, detail="Stage not found")
            
            # Create payment record
            payment_id = str(uuid4())
            payment = {
                "_id": payment_id,
                "id": payment_id,
                "caseId": request.caseId,
                "userId": case['userId'],
                "stageId": request.stageId,
                "stageNumber": request.stageNumber,
                "stageName": stage.get('name', f"Etapa {request.stageNumber}"),
                "amount": request.amount,
                "paymentDate": request.paymentDate,
                "paymentMethod": request.paymentMethod,
                "reference": request.reference,
                "receiptUrl": request.receiptUrl,
                "receiptFileName": None,
                "notes": request.notes,
                "registeredBy": staff_id,
                "registeredByName": staff_name,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            
            await db.manual_payments.insert_one(payment)
            logger.info(f"Manual payment registered: {payment_id} for stage {request.stageNumber} by {staff_name}")
            
            # Update stage status to paid and unlocked
            await db.visa_stages.update_one(
                {'id': request.stageId},
                {
                    '$set': {
                        'isPaid': True,
                        'status': 'unlocked',
                        'updatedAt': datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            logger.info(f"Stage {request.stageNumber} unlocked after payment")
            
            # Update case status to "active" if it was "on_hold"
            if case.get('status') == 'on_hold':
                await db.visa_cases.update_one(
                    {'id': request.caseId},
                    {
                        '$set': {
                            'status': 'active',
                            'updatedAt': datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                logger.info(f"Case {request.caseId} status changed from 'on_hold' to 'active' after first payment")
            
            # Mark related appointment as completed if exists
            await db.appointments.update_many(
                {
                    'caseId': request.caseId,
                    'stageNumber': request.stageNumber,
                    'status': {'$in': ['pending', 'confirmed']}
                },
                {
                    '$set': {
                        'status': 'completed',
                        'updatedAt': datetime.now(timezone.utc).isoformat(),
                        'updatedBy': staff_id
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Pago registrado exitosamente. Etapa desbloqueada.",
                "payment": payment
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error registering payment: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @manual_payments_router.get("/admin/payments")
    async def get_all_payments(
        caseId: str = None,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin: Get all manual payments with optional case filter"""
        try:
            query = {}
            if caseId:
                query['caseId'] = caseId
            
            payments_raw = await db.manual_payments.find(query, {'_id': 0}).sort('createdAt', -1).to_list(1000)
            logger.info(f"📊 GET /admin/payments called with caseId={caseId}, found {len(payments_raw)} raw payments")
            
            # Enrich payment data with user and case information
            payments = []
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
                        except Exception as e:
                            logger.warning(f"Could not convert userId to ObjectId: {e}")
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
                    payments.append(enriched_payment)
                except Exception as e:
                    # If there's an error enriching this payment, still include it with basic data
                    logger.error(f"Error enriching payment {payment.get('id', 'unknown')}: {e}")
                    payments.append(payment)
            
            return {
                "success": True,
                "payments": payments,
                "count": len(payments)
            }
            
        except Exception as e:
            logger.error(f"Error fetching payments: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @manual_payments_router.get("/admin/payments/{payment_id}")
    async def get_payment_details(
        payment_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin: Get details of a specific payment"""
        try:
            payment = await db.manual_payments.find_one({'id': payment_id}, {'_id': 0})
            if not payment:
                raise HTTPException(status_code=404, detail="Payment not found")
            
            return {
                "success": True,
                "payment": payment
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching payment: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @manual_payments_router.patch("/admin/payments/{payment_id}")
    async def update_payment(
        payment_id: str,
        request: ManualPaymentUpdate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin: Update payment details"""
        try:
            # Get existing payment
            payment = await db.manual_payments.find_one({'id': payment_id}, {'_id': 0})
            if not payment:
                raise HTTPException(status_code=404, detail="Payment not found")
            
            # Build update data
            update_data = {
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            
            if request.amount is not None:
                update_data['amount'] = request.amount
            if request.paymentDate:
                update_data['paymentDate'] = request.paymentDate
            if request.paymentMethod:
                update_data['paymentMethod'] = request.paymentMethod
            if request.reference is not None:
                update_data['reference'] = request.reference
            if request.receiptUrl is not None:
                update_data['receiptUrl'] = request.receiptUrl
            if request.notes is not None:
                update_data['notes'] = request.notes
            
            # Update payment
            await db.manual_payments.update_one(
                {'id': payment_id},
                {'$set': update_data}
            )
            
            logger.info(f"Payment updated: {payment_id}")
            
            # Get updated payment
            updated_payment = await db.manual_payments.find_one({'id': payment_id}, {'_id': 0})
            
            return {
                "success": True,
                "message": "Pago actualizado exitosamente",
                "payment": updated_payment
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating payment: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return manual_payments_router
