"""
Authentication Router - Handles user registration, login, and authentication
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import logging

from auth import verify_password, get_password_hash, create_access_token, verify_token

logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()

# ============================================================================
# Models
# ============================================================================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    role: str = "USER"  # "ADMIN", "USER"
    status: str = "active"  # active, suspended, inactive, deleted
    permissions: List[str] = []
    language_preference: str = "es"  # es, en
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    language_preference: str = "es"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    """Model for admin creating users"""
    email: EmailStr
    password: str
    full_name: str
    role: str = "USER"
    language_preference: str = "es"


class UserUpdate(BaseModel):
    """Model for updating user"""
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    language_preference: Optional[str] = None


# ============================================================================
# Admin Whitelist
# ============================================================================

ADMIN_WHITELIST = [
    "leidi@gmail.com",
    "leidipelaez@gmail.com",
    "dau@urpeailab.com",
    "diego@urpeailab.com"
]


# ============================================================================
# Dependencies
# ============================================================================

# Database will be injected from server.py
_db = None

def set_database(database):
    """Set the database instance - called from server.py during initialization"""
    global _db
    _db = database

def get_db():
    """Get the database instance"""
    if _db is None:
        raise RuntimeError("Database not initialized. Call set_database() first.")
    return _db


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    email = verify_token(token)
    if email is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    db = get_db()
    user = await db.users.find_one({"email": email}, {"_id": 0, "password": 0})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return User(**user)


async def require_admin(current_user: User = Depends(get_current_user)):
    """Verify that the user is admin (case-insensitive)"""
    if current_user.role.upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Middleware to verify user has ADMIN role"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, 
            detail="Access denied. Admin privileges required."
        )
    return current_user


# ============================================================================
# Router
# ============================================================================

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=dict)
async def register(user_data: UserRegister):
    """Register a new user"""
    try:
        db = get_db()
        
        # Check if user already exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            if existing_user.get('status') == 'deleted':
                raise HTTPException(
                    status_code=400, 
                    detail="Este email fue previamente registrado y eliminado. Por favor, contacta al administrador para restaurar tu cuenta."
                )
            raise HTTPException(
                status_code=400, 
                detail="Este email ya se encuentra registrado en el sistema. Por favor, contacta al administrador si necesitas recuperar el acceso a tu cuenta."
            )
        
        # Determine role based on email
        user_role = "ADMIN" if user_data.email.lower() in ADMIN_WHITELIST else "USER"
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            full_name=user_data.full_name,
            language_preference=user_data.language_preference,
            role=user_role
        )
        
        user_dict = user.model_dump()
        user_dict['password'] = hashed_password
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        
        if user_role == "ADMIN":
            logger.info(f"AUTO-ADMIN: Usuario {user_data.email} registrado automáticamente como ADMIN")
        
        await db.users.insert_one(user_dict)
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(minutes=30 * 24 * 60)
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "language_preference": user.language_preference
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en registro: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Error al crear la cuenta. Por favor, intenta nuevamente o contacta al soporte."
        )


@router.post("/login", response_model=dict)
async def login(credentials: UserLogin):
    """Login user"""
    db = get_db()
    
    # Find user that is not deleted
    user = await db.users.find_one({
        "email": credentials.email,
        "status": {"$ne": "deleted"}
    })
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    logger.info(f"DEBUG Login - Email: {credentials.email}")
    verification_result = verify_password(credentials.password, user['password'])
    logger.info(f"DEBUG Login - Verification result: {verification_result}")
    
    if not verification_result:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user['email']},
        expires_delta=timedelta(minutes=30 * 24 * 60)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user['id'],
            "email": user['email'],
            "full_name": user.get('full_name') or user.get('name', ''),
            "role": user.get('role', 'USER'),
            "language_preference": user.get('language_preference', 'es')
        }
    }


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user


# ============================================================================
# SSO - Single Sign-On via external token
# ============================================================================

class SSORequest(BaseModel):
    external_token: str


EXTERNAL_AUTH_URL = "https://panel.urpeintegralservices.co/api/admin/auth/me"

# Role mapping from external system to Monica roles
def _map_external_role(external_role: str) -> str:
    role_map = {
        "super_admin": "ADMIN",
        "admin": "ADMIN",
    }
    return role_map.get(external_role, "USER")


@router.post("/sso", response_model=dict)
async def sso_login(payload: SSORequest):
    """
    SSO login via external token.
    Validates the token against the external auth system and
    creates/updates the Monica user accordingly.
    """
    import httpx

    # 1. Validate token against external system
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            ext_resp = await client.get(
                EXTERNAL_AUTH_URL,
                headers={"Authorization": f"Bearer {payload.external_token}"},
            )
    except httpx.RequestError as exc:
        logger.error(f"SSO: Error calling external auth API: {exc}")
        raise HTTPException(status_code=503, detail="Error conectando con el sistema de autenticación externo.")

    if ext_resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Token externo inválido o expirado.")
    if ext_resp.status_code != 200:
        logger.error(f"SSO: External API returned {ext_resp.status_code}: {ext_resp.text}")
        raise HTTPException(status_code=400, detail=f"Error validando token externo (código {ext_resp.status_code}).")

    try:
        ext_user = ext_resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail="Respuesta inválida del sistema de autenticación externo.")

    # 2. Extract user fields
    email = ext_user.get("email")
    name = ext_user.get("name") or ext_user.get("full_name") or "Usuario"
    external_role = ext_user.get("role", "user")
    status = ext_user.get("status", "active")

    if not email:
        raise HTTPException(status_code=400, detail="El sistema externo no devolvió un email de usuario.")

    if status != "active":
        raise HTTPException(status_code=403, detail="Tu cuenta está inactiva en el sistema externo.")

    monica_role = _map_external_role(external_role)

    # 3. Find or create Monica user
    db = get_db()
    existing = await db.users.find_one({"email": email}, {"_id": 0})

    if existing:
        # Update name and role in case they changed in external system
        await db.users.update_one(
            {"email": email},
            {"$set": {"full_name": name, "role": monica_role, "status": "active"}}
        )
        user_id = existing["id"]
    else:
        # Auto-create Monica user (no password — SSO only)
        new_user = User(
            email=email,
            full_name=name,
            role=monica_role,
            status="active",
        )
        user_dict = new_user.model_dump()
        user_dict["password"] = None  # SSO user, no password
        user_dict["created_at"] = user_dict["created_at"].isoformat()
        user_dict["sso_only"] = True
        await db.users.insert_one(user_dict)
        user_id = new_user.id
        logger.info(f"SSO: Auto-created Monica user for {email} with role {monica_role}")

    # 4. Issue Monica JWT
    access_token = create_access_token(
        data={"sub": email},
        expires_delta=timedelta(minutes=30 * 24 * 60),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": email,
            "full_name": name,
            "role": monica_role,
            "language_preference": existing.get("language_preference", "es") if existing else "es",
        },
    }
