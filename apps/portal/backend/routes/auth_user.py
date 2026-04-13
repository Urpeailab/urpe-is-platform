"""User authentication endpoints (signup, signin, magic link)."""
from fastapi import APIRouter, HTTPException, status, Header
from typing import Annotated
from datetime import datetime, timedelta, timezone
import jwt
import secrets
from config import db, pwd_context, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, logger
from utils.date_helpers import get_utc_now
from pydantic import BaseModel, EmailStr
from datetime import datetime as dt_datetime
from typing import Optional

# Define models here since they're in server.py
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class UserSignIn(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    name: str
    email: EmailStr
    phone: str
    userState: str = "U3"
    createdAt: dt_datetime = None
    
    def __init__(self, **data):
        if 'createdAt' not in data:
            data['createdAt'] = dt_datetime.utcnow()
        super().__init__(**data)
from uuid import uuid4
import os

router = APIRouter(prefix="/auth", tags=["User Authentication"])

@router.post("/signup")
async def signup(user_data: UserCreate):
    """Register a new user."""
    try:
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        hashed_password = pwd_context.hash(user_data.password)
        
        # Create user
        user = User(
            name=user_data.name,
            email=user_data.email,
            phone=user_data.phone,
            userState="U1"
        )
        
        user_dict = user.model_dump()
        user_dict['password'] = hashed_password
        user_dict['createdAt'] = user_dict['createdAt'].isoformat()
        user_dict['welcome'] = False  # Show welcome modal on first login
        
        result = await db.users.insert_one(user_dict)
        user_id = str(result.inserted_id)
        
        # Generate JWT token
        payload = {
            'id': user_id,
            'email': user_data.email,
            'name': user_data.name,
            'userState': 'U1',
            'type': 'user',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return {
            'id': user_id,
            'email': user_data.email,
            'name': user_data.name,
            'phone': user_data.phone,
            'userState': 'U1',
            'language': 'en',
            'createdAt': user_dict['createdAt'],
            'token': token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signup failed"
        )

@router.post("/signin")
async def signin(credentials: UserSignIn):
    """User login with email and password."""
    try:
        logger.info(f"🔐 Signin attempt for email: {credentials.email}")
        user_doc = await db.users.find_one({"email": credentials.email})
        
        if not user_doc:
            logger.warning("   User not found in MongoDB")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password
        if not pwd_context.verify(credentials.password, user_doc.get('password', '')):
            logger.warning("   Password verification failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        logger.info("✅ User authenticated successfully")
        
        # Generate token
        payload = {
            'id': str(user_doc['_id']),
            'email': user_doc['email'],
            'name': user_doc.get('name', ''),
            'userState': user_doc.get('userState', 'U3'),
            'type': 'user',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return {
            'id': str(user_doc['_id']),
            'email': user_doc['email'],
            'name': user_doc.get('name', ''),
            'phone': user_doc.get('phone', ''),
            'userState': user_doc.get('userState', 'U3'),
            'welcome': user_doc.get('welcome', False),
            'token': token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signin error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/generate-magic-link")
async def generate_magic_link(data: dict):
    """Generate a magic link for user authentication."""
    try:
        phone = data.get('phone')
        if not phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        
        # Find or create user
        user = await db.users.find_one({'phone': phone})
        
        if not user:
            # Create new user (U3 state)
            user_id = str(uuid4())
            user_state = 'U3'
            new_user = {
                '_id': user_id,
                'id': user_id,
                'phone': phone,
                'name': data.get('name', ''),
                'email': data.get('email', ''),
                'userState': user_state,
                'createdAt': get_utc_now(),
                'welcome': False
            }
            await db.users.insert_one(new_user)
            logger.info(f"✅ New user created with phone: {phone}")
        else:
            user_id = user.get('id') or str(user.get('_id'))
            user_state = user.get('userState', 'U3')
        
        # Generate magic token (32 bytes = very secure)
        magic_token = secrets.token_urlsafe(16)
        
        # Get frontend URL
        frontend_url = os.getenv('FRONTEND_URL')
        if not frontend_url:
            backend_url = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:3000')
            frontend_url = backend_url.replace('/api', '')
        
        # Store magic link (never expires)
        magic_link_doc = {
            'id': str(uuid4()),
            'phone': phone,
            'magicToken': magic_token,
            'userId': user_id,
            'userState': user_state,
            'createdAt': get_utc_now()
        }
        
        await db.magic_links.insert_one(magic_link_doc)
        
        magic_link_url = f"{frontend_url}/welcome/{magic_token}"
        
        logger.info(f"✅ Magic link generated for phone: {phone}")
        
        return {
            'success': True,
            'magicToken': magic_token,
            'magicLink': magic_link_url,
            'userId': user_id,
            'phone': phone,
            'userState': user_state
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating magic link: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/validate-magic-link/{token}")
async def validate_magic_link(token: str):
    """Validate a magic link token and authenticate user."""
    try:
        # Find magic link
        magic_link = await db.magic_links.find_one({'magicToken': token})
        
        if not magic_link:
            raise HTTPException(status_code=401, detail="Invalid or expired magic link")
        
        # Get user
        user_id = magic_link.get('userId')
        user = await db.users.find_one({'_id': user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Generate JWT token
        payload = {
            'id': str(user['_id']),
            'email': user.get('email', ''),
            'name': user.get('name', ''),
            'phone': user.get('phone', ''),
            'userState': user.get('userState', 'U3'),
            'type': 'user',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        
        jwt_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return {
            'token': jwt_token,
            'user': {
                'id': str(user['_id']),
                'email': user.get('email', ''),
                'name': user.get('name', ''),
                'phone': user.get('phone', ''),
                'userState': user.get('userState', 'U3'),
                'welcome': user.get('welcome', False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating magic link: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@router.post("/mark-welcome-seen")
async def mark_welcome_seen(authorization: Annotated[str, Header()]):
    """Mark that the user has seen the welcome modal."""
    try:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(status_code=401, detail="No token provided")
        
        token = authorization.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('id')
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Update user's welcome field
        await db.users.update_one(
            {'_id': user_id},
            {'$set': {'welcome': True}}
        )
        
        return {'success': True, 'message': 'Welcome status updated'}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error marking welcome seen: {e}")
        raise HTTPException(status_code=500, detail="Failed to update welcome status")
