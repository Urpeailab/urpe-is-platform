"""Admin staff management endpoints."""
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Annotated
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from config import db, pwd_context, logger
from utils.auth_helpers import verify_staff_token_impl, verify_admin_only
from utils.activity_log import ActivityLog
from utils.date_helpers import get_utc_now

router = APIRouter(prefix="/admin/staff", tags=["Admin Staff Management"])

@router.get("")
async def get_all_staff(authorization: Annotated[str, Header()]):
    """Get all staff members (coordinators and admins)."""
    try:
        # Verify staff token
        verify_staff_token_impl(authorization)
        
        # Get all staff
        staff_cursor = db.staff.find({}, {'passwordHash': 0})
        staff_list = await staff_cursor.to_list(length=100)
        
        return {
            'staff': staff_list,
            'count': len(staff_list)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting staff: {e}")
        raise HTTPException(status_code=500, detail="Error getting staff list")

@router.get("/coordinators")
async def get_coordinators(authorization: Annotated[str, Header()]):
    """Get all coordinators."""
    try:
        # Verify staff token
        verify_staff_token_impl(authorization)
        
        # Get coordinators
        coordinators_cursor = db.staff.find(
            {'role': {'$in': ['coordinator', 'admin']}, 'status': 'active'},
            {'passwordHash': 0}
        )
        coordinators = await coordinators_cursor.to_list(length=100)
        
        return {
            'coordinators': coordinators,
            'count': len(coordinators)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting coordinators: {e}")
        raise HTTPException(status_code=500, detail="Error getting coordinators")

@router.put("/change-password")
async def change_admin_password(
    password_data: dict,
    authorization: Annotated[str, Header()]
):
    """Change admin/staff password."""
    try:
        payload = verify_staff_token_impl(authorization)
        staff_id = payload['id']
        
        current_password = password_data.get('currentPassword')
        new_password = password_data.get('newPassword')
        
        if not current_password or not new_password:
            raise HTTPException(
                status_code=400,
                detail="Current and new password are required"
            )
        
        # Get staff member
        staff = await db.staff.find_one({'_id': staff_id})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        # Verify current password
        if not pwd_context.verify(current_password, staff.get('passwordHash', '')):
            raise HTTPException(
                status_code=401,
                detail="Current password is incorrect"
            )
        
        # Hash new password
        new_password_hash = pwd_context.hash(new_password)
        
        # Update password
        await db.staff.update_one(
            {'_id': staff_id},
            {'$set': {'passwordHash': new_password_hash}}
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_id,
            action='update',
            resource='staff',
            resource_id=staff_id,
            details={'action': 'password_change'}
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"✅ Password changed for staff: {staff_id}")
        
        return {
            'success': True,
            'message': 'Password changed successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")


@router.post("/create-admin")
async def create_super_admin(
    admin_data: dict,
    authorization: Annotated[str, Header()]
):
    """Create a new super admin (only super admins can do this)."""
    try:
        payload = verify_staff_token_impl(authorization)
        verify_admin_only(payload)
        
        # Validate required fields
        email = admin_data.get('email')
        name = admin_data.get('name')
        password = admin_data.get('password')
        
        if not email or not name or not password:
            raise HTTPException(
                status_code=400,
                detail="Email, name, and password are required"
            )
        
        # Check if email already exists
        existing = await db.staff.find_one({'email': email})
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )
        
        # Hash password
        password_hash = pwd_context.hash(password)
        
        # Create new admin
        new_admin = {
            '_id': str(uuid4()),
            'email': email,
            'name': name,
            'passwordHash': password_hash,
            'role': 'admin',
            'status': 'active',
            'createdAt': get_utc_now(),
            'createdBy': payload['id']
        }
        
        await db.staff.insert_one(new_admin)
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=payload['id'],
            action='create',
            resource='staff',
            resource_id=new_admin['_id'],
            details={
                'role': 'admin',
                'email': email,
                'name': name
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"✅ New super admin created: {email} by {payload['id']}")
        
        return {
            'success': True,
            'message': 'Super admin created successfully',
            'admin': {
                'id': new_admin['_id'],
                'email': email,
                'name': name,
                'role': 'admin',
                'status': 'active'
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating super admin: {e}")
        raise HTTPException(status_code=500, detail="Error creating super admin")

@router.post("/request-delete/{staff_id}")
async def request_delete_admin(
    staff_id: str,
    reason: dict,
    authorization: Annotated[str, Header()]
):
    """Request deletion of a super admin (requires approval from another admin)."""
    try:
        payload = verify_staff_token_impl(authorization)
        verify_admin_only(payload)
        
        # Cannot request to delete yourself
        if staff_id == payload['id']:
            raise HTTPException(
                status_code=400,
                detail="No puedes solicitar eliminar tu propia cuenta"
            )
        
        # Verify the staff member exists
        staff = await db.staff.find_one({'_id': staff_id})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        # Check if already has a pending request
        existing_request = await db.admin_deletion_requests.find_one({
            'staffId': staff_id,
            'status': 'pending'
        })
        
        if existing_request:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una solicitud pendiente para eliminar este admin"
            )
        
        # Create deletion request
        request_doc = {
            '_id': str(uuid4()),
            'staffId': staff_id,
            'staffEmail': staff.get('email'),
            'staffName': staff.get('name'),
            'staffRole': staff.get('role'),
            'requestedBy': {
                'id': payload['id'],
                'email': payload.get('email'),
                'name': payload.get('name')
            },
            'reason': reason.get('reason', ''),
            'status': 'pending',
            'createdAt': get_utc_now(),
            'expiresAt': get_utc_now() + timedelta(days=7)  # Expires in 7 days
        }
        
        await db.admin_deletion_requests.insert_one(request_doc)
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=payload['id'],
            action='request_delete',
            resource='staff',
            resource_id=staff_id,
            details={
                'requestId': request_doc['_id'],
                'targetEmail': staff.get('email'),
                'reason': reason.get('reason', '')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"⚠️ Delete request created for admin {staff_id} by {payload['id']}")
        
        return {
            'success': True,
            'message': 'Solicitud de eliminación creada. Requiere aprobación de otro super admin.',
            'requestId': request_doc['_id'],
            'expiresAt': request_doc['expiresAt']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating delete request: {e}")
        raise HTTPException(status_code=500, detail="Error creating delete request")

@router.get("/deletion-requests")
async def get_deletion_requests(
    authorization: Annotated[str, Header()],
    status: str = "pending"
):
    """Get all admin deletion requests."""
    try:
        payload = verify_staff_token_impl(authorization)
        verify_admin_only(payload)
        
        # Build query
        query = {}
        if status:
            query['status'] = status
        
        # Get requests
        requests_cursor = db.admin_deletion_requests.find(query).sort('createdAt', -1)
        requests = await requests_cursor.to_list(length=100)
        
        # Mark expired requests
        now = get_utc_now()
        for request in requests:
            if request['status'] == 'pending':
                expires_at = request.get('expiresAt')
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                
                if expires_at and now > expires_at:
                    request['isExpired'] = True
                else:
                    request['isExpired'] = False
        
        return {
            'requests': requests,
            'total': len(requests)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting deletion requests: {e}")
        raise HTTPException(status_code=500, detail="Error getting deletion requests")

@router.post("/deletion-requests/{request_id}/approve")
async def approve_deletion_request(
    request_id: str,
    authorization: Annotated[str, Header()]
):
    """Approve a deletion request and delete the admin."""
    try:
        payload = verify_staff_token_impl(authorization)
        verify_admin_only(payload)
        
        # Get the request
        request = await db.admin_deletion_requests.find_one({'_id': request_id})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Check if request is still pending
        if request['status'] != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f"Request already {request['status']}"
            )
        
        # Check if expired
        expires_at = request.get('expiresAt')
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at and get_utc_now() > expires_at:
            raise HTTPException(
                status_code=400,
                detail="Request has expired"
            )
        
        # CRITICAL: Cannot approve your own request
        requester_id = request['requestedBy']['id']
        if requester_id == payload['id']:
            raise HTTPException(
                status_code=403,
                detail="No puedes aprobar tu propia solicitud de eliminación"
            )
        
        staff_id = request['staffId']
        
        # Get staff info before deletion
        staff = await db.staff.find_one({'_id': staff_id})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        # Delete the staff member
        result = await db.staff.delete_one({'_id': staff_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete staff member")
        
        # Update request status
        await db.admin_deletion_requests.update_one(
            {'_id': request_id},
            {
                '$set': {
                    'status': 'approved',
                    'approvedBy': {
                        'id': payload['id'],
                        'email': payload.get('email'),
                        'name': payload.get('name')
                    },
                    'approvedAt': get_utc_now()
                }
            }
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=payload['id'],
            action='delete_approved',
            resource='staff',
            resource_id=staff_id,
            details={
                'requestId': request_id,
                'deletedEmail': staff.get('email'),
                'deletedRole': staff.get('role'),
                'requestedBy': requester_id
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"✅ Admin {staff_id} deleted - approved by {payload['id']}, requested by {requester_id}")
        
        return {
            'success': True,
            'message': 'Admin eliminado exitosamente',
            'deletedAdmin': {
                'email': staff.get('email'),
                'name': staff.get('name')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving deletion: {e}")
        raise HTTPException(status_code=500, detail="Error approving deletion")

@router.post("/deletion-requests/{request_id}/reject")
async def reject_deletion_request(
    request_id: str,
    rejection_data: dict,
    authorization: Annotated[str, Header()]
):
    """Reject a deletion request."""
    try:
        payload = verify_staff_token_impl(authorization)
        verify_admin_only(payload)
        
        # Get the request
        request = await db.admin_deletion_requests.find_one({'_id': request_id})
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Check if request is still pending
        if request['status'] != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f"Request already {request['status']}"
            )
        
        # Update request status
        await db.admin_deletion_requests.update_one(
            {'_id': request_id},
            {
                '$set': {
                    'status': 'rejected',
                    'rejectedBy': {
                        'id': payload['id'],
                        'email': payload.get('email'),
                        'name': payload.get('name')
                    },
                    'rejectionReason': rejection_data.get('reason', ''),
                    'rejectedAt': get_utc_now()
                }
            }
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=payload['id'],
            action='delete_rejected',
            resource='staff',
            resource_id=request['staffId'],
            details={
                'requestId': request_id,
                'reason': rejection_data.get('reason', '')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"❌ Delete request {request_id} rejected by {payload['id']}")
        
        return {
            'success': True,
            'message': 'Solicitud rechazada'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting deletion: {e}")
        raise HTTPException(status_code=500, detail="Error rejecting deletion")

        raise HTTPException(status_code=500, detail="Error changing password")
