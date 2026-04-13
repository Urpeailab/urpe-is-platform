"""Admin user management endpoints."""
from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Annotated, List
from datetime import datetime, timezone
import secrets
import jwt
import os
from uuid import uuid4
from config import db, JWT_SECRET, JWT_ALGORITHM, logger
from utils.auth_helpers import verify_staff_token_impl, verify_admin_only
from utils.date_helpers import get_utc_now

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])

@router.get("/{user_phone}/magic-links")
async def get_user_magic_links(
    user_phone: str,
    authorization: Annotated[str, Header()]
):
    """Get all magic links for a user by phone number."""
    try:
        # Verify admin/staff token
        payload = verify_staff_token_impl(authorization)
        
        # Allow admin, super_admin, coordinator, and advisor roles
        user_type = payload.get('type')
        user_role = payload.get('role')
        
        # Allow: admin (type=admin), super_admin, coordinator, or advisor
        if not (user_type == 'admin' or 
                (user_type == 'staff' and user_role in ['admin', 'super_admin', 'coordinator', 'advisor'])):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        
        # Get frontend URL for constructing full magic link URLs
        frontend_url = os.getenv('FRONTEND_URL')
        if not frontend_url:
            backend_url = os.getenv('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')
            frontend_url = backend_url.replace('/api', '')
        
        # Find all magic links for this phone
        magic_links_cursor = db.magic_links.find({'phone': user_phone}).sort('createdAt', -1)
        magic_links = await magic_links_cursor.to_list(length=100)
        
        # Format magic links with full URLs
        # Magic links never expire and can be used multiple times
        formatted_links = []
        for link in magic_links:
            magic_link_url = f"{frontend_url}/welcome/{link['magicToken']}"
            
            formatted_links.append({
                'magicToken': link['magicToken'],
                'magicLinkUrl': magic_link_url,
                'createdAt': link.get('createdAt'),
                'phone': link.get('phone'),
                'isExpired': False,  # Magic links never expire
                'expiresIn': 'Sin vencimiento'
            })
        
        return {
            'success': True,
            'phone': user_phone,
            'magicLinks': formatted_links,
            'count': len(formatted_links)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting magic links: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting magic links: {str(e)}"
        )

@router.post("/{user_phone}/generate-magic-link")
async def admin_generate_magic_link(
    user_phone: str,
    authorization: Annotated[str, Header()]
):
    """Admin endpoint to generate a new magic link for a user."""
    try:
        # Verify admin token
        payload = verify_staff_token_impl(authorization)
        
        # Allow admin, super_admin, coordinator, and advisor roles
        user_type = payload.get('type')
        user_role = payload.get('role')
        
        # Allow: admin (type=admin), super_admin, coordinator, or advisor
        if not (user_type == 'admin' or 
                (user_type == 'staff' and user_role in ['admin', 'super_admin', 'coordinator', 'advisor'])):
            raise HTTPException(status_code=403, detail="Acceso denegado")
        
        # Find user by phone
        user = await db.users.find_one({'phone': user_phone}, {'_id': 0})
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"Usuario con teléfono {user_phone} no encontrado"
            )
        
        # Generate new magic token
        magic_token = secrets.token_urlsafe(16)
        
        # Get frontend URL
        frontend_url = os.getenv('FRONTEND_URL')
        if not frontend_url:
            backend_url = os.getenv('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')
            frontend_url = backend_url.replace('/api', '')
        
        # Create new magic link document
        magic_link_doc = {
            'id': str(uuid4()),
            'phone': user_phone,
            'magicToken': magic_token,
            'userId': user.get('id'),
            'userState': user.get('userState', 'U3'),
            'createdAt': get_utc_now()
        }
        
        # Insert new magic link
        await db.magic_links.insert_one(magic_link_doc)
        
        magic_link_url = f"{frontend_url}/welcome/{magic_token}"
        
        logger.info(f"✅ Admin generated new magic link for user: {user_phone}")
        
        return {
            'success': True,
            'magicToken': magic_token,
            'magicLinkUrl': magic_link_url,
            'createdAt': magic_link_doc['createdAt'],
            'phone': user_phone,
            'isExpired': False,
            'expiresIn': 'Sin vencimiento'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating magic link: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando magic link: {str(e)}"
        )

@router.get("")
async def get_all_users(
    authorization: Annotated[str, Header()],
    search: str = None,
    page: int = 1,
    limit: int = 50
):
    """Get all users with optional search and pagination."""
    try:
        # Verify staff token
        verify_staff_token_impl(authorization)
        
        # Build query
        query = {}
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'phone': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get total count
        total = await db.users.count_documents(query)
        
        # Get paginated users
        skip = (page - 1) * limit
        users_cursor = db.users.find(query, {'_id': 0, 'password': 0}).skip(skip).limit(limit)
        users = await users_cursor.to_list(length=limit)
        
        return {
            'users': users,
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
        logger.error(f"Error getting users: {e}")
        raise HTTPException(status_code=500, detail="Error getting users")
