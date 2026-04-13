"""Admin authentication endpoints."""
from fastapi import APIRouter, HTTPException, status, Header, Depends
from typing import Annotated
from datetime import datetime, timedelta
import jwt
from config import db, pwd_context, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, logger
from admin_models import StaffModel
from utils.auth_helpers import verify_staff_token_impl

router = APIRouter(prefix="/admin/auth", tags=["Admin Authentication"])

@router.post("/login")
async def admin_login(credentials: dict):
    """Admin/Staff login endpoint."""
    try:
        email = credentials.get('email')
        password = credentials.get('password')
        
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required"
            )
        
        # Find staff member
        staff = await db.staff.find_one({'email': email})
        
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password (check both 'password' and 'passwordHash' for compatibility)
        stored_password = staff.get('password') or staff.get('passwordHash', '')
        if not stored_password or not pwd_context.verify(password, stored_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Check if account is active (check both 'active' and 'status' for compatibility)
        is_active = staff.get('active', True) or staff.get('status') == 'active'
        if not is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not active"
            )
        
        # Generate JWT token
        payload = {
            'id': staff['_id'],
            'email': staff['email'],
            'name': staff.get('name', ''),
            'role': staff.get('role', 'coordinator'),
            'type': 'staff',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        logger.info(f"✅ Admin login successful: {email}")
        
        return {
            'token': token,
            'user': {
                'id': staff['_id'],
                'email': staff['email'],
                'name': staff.get('name', ''),
                'role': staff.get('role', 'coordinator'),
                'type': 'staff'
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.get("/me")
async def get_current_admin(authorization: Annotated[str, Header()] = None):
    """Get current admin user info."""
    try:
        payload = verify_staff_token_impl(authorization)
        
        # Get fresh user data from database
        staff = await db.staff.find_one({'_id': payload['id']})
        
        if not staff:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            'id': staff['_id'],
            'email': staff['email'],
            'name': staff.get('name', ''),
            'role': staff.get('role', 'coordinator'),
            'type': 'staff',
            'status': staff.get('status', 'active')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user info")

@router.post("/logout")
async def admin_logout():
    """Admin logout endpoint (client-side token removal)."""
    return {
        'success': True,
        'message': 'Logged out successfully'
    }
