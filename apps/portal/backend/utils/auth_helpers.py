"""Authentication helper functions."""
from fastapi import HTTPException, Header
from typing import Annotated
import jwt
from config import JWT_SECRET, JWT_ALGORITHM, logger

def verify_staff_token_impl(authorization: str) -> dict:
    """
    Verify staff authentication token.
    Returns payload if valid, raises HTTPException if invalid.
    """
    try:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(status_code=401, detail="No token provided")
        
        token = authorization.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check if user is staff
        user_type = payload.get('type')
        if user_type not in ['staff', 'admin']:
            raise HTTPException(status_code=403, detail="Staff access required")
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

def verify_admin_only(payload: dict) -> bool:
    """
    Verify that the user has admin role.
    Raises HTTPException if not admin.
    """
    user_role = payload.get('role')
    if user_role != 'admin':
        raise HTTPException(
            status_code=403, 
            detail="Solo Super Admins tienen acceso a esta función"
        )
    return True

def verify_user_token(authorization: str) -> dict:
    """
    Verify user (client) authentication token.
    Returns payload if valid, raises HTTPException if invalid.
    """
    try:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(status_code=401, detail="No token provided")
        
        token = authorization.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
