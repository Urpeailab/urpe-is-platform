from fastapi import FastAPI, APIRouter, HTTPException, status, Header, Depends, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Annotated
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import secrets
from bson import ObjectId
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Database dependency for endpoints
def get_db():
    return db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import RBAC system
from permissions_system import (
    ROLE_PERMISSIONS,
    ROLE_HIERARCHY,
    has_permission,
    can_manage_role,
    get_menu_items_for_role,
    filter_data_by_permissions
)

# Import audit logging
from routes.audit import log_case_audit, AuditActionTypes

# Import JWT constants and StaffModel for authentication
from admin_models import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, StaffModel

# ===== Auth Dependency (defined early for use in endpoints) =====
async def verify_staff_token(authorization: Annotated[str, Header()] = None):
    """Verify staff JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No authorization token provided")
    
    token = authorization.replace('Bearer ', '')
    payload = StaffModel.verify_jwt(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # System tokens (admin_system) don't need DB verification
    if payload.get('type') == 'admin_system':
        return payload
    
    # Verificar que el staff existe y está activo (check both 'active' and 'status' for compatibility)
    staff = await db.staff.find_one({'_id': payload['id']})
    is_active = staff and (staff.get('active', True) or staff.get('status') == 'active')
    if not is_active:
        raise HTTPException(status_code=401, detail="Account deactivated or not found")
    
    return payload

# ===== ADMIN API TOKENS =====

class GenerateApiTokenRequest(BaseModel):
    label: Optional[str] = "API Token"
    expiresInDays: int = 30

@api_router.post("/admin/generate-api-token")
async def generate_api_token(
    data: GenerateApiTokenRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Generate a shareable API token for the admin.
    The token has the same permissions as the admin and can be used
    with any endpoint that accepts Bearer token auth.
    """
    from admin_models import JWT_SECRET, JWT_ALGORITHM
    import jwt as _jwt

    token_id = str(uuid.uuid4())
    exp = datetime.now(timezone.utc) + timedelta(days=data.expiresInDays)

    payload = {
        'id': staff_payload['id'],
        'email': staff_payload.get('email', ''),
        'name': staff_payload.get('name', ''),
        'role': staff_payload.get('role', ''),
        'type': 'api_token',
        'token_id': token_id,
        'exp': exp,
    }

    token = _jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Save token record
    await db.admin_api_tokens.insert_one({
        "_id": token_id,
        "staffId": staff_payload['id'],
        "staffEmail": staff_payload.get('email', ''),
        "staffName": staff_payload.get('name', ''),
        "role": staff_payload.get('role', ''),
        "label": data.label,
        "expiresAt": exp.isoformat(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "active": True,
    })

    return {
        "success": True,
        "token": token,
        "tokenId": token_id,
        "expiresAt": exp.isoformat(),
        "message": f"Token generado. Expira en {data.expiresInDays} dias."
    }

@api_router.get("/admin/api-tokens")
async def list_api_tokens(staff_payload: dict = Depends(verify_staff_token)):
    """List all API tokens for the admin."""
    tokens = await db.admin_api_tokens.find(
        {"staffId": staff_payload['id']}, {"_id": 0}
    ).sort("createdAt", -1).to_list(50)
    return {"success": True, "tokens": tokens}

@api_router.delete("/admin/api-tokens/{token_id}")
async def revoke_api_token(token_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Revoke an API token."""
    result = await db.admin_api_tokens.delete_one({"_id": token_id, "staffId": staff_payload['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token no encontrado")
    return {"success": True, "message": "Token revocado"}


# ============= HELPER FUNCTIONS =============

def sanitize_mongo_response(doc):
    """Convert all ObjectId and datetime fields to JSON-serializable types recursively."""
    if doc is None:
        return None
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    if isinstance(doc, dict):
        return {k: sanitize_mongo_response(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [sanitize_mongo_response(item) for item in doc]
    # Handle any other non-serializable types
    try:
        if isinstance(doc, (str, int, float, bool)):
            return doc
        return str(doc)
    except:
        return None

# ============= WEBHOOK NOTIFICATION HELPER =============

async def notify_case_webhook(action: str, client_data: dict, case_data: dict = None, extra_data: dict = None):
    """
    Helper function to notify N8N webhook about case events
    
    Args:
        action: The action that occurred (e.g., "caso_creado", "pago_etapa_1", "cambio_etapa")
        client_data: Client information (name, email, phone, etc.)
        case_data: Case information (caseId, visaType, etc.)
        extra_data: Any additional data to include
    """
    webhook_url = os.environ.get("N8N_WEBHOOK_URL", "https://n8n.urpeailab.com/webhook/5fd48590-2b23-4e0d-8149-e5aac01515a2")
    
    # Detectar si es entorno de prueba
    is_test_environment = os.environ.get('ENVIRONMENT', 'production').lower() in ['development', 'staging', 'preview', 'test']
    # También verificar por el dominio si está disponible
    frontend_url = os.environ.get('FRONTEND_URL', '')
    if 'preview' in frontend_url.lower() or 'staging' in frontend_url.lower() or 'localhost' in frontend_url.lower():
        is_test_environment = True
    
    try:
        import httpx
        
        # Generar título y descripción basado en la acción
        titulo = ""
        descripcion = ""
        etiquetas = []
        
        if action == "caso_creado":
            titulo = "Nuevo Caso Creado"
            descripcion = f"Se ha creado un nuevo caso de visa para {client_data.get('name', 'Cliente')}. Tipo: {case_data.get('visaType', 'N/A') if case_data else 'N/A'}."
            etiquetas = ["caso", "nuevo", case_data.get('visaType', '').replace(' ', '_').lower() if case_data else ""]
        elif action.startswith("pago_etapa_"):
            stage_info = action.replace("pago_etapa_", "")
            amount = extra_data.get('amount', 0) if extra_data else 0
            titulo = f"Pago Registrado - Etapa(s) {stage_info}"
            descripcion = f"Se ha registrado un pago de ${amount} para la(s) etapa(s) {stage_info}. Cliente: {client_data.get('name', 'Cliente')}."
            etiquetas = ["pago", extra_data.get('paymentMethod', 'manual') if extra_data else "manual", f"etapa_{stage_info}"]
        else:
            titulo = f"Notificación: {action}"
            descripcion = f"Acción: {action}. Cliente: {client_data.get('name', 'Cliente')}."
            etiquetas = ["notificacion", action]
        
        # Limpiar etiquetas vacías
        etiquetas = [e for e in etiquetas if e]
        
        payload = {
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "titulo": titulo,
            "descripcion": descripcion,
            "etiquetas": etiquetas,
            "client": client_data,
            "case": case_data or {},
            "extra": extra_data or {},
            "isTestEnvironment": is_test_environment
        }
        
        logger.info(f"📤 Sending webhook notification: {action} (Test: {is_test_environment})")
        logger.debug(f"Webhook payload: {payload}")
        
        webhook_success = False
        webhook_response_text = None
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            webhook_response_text = response.text[:500] if response.text else None
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"✅ Webhook notification sent successfully: {action}")
                webhook_success = True
            else:
                logger.warning(f"⚠️ Webhook returned status {response.status_code}: {response.text[:200]}")
        
        # 📝 Guardar nota en la base de datos
        note_text = ""
        if action == "caso_creado":
            note_text = f"🆕 Caso de visa creado para {client_data.get('name', 'Cliente')}. Tipo: {case_data.get('visaType', 'N/A')}. Notificación enviada a N8N."
        elif action.startswith("pago_etapa_"):
            stage_num = extra_data.get('stageNumber', '?') if extra_data else '?'
            amount = extra_data.get('amount', 0) if extra_data else 0
            note_text = f"💰 Pago registrado - Etapa {stage_num}. Monto: ${amount}. Cliente: {client_data.get('name', 'Cliente')}. Notificación enviada a N8N."
        else:
            note_text = f"📤 Acción: {action}. Cliente: {client_data.get('name', 'Cliente')}. Notificación enviada a N8N."
        
        if is_test_environment:
            note_text += " [ENTORNO DE PRUEBA]"
        
        # Guardar en webhook_notifications collection
        notification_record = {
            "id": str(uuid.uuid4()),
            "action": action,
            "clientId": client_data.get('id'),
            "clientName": client_data.get('name'),
            "clientEmail": client_data.get('email'),
            "caseId": case_data.get('caseId') if case_data else None,
            "payload": payload,
            "webhookSuccess": webhook_success,
            "webhookResponse": webhook_response_text,
            "note": note_text,
            "isTestEnvironment": is_test_environment,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        
        await db.webhook_notifications.insert_one(notification_record)
        logger.info(f"📝 Webhook notification saved to database: {action}")
        
        # También guardar como nota del caso si hay caseId
        if case_data and case_data.get('caseId'):
            case_note = {
                "id": str(uuid.uuid4()),
                "caseId": case_data.get('caseId'),
                "content": note_text,
                "type": "system",
                "category": "webhook_notification",
                "createdBy": {
                    "id": "system",
                    "name": "Sistema",
                    "role": "system"
                },
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "isAutomatic": True,
                "isTestEnvironment": is_test_environment
            }
            await db.case_notes.insert_one(case_note)
            logger.info(f"📝 Case note saved: {action}")
                
    except Exception as e:
        # Don't fail the main operation if webhook fails
        logger.error(f"❌ Error sending webhook notification: {str(e)}")

async def update_case_current_stage(case_id: str):
    """
    Helper function to update the currentStage field in visa_cases
    based on the most recent unlocked/paid stage.
    
    Logic:
    1. Get all stages for the case, sorted by stageNumber
    2. Find the highest stage that is unlocked or paid
    3. Update visa_cases.currentStage to that stage number
    """
    try:
        # Get all stages for this case, sorted by stageNumber
        stages = await db.visa_stages.find(
            {"caseId": case_id}
        ).sort("stageNumber", 1).to_list(100)
        
        if not stages:
            logger.warning(f"No stages found for case {case_id}")
            return
        
        # Find the highest stage number that is unlocked or paid
        current_stage_number = 1  # Default to stage 1
        
        for stage in stages:
            stage_status = stage.get('status', 'locked')
            is_paid = stage.get('isPaid', False)
            stage_number = stage.get('stageNumber', 1)
            
            # If stage is unlocked or paid, update current stage
            if stage_status == 'unlocked' or is_paid:
                current_stage_number = stage_number
            else:
                # Stop at the first locked and unpaid stage
                break
        
        # Update the visa_cases collection with the new currentStage
        result = await db.visa_cases.update_one(
            {"id": case_id},
            {"$set": {
                "currentStage": current_stage_number,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ Updated currentStage for case {case_id} to stage {current_stage_number}")
        else:
            logger.debug(f"No update needed for case {case_id}, already at stage {current_stage_number}")
            
    except Exception as e:
        logger.error(f"Error updating currentStage for case {case_id}: {str(e)}")

# ============= MODELS =============

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class UserSignIn(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    userState: str = "U1"  # U0, U1, U2, U3, U4
    language: str = "en"
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EligibilityAssessment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    procedureType: str
    country: str
    status: str
    education: str
    experience: str
    urgency: str
    scoring: str  # A, B, C
    score: int
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: Optional[str] = None
    origin: str = "web"
    procedureType: str
    scoring: str  # A, B, C
    score: int
    stage: str = "new"  # new, contacted, qualified, converted
    nextAction: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Case(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    type: str
    stage: str = "Document Review"
    assignee: Optional[str] = None
    progress: int = 0
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    caseId: str
    type: str
    filename: str
    status: str = "pending"  # pending, approved, rejected
    uploadedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    caseId: Optional[str] = None
    datetime: str
    type: str
    status: str = "scheduled"  # scheduled, completed, cancelled
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    caseId: str
    amount: float
    dueDate: str
    status: str = "pending"  # pending, paid, overdue
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    content: str
    sender: str  # user, monica
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "URPE Integral Services API", "version": "1.0.0"}

# ====== AUTH ======

@api_router.post("/auth/signup")
async def signup(user_data: UserCreate):
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
        
        # Generate JWT token (same as signin)
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
        
        # Return user data with token
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

@api_router.post("/auth/signin")
async def signin(credentials: UserSignIn):
    try:
        # Find user
        logger.info(f"🔐 Signin attempt for email: {credentials.email}")
        user_doc = await db.users.find_one({"email": credentials.email})
        if not user_doc:
            logger.warning(f"   User not found in MongoDB")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        logger.info(f"   ✅ User found in MongoDB - ID: {user_doc.get('_id')}")
        
        # Verify password
        if not pwd_context.verify(credentials.password, user_doc.get('password', '')):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Generate JWT token
        user_id = str(user_doc.get('_id', user_doc.get('id')))
        payload = {
            'id': user_id,
            'email': user_doc.get('email'),
            'name': user_doc.get('name'),
            'userState': user_doc.get('userState', 'U1'),
            'type': 'user',  # Distinguish from staff
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Return user data with token (without password)
        user_data = {
            'id': user_id,
            'email': user_doc.get('email'),
            'name': user_doc.get('name'),
            'phone': user_doc.get('phone', ''),
            'userState': user_doc.get('userState', 'U1'),
            'language': user_doc.get('language', 'en'),
            'createdAt': user_doc.get('createdAt'),
            'welcome': user_doc.get('welcome', False),
            'report': user_doc.get('report'),  # Include report for profile analysis
            'eligible': user_doc.get('eligible', False),  # Include eligible for client check
            'token': token
        }
        
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signin error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signin failed"
        )

class UpgradeVisitor(BaseModel):
    email: str
    password: str

async def verify_token_header(authorization: str = Header(None)):
    """Verify JWT token from Authorization header"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/auth/upgrade-visitor")
async def upgrade_visitor(data: UpgradeVisitor, user_payload: dict = Depends(verify_token_header)):
    """
    Upgrade a visitor (U1) to registered user (U3) by adding email and password.
    Handles both MongoDB users and Supabase phone-login users.
    """
    try:
        from bson import ObjectId
        user_id = user_payload.get('id') or user_payload.get('_id')
        phone = user_payload.get('phone')
        
        logger.info(f"🔄 Upgrade visitor attempt - user_id: {user_id}, phone: {phone}")
        
        # Try to find user in MongoDB (for users who registered via website)
        user = None
        
        # First, try to find by string ID (UUID format or custom ID)
        if user_id:
            user = await db.users.find_one({'$or': [{'_id': user_id}, {'id': user_id}]})
            if user:
                logger.info(f"✅ Found user by string ID: {user_id}")
        
        # If not found, try ObjectId format
        if not user and user_id and len(str(user_id)) == 24:
            try:
                user = await db.users.find_one({'_id': ObjectId(user_id)})
                if user:
                    logger.info(f"✅ Found user by ObjectId: {user_id}")
            except:
                pass  # Not a valid ObjectId
        
        # Also try to find by phone if we have one
        if not user and phone:
            user = await db.users.find_one({'phone': phone})
            if user:
                logger.info(f"✅ Found user by phone: {phone}")
        
        # Check if email already exists in MongoDB (but not for the same user)
        existing_email = await db.users.find_one({'email': data.email})
        if existing_email:
            # Check if it's the same user
            existing_id = str(existing_email.get('_id') or existing_email.get('id'))
            if existing_id != str(user_id) and (not user or str(user.get('_id') or user.get('id')) != existing_id):
                logger.warning(f"❌ Email {data.email} already exists for another user")
                raise HTTPException(status_code=400, detail="Este email ya está registrado. Por favor usa otro.")
            else:
                logger.info(f"✅ Email belongs to same user, allowing upgrade")
                # Use the existing user if we haven't found one yet
                if not user:
                    user = existing_email
                    user_id = existing_id
        
        # If user not in MongoDB, it's a Supabase phone-login user
        # We need to create a new user in MongoDB
        if not user:
            logger.info(f"✨ Creating new MongoDB user from Supabase phone-login")
            
            # Hash password
            hashed_password = pwd_context.hash(data.password)
            
            # Create new user in MongoDB with U3 state
            new_user = {
                'email': data.email,
                'password': hashed_password,
                'phone': phone or '',
                'name': user_payload.get('name', ''),
                'userState': 'U3',
                'supabase_id': user_id,  # Keep reference to Supabase ID
                'eligible': user_payload.get('eligible', False),
                'report': user_payload.get('report'),
                'welcome': False,  # Show welcome modal on first login
                'createdAt': datetime.utcnow().isoformat(),
                'updatedAt': datetime.utcnow().isoformat()
            }
            
            result = await db.users.insert_one(new_user)
            user_id = str(result.inserted_id)
            logger.info(f"✅ New MongoDB user created with ID: {user_id}")
            
        else:
            # User exists in MongoDB, just update to U3
            current_state = user.get('userState', 'U1')
            logger.info(f"📝 Updating existing MongoDB user from {current_state} to U3")
            
            # Only allow upgrade from U1 or U2 (not from U3 or higher)
            if current_state == 'U3':
                raise HTTPException(status_code=400, detail="El usuario ya está registrado")
            
            # Hash password
            hashed_password = pwd_context.hash(data.password)
            
            # Get the correct user ID for the update query
            user_db_id = user.get('_id') or user.get('id')
            user_id = str(user_db_id)  # Update user_id for later use in token
            
            # Update user to U3 - use the actual _id from the user document
            await db.users.update_one(
                {'_id': user_db_id},
                {
                    '$set': {
                        'email': data.email,
                        'password': hashed_password,
                        'userState': 'U3',
                        'updatedAt': datetime.utcnow().isoformat()
                    }
                }
            )
            logger.info(f"✅ User {user_id} upgraded to U3")
        
        # Get the final user name (from user object or payload)
        user_name = user.get('name') if user else user_payload.get('name', '')
        
        # Generate new token with updated userState
        payload = {
            'id': user_id,
            'email': data.email,
            'name': user_name,
            'phone': phone or '',
            'userState': 'U3',
            'type': 'user',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        logger.info(f"✅ New JWT token generated for user {user_id} as U3")
        logger.info(f"✅ User upgraded: {user_id}, state: U3")
        
        # ⭐ AUTO-CREATE EB-2 NIW CASE FOR NEW U3 USER
        try:
            # First check if user already has a case
            existing_case = await db.visa_cases.find_one({"userId": user_id})
            
            if existing_case:
                logger.info(f"ℹ️ User {user_id} already has a case ({existing_case.get('caseId') or existing_case.get('_id')}), skipping case creation")
            else:
                logger.info(f"🔧 Creating automatic EB-2 NIW case for user: {user_id}")
                
                # Get EB-2 NIW template
                # Use master case from MongoDB instead of hardcoded templates
                MASTER_CASE_ID = "master_case_eb2_niw"
                master_case = await db.visa_cases.find_one({"caseId": MASTER_CASE_ID, "isMasterCase": True})
                
                if master_case:
                    # Create visa case
                    visa_case = VisaCase(
                        userId=user_id,
                        visaType=master_case.get("visaType", "EB-2 NIW"),
                        coordinatorId="auto",  # Auto-assigned coordinator
                        status=CaseStatus.PROCESO_VENTA,
                        currentStage=1,
                        overallProgress=0,
                        eligibilityDate=datetime.now(timezone.utc),
                        notes="Caso creado automáticamente al registrarse desde master case"
                    )
                    
                    case_dict = visa_case.model_dump()
                    case_dict['_id'] = case_dict['id']
                    case_dict['caseId'] = case_dict['id']
                    case_dict['createdAt'] = case_dict['createdAt'].isoformat()
                    case_dict['updatedAt'] = case_dict['updatedAt'].isoformat()
                    if case_dict.get('eligibilityDate'):
                        case_dict['eligibilityDate'] = case_dict['eligibilityDate'].isoformat()
                    
                    await db.visa_cases.insert_one(case_dict)
                    logger.info(f"✅ Case created from master: {visa_case.id}")
                    
                    # Copy stages from master case
                    master_stages_cursor = db.visa_stages.find({'caseId': MASTER_CASE_ID}).sort('stageNumber', 1)
                    master_stages = await master_stages_cursor.to_list(length=None)
                    
                    logger.info(f"📋 Copying {len(master_stages)} stages from master case...")
                    
                    stages = []
                    for master_stage in master_stages:
                        stage_id = str(uuid.uuid4())
                        stage = {
                            "_id": stage_id,
                            "id": stage_id,
                            "caseId": visa_case.id,
                            "stageNumber": master_stage["stageNumber"],
                            "name": master_stage["name"],
                            "description": master_stage.get("description", ""),
                            "percentage": master_stage.get("percentage", 0),
                            "amount": master_stage.get("amount", 0),
                            "status": master_stage.get("status", "locked"),
                            "isPaid": False,
                            "completedDeliverablesCount": 0,
                            "totalDeliverablesCount": master_stage.get("totalDeliverablesCount", 0),
                            "startDate": None,
                            "completionDate": None,
                            "createdAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        stages.append(stage)
                    
                    if stages:
                        await db.visa_stages.insert_many(stages)
                        logger.info(f"✅ Created {len(stages)} stages")
                    
                    # Copy deliverables from master case
                    master_deliverables_cursor = db.visa_deliverables.find({'caseId': MASTER_CASE_ID})
                    master_deliverables = await master_deliverables_cursor.to_list(length=None)
                    
                    logger.info(f"📦 Copying {len(master_deliverables)} deliverables from master case...")
                    
                    all_deliverables = []
                    stage_id_map = {s["stageNumber"]: s["_id"] for s in stages}
                    
                    for master_deliv in master_deliverables:
                        deliverable_id = str(uuid.uuid4())
                        new_stage_id = stage_id_map.get(master_deliv["stageNumber"])
                        
                        deliverable = {
                            "_id": deliverable_id,
                            "id": deliverable_id,
                            "caseId": visa_case.id,
                            "stageId": new_stage_id,
                            "stageNumber": master_deliv["stageNumber"],
                            "deliverableName": master_deliv.get("deliverableName", ""),
                            "name": master_deliv.get("name", {}),
                            "description": master_deliv.get("description", ""),
                            "status": "draft",
                            "fileUrl": None,
                            "fileName": None,
                            "createdAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        all_deliverables.append(deliverable)
                    
                    if all_deliverables:
                        await db.visa_deliverables.insert_many(all_deliverables)
                        logger.info(f"✅ Created {len(all_deliverables)} deliverables")
                    
                    # Copy required documents from master case
                    master_documents_cursor = db.visa_client_documents.find({'caseId': MASTER_CASE_ID})
                    master_documents = await master_documents_cursor.to_list(length=None)
                    
                    logger.info(f"📄 Copying {len(master_documents)} required documents from master case...")
                    
                    all_documents = []
                    for master_doc in master_documents:
                        document_id = str(uuid.uuid4())
                        document = {
                            "_id": document_id,
                            "id": document_id,
                            "caseId": visa_case.id,
                            "stageNumber": master_doc["stageNumber"],
                            "documentName": master_doc.get("documentName", ""),
                            "name": master_doc.get("name", {}),
                            "description": master_doc.get("description", ""),
                            "status": "pending",
                            "required": master_doc.get("required", False),
                            "requiresPhysicalCopy": master_doc.get("requiresPhysicalCopy", False),
                            "fileUrl": None,
                            "fileName": None,
                            "createdAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        all_documents.append(document)
                    
                    if all_documents:
                        await db.visa_client_documents.insert_many(all_documents)
                        logger.info(f"✅ Created {len(all_documents)} documents")
                    
                    logger.info(f"🎉 Complete EB-2 NIW case created from master template for user {user_id}")
                    
                    # 📤 Notify webhook about new case creation
                    await notify_case_webhook(
                        action="caso_creado",
                        client_data={
                            "id": user_id,
                            "name": user_name,
                            "email": data.email,
                            "phone": phone or ''
                        },
                        case_data={
                            "caseId": visa_case.id,
                            "visaType": visa_case.visaType,
                            "status": visa_case.status.value if hasattr(visa_case.status, 'value') else str(visa_case.status),
                            "currentStage": visa_case.currentStage
                        },
                        extra_data={
                            "source": "auto_registration",
                            "stagesCount": len(stages),
                            "deliverablesCount": len(all_deliverables),
                            "documentsCount": len(all_documents)
                        }
                    )
                else:
                    logger.warning("⚠️ Master case template not found in database, skipping case creation")
                
        except Exception as e:
            logger.error(f"❌ Error creating automatic case: {e}")
            # Don't fail the upgrade if case creation fails
            pass
        
        return {
            'success': True,
            'message': 'User upgraded successfully',
            'token': token,
            'user': {
                'id': user_id,
                'email': data.email,
                'name': user_name,
                'phone': phone or '',
                'userState': 'U3'
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upgrade visitor error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upgrade failed"
        )

class PhoneSignIn(BaseModel):
    phone: str

class MagicLinkGenerate(BaseModel):
    phone: str

class MagicLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    magicToken: str
    userId: Optional[str] = None  # ID del usuario en MongoDB o Supabase
    userState: str = "U1"  # U1 o U3
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.post("/auth/signin-phone")
async def signin_phone(credentials: PhoneSignIn):
    """
    Authenticate user by phone number.
    Priority: 
    1. First checks MongoDB for registered user (U3) with this phone
    2. If not found, verifies user in Supabase (U1 visitor)
    Returns user data with JWT token for authenticated sessions.
    """
    try:
        from supabase_client import verify_user_access
        from bson import ObjectId
        
        logger.info(f"📱 Phone login attempt: {credentials.phone}")
        
        # PRIORITY 1: Check if user already exists in MongoDB (registered user)
        mongo_user = await db.users.find_one({'phone': credentials.phone})
        
        if mongo_user:
            logger.info(f"✅ Found registered user in MongoDB: {mongo_user.get('email')} (State: {mongo_user.get('userState')})")
            
            # User already registered in MongoDB - return their complete profile
            user_id = str(mongo_user['_id'])
            
            # Generate JWT token with MongoDB data
            payload = {
                'id': user_id,
                'phone': credentials.phone,
                'name': mongo_user.get('name', ''),
                'email': mongo_user.get('email', ''),
                'userState': mongo_user.get('userState', 'U3'),
                'type': 'user',
                'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
                'iat': datetime.utcnow()
            }
            token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            logger.info(f"✅ JWT token generated for MongoDB user: {user_id}")
            
            return {
                "success": True,
                "user": {
                    'id': user_id,
                    'name': mongo_user.get('name', ''),
                    'email': mongo_user.get('email', ''),
                    'phone': credentials.phone,
                    'userState': mongo_user.get('userState', 'U3'),
                    'eligible': mongo_user.get('eligible', False),
                    'report': mongo_user.get('report'),
                    'welcome': mongo_user.get('welcome', False),
                    'token': token
                },
                "message": "Login exitoso"
            }
        
        # PRIORITY 2: User not in MongoDB, check Supabase (first-time visitor)
        logger.info(f"🔍 User not in MongoDB, checking Supabase...")
        user_data = await verify_user_access(credentials.phone)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Acceso no autorizado. El número de teléfono no está registrado o no pertenece a la empresa autorizada."
            )
        
        logger.info(f"✅ Phone login successful from Supabase: {user_data.get('name')} (State: U1 - Visitor)")
        
        # Create or update user in MongoDB for persistence
        user_doc = {
            'name': user_data.get('name'),
            'phone': credentials.phone,
            'email': user_data.get('email', ''),
            'userState': user_data.get('userState', 'U1'),
            'language': user_data.get('language', 'es'),
            'supabaseId': user_data.get('supabaseId'),
            'empresaId': user_data.get('empresaId'),
            'advisor': user_data.get('advisor'),
            'updatedAt': datetime.utcnow().isoformat(),
        }
        
        # Check if user already exists by phone
        existing_user = await db.users.find_one({'phone': credentials.phone})
        
        if existing_user:
            # Update existing user
            await db.users.update_one(
                {'_id': existing_user['_id']},
                {'$set': user_doc}
            )
            mongo_user_id = str(existing_user['_id'])
            welcome_flag = existing_user.get('welcome', False)
            logger.info(f"✅ User updated in MongoDB with ID: {mongo_user_id}")
        else:
            # Create new user
            user_doc['welcome'] = False  # Show welcome modal on first login
            user_doc['createdAt'] = datetime.utcnow().isoformat()
            result = await db.users.insert_one(user_doc)
            mongo_user_id = str(result.inserted_id)
            welcome_flag = False
            logger.info(f"✅ User created in MongoDB with ID: {mongo_user_id}")
        
        # Generate JWT token with MongoDB user ID
        payload = {
            'id': mongo_user_id,
            'phone': credentials.phone,
            'name': user_data.get('name'),
            'email': user_data.get('email', ''),
            'userState': user_data.get('userState', 'U1'),
            'type': 'user',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        logger.info(f"✅ JWT token generated for new MongoDB user: {mongo_user_id}")
        
        # Return user data with token
        return {
            "success": True,
            "user": {
                'id': mongo_user_id,
                'name': user_data.get('name'),
                'phone': credentials.phone,
                'email': user_data.get('email', ''),
                'userState': user_data.get('userState', 'U1'),
                'language': user_data.get('language', 'es'),
                'advisor': user_data.get('advisor'),
                'welcome': welcome_flag,  # Show welcome modal based on MongoDB flag
                'token': token
            },
            "message": "Login exitoso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Phone signin error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error en el login. Por favor intente nuevamente."
        )


# ============= EXTERNAL LOGIN ENDPOINT =============
class ExternalLoginRequest(BaseModel):
    email: str
    password: str

class ExternalLoginResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    token: Optional[str] = None
    message: Optional[str] = None

@api_router.post("/external/login", response_model=ExternalLoginResponse)
async def external_login(credentials: ExternalLoginRequest):
    """
    External login endpoint for ADMIN/STAFF authentication from third-party platforms.
    Returns admin data with role, permissions, and JWT token.
    
    Usage from external platform:
    POST /api/external/login
    Body: { "email": "admin@example.com", "password": "adminpassword" }
    
    Returns: Admin/Staff data with token for subsequent API calls
    """
    try:
        logger.info(f"🔐 External admin login attempt for: {credentials.email}")
        
        # Find staff by email in staff collection
        staff_doc = await db.staff.find_one({"email": credentials.email.lower()})
        
        if not staff_doc:
            logger.warning(f"External login failed - staff not found: {credentials.email}")
            return ExternalLoginResponse(
                success=False,
                message="Usuario administrador no encontrado"
            )
        
        # Check if staff is active
        is_active = staff_doc.get('active', True) or staff_doc.get('status') == 'active'
        if not is_active:
            logger.warning(f"External login failed - staff inactive: {credentials.email}")
            return ExternalLoginResponse(
                success=False,
                message="Cuenta desactivada"
            )
        
        # Verify password
        stored_password = staff_doc.get('password', '')
        if not stored_password or not pwd_context.verify(credentials.password, stored_password):
            logger.warning(f"External login failed - invalid password: {credentials.email}")
            return ExternalLoginResponse(
                success=False,
                message="Contraseña incorrecta"
            )
        
        staff_id = str(staff_doc['_id'])
        role = staff_doc.get('role', 'coordinator')
        logger.info(f"✅ External admin login successful for staff: {staff_id} (role: {role})")
        
        # Generate JWT token with longer expiration for external use
        token_payload = {
            'id': staff_id,
            'email': staff_doc['email'],
            'name': staff_doc.get('name', ''),
            'role': role,
            'type': 'staff',
            'external': True,
            'exp': datetime.utcnow() + timedelta(days=30),  # 30 days for external
            'iat': datetime.utcnow()
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Get staff permissions based on role
        permissions = ROLE_PERMISSIONS.get(role, [])
        
        # Get assigned cases count if coordinator
        assigned_cases_count = 0
        if role == 'coordinator':
            assigned_cases_count = await db.visa_cases.count_documents({'coordinatorId': staff_id})
        
        # Build admin response
        admin_data = {
            'id': staff_id,
            'email': staff_doc.get('email', ''),
            'name': staff_doc.get('name', ''),
            'role': role,
            'permissions': permissions,
            'active': is_active,
            'createdAt': staff_doc.get('createdAt'),
            'updatedAt': staff_doc.get('updatedAt'),
            'assignedCasesCount': assigned_cases_count,
            'lastLogin': datetime.utcnow().isoformat()
        }
        
        # Update last login timestamp
        await db.staff.update_one(
            {'_id': staff_doc['_id']},
            {'$set': {'lastLogin': datetime.utcnow().isoformat()}}
        )
        
        return ExternalLoginResponse(
            success=True,
            user=admin_data,
            token=token,
            message="Login de administrador exitoso"
        )
        
    except Exception as e:
        logger.error(f"External admin login error: {e}")
        return ExternalLoginResponse(
            success=False,
            message=f"Error en el login: {str(e)}"
        )


@api_router.get("/external/user/{user_id}")
async def get_external_user(
    user_id: str,
    authorization: str = Header(None)
):
    """
    Get user data by ID for external platforms.
    Requires valid JWT token from external login.
    """
    try:
        # Verify token
        if not authorization:
            raise HTTPException(status_code=401, detail="Token requerido")
        
        token = authorization.replace('Bearer ', '').strip()
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expirado")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        # Find user
        user_doc = await db.users.find_one({"_id": user_id})
        if not user_doc:
            # Try with ObjectId
            try:
                from bson import ObjectId
                user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
            except:
                pass
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Get case info
        case_data = None
        case = await db.visa_cases.find_one({'userId': user_id})
        if case:
            case_data = {
                'id': str(case.get('_id') or case.get('id')),
                'procedureType': case.get('procedureType'),
                'status': case.get('status'),
                'currentStage': case.get('currentStage')
            }
        
        return {
            'success': True,
            'user': {
                'id': str(user_doc['_id']),
                'email': user_doc.get('email', ''),
                'name': user_doc.get('name', ''),
                'phone': user_doc.get('phone', ''),
                'userState': user_doc.get('userState'),
                'eligible': user_doc.get('eligible', False),
                'report': user_doc.get('report'),
                'case': case_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get external user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/faces/{filename}")
async def get_face_image(filename: str):
    """Serve generated face images for success stories"""
    faces_dir = Path(__file__).parent / "uploads" / "faces"
    file_path = faces_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path=str(file_path), media_type="image/png")

@api_router.get("/static/manual-diy-completo.pdf")
async def get_manual_diy_pdf():
    """
    Serves the Manual DIY Completo PDF file
    """
    try:
        pdf_path = Path(__file__).parent / "static" / "manual-diy-completo.pdf"
        
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail="Manual DIY PDF not found")
        
        return FileResponse(
            path=str(pdf_path),
            media_type="application/pdf",
            filename="Manual-DIY-Completo-EB2-NIW.pdf"
        )
    except Exception as e:
        logger.error(f"Error serving Manual DIY PDF: {e}")
        raise HTTPException(status_code=500, detail="Error serving PDF file")


@api_router.post("/auth/generate-magic-link")
async def generate_magic_link(
    data: MagicLinkGenerate,
    authorization: Annotated[str, Header()]
):
    """
    Generates a magic link for a user based on their phone number.
    REQUIRES STATIC ADMIN TOKEN (URPE_ADMIN_TOKEN).
    The link never expires and can be used multiple times.
    Priority:
    1. First checks MongoDB for registered user (U3)
    2. If not found, checks Supabase for visitor (U1)
    Returns magic link URL.
    """
    # Verify static admin token
    URPE_ADMIN_TOKEN = os.getenv('URPE_ADMIN_TOKEN')
    
    if not URPE_ADMIN_TOKEN:
        logger.error("URPE_ADMIN_TOKEN not configured in environment")
        raise HTTPException(
            status_code=500, 
            detail="Server configuration error: Admin token not configured"
        )
    
    # Extract token from Authorization header
    token = authorization.replace('Bearer ', '').strip()
    
    # Validate static token
    if token != URPE_ADMIN_TOKEN:
        logger.warning(f"Invalid admin token attempt for magic link generation")
        raise HTTPException(
            status_code=401, 
            detail="Token de autorización inválido"
        )
    try:
        from supabase_client import verify_user_access
        
        logger.info(f"🔗 Magic link generation request for: {data.phone}")
        
        # PRIORITY 1: Check MongoDB for registered user
        mongo_user = await db.users.find_one({'phone': data.phone})
        
        user_id = None
        user_state = "U1"
        
        if mongo_user:
            user_id = str(mongo_user['_id'])
            user_state = mongo_user.get('userState', 'U3')
            logger.info(f"✅ Found user in MongoDB: {user_id} (State: {user_state})")
        else:
            # PRIORITY 2: Check Supabase
            logger.info(f"🔍 User not in MongoDB, checking Supabase...")
            user_data = await verify_user_access(data.phone)
            
            if not user_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Usuario con teléfono {data.phone} no encontrado en el sistema"
                )
            
            user_id = user_data.get('id')
            user_state = user_data.get('userState', 'U1')
            logger.info(f"✅ Found user in Supabase: {user_id} (State: {user_state})")
        
        # Generate unique magic token (never expires)
        # Using 16 bytes = ~22 characters (shorter but still very secure)
        magic_token = secrets.token_urlsafe(16)
        
        # Check if user already has a magic link in MongoDB
        existing_link = await db.magic_links.find_one({'phone': data.phone})
        
        if existing_link:
            # Update existing magic link with new token
            await db.magic_links.update_one(
                {'phone': data.phone},
                {
                    '$set': {
                        'magicToken': magic_token,
                        'userId': user_id,
                        'userState': user_state,
                        'createdAt': datetime.now(timezone.utc)
                    }
                }
            )
            logger.info(f"🔄 Updated existing magic link for: {data.phone}")
        else:
            # Create new magic link
            magic_link_doc = MagicLink(
                phone=data.phone,
                magicToken=magic_token,
                userId=user_id,
                userState=user_state
            )
            
            await db.magic_links.insert_one(magic_link_doc.model_dump())
            logger.info(f"✅ Created new magic link for: {data.phone}")
        
        # Get frontend URL from environment
        # Priority: FRONTEND_URL > REACT_APP_BACKEND_URL (with /api removed)
        frontend_url = os.getenv('FRONTEND_URL')
        
        if not frontend_url:
            # Fallback: derive from backend URL
            backend_url = os.getenv('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')
            frontend_url = backend_url.replace('/api', '')
        
        magic_link_url = f"{frontend_url}/welcome/{magic_token}"
        
        logger.info(f"🎉 Magic link generated: {magic_link_url}")
        
        return {
            "success": True,
            "magic_link": magic_link_url,
            "token": magic_token,
            "phone": data.phone,
            "userState": user_state
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Magic link generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando magic link: {str(e)}"
        )

@api_router.get("/auth/validate-magic-link/{token}")
async def validate_magic_link(token: str):
    """
    Validates a magic link token and returns JWT token + user data.
    Works the same way as signin-phone endpoint.
    """
    try:
        from supabase_client import verify_user_access
        
        logger.info(f"🔐 Magic link validation attempt: {token[:10]}...")
        
        # Find magic link in MongoDB
        magic_link = await db.magic_links.find_one({'magicToken': token})
        
        if not magic_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Link inválido o no encontrado"
            )
        
        phone = magic_link['phone']
        logger.info(f"✅ Found magic link for phone: {phone}")
        
        # PRIORITY 1: Check MongoDB for registered user (same as signin-phone)
        mongo_user = await db.users.find_one({'phone': phone})
        
        if mongo_user:
            logger.info(f"✅ Found registered user in MongoDB: {mongo_user.get('email')} (State: {mongo_user.get('userState')})")
            
            user_id = str(mongo_user['_id'])
            
            # Generate JWT token with MongoDB data
            payload = {
                'id': user_id,
                'phone': phone,
                'name': mongo_user.get('name', ''),
                'email': mongo_user.get('email', ''),
                'userState': mongo_user.get('userState', 'U3'),
                'type': 'user',
                'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
                'iat': datetime.utcnow()
            }
            token_jwt = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            logger.info(f"✅ JWT token generated for MongoDB user via magic link: {user_id}")
            
            return {
                "success": True,
                "user": {
                    'id': user_id,
                    'name': mongo_user.get('name', ''),
                    'email': mongo_user.get('email', ''),
                    'phone': phone,
                    'userState': mongo_user.get('userState', 'U3'),
                    'eligible': mongo_user.get('eligible', False),
                    'report': mongo_user.get('report'),
                    'welcome': mongo_user.get('welcome', False),
                    'token': token_jwt
                },
                "message": "Login exitoso via magic link"
            }
        
        # PRIORITY 2: Check Supabase (visitor)
        logger.info(f"🔍 User not in MongoDB, checking Supabase...")
        user_data = await verify_user_access(phone)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado en el sistema"
            )
        
        logger.info(f"✅ Found user in Supabase via magic link: {user_data.get('name')} (State: U1)")
        
        # Generate JWT token for Supabase visitor
        user_id = user_data.get('id')
        payload = {
            'id': user_id,
            'phone': phone,
            'name': user_data.get('name'),
            'email': user_data.get('email', ''),
            'userState': user_data.get('userState', 'U1'),
            'type': 'user',
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        token_jwt = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        logger.info(f"✅ JWT token generated for Supabase visitor via magic link: {user_id}")
        
        # Return Supabase user data with token
        # Add welcome flag for first-time modal display
        return {
            "success": True,
            "user": {
                **user_data,
                'token': token_jwt,
                'welcome': user_data.get('welcome', False)  # Show welcome modal for new visitors
            },
            "message": "Login exitoso via magic link"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Magic link validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validando magic link: {str(e)}"
        )


@api_router.post("/log-error")
async def log_frontend_error(request: dict):
    """
    Endpoint para recibir logs de errores del frontend
    """
    try:
        logger.error(f"🚨 FRONTEND ERROR: {request.get('error', 'Unknown')}")
        logger.error(f"   User Agent: {request.get('userAgent', 'Unknown')}")
        logger.error(f"   Timestamp: {request.get('timestamp', 'Unknown')}")
        logger.error(f"   Stack: {request.get('errorInfo', 'No stack')}")
        
        return {"success": True, "message": "Error logged"}
    except Exception as e:
        logger.error(f"Error logging frontend error: {e}")
        return {"success": False, "message": str(e)}


@api_router.get("/admin/users/{user_phone}/magic-links")
async def get_user_magic_links(
    user_phone: str,
    authorization: Annotated[str, Header()]
):
    """
    Get all magic links generated for a specific user by phone number.
    Returns a list of magic links with their creation dates and expiration status.
    Requires admin authentication.
    """
    try:
        # Verify admin token
        token = authorization.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check if user has admin role
        user_type = payload.get('type')
        user_role = payload.get('role')
        
        # Allow: type='admin', or type='staff' with role='admin', 'super_admin', 'coordinator', 'advisor', or 'acreditador'
        is_allowed = (
            user_type == 'admin' or 
            (user_type == 'staff' and user_role in ['admin', 'super_admin', 'coordinator', 'advisor', 'acreditador'])
        )
        
        if not is_allowed:
            raise HTTPException(status_code=403, detail="Se requiere acceso de administrador, coordinador o vendedor")
        
        # Get all magic links for this phone number
        magic_links_cursor = db.magic_links.find(
            {'phone': user_phone},
            {'_id': 0}
        ).sort('createdAt', -1)  # Most recent first
        
        magic_links = await magic_links_cursor.to_list(length=None)
        
        # Get frontend URL for constructing full magic link URLs
        frontend_url = os.getenv('FRONTEND_URL')
        if not frontend_url:
            backend_url = os.getenv('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')
            frontend_url = backend_url.replace('/api', '')
        
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
        
        logger.info(f"📋 Retrieved {len(formatted_links)} magic links for phone: {user_phone}")
        
        return {
            'success': True,
            'magicLinks': formatted_links,
            'total': len(formatted_links)
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    except Exception as e:
        logger.error(f"❌ Error getting magic links: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo magic links: {str(e)}"
        )


@api_router.post("/admin/users/{user_phone}/generate-magic-link")
async def admin_generate_magic_link(
    user_phone: str,
    authorization: Annotated[str, Header()]
):
    """
    Admin endpoint to generate a new magic link for a user.
    Creates a new token and stores it in the magic_links collection.
    """
    try:
        # Verify admin token
        if not authorization or authorization.strip() == '':
            raise HTTPException(status_code=401, detail="Token de autorización no proporcionado")
            
        token = authorization.replace('Bearer ', '').strip()
        
        if not token:
            raise HTTPException(status_code=401, detail="Token de autorización vacío")
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expirado")
        except jwt.DecodeError:
            raise HTTPException(status_code=401, detail="Token mal formado")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        # Check if user has admin role
        user_type = payload.get('type')
        user_role = payload.get('role')
        
        # Allow: type='admin', or type='staff' with role='admin', 'super_admin', 'coordinator', 'advisor', or 'acreditador'
        is_allowed = (
            user_type == 'admin' or 
            (user_type == 'staff' and user_role in ['admin', 'super_admin', 'coordinator', 'advisor', 'acreditador'])
        )
        
        if not is_allowed:
            raise HTTPException(status_code=403, detail="Se requiere acceso de administrador, coordinador o vendedor")
        
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
        from uuid import uuid4
        magic_link_doc = {
            'id': str(uuid4()),
            'phone': user_phone,
            'magicToken': magic_token,
            'userId': user.get('id'),
            'userState': user.get('userState', 'U3'),
            'createdAt': datetime.now(timezone.utc)
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

@api_router.post("/auth/mark-welcome-seen")
async def mark_welcome_seen(authorization: Annotated[str, Header()]):
    """
    Mark that the user has seen the welcome modal.
    Updates the 'welcome' field to True in both MongoDB and Supabase.
    """
    try:
        # Verify JWT token
        token = authorization.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('id')
        phone = payload.get('phone')
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        logger.info(f"🎬 Marking welcome as seen for user: {user_id}")
        
        # Update user in MongoDB
        result = await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'welcome': True, 'updatedAt': datetime.utcnow().isoformat()}}
        )
        
        if result.modified_count == 0:
            logger.warning(f"⚠️ User {user_id} not found in MongoDB or welcome already marked")
        else:
            logger.info(f"✅ Welcome marked as seen for user: {user_id}")
        
        return {
            "success": True,
            "message": "Welcome modal marked as seen"
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    except Exception as e:
        logger.error(f"❌ Error marking welcome as seen: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error actualizando estado de bienvenida: {str(e)}"
        )

# ====== ELIGIBILITY ======

class PhoneCheck(BaseModel):
    phone: str
    language: Optional[str] = "en"

@api_router.post("/eligibility/check-phone")
async def check_phone_eligibility(phone_check: PhoneCheck):
    """
    Check if phone exists in Supabase wp_contactos table with empresa_id = 4.
    If found, return user data for eligibility report.
    """
    try:
        from supabase_client import verify_user_access
        from mock_data import get_user_by_phone
        
        # First, try to verify user in Supabase
        user_data = await verify_user_access(phone_check.phone)
        
        if user_data:
            # User exists in Supabase with empresa_id = 4
            # Now get their eligibility report from mock data based on their Supabase ID
            # Try to match by phone number to get mock report data
            
            # Normalize phone for mock data lookup
            normalized_phone = phone_check.phone.replace(" ", "").replace("(", "").replace(")", "").replace("-", "")
            if not normalized_phone.startswith("+"):
                normalized_phone = "+1" + normalized_phone
            
            # Try to get report from n8n webhook first
            report_data = None
            try:
                import requests
                import json as json_lib
                n8n_webhook_url = "https://n8n.urpeailab.com/webhook/7e98df41-11f8-45c1-b4c0-df27aab3c1ef"
                
                logger.info(f"Fetching report from n8n webhook for phone: {user_data.get('phone')}")
                
                webhook_response = requests.post(
                    n8n_webhook_url,
                    json={"telefono": user_data.get('phone')},
                    timeout=10  # Reduced timeout to prevent 502 errors
                )
                
                if webhook_response.status_code == 200:
                    webhook_data = webhook_response.json()
                    
                    # The webhook can return different formats:
                    # 1. Direct array with report data: [{nombreCompleto, proyectoTitulo, ...}]
                    if isinstance(webhook_data, list) and len(webhook_data) > 0:
                        first_item = webhook_data[0]
                        # Check if it has 'data' field (old format)
                        if 'data' in first_item and isinstance(first_item['data'], str):
                            try:
                                report_data = json_lib.loads(first_item['data'])
                                logger.info(f"Report parsed from n8n webhook (array with JSON string)")
                            except json_lib.JSONDecodeError as e:
                                logger.error(f"Failed to parse JSON from array data field: {e}")
                                report_data = None
                        # Direct data in array (new format)
                        elif 'nombreCompleto' in first_item or 'proyectoTitulo' in first_item:
                            report_data = first_item
                            logger.info(f"Report fetched from n8n webhook (direct array format)")
                        else:
                            report_data = first_item
                            logger.info(f"Report fetched from n8n webhook (array format)")
                    # 2. Direct object: {id, created_at, telefono, data: "JSON string"}
                    elif 'data' in webhook_data and isinstance(webhook_data['data'], str):
                        try:
                            report_data = json_lib.loads(webhook_data['data'])
                            logger.info(f"Report parsed from n8n webhook (object with JSON string)")
                        except json_lib.JSONDecodeError as e:
                            logger.error(f"Failed to parse JSON from data field: {e}")
                            report_data = None
                    # 3. Direct object format (already parsed)
                    else:
                        report_data = webhook_data
                        logger.info(f"Report fetched from n8n webhook (direct object format)")
                else:
                    logger.warning(f"n8n webhook returned status {webhook_response.status_code}")
                    
            except Exception as e:
                logger.error(f"Error fetching report from n8n webhook: {e}")
            
            # If n8n webhook didn't work, use fallback data
            if not report_data:
                logger.info(f"n8n webhook failed or timed out, using fallback data")
                mock_user = get_user_by_phone(normalized_phone, phone_check.language)
                
                if mock_user:
                    # Merge Supabase user data with mock report data
                    user_data['report'] = mock_user.get('report')
                    user_data['userState'] = mock_user.get('userState', user_data.get('userState'))
                    # Only use mock advisor if Supabase user doesn't have one
                    if not user_data.get('advisor'):
                        user_data['advisor'] = mock_user.get('advisor')
                    logger.info(f"Using mock data for user")
                else:
                    # Create a default eligibility report
                    user_data['report'] = {
                        'nombreCompleto': user_data.get('name', 'Usuario'),
                        'proyectoTitulo': 'Proyecto Profesional',
                        'scoringProyecto': 60,
                        'scoringURPE': 35,
                        'scoringFinal': 95,
                        'message': 'Tu perfil ha sido evaluado exitosamente. ¡Tienes excelentes posibilidades!'
                    }
                    user_data['userState'] = 'U1'  # Visitor with eligibility
                    logger.info(f"Using default report for Supabase user")
            else:
                # Use report data from n8n webhook
                user_data['report'] = report_data
                logger.info(f"Using report data from n8n webhook")
                
            logger.info(f"Eligibility check successful for: {user_data.get('name')} (Phone: {phone_check.phone})")
            
            return {
                "exists": True,
                "user": user_data
            }
        else:
            # User not found in Supabase or not from empresa_id = 4
            logger.info(f"Phone not found or not authorized: {phone_check.phone}")
            return {
                "exists": False,
                "message": "El número de teléfono no está registrado en nuestra base de datos o no pertenece a la empresa autorizada."
            }
            
    except Exception as e:
        logger.error(f"Phone check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al verificar el teléfono. Por favor intente nuevamente."
        )

@api_router.post("/eligibility/assess")
async def assess_eligibility(assessment: EligibilityAssessment):
    try:
        assessment_dict = assessment.model_dump()
        assessment_dict['createdAt'] = assessment_dict['createdAt'].isoformat()
        
        await db.eligibility_assessments.insert_one(assessment_dict)
        
        # Create lead
        lead = Lead(
            procedureType=assessment.procedureType,
            scoring=assessment.scoring,
            score=assessment.score,
            stage="new",
            nextAction="Contact for consultation" if assessment.scoring in ['A', 'B'] else "Review alternatives"
        )
        
        lead_dict = lead.model_dump()
        lead_dict['createdAt'] = lead_dict['createdAt'].isoformat()
        
        await db.leads.insert_one(lead_dict)
        
        return {"success": True, "leadId": lead.id, "scoring": assessment.scoring}
    except Exception as e:
        logger.error(f"Eligibility assessment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Assessment failed"
        )

# Create Eligibility Report by calling N8N webhook
class CreateEligibilityReportRequest(BaseModel):
    userId: str
    cvUrl: str
    userName: str
    userEmail: str
    userPhone: str
    userState: Optional[str] = "U1"
    caseId: str
    visaType: str

@api_router.get("/eligibility/report/{phone}")
async def get_eligibility_report_status(
    phone: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Check if a user has an eligibility report by calling N8N webhook
    """
    try:
        import httpx
        
        # Call N8N webhook to check if report exists
        n8n_url = f"https://n8n.urpeailab.com/webhook/8d4b04f2-fb83-4008-bf1a-f4944446963a?phone={phone}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(n8n_url)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"N8N eligibility report response for {phone}: {data}")
                
                # Parse N8N response - adjust based on actual response format
                has_report = data.get("has_report", False) or data.get("exists", False) or bool(data.get("report"))
                report_url = data.get("report_url") or data.get("pdfUrl") or data.get("url")
                
                # If N8N returns the report directly
                if isinstance(data, dict) and not has_report:
                    # Check if the response itself contains report data
                    if data.get("nombreCompleto") or data.get("proyectoTitulo") or data.get("estadoElegibilidad"):
                        has_report = True
                        report_url = data.get("pdfUrl") or data.get("reportUrl")
                
                return {
                    "has_report": has_report,
                    "report_url": report_url,
                    "report_data": data if has_report else None
                }
            else:
                logger.warning(f"N8N returned status {response.status_code} for eligibility check")
                return {
                    "has_report": False,
                    "message": f"Error al consultar N8N: {response.status_code}"
                }
        
    except Exception as e:
        logger.error(f"Error checking eligibility report via N8N: {e}")
        return {
            "has_report": False,
            "error": str(e)
        }

@api_router.get("/ruta-personalizada/report/{phone}")
async def get_ruta_personalizada_status(
    phone: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Check if a user has a ruta personalizada by calling N8N webhook
    """
    try:
        import httpx
        
        # Call N8N webhook to check if ruta personalizada exists
        n8n_url = f"https://n8n.urpeailab.com/webhook/8d4b04f2-fb83-4008-bf1a-f4944446963a7?phone={phone}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(n8n_url)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"N8N ruta personalizada response for {phone}: {data}")
                
                # Parse N8N response
                has_report = data.get("has_report", False) or data.get("exists", False) or bool(data.get("ruta"))
                report_url = data.get("report_url") or data.get("pdfUrl") or data.get("url")
                
                return {
                    "has_report": has_report,
                    "report_url": report_url,
                    "report_data": data if has_report else None
                }
            else:
                logger.warning(f"N8N returned status {response.status_code} for ruta personalizada check")
                return {
                    "has_report": False,
                    "message": f"Error al consultar N8N: {response.status_code}"
                }
        
    except Exception as e:
        logger.error(f"Error checking ruta personalizada via N8N: {e}")
        return {
            "has_report": False,
            "error": str(e)
        }

@api_router.post("/eligibility/create-report")
async def create_eligibility_report(
    request: CreateEligibilityReportRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Create an eligibility report by calling N8N webhook
    This endpoint is called from admin panel after CV upload
    """
    try:
        import httpx
        
        logger.info(f"📋 Creating eligibility report for user: {request.userName} (Phone: {request.userPhone})")
        logger.info(f"📎 CV URL: {request.cvUrl}")
        
        # Prepare webhook data
        webhook_data = {
            "user": {
                "id": request.userId,
                "name": request.userName,
                "email": request.userEmail,
                "phone": request.userPhone,
                "cvUrl": request.cvUrl,
                "userState": request.userState
            },
            "case": {
                "id": request.caseId,
                "caseId": request.caseId,
                "visaType": request.visaType
            },
            "metadata": {
                "source": "urpe_admin_panel",
                "action": "create_eligibility_report",
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
        }
        
        # Call N8N webhook with extended timeout
        webhook_url = "https://n8n.urpeailab.com/webhook/464cb950-d5f8-4216-9d49-186421028558"
        logger.info(f"🚀 Calling N8N webhook: {webhook_url}")
        
        async with httpx.AsyncClient(timeout=120.0) as client:  # 2 minute timeout for processing
            response = await client.post(
                webhook_url,
                json=webhook_data,
                headers={"Content-Type": "application/json"}
            )
            
            logger.info(f"✅ N8N webhook response: {response.status_code}")
            logger.info(f"📄 N8N webhook response body: {response.text[:200]}")  # Log first 200 chars
            
            if response.status_code not in [200, 201, 202]:
                logger.error(f"❌ N8N webhook failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"N8N webhook failed: {response.status_code}"
                )
            
            return {
                "success": True,
                "message": "Eligibility report created successfully",
                "webhookStatus": response.status_code,
                "webhookResponse": response.text[:100] if response.text else None  # Return first 100 chars
            }
            
    except httpx.TimeoutException:
        logger.error("❌ N8N webhook timeout")
        raise HTTPException(
            status_code=504,
            detail="N8N webhook timeout"
        )
    except Exception as e:
        logger.error(f"❌ Error creating eligibility report: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating eligibility report: {str(e)}"
        )

# ====== TEST ELIGIBILITY REPORT ======

class TestEligibilityReportRequest(BaseModel):
    cvUrl: str
    testName: Optional[str] = "Test"
    testEmail: Optional[str] = "test@urpeintegralservices.co"
    notes: Optional[str] = None

@api_router.post("/eligibility/test-report")
async def create_test_eligibility_report(
    request: TestEligibilityReportRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Create a TEST eligibility report by calling N8N webhook
    This endpoint does NOT send phone number and marks the request as test
    """
    try:
        import httpx
        
        # Generate unique test ID
        test_id = f"test_{uuid.uuid4().hex[:8]}"
        
        logger.info(f"🧪 Creating TEST eligibility report: {test_id}")
        logger.info(f"📎 CV URL: {request.cvUrl}")
        logger.info(f"👤 Test Name: {request.testName}")
        
        # Prepare webhook data - NO PHONE NUMBER
        webhook_data = {
            "user": {
                "id": test_id,
                "name": request.testName,
                "email": request.testEmail,
                # NO phone field - explicitly not sending it
                "cvUrl": request.cvUrl,
                "userState": "TEST"
            },
            "case": {
                "id": test_id,
                "caseId": test_id,
                "visaType": "EB-2 NIW"
            },
            "metadata": {
                "source": "urpe_admin_panel",
                "action": "test_eligibility_report",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "notes": request.notes
            },
            "test": True  # FLAG DE PRUEBA
        }
        
        # Save test report record to database BEFORE calling N8N
        test_record = {
            "id": test_id,
            "testName": request.testName,
            "testEmail": request.testEmail,
            "cvUrl": request.cvUrl,
            "notes": request.notes,
            "status": "processing",
            "isTest": True,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "createdBy": {
                "id": staff_payload.get('id'),
                "name": staff_payload.get('name'),
                "email": staff_payload.get('email')
            },
            "webhookResponse": None,
            "reportData": None
        }
        
        await db.test_eligibility_reports.insert_one(test_record)
        logger.info(f"💾 Test record saved to database: {test_id}")
        
        # Call N8N webhook with extended timeout
        webhook_url = "https://n8n.urpeailab.com/webhook/464cb950-d5f8-4216-9d49-186421028558"
        logger.info(f"🚀 Calling N8N webhook (TEST MODE): {webhook_url}")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                webhook_url,
                json=webhook_data,
                headers={"Content-Type": "application/json"}
            )
            
            logger.info(f"✅ N8N webhook response: {response.status_code}")
            
            # Update test record with response
            update_data = {
                "webhookStatus": response.status_code,
                "webhookResponse": response.text[:500] if response.text else None,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            
            if response.status_code in [200, 201, 202]:
                update_data["status"] = "completed"
                try:
                    update_data["reportData"] = response.json()
                except:
                    pass
            else:
                update_data["status"] = "failed"
                update_data["error"] = f"N8N returned {response.status_code}"
            
            await db.test_eligibility_reports.update_one(
                {"id": test_id},
                {"$set": update_data}
            )
            
            if response.status_code not in [200, 201, 202]:
                logger.error(f"❌ N8N webhook failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail=f"N8N webhook failed: {response.status_code}"
                )
            
            return {
                "success": True,
                "testId": test_id,
                "message": "Test eligibility report created successfully",
                "webhookStatus": response.status_code,
                "isTest": True
            }
            
    except httpx.TimeoutException:
        logger.error("❌ N8N webhook timeout (TEST)")
        await db.test_eligibility_reports.update_one(
            {"id": test_id},
            {"$set": {"status": "timeout", "error": "N8N webhook timeout"}}
        )
        raise HTTPException(
            status_code=504,
            detail="N8N webhook timeout"
        )
    except Exception as e:
        logger.error(f"❌ Error creating test eligibility report: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating test eligibility report: {str(e)}"
        )

@api_router.get("/eligibility/test-reports")
async def get_test_eligibility_reports(
    limit: int = 50,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all test eligibility reports"""
    try:
        cursor = db.test_eligibility_reports.find(
            {},
            {"_id": 0}
        ).sort("createdAt", -1).limit(limit)
        
        reports = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "reports": reports,
            "total": len(reports)
        }
    except Exception as e:
        logger.error(f"Error fetching test reports: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch test reports")

@api_router.delete("/eligibility/test-reports/{test_id}")
async def delete_test_eligibility_report(
    test_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a test eligibility report"""
    try:
        result = await db.test_eligibility_reports.delete_one({"id": test_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Test report not found")
        
        return {"success": True, "message": "Test report deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test report: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete test report")

# ====== CASES ======

@api_router.get("/cases/user/{user_id}")
async def get_user_case(user_id: str):
    try:
        case_doc = await db.cases.find_one({"userId": user_id}, {"_id": 0})
        if not case_doc:
            # Return mock data for demo
            return {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "type": "EB-2 NIW",
                "stage": "Document Review",
                "progress": 45,
                "assignee": "Jane Smith"
            }
        
        if isinstance(case_doc.get('createdAt'), str):
            case_doc['createdAt'] = datetime.fromisoformat(case_doc['createdAt'])
        
        return case_doc
    except Exception as e:
        logger.error(f"Get case error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch case"
        )

@api_router.post("/cases", response_model=Case)
async def create_case(case: Case):
    try:
        case_dict = case.model_dump()
        case_dict['createdAt'] = case_dict['createdAt'].isoformat()
        
        await db.cases.insert_one(case_dict)
        
        return case
    except Exception as e:
        logger.error(f"Create case error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create case"
        )

# ====== DOCUMENTS ======

@api_router.get("/documents/case/{case_id}")
async def get_case_documents(case_id: str):
    try:
        # Search in both collections and merge results
        documents_new = await db.case_documents.find({"caseId": case_id}, {"_id": 0}).to_list(1000)
        documents_old = await db.visa_client_documents.find({"caseId": case_id}, {"_id": 0}).to_list(1000)
        
        # Merge both lists
        all_documents = documents_new + documents_old
        
        for doc in all_documents:
            if isinstance(doc.get('uploadedAt'), str):
                try:
                    doc['uploadedAt'] = datetime.fromisoformat(doc['uploadedAt'])
                except:
                    pass
        
        return all_documents
    except Exception as e:
        logger.error(f"Get documents error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch documents"
        )


@api_router.get("/client/documents")
async def get_client_documents(user_payload: dict = Depends(verify_token_header)):
    """Get documents for the authenticated client's case"""
    try:
        user_id = user_payload.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Get user's case
        case = await db.visa_cases.find_one({"userId": user_id})
        if not case:
            logger.warning(f"No case found for user {user_id}")
            return []
        
        case_id = case.get('id') or case.get('_id')
        
        # Search in both collections and merge results
        documents_new = await db.case_documents.find({"caseId": case_id}, {"_id": 0}).to_list(1000)
        documents_old = await db.visa_client_documents.find({"caseId": case_id}, {"_id": 0}).to_list(1000)
        
        # Merge both lists
        all_documents = documents_new + documents_old
        
        for doc in all_documents:
            if isinstance(doc.get('uploadedAt'), str):
                try:
                    doc['uploadedAt'] = datetime.fromisoformat(doc['uploadedAt'])
                except:
                    pass
        
        logger.info(f"Client {user_id} retrieved {len(all_documents)} documents")
        return all_documents
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get client documents error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch documents"
        )

@api_router.post("/documents", response_model=Document)
async def upload_document(document: Document):
    try:
        doc_dict = document.model_dump()
        doc_dict['uploadedAt'] = doc_dict['uploadedAt'].isoformat()
        
        # Save to case_documents collection (correct collection)
        await db.case_documents.insert_one(doc_dict)
        
        return document
    except Exception as e:
        logger.error(f"Upload document error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document"
        )

# ====== APPOINTMENTS ======

@api_router.get("/appointments/user/{user_id}")
async def get_user_appointments(user_id: str):
    try:
        appointments = await db.appointments.find({"userId": user_id}, {"_id": 0}).to_list(100)
        
        for apt in appointments:
            if isinstance(apt.get('createdAt'), str):
                apt['createdAt'] = datetime.fromisoformat(apt['createdAt'])
        
        return appointments
    except Exception as e:
        logger.error(f"Get appointments error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch appointments"
        )

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appointment: Appointment):
    try:
        apt_dict = appointment.model_dump()
        apt_dict['createdAt'] = apt_dict['createdAt'].isoformat()
        
        await db.appointments.insert_one(apt_dict)
        
        return appointment
    except Exception as e:
        logger.error(f"Create appointment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create appointment"
        )

# ====== PAYMENTS ======

@api_router.get("/payments/admin/all")
async def get_all_payments_admin(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    search: Optional[str] = None,
    user_id: Optional[str] = None,
    stage_number: Optional[int] = None,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get paginated and filtered payments for admin (combines payment_transactions and manual_payments)"""
    try:
        # Build query for transactions
        query = {}
        if status and status != 'all':
            query['status'] = status
        if method and method != 'all':
            query['paymentMethod'] = {'$regex': method, '$options': 'i'}
        if user_id and user_id != 'all':
            query['userId'] = user_id
        if stage_number:
            query['stageNumber'] = stage_number
        
        # Date filters
        if date_from or date_to:
            query['createdAt'] = {}
            if date_from:
                query['createdAt']['$gte'] = date_from
            if date_to:
                # Add one day to include the full day
                from datetime import datetime as dt, timedelta
                date_to_obj = dt.fromisoformat(date_to.replace('Z', '+00:00'))
                date_to_end = (date_to_obj + timedelta(days=1)).isoformat()
                query['createdAt']['$lt'] = date_to_end
        
        # Amount filters
        if amount_min is not None or amount_max is not None:
            query['amount'] = {}
            if amount_min is not None:
                query['amount']['$gte'] = amount_min
            if amount_max is not None:
                query['amount']['$lte'] = amount_max
        
        # Get payment transactions with filters
        transactions_cursor = db.payment_transactions.find(query, {'_id': 0})
        transactions = await transactions_cursor.to_list(length=10000)
        
        # Get manual payments (they are always completed)
        manual_query = {}
        if status and status not in ['all', 'completed']:
            # If filtering by non-completed status, exclude manual payments
            manual_payments = []
        else:
            if method and method != 'all':
                manual_query['paymentMethod'] = {'$regex': method, '$options': 'i'}
            if user_id and user_id != 'all':
                manual_query['userId'] = user_id
            if stage_number:
                manual_query['$or'] = [
                    {'stageNumber': stage_number},
                    {'stageNumbers': stage_number}
                ]
            if date_from or date_to:
                manual_query['createdAt'] = {}
                if date_from:
                    manual_query['createdAt']['$gte'] = date_from
                if date_to:
                    from datetime import datetime as dt, timedelta
                    date_to_obj = dt.fromisoformat(date_to.replace('Z', '+00:00'))
                    date_to_end = (date_to_obj + timedelta(days=1)).isoformat()
                    manual_query['createdAt']['$lt'] = date_to_end
            if amount_min is not None or amount_max is not None:
                manual_query['amount'] = {}
                if amount_min is not None:
                    manual_query['amount']['$gte'] = amount_min
                if amount_max is not None:
                    manual_query['amount']['$lte'] = amount_max
            
            manual_cursor = db.manual_payments.find(manual_query, {'_id': 0})
            manual_payments_raw = await manual_cursor.to_list(length=10000)
            
            # Format manual payments with user and case info
            manual_payments = []
            for mp in manual_payments_raw:
                # Get user info
                user_id = mp.get('userId')
                user_info = {}
                if user_id:
                    # Try to find user by ObjectId
                    from bson import ObjectId
                    try:
                        user_object_id = ObjectId(user_id)
                        user = await db.users.find_one({'_id': user_object_id}, {'_id': 0, 'name': 1, 'email': 1, 'phone': 1})
                    except:
                        # If conversion fails, try with string id field
                        user = await db.users.find_one({'id': user_id}, {'_id': 0, 'name': 1, 'email': 1, 'phone': 1})
                    
                    if user:
                        user_info = {
                            'userName': user.get('name'),
                            'userEmail': user.get('email'),
                            'userPhone': user.get('phone')
                        }
                
                # Get case info
                case_id = mp.get('caseId')
                case_info = {}
                if case_id:
                    case = await db.visa_cases.find_one({'id': case_id}, {'_id': 0, 'visaType': 1, 'status': 1, 'overallProgress': 1})
                    if case:
                        case_info = {
                            'visaType': case.get('visaType'),
                            'caseStatus': case.get('status'),
                            'overallProgress': case.get('overallProgress', 0)
                        }
                
                manual_payments.append({
                    'id': mp.get('id'),
                    'sessionId': mp.get('reference', 'Manual'),
                    'caseId': case_id,
                    'userId': user_id,
                    'userName': user_info.get('userName'),
                    'userEmail': user_info.get('userEmail'),
                    'userPhone': user_info.get('userPhone'),
                    'visaType': case_info.get('visaType'),
                    'caseStatus': case_info.get('caseStatus'),
                    'overallProgress': case_info.get('overallProgress', 0),
                    'stageNumber': mp.get('stageNumber') or (mp.get('stageNumbers', [None])[0] if mp.get('stageNumbers') else None),
                    'stageName': mp.get('stageName', {}),
                    'amount': mp.get('amount', 0),
                    'currency': 'USD',
                    'status': 'completed',
                    'paymentStatus': 'completed',
                    'paymentMethod': mp.get('paymentMethod', 'manual'),
                    'receiptUrl': mp.get('receiptUrl'),
                    'notes': mp.get('notes'),
                    'registeredBy': mp.get('createdBy', {}).get('name') if isinstance(mp.get('createdBy'), dict) else mp.get('registeredByName'),
                    'createdAt': mp.get('createdAt'),
                    'completedAt': mp.get('paymentDate'),
                    'isManual': True
                })
        
        # Combine both lists
        all_payments = transactions + manual_payments
        
        # Search filter (after combining because we need to search in computed fields)
        if search:
            search_lower = search.lower()
            all_payments = [
                p for p in all_payments
                if (search_lower in (p.get('sessionId', '') or '').lower() or
                    search_lower in (p.get('userId', '') or '').lower() or
                    search_lower in (p.get('caseId', '') or '').lower() or
                    search_lower in (p.get('userName', '') or '').lower() or
                    search_lower in (p.get('userEmail', '') or '').lower())
            ]
        
        # Sort by creation date (newest first)
        all_payments.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        # Calculate totals
        total_count = len(all_payments)
        total_pages = (total_count + limit - 1) // limit  # Ceiling division
        
        # Apply pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_payments = all_payments[start_idx:end_idx]
        
        logger.info(f"Admin fetched payments: page {page}, showing {len(paginated_payments)} of {total_count} total")
        
        # Calculate stats from all filtered payments (not just current page)
        stats = {
            'total': total_count,
            'completed': sum(1 for p in all_payments if p.get('status') == 'completed'),
            'pending': sum(1 for p in all_payments if p.get('status') == 'pending'),
            'failed': sum(1 for p in all_payments if p.get('status') == 'failed'),
            'totalRevenue': sum(p.get('amount', 0) for p in all_payments if p.get('status') == 'completed')
        }
        
        return {
            'success': True,
            'transactions': paginated_payments,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_count,
                'totalPages': total_pages,
                'hasNextPage': page < total_pages,
                'hasPrevPage': page > 1
            },
            'stats': stats,
            'breakdown': {
                'transactions': len(transactions),
                'manual': len(manual_payments)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching all payments: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch payments"
        )

@api_router.get("/payments/case/{case_id}")
async def get_case_payments(case_id: str):
    try:
        payments = await db.payments.find({"caseId": case_id}, {"_id": 0}).to_list(100)
        
        for payment in payments:
            if isinstance(payment.get('createdAt'), str):
                payment['createdAt'] = datetime.fromisoformat(payment['createdAt'])
        
        return payments
    except Exception as e:
        logger.error(f"Get payments error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch payments"
        )

@api_router.post("/payments", response_model=Payment)
async def create_payment(payment: Payment):
    try:
        payment_dict = payment.model_dump()
        payment_dict['createdAt'] = payment_dict['createdAt'].isoformat()
        
        await db.payments.insert_one(payment_dict)
        
        # Auto-change visa case status to 'en_proceso' on first payment
        case_id = payment_dict.get('caseId')
        if case_id:
            visa_case = await db.visa_cases.find_one({"id": case_id}, {"status": 1})
            if visa_case and visa_case.get("status") in ("proceso_venta", "elegibility_approved"):
                await db.visa_cases.update_one({"id": case_id}, {"$set": {"status": "en_proceso"}})
        
        return payment
    except Exception as e:
        logger.error(f"Create payment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment"
        )

@api_router.post("/admin/payments/register-multiple")
async def register_payment_multiple(request: Request, staff_info: dict = Depends(verify_staff_token)):
    """Register a manual payment for multiple stages with one receipt"""
    try:
        data = await request.json()
        case_id = data.get('caseId')
        stage_numbers = data.get('stageNumbers', [])  # Array of stage numbers
        amount = data.get('amount')
        payment_date = data.get('paymentDate')
        payment_method = data.get('paymentMethod')
        reference = data.get('reference')
        receipt_url = data.get('receiptUrl')
        notes = data.get('notes')
        
        # Get staff info who created the payment
        created_by_id = staff_info.get('id')
        created_by_name = staff_info.get('name', 'Unknown')
        created_by_email = staff_info.get('email', '')
        
        # Validate required fields (reference is optional)
        if not all([case_id, len(stage_numbers) > 0, amount, payment_date, payment_method]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: caseId, stageNumbers, amount, paymentDate, and paymentMethod are required"
            )
        
        # Find the case
        case = await db.visa_cases.find_one({"id": case_id}, {"_id": 0})
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found"
            )
        
        # Get userId from the case
        user_id = case.get('userId')
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Case does not have a valid userId"
            )
        
        # Create payment record for all stages
        payment_id = str(uuid.uuid4())
        
        # Create automatic note about stages
        stages_text = f"Etapas {', '.join(map(str, stage_numbers))}" if len(stage_numbers) > 1 else f"Etapa {stage_numbers[0]}"
        automatic_note = f"Pago registrado para {stages_text}."
        final_notes = f"{automatic_note} {notes}" if notes else automatic_note
        
        payment_record = {
            "id": payment_id,
            "userId": user_id,  # Link payment to user
            "caseId": case_id,
            "stageNumbers": stage_numbers,  # Store multiple stage numbers
            "amount": float(amount),
            "paymentDate": payment_date,
            "paymentMethod": payment_method,
            "reference": reference,
            "receiptUrl": receipt_url,
            "notes": final_notes,
            "createdBy": {
                "id": created_by_id,
                "name": created_by_name,
                "email": created_by_email
            },
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        
        await db.manual_payments.insert_one(payment_record)
        
        # Calculate amount per stage (distribute evenly)
        amount_per_stage = float(amount) / len(stage_numbers)
        
        # Update all selected stages
        for stage_number in stage_numbers:
            await db.visa_stages.update_one(
                {"caseId": case_id, "stageNumber": stage_number},
                {"$set": {
                    "isPaid": True,
                    "status": "unlocked",
                    "paidAmount": amount_per_stage,
                    "paidDate": payment_date
                }}
            )
        
        # Refresh stages to get updated data
        stages = await db.visa_stages.find({"caseId": case_id}).to_list(100)
        
        # Calculate overall progress
        total_stages = len(stages)
        paid_stages = sum(1 for stage in stages if stage.get('isPaid', False))
        
        # Calculate base progress (paid/total * 100)
        base_progress = round((paid_stages / total_stages) * 100) if total_stages > 0 else 0
        
        # Always add first stage percentage (usually 9%)
        first_stage = next((s for s in stages if s.get('stageNumber') == 1), None)
        first_stage_percentage = first_stage.get('percentage', 0) if first_stage else 0
        
        # Final progress = base progress + first stage percentage
        overall_progress = min(base_progress + first_stage_percentage, 100)  # Cap at 100%
        
        # Update case with progress
        await db.visa_cases.update_one(
            {"id": case_id},
            {"$set": {
                "overallProgress": overall_progress
            }}
        )
        
        # Auto-change status to 'en_proceso' if case has a payment and status is still default
        current_status = case.get("status", "proceso_venta")
        if current_status in ("proceso_venta", "elegibility_approved"):
            await db.visa_cases.update_one(
                {"id": case_id},
                {"$set": {"status": "en_proceso"}}
            )
            logger.info(f"Case {case_id} auto-changed to 'en_proceso' after payment")
        
        # 🔧 FIX: Update currentStage after payment
        await update_case_current_stage(case_id)
        
        # Case audit log
        staff = await db.staff.find_one({'_id': created_by_id})
        await log_case_audit(
            case_id=case_id,
            action=f"Pago de ${amount} registrado para etapa(s) {', '.join(map(str, stage_numbers))}",
            action_type=AuditActionTypes.PAYMENT_REGISTERED,
            performed_by_id=created_by_id,
            performed_by_name=staff.get('name', created_by_name) if staff else created_by_name,
            performed_by_role=staff_info.get('role', 'coordinator'),
            details={
                'paymentId': payment_id,
                'amount': float(amount),
                'stageNumbers': stage_numbers,
                'paymentMethod': payment_method,
                'reference': reference
            }
        )
        
        logger.info(f"Payment registered for case {case_id}, stages {stage_numbers}")
        
        # Notify about payment
        from services.case_notifications import notify_payment_registered
        await notify_payment_registered(db, case_id, float(amount), stage_numbers, {
            "id": created_by_id, "name": staff.get('name', created_by_name) if staff else created_by_name, "role": staff_info.get('role', '')
        })
        
        # Guardar nota del pago en case_notes
        stages_str = ', '.join(map(str, stage_numbers))
        
        # Buscar usuario - soporta tanto 'id' string como '_id' ObjectId
        user_info = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        if not user_info:
            # Intentar buscar por _id como ObjectId (usuarios creados con BSON ObjectId)
            try:
                user_info = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
            except Exception:
                pass  # No es un ObjectId válido
        if not user_info:
            # Intentar buscar por _id como string (usuarios con UUID)
            user_info = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        
        case_info = await db.visa_cases.find_one({"id": case_id}, {"_id": 0, "visaType": 1, "status": 1})
        
        client_name = user_info.get('name', 'N/A') if user_info else 'N/A'
        client_email = user_info.get('email', '') if user_info else ''
        client_phone = user_info.get('phone', '') if user_info else ''
        
        payment_note_content = f"💰 Pago registrado:\n" \
                               f"• Cliente: {client_name}\n" \
                               f"• Monto: ${amount}\n" \
                               f"• Etapa(s): {stages_str}\n" \
                               f"• Método: {payment_method}\n" \
                               f"• Fecha de pago: {payment_date}\n" \
                               f"• Referencia: {reference or 'N/A'}\n" \
                               f"• Progreso: {paid_stages}/{total_stages} etapas pagadas ({overall_progress}%)\n" \
                               f"• Registrado por: {created_by_name}"
        
        payment_note = {
            "id": str(uuid.uuid4()),
            "caseId": case_id,
            "content": payment_note_content,
            "type": "payment",
            "category": "payment_registered",
            "createdBy": {
                "id": created_by_id,
                "name": created_by_name,
                "role": staff_info.get('role', 'coordinator')
            },
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "paymentId": payment_id,
                "amount": float(amount),
                "stageNumbers": stage_numbers,
                "paymentMethod": payment_method,
                "paymentDate": payment_date,
                "reference": reference
            }
        }
        await db.case_notes.insert_one(payment_note)
        logger.info(f"📝 Payment note saved for case {case_id}")
        
        # 📤 Notify webhook about stage payment
        await notify_case_webhook(
            action=f"pago_etapa_{stages_str}",
            client_data={
                "id": user_id,
                "name": client_name,
                "email": client_email,
                "phone": client_phone
            },
            case_data={
                "caseId": case_id,
                "visaType": case_info.get("visaType", "") if case_info else "",
                "status": case_info.get("status", "") if case_info else ""
            },
            extra_data={
                "stageNumbers": stage_numbers,
                "amount": float(amount),
                "paymentMethod": payment_method,
                "paymentDate": payment_date,
                "reference": reference,
                "paidStages": paid_stages,
                "totalStages": total_stages,
                "overallProgress": overall_progress,
                "registeredBy": created_by_name,
                "note": payment_note_content
            }
        )
        
        return {
            "success": True,
            "message": f"Payment registered successfully for {len(stage_numbers)} stages",
            "paymentId": payment_id,
            "stagesUpdated": len(stage_numbers)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error registering payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@api_router.put("/admin/payments/{payment_id}")
async def update_payment(
    payment_id: str,
    request: Request,
    staff_info: dict = Depends(verify_staff_token)
):
    """
    Update a payment. Only super_admin can edit payments.
    """
    try:
        # Verificar que sea super_admin
        user_role = staff_info.get('role', 'advisor')
        if user_role not in ('super_admin', 'admin'):
            raise HTTPException(
                status_code=403,
                detail="Solo admin o super_admin puede editar pagos"
            )
        
        data = await request.json()
        
        # Buscar el pago en manual_payments (colección principal de pagos)
        payment = await db.manual_payments.find_one({'id': payment_id})
        if not payment:
            # También buscar en payment_transactions como respaldo
            payment = await db.payment_transactions.find_one({'id': payment_id})
        
        if not payment:
            raise HTTPException(
                status_code=404,
                detail=f"Pago no encontrado: {payment_id}"
            )
        
        # Determinar la colección correcta
        collection = db.manual_payments if await db.manual_payments.find_one({'id': payment_id}) else db.payment_transactions
        
        # Campos permitidos para actualizar
        allowed_fields = ['amount', 'currency', 'status', 'paymentMethod', 'notes', 'transactionId', 'reference', 'paymentDate', 'receiptUrl', 'stageNumbers']
        update_fields = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail="No se proporcionaron campos válidos para actualizar"
            )
        
        # Agregar metadata de actualización
        update_fields['updatedAt'] = datetime.now(timezone.utc).isoformat()
        update_fields['updatedBy'] = staff_info.get('email')
        
        # Actualizar el pago
        await collection.update_one(
            {'id': payment_id},
            {'$set': update_fields}
        )
        
        # Obtener pago actualizado
        updated_payment = await collection.find_one({'id': payment_id}, {'_id': 0})
        
        logger.info(f"✅ Payment {payment_id} updated by {staff_info.get('email')}")
        
        return {
            "success": True,
            "message": "Pago actualizado exitosamente",
            "payment": updated_payment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating payment: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar pago: {str(e)}"
        )


@api_router.delete("/admin/payments/{payment_id}")
async def delete_payment(
    payment_id: str,
    staff_info: dict = Depends(verify_staff_token)
):
    """
    Delete a payment. Only super_admin can delete payments.
    """
    try:
        # Verificar que sea super_admin
        user_role = staff_info.get('role', 'advisor')
        if user_role not in ['super_admin', 'admin']:
            raise HTTPException(
                status_code=403,
                detail="Solo admin y super_admin pueden eliminar pagos"
            )
        
        # Buscar el pago en manual_payments (colección principal de pagos)
        payment = await db.manual_payments.find_one({'id': payment_id})
        collection = db.manual_payments
        
        if not payment:
            # También buscar en payment_transactions como respaldo
            payment = await db.payment_transactions.find_one({'id': payment_id})
            collection = db.payment_transactions
        
        if not payment:
            raise HTTPException(
                status_code=404,
                detail=f"Pago no encontrado: {payment_id}"
            )
        
        # Guardar info del pago para el log
        payment_info = {
            'amount': payment.get('amount'),
            'userName': payment.get('userName'),
            'stageNumber': payment.get('stageNumber')
        }
        
        # Eliminar el pago
        result = await collection.delete_one({'id': payment_id})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=500,
                detail="No se pudo eliminar el pago"
            )
        
        logger.info(f"✅ Payment {payment_id} deleted by {staff_info.get('email')} - Amount: ${payment_info['amount']}, User: {payment_info['userName']}")
        
        return {
            "success": True,
            "message": "Pago eliminado exitosamente",
            "deletedPayment": payment_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting payment: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar pago: {str(e)}"
        )


@api_router.post("/admin/stages/{stage_id}/unmark-paid")
async def unmark_stage_as_paid(
    stage_id: str,
    request: Request,
    staff_info: dict = Depends(verify_staff_token)
):
    """
    Unmark a stage as paid (remove isPaid flag).
    Only admin and super_admin can perform this action.
    """
    try:
        user_role = staff_info.get('role', 'advisor')
        if user_role not in ['super_admin', 'admin']:
            raise HTTPException(
                status_code=403,
                detail="Solo admin y super_admin pueden quitar el estado de pago"
            )
        
        # Find the stage
        stage = await db.visa_stages.find_one({'_id': stage_id})
        if not stage:
            # Try by id field
            stage = await db.visa_stages.find_one({'id': stage_id})
        
        if not stage:
            raise HTTPException(
                status_code=404,
                detail=f"Etapa no encontrada: {stage_id}"
            )
        
        if not stage.get('isPaid'):
            raise HTTPException(
                status_code=400,
                detail="La etapa no está marcada como pagada"
            )
        
        # Get stage info for logging
        stage_info = {
            'stageNumber': stage.get('stageNumber'),
            'caseId': stage.get('caseId'),
            'paidAmount': stage.get('paidAmount', 0)
        }
        
        # Unmark as paid
        result = await db.visa_stages.update_one(
            {'_id': stage_id} if stage.get('_id') == stage_id else {'id': stage_id},
            {
                '$set': {
                    'isPaid': False,
                    'paidAmount': 0,
                    'paymentId': None,
                    'paidAt': None,
                    'unmarkedAsPaidBy': staff_info.get('email'),
                    'unmarkedAsPaidAt': datetime.utcnow().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=500,
                detail="No se pudo actualizar la etapa"
            )
        
        logger.info(f"✅ Stage {stage_id} unmarked as paid by {staff_info.get('email')} - Stage: {stage_info['stageNumber']}, Case: {stage_info['caseId']}")
        
        return {
            "success": True,
            "message": f"Pago de etapa {stage_info['stageNumber']} eliminado exitosamente",
            "stageInfo": stage_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unmarking stage as paid: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al quitar el pago de la etapa: {str(e)}"
        )


@api_router.post("/admin/payments/register")
async def register_payment(request: Request, staff_info: dict = Depends(verify_staff_token)):
    """Register a manual payment for a stage and unlock it"""
    try:
        data = await request.json()
        case_id = data.get('caseId')
        stage_number = data.get('stageNumber')
        amount = data.get('amount')
        payment_date = data.get('paymentDate')
        payment_method = data.get('paymentMethod')
        reference = data.get('reference')
        receipt_url = data.get('receiptUrl')
        notes = data.get('notes')
        
        # Get staff info who created the payment
        created_by_id = staff_info.get('id')
        created_by_name = staff_info.get('name', 'Unknown')
        created_by_email = staff_info.get('email', '')
        
        # Validate required fields
        if not all([case_id, stage_number is not None, amount, payment_date, payment_method, reference]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: caseId, stageNumber, amount, paymentDate, paymentMethod, and reference are required"
            )
        
        # Find the case
        case = await db.visa_cases.find_one({"id": case_id}, {"_id": 0})
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found"
            )
        
        # Get userId from the case
        user_id = case.get('userId')
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Case does not have a valid userId"
            )
        
        # Create payment record
        payment_id = str(uuid.uuid4())
        
        # Create automatic note about stage
        automatic_note = f"Pago registrado para Etapa {stage_number}."
        final_notes = f"{automatic_note} {notes}" if notes else automatic_note
        
        payment_record = {
            "id": payment_id,
            "userId": user_id,  # Link payment to user
            "caseId": case_id,
            "stageNumber": stage_number,
            "stageNumbers": [stage_number],  # Also store as array for consistency
            "amount": float(amount),
            "paymentDate": payment_date,
            "paymentMethod": payment_method,
            "reference": reference,
            "receiptUrl": receipt_url,
            "notes": final_notes,
            "createdBy": {
                "id": created_by_id,
                "name": created_by_name,
                "email": created_by_email
            },
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        
        await db.manual_payments.insert_one(payment_record)
        
        # Get stages from db.visa_stages collection using caseId
        stages = await db.visa_stages.find({"caseId": case_id}).to_list(100)
        logger.info(f"🔍 Found {len(stages)} stages for case {case_id}")
        
        # Update the specific stage to mark as paid and unlock
        update_result = await db.visa_stages.update_one(
            {"caseId": case_id, "stageNumber": stage_number},
            {"$set": {
                "isPaid": True,
                "status": "unlocked",
                "paidAmount": float(amount),
                "paidDate": payment_date
            }}
        )
        logger.info(f"✏️ Stage update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
        
        # Refresh stages to get updated data
        stages = await db.visa_stages.find({"caseId": case_id}).to_list(100)
        
        # Calculate overall progress
        # Count paid stages
        total_stages = len(stages)
        paid_stages = sum(1 for stage in stages if stage.get('isPaid', False))
        
        # Calculate base progress (paid/total * 100)
        base_progress = round((paid_stages / total_stages) * 100) if total_stages > 0 else 0
        
        # Always add first stage percentage (usually 9%)
        first_stage = next((s for s in stages if s.get('stageNumber') == 1), None)
        first_stage_percentage = first_stage.get('percentage', 0) if first_stage else 0
        
        # Final progress = base progress + first stage percentage
        overall_progress = min(base_progress + first_stage_percentage, 100)  # Cap at 100%
        
        logger.info(f"📊 Calculated: {paid_stages}/{total_stages} paid, base: {base_progress}% + stage 1: {first_stage_percentage}% = {overall_progress}%")
        
        # Update case with progress
        await db.visa_cases.update_one(
            {"id": case_id},
            {"$set": {
                "overallProgress": overall_progress
            }}
        )
        
        # 🔧 FIX: Update currentStage after payment
        await update_case_current_stage(case_id)
        
        logger.info(f"✅ Payment registered for case {case_id}, stage {stage_number}")
        logger.info(f"📊 Progress updated: {paid_stages}/{total_stages} stages paid ({overall_progress}%)")
        
        # 📤 Notify webhook about stage payment
        # Get client info - soporta tanto 'id' string como '_id' ObjectId
        user_info = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        if not user_info:
            try:
                user_info = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
            except Exception:
                pass
        if not user_info:
            user_info = await db.users.find_one({"_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        
        case_info = await db.visa_cases.find_one({"id": case_id}, {"_id": 0, "visaType": 1, "status": 1})
        
        client_name = user_info.get("name", "N/A") if user_info else "N/A"
        client_email = user_info.get("email", "") if user_info else ""
        client_phone = user_info.get("phone", "") if user_info else ""
        
        # 📝 Crear nota de pago con estructura estándar
        payment_note_content = f"💰 Pago registrado:\n" \
                               f"• Cliente: {client_name}\n" \
                               f"• Monto: ${amount}\n" \
                               f"• Etapa: {stage_number}\n" \
                               f"• Método: {payment_method}\n" \
                               f"• Fecha de pago: {payment_date}\n" \
                               f"• Referencia: {reference or 'N/A'}\n" \
                               f"• Progreso: {paid_stages}/{total_stages} etapas pagadas ({overall_progress}%)\n" \
                               f"• Registrado por: {created_by_name}"
        
        payment_note = {
            "id": str(uuid.uuid4()),
            "caseId": case_id,
            "content": payment_note_content,
            "type": "payment",
            "category": "payment_registered",
            "createdBy": {
                "id": created_by_id,
                "name": created_by_name,
                "role": staff_info.get('role', 'coordinator')
            },
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "paymentId": payment_id,
                "amount": float(amount),
                "stageNumber": stage_number,
                "paymentMethod": payment_method,
                "paymentDate": payment_date,
                "reference": reference
            }
        }
        await db.case_notes.insert_one(payment_note)
        logger.info(f"📝 Payment note saved for case {case_id}")
        
        await notify_case_webhook(
            action=f"pago_etapa_{stage_number}",
            client_data={
                "id": user_id,
                "name": client_name,
                "email": client_email,
                "phone": client_phone
            },
            case_data={
                "caseId": case_id,
                "visaType": case_info.get("visaType", "") if case_info else "",
                "status": case_info.get("status", "") if case_info else "",
                "currentStage": stage_number
            },
            extra_data={
                "stageNumber": stage_number,
                "amount": float(amount),
                "paymentMethod": payment_method,
                "paymentDate": payment_date,
                "paidStages": paid_stages,
                "totalStages": total_stages,
                "overallProgress": overall_progress,
                "registeredBy": created_by_name,
                "note": payment_note_content
            }
        )
        
        return {
            "success": True,
            "message": "Payment registered successfully",
            "paymentId": payment_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error registering payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ====== MESSAGES ======

@api_router.get("/messages/user/{user_id}")
async def get_user_messages(user_id: str):
    try:
        messages = await db.messages.find({"userId": user_id}, {"_id": 0}).to_list(100)
        
        for msg in messages:
            if isinstance(msg.get('timestamp'), str):
                msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
        
        return messages
    except Exception as e:
        logger.error(f"Get messages error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch messages"
        )

@api_router.post("/messages", response_model=Message)
async def send_message(message: Message):
    try:
        msg_dict = message.model_dump()
        msg_dict['timestamp'] = msg_dict['timestamp'].isoformat()
        
        await db.messages.insert_one(msg_dict)
        
        return message
    except Exception as e:
        logger.error(f"Send message error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message"
        )

# ====== COMPARATOR ======

@api_router.get("/comparator/{user_id}")
async def get_similar_cases(user_id: str):
    try:
        # Import mock data
        from mock_data import get_similar_cases_data
        
        similar_cases = get_similar_cases_data(user_id)
        
        return similar_cases
    except Exception as e:
        logger.error(f"Get similar cases error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch similar cases"
        )

# ====== ADMIN COMPARATOR CASES MANAGEMENT ======

class ComparatorCaseCreate(BaseModel):
    country: str
    profession: str
    visaType: str = 'EB-2 NIW'
    profile: dict
    outcome: dict
    timeline: list = []

class ComparatorCaseUpdate(BaseModel):
    country: Optional[str] = None
    profession: Optional[str] = None
    visaType: Optional[str] = None
    profile: Optional[dict] = None
    outcome: Optional[dict] = None
    timeline: Optional[list] = None

@api_router.get("/admin/comparator-cases")
async def get_admin_comparator_cases(
    limit: int = 100,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all comparator cases for admin"""
    try:
        cursor = db.comparator_cases.find({}, {'_id': 0}).limit(limit)
        cases = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "cases": cases,
            "total": len(cases)
        }
    except Exception as e:
        logger.error(f"Error fetching comparator cases: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch cases")

@api_router.post("/admin/comparator-cases")
async def create_comparator_case(
    request: ComparatorCaseCreate,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new comparator case"""
    try:
        case_id = str(uuid.uuid4())
        case = {
            "_id": case_id,
            "id": case_id,
            "country": request.country,
            "profession": request.profession,
            "visaType": request.visaType,
            "profile": request.profile,
            "outcome": request.outcome,
            "timeline": request.timeline,
            "createdBy": staff_payload['id'],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        await db.comparator_cases.insert_one(case)
        logger.info(f"Comparator case created: {case_id}")
        
        return {
            "success": True,
            "message": "Case created successfully",
            "case": case
        }
    except Exception as e:
        logger.error(f"Error creating comparator case: {e}")
        raise HTTPException(status_code=500, detail="Failed to create case")

@api_router.put("/admin/comparator-cases/{case_id}")
async def update_comparator_case(
    case_id: str,
    request: ComparatorCaseUpdate,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update an existing comparator case"""
    try:
        # Check if case exists
        case = await db.comparator_cases.find_one({'id': case_id}, {'_id': 0})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Build update dict with only provided fields
        update_data = {}
        if request.country is not None:
            update_data['country'] = request.country
        if request.profession is not None:
            update_data['profession'] = request.profession
        if request.visaType is not None:
            update_data['visaType'] = request.visaType
        if request.profile is not None:
            update_data['profile'] = request.profile
        if request.outcome is not None:
            update_data['outcome'] = request.outcome
        if request.timeline is not None:
            update_data['timeline'] = request.timeline
        
        update_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        await db.comparator_cases.update_one(
            {'id': case_id},
            {'$set': update_data}
        )
        
        logger.info(f"Comparator case updated: {case_id}")
        
        return {
            "success": True,
            "message": "Case updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating comparator case: {e}")
        raise HTTPException(status_code=500, detail="Failed to update case")

@api_router.delete("/admin/comparator-cases/{case_id}")
async def delete_comparator_case(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a comparator case"""
    try:
        # Check if case exists
        case = await db.comparator_cases.find_one({'id': case_id}, {'_id': 0})
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        await db.comparator_cases.delete_one({'id': case_id})
        logger.info(f"Comparator case deleted: {case_id}")
        
        return {
            "success": True,
            "message": "Case deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting comparator case: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete case")

# ====== ADMIN LEGAL DOCUMENTS MANAGEMENT ======

class LegalDocumentCreate(BaseModel):
    title: dict
    description: dict
    category: str
    subcategory: str = ''
    fileUrl: str
    fileType: str = 'pdf'
    fileSize: int = 0
    tags: list = []
    language: str = 'both'
    isPremium: bool = False

class LegalDocumentUpdate(BaseModel):
    title: Optional[dict] = None
    description: Optional[dict] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    fileUrl: Optional[str] = None
    fileType: Optional[str] = None
    fileSize: Optional[int] = None
    tags: Optional[list] = None
    language: Optional[str] = None
    isPremium: Optional[bool] = None

@api_router.get("/admin/legal-documents")
async def get_admin_legal_documents(
    limit: int = 100,
    category: Optional[str] = None,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all legal documents for admin"""
    try:
        query = {}
        if category:
            query['category'] = category
        
        cursor = db.legal_documents.find(query, {'_id': 0}).limit(limit)
        documents = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "documents": documents,
            "total": len(documents)
        }
    except Exception as e:
        logger.error(f"Error fetching legal documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")

@api_router.post("/admin/legal-documents")
async def create_legal_document(
    request: LegalDocumentCreate,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new legal document"""
    try:
        doc_id = str(uuid.uuid4())
        document = {
            "_id": doc_id,
            "id": doc_id,
            "title": request.title,
            "description": request.description,
            "category": request.category,
            "subcategory": request.subcategory,
            "fileUrl": request.fileUrl,
            "fileType": request.fileType,
            "fileSize": request.fileSize,
            "tags": request.tags,
            "language": request.language,
            "isPremium": request.isPremium,
            "createdBy": staff_payload['id'],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        await db.legal_documents.insert_one(document)
        logger.info(f"Legal document created: {doc_id}")
        
        return {
            "success": True,
            "message": "Document created successfully",
            "document": document
        }
    except Exception as e:
        logger.error(f"Error creating legal document: {e}")
        raise HTTPException(status_code=500, detail="Failed to create document")

@api_router.put("/admin/legal-documents/{document_id}")
async def update_legal_document(
    document_id: str,
    request: LegalDocumentUpdate,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update an existing legal document"""
    try:
        # Check if document exists
        document = await db.legal_documents.find_one({'id': document_id}, {'_id': 0})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Build update dict with only provided fields
        update_data = {}
        if request.title is not None:
            update_data['title'] = request.title
        if request.description is not None:
            update_data['description'] = request.description
        if request.category is not None:
            update_data['category'] = request.category
        if request.subcategory is not None:
            update_data['subcategory'] = request.subcategory
        if request.fileUrl is not None:
            update_data['fileUrl'] = request.fileUrl
        if request.fileType is not None:
            update_data['fileType'] = request.fileType
        if request.fileSize is not None:
            update_data['fileSize'] = request.fileSize
        if request.tags is not None:
            update_data['tags'] = request.tags
        if request.language is not None:
            update_data['language'] = request.language
        if request.isPremium is not None:
            update_data['isPremium'] = request.isPremium
        
        update_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        await db.legal_documents.update_one(
            {'id': document_id},
            {'$set': update_data}
        )
        
        logger.info(f"Legal document updated: {document_id}")
        
        return {
            "success": True,
            "message": "Document updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating legal document: {e}")
        raise HTTPException(status_code=500, detail="Failed to update document")

@api_router.delete("/admin/legal-documents/{document_id}")
async def delete_legal_document(
    document_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a legal document"""
    try:
        # Check if document exists
        document = await db.legal_documents.find_one({'id': document_id}, {'_id': 0})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        await db.legal_documents.delete_one({'id': document_id})
        logger.info(f"Legal document deleted: {document_id}")
        
        return {
            "success": True,
            "message": "Document deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting legal document: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

# ====== TIMELINE PREDICTOR ======

@api_router.get("/timeline/{user_id}")
async def get_timeline_prediction(user_id: str):
    try:
        # First, check if there's a custom timeline in MongoDB
        custom_timeline = await db.user_timelines.find_one({'userId': user_id})
        
        if custom_timeline:
            # Return custom timeline from database
            return {
                'stages': custom_timeline['stages'],
                'prediction': custom_timeline['prediction'],
                'factors': custom_timeline['factors']
            }
        
        # If no custom timeline, use mock data as default
        from mock_data import get_timeline_prediction_data
        timeline = get_timeline_prediction_data(user_id)
        
        return timeline
    except Exception as e:
        logger.error(f"Get timeline error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch timeline prediction"
        )


# ============= ADMIN PANEL ENDPOINTS =============

from admin_models import (
    StaffModel, ActivityLog, serialize_staff, 
    has_permission as admin_has_permission, can_manage_role as admin_can_manage_role, ROLE_LEVELS
)
from fastapi import Header, Depends
from typing import Annotated

# ===== Admin Auth Models =====
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminMagicLinkRequest(BaseModel):
    email: EmailStr

class OTPRequest(BaseModel):
    email: EmailStr

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str

class EmergencyAdminRequest(BaseModel):
    secret_key: str
    email: EmailStr
    password: str
    name: str

class StaffCreateRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None  # Opcional - se genera automáticamente si no se proporciona
    name: str
    role: str
    phone: Optional[str] = None
    department: Optional[str] = None
    linkedin: Optional[str] = None

class StaffUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    linkedin: Optional[str] = None
    photo: Optional[str] = None  # Base64 encoded image
    permissions: Optional[dict] = None

# ===== Auth Endpoints =====
@api_router.post("/admin/auth/login")
async def admin_login(request: AdminLoginRequest):
    """Admin login with email and password"""
    try:
        # Buscar staff por email
        staff = await db.staff.find_one({'email': request.email.lower()})
        
        if not staff:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verificar contraseña - support both 'passwordHash' and 'password' fields
        password_hash = staff.get('passwordHash') or staff.get('password')
        if not password_hash or not StaffModel.verify_password(request.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verificar estado (check both 'active' and 'status' for compatibility)
        is_active = staff.get('active', True) or staff.get('status') == 'active'
        if not is_active:
            raise HTTPException(status_code=403, detail="Account is inactive. Contact administrator.")
        
        # Actualizar último login
        await db.staff.update_one(
            {'_id': staff['_id']},
            {'$set': {'lastLogin': datetime.utcnow()}}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff['_id'],
            action='login',
            resource='auth',
            details={'method': 'password'}
        )
        await db.activity_log.insert_one(log)
        
        # Generar JWT
        token = StaffModel.generate_jwt(staff)
        
        # Get permissions from RBAC system
        user_role = staff.get('role', 'advisor')
        role_permissions = ROLE_PERMISSIONS.get(user_role, {})
        menu_items = get_menu_items_for_role(user_role)
        
        staff_serialized = serialize_staff(staff)
        # Add RBAC permissions to staff data
        staff_serialized['rbacPermissions'] = role_permissions
        staff_serialized['menuItems'] = menu_items
        
        return {
            'token': token,
            'staff': staff_serialized,
            'message': 'Login successful'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

# ===== OTP Login =====
@api_router.post("/admin/auth/send-otp")
async def send_otp(request: OTPRequest):
    """Send a 6-digit OTP to the staff email for passwordless login."""
    import random
    email = request.email.lower().strip()
    
    staff = await db.staff.find_one({'email': email})
    if not staff:
        raise HTTPException(status_code=404, detail="Email no encontrado")
    
    is_active = staff.get('active', True) or staff.get('status') == 'active'
    if not is_active:
        raise HTTPException(status_code=403, detail="Cuenta inactiva")
    
    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP
    await db.admin_otp.update_one(
        {"email": email},
        {"$set": {"code": code, "expiresAt": expires.isoformat(), "attempts": 0, "createdAt": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    # Send email
    try:
        from services.case_notifications import _send_email, _email_wrapper
        body = (
            f"<div style='text-align:center;padding:20px 0;'>"
            f"<p style='margin:0 0 8px;color:#6B7280;font-size:14px;'>Tu codigo de verificacion es:</p>"
            f"<p style='margin:0;font-size:36px;font-weight:800;letter-spacing:8px;color:#111827;'>{code}</p>"
            f"<p style='margin:12px 0 0;color:#9CA3AF;font-size:12px;'>Este codigo expira en 10 minutos</p>"
            f"</div>"
        )
        html = _email_wrapper(staff.get("name", ""), "Codigo de acceso", body)
        _send_email(email, "Tu codigo de acceso - URPE", html)
    except Exception as e:
        logger.error(f"OTP email error: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar el codigo")
    
    return {"success": True, "message": "Codigo enviado a tu email"}

@api_router.post("/admin/auth/verify-otp")
async def verify_otp(request: OTPVerifyRequest):
    """Verify OTP and return JWT token (logs the user in)."""
    email = request.email.lower().strip()
    code = request.code.strip()
    
    otp_record = await db.admin_otp.find_one({"email": email})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No hay codigo pendiente para este email")
    
    # Check attempts
    if otp_record.get("attempts", 0) >= 5:
        await db.admin_otp.delete_one({"email": email})
        raise HTTPException(status_code=429, detail="Demasiados intentos. Solicita un nuevo codigo.")
    
    # Increment attempts
    await db.admin_otp.update_one({"email": email}, {"$inc": {"attempts": 1}})
    
    # Check expiry
    expires = otp_record.get("expiresAt", "")
    if expires:
        exp_dt = datetime.fromisoformat(expires.replace('Z', '+00:00')) if isinstance(expires, str) else expires
        if datetime.now(timezone.utc) > exp_dt:
            await db.admin_otp.delete_one({"email": email})
            raise HTTPException(status_code=400, detail="Codigo expirado. Solicita uno nuevo.")
    
    # Verify code
    if otp_record.get("code") != code:
        remaining = 5 - otp_record.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Codigo incorrecto. {remaining} intento(s) restante(s).")
    
    # OTP valid — delete it
    await db.admin_otp.delete_one({"email": email})
    
    # Get staff and generate token
    staff = await db.staff.find_one({'email': email})
    if not staff:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Update last login
    await db.staff.update_one({'_id': staff['_id']}, {'$set': {'lastLogin': datetime.utcnow()}})
    
    # Log
    log = ActivityLog.create_log(staff_id=staff['_id'], action='login', resource='auth', details={'method': 'otp'})
    await db.activity_log.insert_one(log)
    
    # Generate JWT
    token = StaffModel.generate_jwt(staff)
    user_role = staff.get('role', 'advisor')
    role_permissions = ROLE_PERMISSIONS.get(user_role, {})
    menu_items = get_menu_items_for_role(user_role)
    
    staff_serialized = serialize_staff(staff)
    staff_serialized['rbacPermissions'] = role_permissions
    staff_serialized['menuItems'] = menu_items
    
    return {'token': token, 'staff': staff_serialized, 'message': 'Login exitoso'}



@api_router.post("/admin/auth/emergency-create")
async def emergency_create_admin(request: EmergencyAdminRequest):
    """
    EMERGENCY ENDPOINT: Create a new admin user
    This endpoint should only be used in production emergencies when admin access is lost.
    Requires a secret key from environment variable: EMERGENCY_ADMIN_KEY
    
    Usage:
    POST /api/admin/auth/emergency-create
    {
        "secret_key": "your-emergency-key",
        "email": "newadmin@urpe.com",
        "password": "newpassword123",
        "name": "Emergency Admin"
    }
    """
    try:
        # Verificar clave secreta de emergencia
        emergency_key = os.getenv('EMERGENCY_ADMIN_KEY', 'URPE-EMERGENCY-2024-SECURE')
        if request.secret_key != emergency_key:
            logger.warning(f"Failed emergency admin creation attempt with wrong key")
            raise HTTPException(status_code=403, detail="Invalid emergency key")
        
        # Verificar si ya existe un admin con ese email
        existing_staff = await db.staff.find_one({'email': request.email.lower()})
        if existing_staff:
            raise HTTPException(status_code=400, detail="Admin with this email already exists")
        
        # Crear nuevo admin con rol super_admin
        new_admin = StaffModel.create_staff(
            email=request.email,
            password=request.password,
            name=request.name,
            role='super_admin',
            phone=None,
            department='Administration',
            linkedin=None
        )
        
        # Insertar en la base de datos
        result = await db.staff.insert_one(new_admin)
        
        # Log de actividad crítica
        log = ActivityLog.create_log(
            staff_id=new_admin['_id'],
            action='emergency_admin_created',
            resource='staff',
            details={
                'email': request.email,
                'created_at': datetime.utcnow().isoformat()
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Emergency admin created successfully: {request.email}")
        
        return {
            'success': True,
            'message': 'Emergency admin created successfully',
            'admin': {
                'id': new_admin['_id'],
                'email': new_admin['email'],
                'name': new_admin['name'],
                'role': new_admin['role']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Emergency admin creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create emergency admin")


@api_router.post("/admin/auth/magic-link")
async def send_magic_link(request: AdminMagicLinkRequest):
    """Send magic link to admin email"""
    try:
        staff = await db.staff.find_one({'email': request.email.lower()})
        
        if not staff:
            # Por seguridad, no revelar si el email existe
            return {'message': 'If this email exists, a magic link has been sent.'}
        
        # Check if staff is active (check both 'active' and 'status' for compatibility)
        is_active = staff.get('active', True) or staff.get('status') == 'active'
        if not is_active:
            return {'message': 'If this email exists, a magic link has been sent.'}
        
        # Generar token único
        token = StaffModel.generate_magic_link_token()
        expires = StaffModel.get_magic_link_expiration()
        
        # Guardar token en DB
        await db.staff.update_one(
            {'_id': staff['_id']},
            {
                '$set': {
                    'magicLinkToken': token,
                    'magicLinkExpires': expires
                }
            }
        )
        
        # TODO: Enviar email con link
        # En desarrollo, retornamos el token
        magic_link = f"http://localhost:3000/admin/magic-link/{token}"
        logger.info(f"Magic link for {staff['email']}: {magic_link}")
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff['_id'],
            action='magic_link_requested',
            resource='auth'
        )
        await db.activity_log.insert_one(log)
        
        return {
            'message': 'If this email exists, a magic link has been sent.',
            'dev_link': magic_link if os.getenv('ENV') == 'development' else None
        }
        
    except Exception as e:
        logger.error(f"Magic link error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send magic link")


@api_router.get("/admin/auth/verify-magic-link/{token}")
async def verify_magic_link(token: str):
    """Verify magic link token and login"""
    try:
        staff = await db.staff.find_one({
            'magicLinkToken': token,
            'magicLinkExpires': {'$gt': datetime.utcnow()}
        })
        
        if not staff:
            raise HTTPException(status_code=401, detail="Invalid or expired magic link")
        
        # Check if staff is active (check both 'active' and 'status' for compatibility)
        is_active = staff.get('active', True) or staff.get('status') == 'active'
        if not is_active:
            raise HTTPException(status_code=403, detail="Account is inactive")
        
        # Invalidar token inmediatamente
        await db.staff.update_one(
            {'_id': staff['_id']},
            {
                '$set': {'lastLogin': datetime.utcnow()},
                '$unset': {'magicLinkToken': '', 'magicLinkExpires': ''}
            }
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff['_id'],
            action='login',
            resource='auth',
            details={'method': 'magic_link'}
        )
        await db.activity_log.insert_one(log)
        
        # Generar JWT
        jwt_token = StaffModel.generate_jwt(staff)
        
        # Get permissions from RBAC system
        user_role = staff.get('role', 'advisor')
        role_permissions = ROLE_PERMISSIONS.get(user_role, {})
        menu_items = get_menu_items_for_role(user_role)
        
        staff_serialized = serialize_staff(staff)
        staff_serialized['rbacPermissions'] = role_permissions
        staff_serialized['menuItems'] = menu_items
        
        return {
            'token': jwt_token,
            'staff': staff_serialized,
            'message': 'Login successful'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Magic link verification error: {e}")
        raise HTTPException(status_code=500, detail="Verification failed")


@api_router.get("/admin/auth/me")
async def get_current_admin(staff_payload: dict = Depends(verify_staff_token)):
    """Get current authenticated admin info with RBAC permissions"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Get permissions from RBAC system
        user_role = staff.get('role', 'advisor')
        role_permissions = ROLE_PERMISSIONS.get(user_role, {})
        menu_items = get_menu_items_for_role(user_role)
        
        staff_serialized = serialize_staff(staff)
        staff_serialized['rbacPermissions'] = role_permissions
        staff_serialized['menuItems'] = menu_items
        
        return staff_serialized
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get current admin error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get admin info")


@api_router.get("/admin/permissions/{role}")
async def get_role_permissions(role: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get permissions for a specific role (admin only)"""
    try:
        # Only super admins and admins can query role permissions
        if staff_payload['role'] not in ['presidente', 'ceo', 'super_admin', 'admin']:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        if role not in ROLE_PERMISSIONS:
            raise HTTPException(status_code=404, detail="Role not found")
        
        return {
            'role': role,
            'permissions': ROLE_PERMISSIONS[role],
            'hierarchy_level': ROLE_HIERARCHY[role],
            'menu_items': get_menu_items_for_role(role)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get role permissions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get role permissions")


@api_router.post("/admin/auth/logout")
async def admin_logout(staff_payload: dict = Depends(verify_staff_token)):
    """Admin logout (client should delete token)"""
    try:
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='logout',
            resource='auth'
        )
        await db.activity_log.insert_one(log)
        
        return {'message': 'Logged out successfully'}
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail="Logout failed")


# ============= STORAGE ENDPOINTS =============

@api_router.post("/storage/upload")
async def upload_file_to_storage(
    file: UploadFile = File(...),
    documentType: str = Form(default="general"),
    folder: Optional[str] = Form(default=None),
    metadata: Optional[str] = Form(default=None),
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Upload a file to Supabase Storage
    Requires admin authentication
    Returns the public URL of the uploaded file
    """
    try:
        from storage_service import upload_file as supabase_upload
        import json
        
        # Validate file size (max 10MB)
        file_content = await file.read()
        file_size_mb = len(file_content) / (1024 * 1024)
        
        if file_size_mb > 10:
            raise HTTPException(status_code=400, detail=f"File size ({file_size_mb:.2f} MB) exceeds maximum allowed (10 MB)")
        
        # Determine folder - use explicit folder if provided, otherwise use documentType mapping
        if folder:
            target_folder = folder
        else:
            folder_map = {
                "cv": "cvs",
                "document": "documents",
                "deliverable": "deliverables",
                "intake": "intake-forms"
            }
            target_folder = folder_map.get(documentType, "general")
        
        # Upload file to Supabase
        logger.info(f"📤 Uploading file: {file.filename} ({file_size_mb:.2f} MB) to folder: {target_folder}")
        result = supabase_upload(file_content, file.filename, target_folder)
        
        if not result.get("success"):
            error_msg = result.get("error", "Unknown error")
            logger.error(f"❌ Upload failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"File upload failed: {error_msg}")
        
        logger.info(f"✅ File uploaded successfully: {result['fileUrl']}")
        
        return {
            "success": True,
            "publicUrl": result["fileUrl"],
            "filePath": result["filePath"],
            "fileName": file.filename,
            "fileSize": len(file_content),
            "documentType": documentType
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in upload endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")


# ===== CASE NOTES ENDPOINTS =====

@api_router.get("/admin/cases/{case_id}/notes")
async def get_case_notes(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get notes for a visa case. Deleted notes only visible to admin/super_admin."""
    role = staff_payload.get('role', '')
    is_admin = role in ('admin', 'super_admin')

    query = {"caseId": case_id}
    if not is_admin:
        query["deleted"] = {"$ne": True}

    notes = await db.case_notes.find(query, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return {"success": True, "notes": notes}


class CaseNoteCreate(BaseModel):
    text: str

@api_router.post("/admin/cases/{case_id}/notes")
async def create_case_note(case_id: str, data: CaseNoteCreate, staff_payload: dict = Depends(verify_staff_token)):
    """Add a note to a visa case."""
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Texto de la nota requerido")

    note = {
        "id": str(uuid.uuid4()),
        "caseId": case_id,
        "content": data.text.strip(),
        "type": "manual",
        "category": "staff_note",
        "createdBy": {
            "id": staff_payload.get("id", ""),
            "name": staff_payload.get("name", ""),
            "email": staff_payload.get("email", ""),
            "role": staff_payload.get("role", ""),
        },
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "isAutomatic": False,
        "deleted": False,
        "deletedAt": None,
        "deletedBy": None,
    }

    await db.case_notes.insert_one(note)
    note.pop("_id", None)
    return {"success": True, "note": note}


@api_router.delete("/admin/cases/{case_id}/notes/{note_id}")
async def delete_case_note(case_id: str, note_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Soft-delete a note. Only the author or admin can delete. Admins can still see deleted notes."""
    note = await db.case_notes.find_one({"id": note_id, "caseId": case_id})
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    role = staff_payload.get('role', '')
    is_admin = role in ('admin', 'super_admin')
    is_author = note.get("createdBy", {}).get("id") == staff_payload.get("id")

    if not is_author and not is_admin:
        raise HTTPException(status_code=403, detail="Solo el autor o admin puede eliminar")

    await db.case_notes.update_one({"id": note_id}, {"$set": {
        "deleted": True,
        "deletedAt": datetime.now(timezone.utc).isoformat(),
        "deletedBy": {"id": staff_payload.get("id"), "name": staff_payload.get("name", ""), "role": role},
    }})

    return {"success": True, "message": "Nota eliminada"}


# ===== CASE ACTIVITIES ENDPOINT =====

@api_router.get("/admin/cases/{case_id}/activities")
async def get_case_activities(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token),
    limit: int = 20,
    page: int = 1
):
    """Get activity log for a case."""
    skip = (page - 1) * limit
    total = await db.case_activities.count_documents({"caseId": case_id})
    cursor = db.case_activities.find({"caseId": case_id}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit)
    activities = await cursor.to_list(length=limit)
    for a in activities:
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
    return {"activities": activities, "total": total, "page": page, "pages": (total + limit - 1) // limit if total > 0 else 1}


# ===== ADMIN DASHBOARD STATS =====

@api_router.get("/admin/dashboard/stats")
async def get_dashboard_stats(staff_payload: dict = Depends(verify_staff_token)):
    """Dashboard avanzado: métricas por tipo de caso + top 10 prioritarios."""
    from datetime import timedelta
    from collections import Counter
    now = datetime.now(timezone.utc)

    # Determinar si el usuario es admin completo o staff con vista restringida
    user_role = staff_payload.get("role", "")
    user_id = staff_payload.get("id", "")
    is_admin = user_role in ("super_admin", "admin", "manager")

    # ===== TAB 1: CASOS DE VISA (ETAPAS) =====
    # Admins ven todos; coordinadores/advisors solo ven sus casos asignados
    visa_filter = {"isMasterCase": {"$ne": True}, "overallProgress": {"$gt": 18}}
    if not is_admin:
        visa_filter["$or"] = [{"coordinatorId": user_id}, {"salesRepId": user_id}]

    visa_cases = await db.visa_cases.find(
        visa_filter,
        {"_id": 0, "id": 1, "userId": 1, "status": 1, "overallProgress": 1, "currentStage": 1,
         "visaType": 1, "coordinatorId": 1, "salesRepId": 1, "updatedAt": 1, "createdAt": 1,
         "clientName": 1, "user": 1, "paidAmount": 1, "remainingBalance": 1, "totalFee": 1}
    ).to_list(5000)

    visa_statuses = Counter(c.get("status", "unknown") for c in visa_cases)
    visa_types = Counter(c.get("visaType", "unknown") for c in visa_cases)
    visa_avg_progress = round(sum(c.get("overallProgress", 0) for c in visa_cases) / max(len(visa_cases), 1), 1)
    visa_total_paid = sum(c.get("paidAmount", 0) or 0 for c in visa_cases)
    visa_total_pending = sum(c.get("remainingBalance", 0) or 0 for c in visa_cases)

    # Batch lookup de nombres de clientes por userId
    raw_user_ids = [c.get("userId") for c in visa_cases if c.get("userId")]
    oid_ids, str_ids = [], []
    for uid in raw_user_ids:
        try:
            oid_ids.append(ObjectId(uid))
        except Exception:
            str_ids.append(uid)

    user_query = []
    if oid_ids:
        user_query.append({"_id": {"$in": oid_ids}})
    if str_ids:
        user_query.append({"id": {"$in": str_ids}})

    user_name_map = {}
    if user_query:
        user_docs = await db.users.find(
            {"$or": user_query} if len(user_query) > 1 else user_query[0],
            {"_id": 1, "id": 1, "name": 1}
        ).to_list(5000)
        for u in user_docs:
            name = u.get("name", "")
            if u.get("id"):
                user_name_map[str(u["id"])] = name
            if u.get("_id"):
                user_name_map[str(u["_id"])] = name

    def _client_name(c):
        uid = str(c.get("userId", ""))
        return user_name_map.get(uid) or (c.get("user") or {}).get("name") or c.get("clientName") or "Sin nombre"

    # "Por Coordinador": incluye TODOS los casos (con y sin progreso)
    # Admins ven todos; staff solo ven sus casos
    all_visa_filter = {"isMasterCase": {"$ne": True}}
    if not is_admin:
        all_visa_filter["$or"] = [{"coordinatorId": user_id}, {"salesRepId": user_id}]

    all_visa_cases = await db.visa_cases.find(
        all_visa_filter,
        {"_id": 0, "coordinatorId": 1, "salesRepId": 1}
    ).to_list(5000)

    coord_names = {}
    coord_counter = {}
    for c in all_visa_cases:
        cid = c.get("coordinatorId") or ""
        sid = c.get("salesRepId") or ""
        # Sin asignar = sin coordinador Y sin vendedor
        if not cid and not sid:
            key = "__unassigned__"
        else:
            key = cid if cid else "__unassigned__"
        coord_counter[key] = coord_counter.get(key, 0) + 1

    # Resolver nombres de coordinadores
    import re as _re
    _uuid_pattern = _re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', _re.I)
    for cid in coord_counter:
        if cid and cid != "__unassigned__":
            s = await db.staff.find_one({"_id": cid}, {"name": 1})
            if not s:
                s = await db.staff.find_one({"id": cid}, {"name": 1})
            if s and s.get("name"):
                coord_names[cid] = s["name"]
            elif _uuid_pattern.match(cid):
                # UUID no resuelto: mostrar primeros 8 chars como referencia
                coord_names[cid] = f"Staff #{cid[:8]}"
            else:
                # ID no UUID (ej: "auto", "admin-staff-001"): mostrar tal cual capitalizado
                coord_names[cid] = cid.replace("-", " ").title()

    # Construir byCoordinator con label legible
    visa_by_coord_display = {}
    for key, count in sorted(coord_counter.items(), key=lambda x: -x[1]):
        label = "Sin asignar" if key == "__unassigned__" else coord_names.get(key, key)
        visa_by_coord_display[label] = visa_by_coord_display.get(label, 0) + count

    # Top 10 prioritarios — ordenados por updatedAt más antiguo (más tiempo sin tocar)
    visa_sorted = sorted(visa_cases, key=lambda c: c.get("updatedAt", c.get("createdAt", "")) or "")
    visa_top10 = []
    for c in visa_sorted[:10]:
        updated = c.get("updatedAt") or c.get("createdAt") or ""
        days_ago = None
        if updated:
            try:
                dt = datetime.fromisoformat(str(updated).replace('Z', '+00:00')) if isinstance(updated, str) else updated
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                days_ago = (now - dt).days
            except:
                pass
        cid = c.get("coordinatorId", "")
        visa_top10.append({
            "id": c.get("id"), "name": _client_name(c), "status": c.get("status"),
            "progress": c.get("overallProgress", 0), "stage": c.get("currentStage"),
            "visaType": c.get("visaType"), "coordinator": coord_names.get(cid, ""),
            "daysInactive": days_ago, "updatedAt": str(updated) if updated else None,
        })

    # Casos con progreso > 0% que les falta coordinador O vendedor (o ambos)
    # Solo admins ven esta sección completa; staff no la necesita
    unattended_filter = {"isMasterCase": {"$ne": True}, "overallProgress": {"$gt": 18},
         "$or": [
             {"coordinatorId": {"$in": [None, ""]}},
             {"coordinatorId": {"$exists": False}},
             {"salesRepId": {"$in": [None, ""]}},
             {"salesRepId": {"$exists": False}},
         ]
        }
    all_visa_full = await db.visa_cases.find(
        unattended_filter if is_admin else {"_id": "skip"},
        {"_id": 0, "id": 1, "clientName": 1, "user": 1, "status": 1, "overallProgress": 1,
         "currentStage": 1, "visaType": 1, "coordinatorId": 1, "salesRepId": 1,
         "updatedAt": 1, "createdAt": 1}
    ).to_list(5000)

    unattended = []
    for c in all_visa_full:
        has_coord = bool(c.get("coordinatorId", ""))
        has_seller = bool(c.get("salesRepId", ""))
        # Excluir si tiene los dos asignados
        if has_coord and has_seller:
            continue
        updated = c.get("updatedAt") or c.get("createdAt") or ""
        days_ago = None
        if updated:
            try:
                dt = datetime.fromisoformat(str(updated).replace('Z', '+00:00')) if isinstance(updated, str) else updated
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                days_ago = (now - dt).days
            except:
                pass
        unattended.append({
            "id": c.get("id"),
            "name": _client_name(c),
            "status": c.get("status"),
            "progress": c.get("overallProgress") or 0,
            "stage": c.get("currentStage"),
            "visaType": c.get("visaType"),
            "hasCoord": has_coord,
            "hasSeller": has_seller,
            "daysInactive": days_ago,
            "updatedAt": str(updated) if updated else None,
        })

    # Appointments pending
    appts_pending = await db.appointments.count_documents({"status": "pending"})

    # ===== TAB 2: GESTION CLASICA (CHECKLIST) =====
    classic_cases = await db.classic_cases.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "status": 1, "workStatus": 1,
         "progress": 1, "progressCoordinator": 1, "progressArmador": 1,
         "coordinatorId": 1, "updatedAt": 1, "createdAt": 1, "lastContactAt": 1,
         "lastProgressChangeAt": 1, "filingDate": 1, "ioeNumber": 1,
         "rfeReceivedDate": 1, "rfeDeadline": 1, "processingType": 1}
    ).to_list(5000)

    classic_statuses = Counter(c.get("status", "unknown") for c in classic_cases)
    classic_work = Counter(c.get("workStatus", "unknown") for c in classic_cases)
    classic_avg_progress = round(sum(c.get("progress", 0) for c in classic_cases) / max(len(classic_cases), 1), 1)
    classic_avg_coord = round(sum(c.get("progressCoordinator", 0) for c in classic_cases) / max(len(classic_cases), 1), 1)
    classic_avg_arm = round(sum(c.get("progressArmador", 0) for c in classic_cases) / max(len(classic_cases), 1), 1)

    # Alertas
    rfe_activos = sum(1 for c in classic_cases if c.get("status") == "rfe_recibido")
    enviados_sin_ioe = sum(1 for c in classic_cases if c.get("status") == "radicado" and not c.get("ioeNumber"))
    sin_contacto_5d = 0
    estancados_7d = 0
    for c in classic_cases:
        lc = c.get("lastContactAt") or c.get("createdAt")
        lp = c.get("lastProgressChangeAt") or c.get("createdAt")
        if lc:
            try:
                dt = datetime.fromisoformat(str(lc).replace('Z', '+00:00')) if isinstance(lc, str) else lc
                if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                if (now - dt).days >= 5: sin_contacto_5d += 1
            except: pass
        if lp:
            try:
                dt = datetime.fromisoformat(str(lp).replace('Z', '+00:00')) if isinstance(lp, str) else lp
                if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                if (now - dt).days >= 7: estancados_7d += 1
            except: pass

    # Classic coordinators
    classic_by_coord = Counter(c.get("coordinatorId", "unassigned") for c in classic_cases)
    for cid in classic_by_coord:
        if cid and cid != "unassigned" and cid not in coord_names:
            s = await db.staff.find_one({"_id": cid}, {"name": 1})
            coord_names[cid] = s.get("name", cid) if s else cid

    # Top 10 prioritarios clásicos — más tiempo sin actualizar
    classic_sorted = sorted(classic_cases, key=lambda c: c.get("updatedAt", c.get("createdAt", "")) or "")
    classic_top10 = []
    for c in classic_sorted[:10]:
        updated = c.get("updatedAt") or c.get("createdAt") or ""
        days_ago = None
        if updated:
            try:
                dt = datetime.fromisoformat(str(updated).replace('Z', '+00:00')) if isinstance(updated, str) else updated
                if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                days_ago = (now - dt).days
            except: pass
        cid = c.get("coordinatorId", "")
        classic_top10.append({
            "id": c.get("id"), "name": c.get("name", "Sin nombre"), "status": c.get("status"),
            "workStatus": c.get("workStatus"), "progress": c.get("progress", 0),
            "progressCoordinator": c.get("progressCoordinator", 0), "progressArmador": c.get("progressArmador", 0),
            "coordinator": coord_names.get(cid, ""), "daysInactive": days_ago,
            "rfeDeadline": c.get("rfeDeadline"), "ioeNumber": c.get("ioeNumber"),
            "lastContactAt": str(c.get("lastContactAt", "")) if c.get("lastContactAt") else None,
        })

    return {
        "visaCases": {
            "total": len(visa_cases),
            "statuses": dict(visa_statuses),
            "visaTypes": dict(visa_types),
            "avgProgress": visa_avg_progress,
            "totalPaid": visa_total_paid,
            "totalPending": visa_total_pending,
            "byCoordinator": visa_by_coord_display,
            "appointmentsPending": appts_pending,
            "unattended": unattended,
            "top10": visa_top10,
        },
        "classicCases": {
            "total": len(classic_cases),
            "statuses": dict(classic_statuses),
            "workStatuses": dict(classic_work),
            "avgProgress": classic_avg_progress,
            "avgCoordinator": classic_avg_coord,
            "avgArmador": classic_avg_arm,
            "alerts": {
                "rfeActivos": rfe_activos,
                "enviadosSinIoe": enviados_sin_ioe,
                "sinContacto5d": sin_contacto_5d,
                "estancados7d": estancados_7d,
            },
            "byCoordinator": {coord_names.get(k, k): v for k, v in classic_by_coord.most_common(10)},
            "top10": classic_top10,
        },
    }


@api_router.get("/admin/dashboard/recent-activity")
async def get_dashboard_recent_activity(staff_payload: dict = Depends(verify_staff_token), limit: int = 10):
    """Get recent activity across all cases."""
    cursor = db.case_activities.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    activities = await cursor.to_list(length=limit)
    for a in activities:
        if isinstance(a.get("timestamp"), datetime):
            a["timestamp"] = a["timestamp"].isoformat()
    return {"activity": activities}


@api_router.post("/admin/backfill-activity-dates")
async def backfill_activity_dates(secret: str = ""):
    """
    Migración única: actualiza updatedAt de todos los casos con la fecha real
    de última actividad (documentos, notas, checklists, auditoría, etc.).
    Protegido por ADMIN_OPERATIONS_TOKEN como query param ?secret=...
    """
    expected = os.environ.get("ADMIN_OPERATIONS_TOKEN", "")
    if not expected or secret != expected:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    def _to_dt(val):
        """Convierte string ISO o datetime a datetime con timezone UTC."""
        if val is None:
            return None
        if isinstance(val, datetime):
            return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
        try:
            s = str(val).replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:
            return None

    now = datetime.now(timezone.utc)
    visa_updated = 0
    classic_updated = 0
    results = []

    # ===== CASOS DE VISA =====
    visa_cases = await db.visa_cases.find(
        {"isMasterCase": {"$ne": True}},
        {"_id": 0, "id": 1, "updatedAt": 1, "createdAt": 1}
    ).to_list(5000)

    for case in visa_cases:
        case_id = case.get("id")
        if not case_id:
            continue

        candidates = []

        # 1. updatedAt actual del caso
        c = _to_dt(case.get("updatedAt") or case.get("createdAt"))
        if c:
            candidates.append(c)

        # 2. Último log de auditoría
        audit = await db.case_audit_logs.find_one(
            {"caseId": case_id}, sort=[("timestamp", -1)]
        )
        if audit:
            c = _to_dt(audit.get("timestamp"))
            if c:
                candidates.append(c)

        # 3. Último entregable subido (uploadedAt o updatedAt)
        deliv = await db.visa_deliverables.find_one(
            {"caseId": case_id, "$or": [{"uploadedAt": {"$exists": True}}, {"updatedAt": {"$exists": True}}]},
            sort=[("uploadedAt", -1)]
        )
        if deliv:
            c = _to_dt(deliv.get("uploadedAt") or deliv.get("updatedAt"))
            if c:
                candidates.append(c)

        # 4. Última actividad en case_activities
        act = await db.case_activities.find_one(
            {"caseId": case_id}, sort=[("timestamp", -1)]
        )
        if act:
            c = _to_dt(act.get("timestamp"))
            if c:
                candidates.append(c)

        # 5. Última nota de coordinador (case_notes)
        note = await db.case_notes.find_one(
            {"caseId": case_id}, sort=[("createdAt", -1)]
        )
        if note:
            c = _to_dt(note.get("createdAt") or note.get("updatedAt"))
            if c:
                candidates.append(c)

        if candidates:
            latest = max(candidates)
            # Solo actualizar si hay cambio significativo (> 1 min de diferencia)
            existing = _to_dt(case.get("updatedAt"))
            if existing is None or (latest - existing).total_seconds() > 60:
                new_val = latest.isoformat()
                await db.visa_cases.update_one(
                    {"id": case_id},
                    {"$set": {"updatedAt": new_val}}
                )
                visa_updated += 1
                results.append({
                    "type": "visa", "id": case_id,
                    "before": existing.isoformat() if existing else None,
                    "after": new_val
                })

    # ===== GESTIÓN CLÁSICA =====
    classic_cases = await db.classic_cases.find(
        {}, {"_id": 0, "id": 1, "updatedAt": 1, "createdAt": 1, "lastContactAt": 1, "lastProgressChangeAt": 1}
    ).to_list(5000)

    for case in classic_cases:
        case_id = case.get("id")
        if not case_id:
            continue

        candidates = []

        # 1. updatedAt actual
        for field in ("updatedAt", "lastProgressChangeAt", "lastContactAt", "createdAt"):
            c = _to_dt(case.get(field))
            if c:
                candidates.append(c)

        # 2. Última entrada en timeline
        tl = await db.classic_case_timeline.find_one(
            {"caseId": case_id}, sort=[("timestamp", -1)]
        )
        if tl:
            c = _to_dt(tl.get("timestamp"))
            if c:
                candidates.append(c)

        # 3. Última nota
        note = await db.classic_case_notes.find_one(
            {"caseId": case_id}, sort=[("createdAt", -1)]
        )
        if note:
            c = _to_dt(note.get("createdAt"))
            if c:
                candidates.append(c)

        # 4. Último contacto registrado
        contact = await db.classic_case_contacts.find_one(
            {"caseId": case_id}, sort=[("createdAt", -1)]
        )
        if contact:
            c = _to_dt(contact.get("createdAt"))
            if c:
                candidates.append(c)

        if candidates:
            latest = max(candidates)
            existing = _to_dt(case.get("updatedAt"))
            if existing is None or (latest - existing).total_seconds() > 60:
                new_val = latest.isoformat()
                await db.classic_cases.update_one(
                    {"id": case_id},
                    {"$set": {"updatedAt": new_val}}
                )
                classic_updated += 1
                results.append({
                    "type": "classic", "id": case_id,
                    "before": existing.isoformat() if existing else None,
                    "after": new_val
                })

    return {
        "success": True,
        "summary": {
            "visaCasesUpdated": visa_updated,
            "classicCasesUpdated": classic_updated,
            "totalUpdated": visa_updated + classic_updated,
            "totalVisaProcessed": len(visa_cases),
            "totalClassicProcessed": len(classic_cases),
        },
        "details": results
    }


# ===== USER CVs ENDPOINTS =====

@api_router.get("/client/my-cvs")
async def get_my_cvs(user_payload: dict = Depends(verify_token_header)):
    """Get CVs for the logged-in user."""
    user_id = user_payload.get('id')
    cvs = await db.user_cvs.find({"userId": user_id}, {"_id": 0}).sort("uploadedAt", -1).to_list(length=100)
    return {"success": True, "cvs": cvs, "total": len(cvs)}

@api_router.get("/admin/users/{user_id}/cvs")
async def get_user_cvs(user_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get all CVs uploaded for a specific user."""
    cvs = await db.user_cvs.find({"userId": user_id}, {"_id": 0}).sort("uploadedAt", -1).to_list(length=100)
    return {"success": True, "cvs": cvs, "total": len(cvs)}


@api_router.post("/admin/users/{user_id}/cvs")
async def add_user_cv(
    user_id: str,
    file: UploadFile = File(...),
    staff_payload: dict = Depends(verify_staff_token)
):
    """Upload a new CV for a user and add it to their CV list."""
    from storage_service import upload_file as supabase_upload

    user = await db.users.find_one({"$or": [{"_id": user_id}, {"id": user_id}]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no debe superar 10MB")

    result = supabase_upload(file_content, file.filename, "cvs")
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=f"Error al subir: {result.get('error')}")

    cv_record = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "url": result["fileUrl"],
        "fileName": file.filename,
        "fileSize": len(file_content),
        "uploadedBy": {
            "id": staff_payload['id'],
            "name": staff_payload.get('name', 'Staff'),
            "email": staff_payload.get('email', '')
        },
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "active": True
    }
    await db.user_cvs.insert_one(cv_record)
    cv_record.pop("_id", None)

    # Also update the user's cvUrl with the latest
    await db.users.update_one(
        {"$or": [{"_id": user_id}, {"id": user_id}]},
        {"$set": {"cvUrl": result["fileUrl"], "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )

    return {"success": True, "cv": cv_record, "message": "CV subido exitosamente"}


@api_router.delete("/admin/users/{user_id}/cvs/{cv_id}")
async def delete_user_cv(user_id: str, cv_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Delete a CV from a user's CV list."""
    result = await db.user_cvs.delete_one({"id": cv_id, "userId": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="CV no encontrado")
    return {"success": True, "message": "CV eliminado"}


# Admin Profile Management
class AdminProfileUpdateRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

@api_router.put("/admin/profile")
async def update_admin_profile(
    profile_data: AdminProfileUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update admin profile"""
    try:
        admin_id = staff_payload['id']
        
        # Check if email is already used by another admin
        if profile_data.email:
            existing = await db.staff.find_one({
                'email': profile_data.email,
                '_id': {'$ne': admin_id}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
        
        # Update profile
        update_data = {
            'name': profile_data.name,
            'email': profile_data.email,
            'phone': profile_data.phone
        }
        
        result = await db.staff.update_one(
            {'_id': admin_id},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        # Get updated admin
        updated_admin = await db.staff.find_one({'_id': admin_id})
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=admin_id,
            action='update',
            resource='admin_profile',
            details={'updated_fields': list(update_data.keys())}
        )
        await db.activity_log.insert_one(log)
        
        return serialize_staff(updated_admin)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update admin profile error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


class AdminChangePasswordRequest(BaseModel):
    newPassword: str

@api_router.put("/admin/change-password")
async def change_admin_password(
    password_data: AdminChangePasswordRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Change admin password - no current password required since user is already authenticated"""
    try:
        admin_id = staff_payload['id']
        
        # Get current admin
        admin = await db.staff.find_one({'_id': admin_id})
        if not admin:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        # Validate new password length
        if len(password_data.newPassword) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        
        # Hash new password
        hashed_password = pwd_context.hash(password_data.newPassword)
        
        # Update password (update both fields for compatibility)
        result = await db.staff.update_one(
            {'_id': admin_id},
            {'$set': {
                'passwordHash': hashed_password,
                'password': hashed_password  # For backward compatibility
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update password")
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=admin_id,
            action='change_password',
            resource='admin_security'
        )
        await db.activity_log.insert_one(log)
        
        return {'message': 'Password changed successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change admin password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")


# ===== Staff Management Endpoints =====

@api_router.get("/admin/staff")
async def get_all_staff(
    staff_payload: dict = Depends(verify_staff_token),
    page: int = 1,
    limit: int = 50,
    search: str = None,
    role: str = None,
    department: str = None
):
    """Get list of all staff members (with pagination and filters)"""
    try:
        # Verificar permisos usando RBAC
        user_role = staff_payload.get('role', 'advisor')
        
        if not has_permission(user_role, 'view_all_staff') and not has_permission(user_role, 'view_department_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to view staff")
        
        # Construir query
        query = {}
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'phone': {'$regex': search, '$options': 'i'}}
            ]
        if role:
            query['role'] = role
        if department and department != 'all':
            query['department'] = department
        
        # Si no tiene permiso para ver todo el staff, filtrar por departamento
        if not has_permission(user_role, 'view_all_staff'):
            if has_permission(user_role, 'view_department_staff'):
                query['department'] = staff_payload.get('department')
        
        # Paginación
        skip = (page - 1) * limit
        
        # Obtener staff y total
        staff_list = await db.staff.find(query).skip(skip).limit(limit).to_list(length=limit)
        total = await db.staff.count_documents(query)
        
        # Serializar
        staff_serialized = [serialize_staff(s) for s in staff_list]
        
        # Enrich with case counts
        staff_ids = [s['_id'] for s in staff_serialized]
        if staff_ids:
            # Visa cases count per staff (coordinator or salesRep)
            visa_pipeline = [
                {"$match": {"$or": [{"coordinatorId": {"$in": staff_ids}}, {"salesRepId": {"$in": staff_ids}}]}},
                {"$project": {"coordinatorId": 1, "salesRepId": 1}},
            ]
            visa_cases_list = await db.visa_cases.aggregate(visa_pipeline).to_list(length=100000)
            visa_counts = {}
            for vc in visa_cases_list:
                cid = vc.get("coordinatorId", "")
                sid = vc.get("salesRepId", "")
                if cid in staff_ids:
                    visa_counts[cid] = visa_counts.get(cid, 0) + 1
                if sid in staff_ids and sid != cid:
                    visa_counts[sid] = visa_counts.get(sid, 0) + 1

            # Classic cases count per staff
            classic_pipeline = [
                {"$match": {"coordinatorId": {"$in": staff_ids}}},
                {"$group": {"_id": "$coordinatorId", "count": {"$sum": 1}}},
            ]
            classic_agg = await db.classic_cases.aggregate(classic_pipeline).to_list(length=1000)
            classic_counts = {c["_id"]: c["count"] for c in classic_agg}

            for s in staff_serialized:
                s["visaCasesCount"] = visa_counts.get(s["_id"], 0)
                s["classicCasesCount"] = classic_counts.get(s["_id"], 0)
        
        return {
            'staff': staff_serialized,
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
        logger.error(f"Get staff error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get staff list: {str(e)}")


@api_router.get("/admin/advisors")
async def get_unique_advisors(
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get list of unique advisor names from users (for filtering visa cases)"""
    try:
        # Obtener todos los usuarios que tienen advisor definido
        users_with_advisor = await db.users.find(
            {'advisor': {'$exists': True, '$ne': None}},
            {'advisor': 1}
        ).to_list(length=10000)
        
        # Extraer nombres únicos de advisors
        advisor_names = set()
        for user in users_with_advisor:
            advisor = user.get('advisor')
            if advisor:
                if isinstance(advisor, dict):
                    name = advisor.get('name')
                    if name:
                        advisor_names.add(name)
                elif isinstance(advisor, str):
                    advisor_names.add(advisor)
        
        # Ordenar y retornar
        sorted_advisors = sorted(list(advisor_names))
        
        return {
            'success': True,
            'advisors': sorted_advisors,
            'total': len(sorted_advisors)
        }
        
    except Exception as e:
        logger.error(f"Get advisors error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get advisors: {str(e)}")


@api_router.get("/admin/users")
async def get_all_users(
    staff_payload: dict = Depends(verify_staff_token),
    page: int = 1,
    limit: int = 50,
    search: str = None,
    user_state: str = None
):
    """Get list of all users/clients (with pagination and filters)"""
    try:
        # Verificar permisos usando RBAC
        user_role = staff_payload.get('role', 'advisor')
        
        if not has_permission(user_role, 'view_all_users') and not has_permission(user_role, 'view_assigned_users'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to view users")
        
        # Construir query
        query = {}
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'phone': {'$regex': search, '$options': 'i'}}
            ]
        if user_state:
            query['userState'] = user_state
        
        # Si no tiene permiso para ver todos los usuarios, filtrar por asignados
        if not has_permission(user_role, 'view_all_users'):
            if has_permission(user_role, 'view_assigned_users'):
                query['assignedAdvisor'] = staff_payload['id']
        
        # Paginación
        skip = (page - 1) * limit
        
        # Obtener usuarios y total
        users_list = await db.users.find(query).skip(skip).limit(limit).to_list(length=limit)
        total = await db.users.count_documents(query)
        
        # Serializar usuarios con conteo de casos
        users_serialized = []
        for user in users_list:
            user_id = str(user['_id'])
            
            # Contar casos asociados al usuario
            cases_count = await db.visa_cases.count_documents({'userId': user_id})
            
            user_dict = {
                '_id': user_id,
                'id': user_id,
                'name': user.get('name', ''),
                'email': user.get('email', ''),
                'phone': user.get('phone', ''),
                'profession': user.get('profession', ''),
                'userState': user.get('userState', 'U1'),
                'casesCount': cases_count,  # Agregar conteo de casos
                'language': user.get('language', 'es'),
                'createdAt': user.get('createdAt', ''),
                'updatedAt': user.get('updatedAt', '')
            }
            users_serialized.append(user_dict)
        
        return {
            'users': users_serialized,
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
        logger.error(f"Get users error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get users list: {str(e)}")


@api_router.get("/admin/users/{user_id}")
async def get_user_by_id(
    user_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get detailed information about a specific user"""
    try:
        # Verificar permisos
        user_role = staff_payload.get('role', 'advisor')
        
        if not has_permission(user_role, 'view_all_users') and not has_permission(user_role, 'view_assigned_users'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to view user details")
        
        # Buscar usuario por _id (ObjectId)
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except:
            # Si falla con ObjectId, intentar con el campo 'id' (string)
            user = await db.users.find_one({"id": user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found with ID: {user_id}")
        
        # Serializar usuario
        user_id_str = str(user['_id'])
        user_dict = {
            '_id': user_id_str,
            'id': user_id_str,
            'name': user.get('name', ''),
            'email': user.get('email', ''),
            'phone': user.get('phone', ''),
            'profession': user.get('profession', ''),
            'userState': user.get('userState', 'U1'),
            'language': user.get('language', 'es'),
            'createdAt': user.get('createdAt', ''),
            'updatedAt': user.get('updatedAt', '')
        }
        
        return user_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user by ID error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get user details: {str(e)}")


@api_router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: dict,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Update user information.
    Requires admin or super_admin role.
    """
    try:
        # Verificar permisos
        user_role = staff_payload.get('role', 'advisor')
        if user_role not in ['admin', 'super_admin', 'coordinator']:
            raise HTTPException(
                status_code=403, 
                detail="No tienes permisos para editar usuarios"
            )
        
        # Buscar usuario por _id o id string
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except:
            user = await db.users.find_one({"id": user_id})
        
        if not user:
            raise HTTPException(
                status_code=404, 
                detail=f"Usuario no encontrado con ID: {user_id}"
            )
        
        # Campos permitidos para actualizar
        allowed_fields = ['name', 'email', 'phone', 'profession', 'userState', 'cvUrl', 'notes']
        update_fields = {k: v for k, v in update_data.items() if k in allowed_fields and v is not None}
        
        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail="No se proporcionaron campos válidos para actualizar"
            )
        
        # Validar teléfono único si se está actualizando
        if 'phone' in update_fields and update_fields['phone']:
            import re
            new_phone = update_fields['phone']
            
            # Validar formato del teléfono
            if not re.match(r'^\d{10,15}$', new_phone):
                raise HTTPException(
                    status_code=400,
                    detail="El número de teléfono debe contener solo dígitos (10-15), incluyendo código de área. Ejemplo: 584124248787"
                )
            
            # Verificar que no exista otro usuario con el mismo teléfono
            existing_user = await db.users.find_one({
                'phone': new_phone,
                '_id': {'$ne': user['_id']}
            })
            
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ya existe otro usuario con el número de teléfono {new_phone}"
                )
        
        # Agregar timestamp de actualización
        update_fields['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        # Actualizar usuario
        try:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": update_fields}
            )
        except Exception as e:
            if 'duplicate key' in str(e).lower() or 'E11000' in str(e):
                raise HTTPException(
                    status_code=400,
                    detail="El número de teléfono ya está en uso por otro usuario"
                )
            raise
        
        # Obtener usuario actualizado
        updated_user = await db.users.find_one({"_id": user["_id"]}, {"_id": 0})
        
        logger.info(f"✅ User updated: {user_id} by {staff_payload.get('email')}")
        
        return {
            "success": True,
            "message": "Usuario actualizado exitosamente",
            "user": updated_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar usuario: {str(e)}"
        )


@api_router.post("/admin/migrations/unique-phone-index")
async def run_unique_phone_migration(
    request: Request,
    dry_run: bool = True
):
    """
    Run migration to create unique index on phone field.
    Requires URPE_ADMIN_TOKEN or super_admin role.
    
    Parameters:
    - dry_run: If True (default), only shows what would be changed without applying
    
    Authentication:
    - Header: X-Admin-Token: {URPE_ADMIN_TOKEN}
    - Or: Authorization: Bearer {JWT token de super_admin}
    """
    try:
        # Verificar autenticación
        admin_token = request.headers.get('X-Admin-Token')
        auth_header = request.headers.get('Authorization')
        
        URPE_ADMIN_TOKEN = os.environ.get('URPE_ADMIN_TOKEN', '')
        
        is_authorized = False
        auth_source = ""
        
        # Opción 1: X-Admin-Token header
        if admin_token and admin_token == URPE_ADMIN_TOKEN:
            is_authorized = True
            auth_source = "URPE_ADMIN_TOKEN"
        
        # Opción 2: Bearer token de super_admin
        elif auth_header and auth_header.startswith('Bearer '):
            try:
                token = auth_header.split(' ')[1]
                payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                if payload.get('role') == 'super_admin':
                    is_authorized = True
                    auth_source = f"super_admin: {payload.get('email')}"
            except:
                pass
        
        if not is_authorized:
            raise HTTPException(
                status_code=403, 
                detail="Se requiere URPE_ADMIN_TOKEN o token de super_admin para ejecutar migraciones"
            )
        
        results = {
            "mode": "DRY RUN" if dry_run else "EXECUTE",
            "duplicates_found": [],
            "users_modified": 0,
            "index_created": False,
            "index_already_exists": False,
            "errors": []
        }
        
        # Step 1: Check if index already exists
        existing_indexes = await db.users.index_information()
        if 'phone_unique_idx' in existing_indexes:
            results["index_already_exists"] = True
            results["message"] = "El índice único de teléfono ya existe. No se requiere migración."
            return results
        
        # Step 2: Find duplicates
        pipeline = [
            {'$match': {'phone': {'$ne': None, '$ne': '', '$exists': True}}},
            {'$group': {
                '_id': '$phone',
                'count': {'$sum': 1},
                'users': {'$push': {'_id': '$_id', 'id': '$id', 'email': '$email', 'name': '$name', 'createdAt': '$createdAt'}}
            }},
            {'$match': {'count': {'$gt': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        duplicates = await db.users.aggregate(pipeline).to_list(1000)
        
        for dup in duplicates:
            phone = dup['_id']
            users = dup['users']
            
            # Sort by createdAt (oldest first)
            def get_date(u):
                created = u.get('createdAt')
                if created:
                    if isinstance(created, str):
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                            return dt.replace(tzinfo=None) if dt.tzinfo else dt
                        except:
                            return datetime.min
                    if hasattr(created, 'tzinfo') and created.tzinfo:
                        return created.replace(tzinfo=None)
                    return created
                from datetime import datetime
                return datetime.min
            
            users_sorted = sorted(users, key=get_date)
            keep_user = users_sorted[0]
            duplicate_users = users_sorted[1:]
            
            dup_info = {
                "phone": phone,
                "keep": {"email": keep_user.get('email'), "id": str(keep_user.get('_id'))},
                "modify": []
            }
            
            for idx, user in enumerate(duplicate_users, 1):
                new_phone = f"{phone}_duplicate_{idx}"
                dup_info["modify"].append({
                    "email": user.get('email'),
                    "id": str(user.get('_id')),
                    "new_phone": new_phone
                })
                
                if not dry_run:
                    await db.users.update_one(
                        {'_id': user['_id']},
                        {'$set': {
                            'phone': new_phone,
                            'phone_duplicate_original': phone,
                            'updatedAt': datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    results["users_modified"] += 1
            
            results["duplicates_found"].append(dup_info)
        
        # Step 3: Handle empty phone strings
        if not dry_run:
            empty_result = await db.users.update_many(
                {'phone': ''},
                {'$set': {'phone': None}}
            )
            if empty_result.modified_count > 0:
                results["empty_phones_converted"] = empty_result.modified_count
        
        # Step 4: Create unique index
        if not dry_run:
            try:
                await db.users.create_index(
                    [('phone', 1)],
                    unique=True,
                    name='phone_unique_idx',
                    partialFilterExpression={'phone': {'$type': 'string', '$gt': ''}}
                )
                results["index_created"] = True
                logger.info(f"✅ Migration: Unique phone index created by {auth_source}")
            except Exception as e:
                results["errors"].append(f"Error creating index: {str(e)}")
        
        # Summary message
        if dry_run:
            results["message"] = f"DRY RUN: Se encontraron {len(results['duplicates_found'])} teléfonos duplicados. Ejecutar con dry_run=false para aplicar cambios."
        else:
            results["message"] = f"Migración completada. {results['users_modified']} usuarios modificados. Índice único creado: {results['index_created']}"
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in migration: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error en migración: {str(e)}"
        )


# =====================================================
# MASTER CASE EXPORT/IMPORT ENDPOINTS
# =====================================================

@api_router.get("/admin/master-case/export")
async def export_master_case():
    """
    Exportar el caso maestro completo: caso, etapas, entregables, documentos requeridos y documentos legales.
    Retorna JSON con todos los datos del caso maestro.
    """
    try:
        # Buscar caso maestro
        master_case = await db.visa_cases.find_one({'_id': 'master_case_eb2_niw'})
        
        if not master_case:
            raise HTTPException(
                status_code=404,
                detail="No se encontró el caso maestro"
            )
        
        # Buscar etapas del caso maestro
        stages_cursor = db.visa_stages.find({'caseId': 'master_case_eb2_niw'})
        master_stages = await stages_cursor.to_list(100)
        
        # Buscar deliverables del caso maestro
        deliverables_cursor = db.visa_deliverables.find({'caseId': 'master_case_eb2_niw'})
        master_deliverables = await deliverables_cursor.to_list(500)
        
        # Buscar documentos requeridos del cliente (visa_client_documents) del master case
        client_docs_cursor = db.visa_client_documents.find({'caseId': 'master_case_eb2_niw'})
        client_documents = await client_docs_cursor.to_list(100)
        
        # Buscar documentos legales adicionales (si existen)
        legal_docs_cursor = db.legal_documents.find({})
        legal_documents = await legal_docs_cursor.to_list(100)
        
        # Convertir ObjectId a string
        for stage in master_stages:
            if '_id' in stage:
                stage['_id'] = str(stage['_id'])
        
        for deliverable in master_deliverables:
            if '_id' in deliverable:
                deliverable['_id'] = str(deliverable['_id'])
        
        for doc in client_documents:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        for doc in legal_documents:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        
        export_data = {
            'exportedAt': datetime.now(timezone.utc).isoformat(),
            'masterCase': master_case,
            'masterStages': master_stages,
            'masterDeliverables': master_deliverables,
            'clientDocuments': client_documents,  # Documentos requeridos del master case (13 docs)
            'legalDocuments': legal_documents,    # Documentos legales adicionales (4 docs)
            'summary': {
                'caseId': master_case.get('_id'),
                'visaType': master_case.get('visaType'),
                'totalStages': len(master_stages),
                'totalDeliverables': len(master_deliverables),
                'totalClientDocuments': len(client_documents),
                'totalLegalDocuments': len(legal_documents)
            }
        }
        
        logger.info(f"✅ Master case exported - {len(master_stages)} stages, {len(master_deliverables)} deliverables, {len(client_documents)} client docs, {len(legal_documents)} legal docs")
        
        return export_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting master case: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al exportar caso maestro: {str(e)}"
        )


@api_router.post("/admin/master-case/import")
async def import_master_case(
    request: Request,
    force: bool = False
):
    """
    Importar el caso maestro completo: caso, etapas, entregables, documentos requeridos y documentos legales.
    
    Body: JSON con masterCase, masterStages, masterDeliverables, clientDocuments, legalDocuments
    Query param: force=true para sobrescribir existente
    """
    try:
        # Obtener datos del body
        import_data = await request.json()
        
        master_case = import_data.get('masterCase')
        master_stages = import_data.get('masterStages', [])
        master_deliverables = import_data.get('masterDeliverables', [])
        client_documents = import_data.get('clientDocuments', [])  # Documentos requeridos del master case
        legal_documents = import_data.get('legalDocuments', [])
        
        if not master_case:
            raise HTTPException(
                status_code=400,
                detail="Se requiere masterCase en el body"
            )
        
        # Verificar si ya existe
        existing_case = await db.visa_cases.find_one({'_id': 'master_case_eb2_niw'})
        
        if existing_case and not force:
            raise HTTPException(
                status_code=409,
                detail="Ya existe un caso maestro. Usa ?force=true para sobrescribir"
            )
        
        results = {
            'previousCaseDeleted': False,
            'previousStagesDeleted': 0,
            'previousDeliverablesDeleted': 0,
            'previousClientDocsDeleted': 0,
            'previousLegalDocsDeleted': 0,
            'caseImported': False,
            'stagesImported': 0,
            'deliverablesImported': 0,
            'clientDocsImported': 0,
            'legalDocsImported': 0
        }
        
        # Eliminar existente si force=true
        if existing_case and force:
            await db.visa_cases.delete_one({'_id': 'master_case_eb2_niw'})
            results['previousCaseDeleted'] = True
            
            stages_result = await db.visa_stages.delete_many({'caseId': 'master_case_eb2_niw'})
            results['previousStagesDeleted'] = stages_result.deleted_count
            
            deliverables_result = await db.visa_deliverables.delete_many({'caseId': 'master_case_eb2_niw'})
            results['previousDeliverablesDeleted'] = deliverables_result.deleted_count
            
            # Eliminar documentos requeridos del master case
            client_docs_result = await db.visa_client_documents.delete_many({'caseId': 'master_case_eb2_niw'})
            results['previousClientDocsDeleted'] = client_docs_result.deleted_count
            
            # Eliminar documentos legales existentes
            legal_result = await db.legal_documents.delete_many({})
            results['previousLegalDocsDeleted'] = legal_result.deleted_count
        
        # Insertar caso maestro
        await db.visa_cases.insert_one(master_case)
        results['caseImported'] = True
        
        # Insertar etapas
        if master_stages:
            for stage in master_stages:
                if '_id' in stage and isinstance(stage['_id'], str):
                    try:
                        stage['_id'] = ObjectId(stage['_id'])
                    except:
                        pass
            
            await db.visa_stages.insert_many(master_stages)
            results['stagesImported'] = len(master_stages)
        
        # Insertar deliverables
        if master_deliverables:
            for deliverable in master_deliverables:
                if '_id' in deliverable and isinstance(deliverable['_id'], str):
                    try:
                        deliverable['_id'] = ObjectId(deliverable['_id'])
                    except:
                        pass
            
            await db.visa_deliverables.insert_many(master_deliverables)
            results['deliverablesImported'] = len(master_deliverables)
        
        # Insertar documentos requeridos del cliente (visa_client_documents)
        if client_documents:
            for doc in client_documents:
                if '_id' in doc and isinstance(doc['_id'], str):
                    try:
                        doc['_id'] = ObjectId(doc['_id'])
                    except:
                        pass
            
            await db.visa_client_documents.insert_many(client_documents)
            results['clientDocsImported'] = len(client_documents)
        
        # Insertar documentos legales
        if legal_documents:
            for doc in legal_documents:
                if '_id' in doc and isinstance(doc['_id'], str):
                    try:
                        doc['_id'] = ObjectId(doc['_id'])
                    except:
                        pass
            
            await db.legal_documents.insert_many(legal_documents)
            results['legalDocsImported'] = len(legal_documents)
        
        logger.info(f"✅ Master case imported - {results['stagesImported']} stages, {results['deliverablesImported']} deliverables, {results['clientDocsImported']} client docs, {results['legalDocsImported']} legal docs")
        
        return {
            'success': True,
            'message': 'Caso maestro importado exitosamente',
            'results': results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing master case: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al importar caso maestro: {str(e)}"
        )


@api_router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Delete a user and all related data (cases, stages, deliverables, documents, payments).
    Requires admin or super_admin role.
    """
    try:
        # Verificar permisos - solo admin y super_admin pueden eliminar
        user_role = staff_payload.get('role', 'advisor')
        if user_role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=403, 
                detail="Only admin and super_admin can delete users"
            )
        
        # Buscar usuario - soporta tanto ObjectId como UUID string
        user = None
        try:
            # Intentar primero como ObjectId
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except:
            pass
        
        if not user:
            # Intentar como string (UUID)
            user = await db.users.find_one({"_id": user_id})
        
        if not user:
            raise HTTPException(
                status_code=404, 
                detail=f"User not found with ID: {user_id}"
            )
        
        actual_user_id = user.get('_id')  # Usar el ID real del documento
        user_name = user.get('name', 'Unknown')
        user_email = user.get('email', 'N/A')
        
        deletion_summary = {
            "user": {
                "name": user_name,
                "email": user_email,
                "phone": user.get('phone', 'N/A'),
                "id": str(actual_user_id)
            },
            "deleted": {
                "cases": 0,
                "stages": 0,
                "deliverables": 0,
                "documents": 0,
                "payments": 0,
                "manual_payments": 0
            }
        }
        
        # Buscar y eliminar todos los casos del usuario (usando el ID como string)
        user_id_str = str(actual_user_id)
        user_cases = await db.visa_cases.find({"userId": user_id_str}).to_list(length=None)
        
        for user_case in user_cases:
            case_id = user_case.get('caseId') or user_case.get('id') or str(user_case.get('_id'))
            
            # Eliminar stages
            stages_result = await db.visa_stages.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["stages"] += stages_result.deleted_count
            
            # Eliminar deliverables
            deliverables_result = await db.visa_deliverables.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["deliverables"] += deliverables_result.deleted_count
            
            # Eliminar documentos
            docs_result = await db.visa_client_documents.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["documents"] += docs_result.deleted_count
            
            # Eliminar pagos (ambas colecciones)
            payments_result = await db.payments.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["payments"] += payments_result.deleted_count
            
            manual_payments_result = await db.manual_payments.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["manual_payments"] += manual_payments_result.deleted_count
        
        # Eliminar todos los casos del usuario
        cases_result = await db.visa_cases.delete_many({"userId": user_id_str})
        deletion_summary["deleted"]["cases"] = cases_result.deleted_count
        
        # Eliminar usuario (usando el ID real)
        await db.users.delete_one({"_id": actual_user_id})
        
        logger.info(f"✅ User deleted by {staff_payload.get('email')}: {user_email} (ID: {user_id})")
        
        return {
            "success": True,
            "message": f"Usuario '{user_name}' y todos sus datos relacionados fueron eliminados exitosamente",
            "summary": deletion_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar usuario: {str(e)}")


@api_router.post("/admin/staff")
async def create_staff(
    request: StaffCreateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create new staff member with automatic temporary password"""
    try:
        from email_service import generate_random_password, send_welcome_email
        
        # Verificar permisos con RBAC
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'create_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to create staff")
        
        # Verificar que puede crear este rol
        if not can_manage_role(user_role, request.role):
            raise HTTPException(
                status_code=403, 
                detail=f"You cannot create staff with role: {request.role}"
            )
        
        # Verificar que el email no existe
        existing = await db.staff.find_one({'email': request.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        
        # Generar contraseña temporal aleatoria
        temporary_password = generate_random_password(12)
        logger.info(f"Generated temporary password for {request.email}")
        
        # Crear staff con contraseña temporal
        new_staff = StaffModel.create_staff(
            email=request.email,
            password=temporary_password,
            name=request.name,
            role=request.role,
            phone=request.phone,
            department=getattr(request, 'department', None),
            linkedin=getattr(request, 'linkedin', None)
        )
        
        # Insertar en DB
        await db.staff.insert_one(new_staff)
        
        # Enviar email con contraseña (MOCKED por ahora)
        email_result = await send_welcome_email(
            recipient_email=request.email,
            recipient_name=request.name,
            temporary_password=temporary_password,
            role=request.role
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='create',
            resource='staff',
            resource_id=new_staff['_id'],
            details={
                'name': new_staff['name'], 
                'role': new_staff['role'],
                'email_sent': email_result.get('success', False)
            }
        )
        await db.activity_log.insert_one(log)
        
        return {
            'staff': serialize_staff(new_staff),
            'message': 'Personal creado exitosamente',
            'temporaryPassword': temporary_password,
            'emailSent': email_result.get('mocked', False),
            'emailMocked': True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create staff error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create staff: {str(e)}")


@api_router.get("/admin/staff/csv-template")
async def download_staff_csv_template(staff_payload: dict = Depends(verify_staff_token)):
    """Download CSV template for staff import"""
    from fastapi.responses import StreamingResponse
    
    csv_content = "email,name,role,phone,department,linkedin\n"
    csv_content += "john.doe@example.com,John Doe,advisor,+1234567890,commercial,https://linkedin.com/in/johndoe\n"
    csv_content += "jane.smith@example.com,Jane Smith,coordinator,+1234567891,operations,https://linkedin.com/in/janesmith\n"
    
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=staff_import_template.csv"}
    )


@api_router.get("/admin/staff/export")
async def export_staff(
    staff_payload: dict = Depends(verify_staff_token),
    role: str = None,
    department: str = None,
    status: str = None
):
    """Export staff to CSV with optional filters"""
    from fastapi.responses import StreamingResponse
    import csv
    
    try:
        # Verificar permisos
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'view_all_staff') and not has_permission(user_role, 'view_department_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to export staff")
        
        # Construir query
        query = {}
        if role:
            query['role'] = role
        if department:
            query['department'] = department
        if status:
            query['status'] = status
        
        # Si no tiene permiso para ver todo el staff, filtrar por departamento
        if not has_permission(user_role, 'view_all_staff'):
            if has_permission(user_role, 'view_department_staff'):
                query['department'] = staff_payload.get('department')
        
        # Obtener staff
        staff_list = await db.staff.find(query).to_list(length=1000)
        
        # Crear CSV en memoria
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow([
            'ID', 'Nombre', 'Email', 'Teléfono', 'Rol', 'Departamento',
            'LinkedIn', 'Estado', 'Fecha de Creación', 'Último Login'
        ])
        
        # Data rows
        for staff in staff_list:
            writer.writerow([
                staff.get('_id', ''),
                staff.get('name', ''),
                staff.get('email', ''),
                staff.get('phone', ''),
                staff.get('role', ''),
                staff.get('department', ''),
                staff.get('linkedin', ''),
                staff.get('status', ''),
                staff.get('createdAt', ''),
                staff.get('lastLogin', '')
            ])
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='export',
            resource='staff',
            details={'count': len(staff_list), 'filters': query}
        )
        await db.activity_log.insert_one(log)
        
        # Preparar respuesta
        output.seek(0)
        filename = f"staff_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export staff error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export staff: {str(e)}")


@api_router.get("/admin/staff/{staff_id}")
async def get_staff_by_id(
    staff_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get staff member by ID"""
    try:
        staff = await db.staff.find_one({'_id': staff_id})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Verificar permisos de visualización con RBAC
        user_role = staff_payload.get('role', 'advisor')
        can_view = (
            has_permission(user_role, 'view_all_staff') or
            staff_payload['id'] == staff_id or
            staff.get('managedBy') == staff_payload['id']
        )
        
        if not can_view:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return serialize_staff(staff)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get staff by ID error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get staff")


@api_router.get("/admin/staff/{staff_id}/detail")
async def get_staff_detail(
    staff_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get staff member detail with case counts."""
    try:
        staff_member = await db.staff.find_one({'_id': staff_id})
        if not staff_member:
            raise HTTPException(status_code=404, detail="Staff not found")

        staff_data = serialize_staff(staff_member)

        # Count visa cases where this staff is coordinator or sales rep
        visa_as_coordinator = await db.visa_cases.count_documents({"coordinatorId": staff_id})
        visa_as_sales = await db.visa_cases.count_documents({"salesRepId": staff_id})

        # Count visa cases by status for this staff
        visa_pipeline = [
            {"$match": {"$or": [{"coordinatorId": staff_id}, {"salesRepId": staff_id}]}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        visa_by_status = {}
        async for doc in db.visa_cases.aggregate(visa_pipeline):
            visa_by_status[doc["_id"]] = doc["count"]

        # Get list of visa cases (limited)
        visa_cases = await db.visa_cases.find(
            {"$or": [{"coordinatorId": staff_id}, {"salesRepId": staff_id}]},
            {"_id": 0, "id": 1, "userId": 1, "visaType": 1, "status": 1, "overallProgress": 1, "createdAt": 1, "updatedAt": 1}
        ).sort("updatedAt", -1).to_list(100)

        # Enrich visa cases with client names
        for vc in visa_cases:
            user = None
            user_id = vc.get("userId")
            if user_id:
                from bson import ObjectId
                queries = [{"_id": user_id}, {"id": user_id}]
                try:
                    queries.append({"_id": ObjectId(user_id)})
                except Exception:
                    pass
                user = await db.users.find_one({"$or": queries}, {"_id": 0, "name": 1, "email": 1})
            vc["clientName"] = user.get("name", "Sin nombre") if user else "Sin cliente"
            vc["clientEmail"] = user.get("email", "") if user else ""
            vc.pop("userId", None)

        # Count classic cases where this staff is coordinator
        classic_as_coordinator = await db.classic_cases.count_documents({"coordinatorId": staff_id})

        # Count classic cases by status
        classic_pipeline = [
            {"$match": {"coordinatorId": staff_id}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        classic_by_status = {}
        async for doc in db.classic_cases.aggregate(classic_pipeline):
            classic_by_status[doc["_id"]] = doc["count"]

        # Get list of classic cases (limited)
        classic_cases = await db.classic_cases.find(
            {"coordinatorId": staff_id},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "status": 1, "workStatus": 1, "createdAt": 1, "updatedAt": 1}
        ).sort("updatedAt", -1).to_list(100)

        return {
            "staff": staff_data,
            "visaCases": {
                "asCoordinator": visa_as_coordinator,
                "asSalesRep": visa_as_sales,
                "total": visa_as_coordinator + visa_as_sales,
                "byStatus": visa_by_status,
                "cases": visa_cases,
            },
            "classicCases": {
                "asCoordinator": classic_as_coordinator,
                "total": classic_as_coordinator,
                "byStatus": classic_by_status,
                "cases": classic_cases,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get staff detail error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get staff detail")


@api_router.put("/admin/staff/{staff_id}")
async def update_staff(
    staff_id: str,
    request: StaffUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update staff member"""
    try:
        # Obtener staff a actualizar
        target_staff = await db.staff.find_one({'_id': staff_id})
        if not target_staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Verificar permisos con RBAC
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'edit_all_staff') and not has_permission(user_role, 'edit_department_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Verificar que puede modificar este rol
        if not can_manage_role(user_role, target_staff['role']):
            raise HTTPException(
                status_code=403,
                detail="You cannot modify this staff member"
            )
        
        # Si cambia el rol, verificar que puede asignar el nuevo
        if request.role and not can_manage_role(user_role, request.role):
            raise HTTPException(
                status_code=403,
                detail=f"You cannot assign role: {request.role}"
            )
        
        # Preparar actualización
        update_data = {'updatedAt': datetime.utcnow()}
        if request.name is not None:
            update_data['name'] = request.name
        if request.email is not None:
            # Verificar que el email no esté en uso por otro staff
            existing = await db.staff.find_one({
                'email': request.email.lower(),
                '_id': {'$ne': staff_id}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
            update_data['email'] = request.email.lower()
        if request.role is not None:
            update_data['role'] = request.role
            update_data['roleLevel'] = ROLE_LEVELS.get(request.role, 5)
        if request.phone is not None:
            update_data['phone'] = request.phone
        if request.status is not None:
            update_data['status'] = request.status
        if request.department is not None:
            update_data['department'] = request.department
        if request.linkedin is not None:
            update_data['linkedin'] = request.linkedin
        if request.photo is not None:
            update_data['photo'] = request.photo
        if request.permissions is not None:
            update_data['permissions'] = request.permissions
        
        # Actualizar
        await db.staff.update_one(
            {'_id': staff_id},
            {'$set': update_data}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='update',
            resource='staff',
            resource_id=staff_id,
            details=update_data
        )
        await db.activity_log.insert_one(log)
        
        # Obtener staff actualizado
        updated_staff = await db.staff.find_one({'_id': staff_id})
        
        return {
            'staff': serialize_staff(updated_staff),
            'message': 'Staff updated successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update staff error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update staff")


@api_router.delete("/admin/staff/{staff_id}")
async def delete_staff(
    staff_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete staff member"""
    try:
        # No puede eliminarse a sí mismo
        if staff_id == staff_payload['id']:
            raise HTTPException(status_code=400, detail="You cannot delete yourself")
        
        # Obtener staff a eliminar
        target_staff = await db.staff.find_one({'_id': staff_id})
        if not target_staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Verificar permisos con RBAC
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'delete_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to delete staff")
        
        # Verificar jerarquía - solo puede eliminar roles inferiores
        if not can_manage_role(user_role, target_staff['role']):
            raise HTTPException(status_code=403, detail="Cannot delete staff member with equal or higher role")
        
        # Eliminar
        await db.staff.delete_one({'_id': staff_id})
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='delete',
            resource='staff',
            resource_id=staff_id,
            details={'name': target_staff['name'], 'role': target_staff['role']}
        )
        await db.activity_log.insert_one(log)
        
        return {'message': 'Staff deleted successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete staff error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete staff")



class TransferCasesRequest(BaseModel):
    targetStaffId: str

@api_router.post("/admin/staff/{staff_id}/transfer-cases")
async def transfer_staff_cases(
    staff_id: str,
    request: TransferCasesRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Transfer all visa cases and classic cases from one staff member to another"""
    try:
        if staff_id == request.targetStaffId:
            raise HTTPException(status_code=400, detail="No puedes transferir casos al mismo usuario")

        source = await db.staff.find_one({"_id": staff_id}, {"name": 1})
        target = await db.staff.find_one({"_id": request.targetStaffId}, {"name": 1})
        if not source:
            raise HTTPException(status_code=404, detail="Staff origen no encontrado")
        if not target:
            raise HTTPException(status_code=404, detail="Staff destino no encontrado")

        # Transfer visa cases - coordinatorId
        visa_coord = await db.visa_cases.update_many(
            {"coordinatorId": staff_id},
            {"$set": {"coordinatorId": request.targetStaffId}}
        )
        # Transfer visa cases - salesRepId
        visa_sales = await db.visa_cases.update_many(
            {"salesRepId": staff_id},
            {"$set": {"salesRepId": request.targetStaffId}}
        )
        # Transfer classic cases - coordinatorId
        classic_coord = await db.classic_cases.update_many(
            {"coordinatorId": staff_id},
            {"$set": {"coordinatorId": request.targetStaffId}}
        )

        total = visa_coord.modified_count + visa_sales.modified_count + classic_coord.modified_count

        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='transfer_cases',
            resource='staff',
            resource_id=staff_id,
            details={
                'source_name': source['name'],
                'target_name': target['name'],
                'target_id': request.targetStaffId,
                'visa_coordinator': visa_coord.modified_count,
                'visa_sales': visa_sales.modified_count,
                'classic_coordinator': classic_coord.modified_count,
            }
        )
        await db.activity_log.insert_one(log)

        return {
            "message": f"Casos transferidos exitosamente de {source['name']} a {target['name']}",
            "visa_coordinator_transferred": visa_coord.modified_count,
            "visa_sales_transferred": visa_sales.modified_count,
            "classic_transferred": classic_coord.modified_count,
            "total_transferred": total,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transfer cases error: {e}")
        raise HTTPException(status_code=500, detail="Error al transferir casos")



# ── Whitepaper Generation Endpoints ──────────────────────────────────
from services.whitepaper_service import run_whitepaper_generation, get_whitepaper_status as _get_wp_status, _get_redaccion_token, run_policy_paper_generation, get_policy_paper_status as _get_pp_status, run_econometric_generation, get_econometric_status as _get_ec_status, run_book_generation, get_book_status as _get_bk_status, run_case_study_generation, get_case_study_status as _get_cs_status

@api_router.post("/admin/visa-cases/{case_id}/generate-whitepaper")
async def generate_whitepaper(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Start whitepaper generation for a visa case"""
    import uuid as uuid_mod
    import asyncio as _asyncio

    # Check if there's already an active job
    existing = await db.whitepaper_jobs.find_one(
        {"caseId": case_id, "status": {"$in": ["processing", "generating"]}},
        {"_id": 1}
    )
    if existing:
        return {"job_id": existing["_id"], "message": "Ya hay una generacion en progreso"}

    job_id = str(uuid_mod.uuid4())
    await db.whitepaper_jobs.insert_one({
        "_id": job_id,
        "caseId": case_id,
        "status": "queued",
        "currentStep": "Iniciando...",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "startedBy": staff_payload.get("id", ""),
    })

    _asyncio.create_task(run_whitepaper_generation(db, case_id, job_id))
    return {"job_id": job_id, "message": "Generacion iniciada"}


@api_router.get("/admin/visa-cases/{case_id}/whitepaper-job")
async def get_whitepaper_job(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get latest whitepaper generation job for a case"""
    job = await db.whitepaper_jobs.find_one(
        {"caseId": case_id},
        {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "externalWhitepaperId": 1, "externalClientId": 1, "updatedAt": 1},
        sort=[("createdAt", -1)]
    )
    if not job:
        return {"job": None}

    # If generating, poll external system for progress
    if job.get("status") == "generating" and job.get("externalWhitepaperId"):
        try:
            token = await _get_redaccion_token()
            wp_status = await _get_wp_status(token, job["externalWhitepaperId"])
            ext_status = wp_status.get("status", "")
            progress = wp_status.get("progress", 0)
            await db.whitepaper_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"progress": progress, "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            job["progress"] = progress
            if ext_status == "completed":
                await db.whitepaper_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "completed", "currentStep": "White Paper generado exitosamente"}}
                )
                job["status"] = "completed"
                job["currentStep"] = "White Paper generado exitosamente"
            elif ext_status == "error":
                await db.whitepaper_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "error", "error": "Error en generacion externa"}}
                )
                job["status"] = "error"
        except Exception as e:
            logger.warning(f"Failed to poll whitepaper status: {e}")

    job["id"] = job.pop("_id")
    return {"job": job}



# ── Policy Paper Generation Endpoints ────────────────────────────────

@api_router.post("/admin/visa-cases/{case_id}/generate-policy-paper")
async def generate_policy_paper(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Start policy paper generation for a visa case"""
    import uuid as uuid_mod
    import asyncio as _asyncio

    existing = await db.policy_paper_jobs.find_one(
        {"caseId": case_id, "status": {"$in": ["processing", "generating"]}},
        {"_id": 1}
    )
    if existing:
        return {"job_id": existing["_id"], "message": "Ya hay una generacion en progreso"}

    job_id = str(uuid_mod.uuid4())
    await db.policy_paper_jobs.insert_one({
        "_id": job_id,
        "caseId": case_id,
        "status": "queued",
        "currentStep": "Iniciando...",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "startedBy": staff_payload.get("id", ""),
    })

    _asyncio.create_task(run_policy_paper_generation(db, case_id, job_id))
    return {"job_id": job_id, "message": "Generacion de Policy Paper iniciada"}


@api_router.get("/admin/visa-cases/{case_id}/policy-paper-job")
async def get_policy_paper_job(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get latest policy paper generation job for a case"""
    job = await db.policy_paper_jobs.find_one(
        {"caseId": case_id},
        {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "externalPaperId": 1, "externalClientId": 1, "updatedAt": 1},
        sort=[("createdAt", -1)]
    )
    if not job:
        return {"job": None}

    if job.get("status") == "generating" and job.get("externalPaperId"):
        try:
            token = await _get_redaccion_token()
            pp_status = await _get_pp_status(token, job["externalPaperId"])
            progress = pp_status.get("progress", 0)
            ext_status = pp_status.get("status", "")
            progress_msg = pp_status.get("progress_message", "")
            await db.policy_paper_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"progress": progress, "progressMessage": progress_msg, "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            job["progress"] = progress
            job["progressMessage"] = progress_msg
            if ext_status == "completed":
                await db.policy_paper_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "completed", "currentStep": "Policy Paper generado exitosamente"}}
                )
                job["status"] = "completed"
                job["currentStep"] = "Policy Paper generado exitosamente"
            elif ext_status == "error":
                err_msg = pp_status.get("error_message", "Error en generacion externa")
                await db.policy_paper_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "error", "error": err_msg}}
                )
                job["status"] = "error"
        except Exception as e:
            logger.warning(f"Failed to poll policy paper status: {e}")

    job["id"] = job.pop("_id")
    return {"job": job}


@api_router.get("/admin/visa-cases/{case_id}/policy-paper-download")
async def download_policy_paper(case_id: str, language: str = "es", staff_payload: dict = Depends(verify_staff_token)):
    """Proxy download of the generated policy paper PDF"""
    job = await db.policy_paper_jobs.find_one(
        {"caseId": case_id, "status": "completed"},
        {"externalPaperId": 1},
        sort=[("createdAt", -1)]
    )
    if not job or not job.get("externalPaperId"):
        raise HTTPException(status_code=404, detail="No hay Policy Paper completado")

    token = await _get_redaccion_token()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/policy-papers/{job['externalPaperId']}/download",
            params={"language": language},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Error al descargar PDF")

        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=policy_paper_{case_id}.pdf"}
        )



# ── Econometric Study Generation Endpoints ───────────────────────────

REDACCION_URL = os.environ.get("REDACCION_API_URL", "").rstrip("/")
import httpx

@api_router.post("/admin/visa-cases/{case_id}/generate-econometric")
async def generate_econometric(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Start econometric study generation for a visa case"""
    import uuid as uuid_mod
    import asyncio as _asyncio

    existing = await db.econometric_jobs.find_one(
        {"caseId": case_id, "status": {"$in": ["processing", "generating"]}},
        {"_id": 1}
    )
    if existing:
        return {"job_id": existing["_id"], "message": "Ya hay una generacion en progreso"}

    job_id = str(uuid_mod.uuid4())
    await db.econometric_jobs.insert_one({
        "_id": job_id,
        "caseId": case_id,
        "status": "queued",
        "currentStep": "Iniciando...",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "startedBy": staff_payload.get("id", ""),
    })

    _asyncio.create_task(run_econometric_generation(db, case_id, job_id))
    return {"job_id": job_id, "message": "Generacion de Estudio Econometrico iniciada"}


@api_router.get("/admin/visa-cases/{case_id}/econometric-job")
async def get_econometric_job(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get latest econometric study job for a case"""
    job = await db.econometric_jobs.find_one(
        {"caseId": case_id},
        {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "externalStudyId": 1, "externalClientId": 1, "updatedAt": 1},
        sort=[("createdAt", -1)]
    )
    if not job:
        return {"job": None}

    if job.get("status") == "generating" and job.get("externalStudyId"):
        try:
            token = await _get_redaccion_token()
            ec_status = await _get_ec_status(token, job["externalStudyId"])
            progress = ec_status.get("progress", 0)
            ext_status = ec_status.get("status", "")
            await db.econometric_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"progress": progress, "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            job["progress"] = progress
            if ext_status in ("completed", "generation_complete"):
                await db.econometric_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "completed", "currentStep": "Estudio Econometrico generado exitosamente"}}
                )
                job["status"] = "completed"
                job["currentStep"] = "Estudio Econometrico generado exitosamente"
            elif ext_status == "generation_failed":
                await db.econometric_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "error", "error": "Error en generacion externa"}}
                )
                job["status"] = "error"
        except Exception as e:
            logger.warning(f"Failed to poll econometric status: {e}")

    job["id"] = job.pop("_id")
    return {"job": job}


@api_router.get("/admin/visa-cases/{case_id}/econometric-download")
async def download_econometric(case_id: str, language: str = "es", staff_payload: dict = Depends(verify_staff_token)):
    """Proxy download of the generated econometric study PDF"""
    job = await db.econometric_jobs.find_one(
        {"caseId": case_id, "status": "completed"},
        {"externalStudyId": 1},
        sort=[("createdAt", -1)]
    )
    if not job or not job.get("externalStudyId"):
        raise HTTPException(status_code=404, detail="No hay Estudio Econometrico completado")

    token = await _get_redaccion_token()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/econometric-studies/{job['externalStudyId']}/download",
            params={"language": language},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Error al descargar PDF")

        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=estudio_econometrico_{case_id}.pdf"}
        )



# ── Book Generation Endpoints ────────────────────────────────────────

@api_router.get("/admin/visa-cases/{case_id}/book-preparation")
async def get_book_preparation_admin(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get book preparation status (idea + title selected by client)"""
    prep = await db.book_preparations.find_one(
        {"caseId": case_id},
        {"_id": 0}
    )
    return {"preparation": prep}


@api_router.post("/admin/visa-cases/{case_id}/generate-book")
async def generate_book(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Start book generation for a visa case"""
    import uuid as uuid_mod
    import asyncio as _asyncio

    existing = await db.book_jobs.find_one(
        {"caseId": case_id, "status": {"$in": ["processing", "generating"]}},
        {"_id": 1}
    )
    if existing:
        return {"job_id": existing["_id"], "message": "Ya hay una generacion en progreso"}

    job_id = str(uuid_mod.uuid4())
    await db.book_jobs.insert_one({
        "_id": job_id,
        "caseId": case_id,
        "status": "queued",
        "currentStep": "Iniciando...",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "startedBy": staff_payload.get("id", ""),
    })

    _asyncio.create_task(run_book_generation(db, case_id, job_id))
    return {"job_id": job_id, "message": "Generacion de Libro iniciada"}


@api_router.get("/admin/visa-cases/{case_id}/book-job")
async def get_book_job(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get latest book generation job for a case"""
    job = await db.book_jobs.find_one(
        {"caseId": case_id},
        {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "externalBookId": 1, "externalClientId": 1, "updatedAt": 1},
        sort=[("createdAt", -1)]
    )
    if not job:
        return {"job": None}

    if job.get("status") == "generating" and job.get("externalBookId"):
        try:
            token = await _get_redaccion_token()
            bk_status = await _get_bk_status(token, job["externalBookId"])
            progress = bk_status.get("progress_percentage", 0)
            ext_status = bk_status.get("status", "")
            progress_msg = bk_status.get("progress_message", "")
            await db.book_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"progress": progress, "progressMessage": progress_msg, "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            job["progress"] = progress
            job["progressMessage"] = progress_msg
            if ext_status == "completed":
                await db.book_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "completed", "currentStep": "Libro generado exitosamente"}}
                )
                job["status"] = "completed"
                job["currentStep"] = "Libro generado exitosamente"
            elif ext_status == "failed":
                err_msg = bk_status.get("error_message", "Error en generacion externa")
                await db.book_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "error", "error": err_msg}}
                )
                job["status"] = "error"
        except Exception as e:
            logger.warning(f"Failed to poll book status: {e}")

    job["id"] = job.pop("_id")
    return {"job": job}


@api_router.get("/admin/visa-cases/{case_id}/book-download")
async def download_book(case_id: str, language: str = "es", staff_payload: dict = Depends(verify_staff_token)):
    """Proxy download of the generated book PDF"""
    job = await db.book_jobs.find_one(
        {"caseId": case_id, "status": "completed"},
        {"externalBookId": 1},
        sort=[("createdAt", -1)]
    )
    if not job or not job.get("externalBookId"):
        raise HTTPException(status_code=404, detail="No hay Libro completado")

    token = await _get_redaccion_token()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/books/{job['externalBookId']}/download",
            params={"language": language},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Error al descargar PDF")

        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=libro_{case_id}.pdf"}
        )


# ── Business Plan NIW Admin Endpoints ────────────────────────

@api_router.get("/admin/visa-cases/{case_id}/bp-preparation")
async def get_bp_preparation_admin(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get BP preparation status (project selected by client)"""
    prep = await db.bp_preparations.find_one({"caseId": case_id}, {"_id": 0})
    return {"preparation": prep}


@api_router.get("/admin/visa-cases/{case_id}/bp-job")
async def get_bp_job_admin(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get latest BP generation job for a case"""
    job = await db.bp_jobs.find_one(
        {"caseId": case_id},
        {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "progress": 1, "externalNiwId": 1, "updatedAt": 1},
        sort=[("createdAt", -1)]
    )
    if not job:
        return {"job": None}

    if job.get("status") == "generating" and job.get("externalNiwId"):
        try:
            token = await _get_redaccion_token()
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{REDACCION_URL}/api/business-plans/generation-status/{job['externalNiwId']}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if resp.status_code == 200:
                    ext = resp.json()
                    ext_status = ext.get("status", "")
                    progress = ext.get("progress", 0)
                    msg = ext.get("progress_message", "")
                    update = {"progress": progress, "currentStep": msg or job.get("currentStep", ""), "updatedAt": datetime.now(timezone.utc).isoformat()}
                    if ext_status == "completed":
                        update["status"] = "completed"
                        update["currentStep"] = "Business Plan generado exitosamente"
                    elif ext_status == "generation_failed":
                        update["status"] = "error"
                        update["error"] = ext.get("error", "Error en generacion")
                    await db.bp_jobs.update_one({"_id": job["_id"]}, {"$set": update})
                    job.update(update)
        except Exception as e:
            logger.warning(f"BP job poll failed: {e}")

    job["id"] = job.pop("_id")
    return {"job": job}


# ── Case Study (Harvard) Generation Endpoints ────────────────────────

@api_router.post("/admin/visa-cases/{case_id}/generate-case-study")
async def generate_case_study(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Start Harvard-style case study generation for a visa case"""
    import uuid as uuid_mod
    import asyncio as _asyncio

    existing = await db.case_study_jobs.find_one(
        {"caseId": case_id, "status": {"$in": ["processing", "generating"]}},
        {"_id": 1}
    )
    if existing:
        return {"job_id": existing["_id"], "message": "Ya hay una generacion en progreso"}

    job_id = str(uuid_mod.uuid4())
    await db.case_study_jobs.insert_one({
        "_id": job_id,
        "caseId": case_id,
        "status": "queued",
        "currentStep": "Iniciando...",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "startedBy": staff_payload.get("id", ""),
    })

    _asyncio.create_task(run_case_study_generation(db, case_id, job_id))
    return {"job_id": job_id, "message": "Generacion de Caso de Estudio iniciada"}


@api_router.get("/admin/visa-cases/{case_id}/case-study-job")
async def get_case_study_job(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
    """Get latest case study generation job for a case"""
    job = await db.case_study_jobs.find_one(
        {"caseId": case_id},
        {"_id": 1, "status": 1, "currentStep": 1, "error": 1, "externalStudyId": 1, "externalClientId": 1, "updatedAt": 1},
        sort=[("createdAt", -1)]
    )
    if not job:
        return {"job": None}

    if job.get("status") == "generating" and job.get("externalStudyId"):
        try:
            token = await _get_redaccion_token()
            cs_status = await _get_cs_status(token, job["externalStudyId"])
            ext_status = cs_status.get("status", "")
            coherence = cs_status.get("coherence_evaluation", {})
            coherence_score = coherence.get("coherence_score", 0) if coherence else 0
            await db.case_study_jobs.update_one(
                {"_id": job["_id"]},
                {"$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            if ext_status == "completed":
                await db.case_study_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {
                        "status": "completed",
                        "currentStep": "Caso de Estudio generado exitosamente",
                        "coherenceScore": coherence_score,
                    }}
                )
                job["status"] = "completed"
                job["currentStep"] = "Caso de Estudio generado exitosamente"
                job["coherenceScore"] = coherence_score
            elif ext_status == "failed":
                await db.case_study_jobs.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "error", "error": "Error en generacion externa"}}
                )
                job["status"] = "error"
        except Exception as e:
            logger.warning(f"Failed to poll case study status: {e}")

    job["id"] = job.pop("_id")
    return {"job": job}


@api_router.get("/admin/visa-cases/{case_id}/case-study-download")
async def download_case_study(case_id: str, language: str = "es", staff_payload: dict = Depends(verify_staff_token)):
    """Proxy download of the generated case study PDF"""
    job = await db.case_study_jobs.find_one(
        {"caseId": case_id, "status": "completed"},
        {"externalStudyId": 1},
        sort=[("createdAt", -1)]
    )
    if not job or not job.get("externalStudyId"):
        raise HTTPException(status_code=404, detail="No hay Caso de Estudio completado")

    token = await _get_redaccion_token()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{REDACCION_URL}/api/case-studies/{job['externalStudyId']}/download",
            params={"language": language},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Error al descargar PDF del Caso de Estudio")

        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=caso_estudio_{case_id}_{language}.pdf"}
        )


@api_router.post("/admin/staff/{staff_id}/reset-password")
async def reset_staff_password(
    staff_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Reset password for a staff member (Admin only)"""
    try:
        # Get target staff
        target_staff = await db.staff.find_one({'_id': staff_id})
        if not target_staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        
        # Verify permissions with RBAC
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'edit_all_staff') and not has_permission(user_role, 'edit_department_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to reset password")
        
        # Verify hierarchy - can only reset password for lower roles
        if not can_manage_role(user_role, target_staff['role']):
            raise HTTPException(status_code=403, detail="Cannot reset password for staff member with equal or higher role")
        
        # Generate new temporary password
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(secrets.choice(alphabet) for i in range(12))
        
        # Hash the new password
        password_hash = pwd_context.hash(new_password)
        
        # Update password in database
        await db.staff.update_one(
            {'_id': staff_id},
            {
                '$set': {
                    'passwordHash': password_hash,
                    'mustChangePassword': True,
                    'updatedAt': datetime.now(timezone.utc)
                }
            }
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='reset_password',
            resource='staff',
            resource_id=staff_id,
            details={
                'name': target_staff['name'],
                'email': target_staff['email']
            }
        )
        await db.activity_log.insert_one(log)
        
        return {
            'success': True,
            'message': 'Password reset successfully',
            'temporaryPassword': new_password,
            'staff': {
                'name': target_staff['name'],
                'email': target_staff['email']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset staff password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset password")


# ===== CSV Import Endpoints =====

from fastapi import File, UploadFile
import csv
import io

@api_router.post("/admin/staff/import-csv")
async def import_staff_csv(
    file: UploadFile = File(...),
    staff_payload: dict = Depends(verify_staff_token)
):
    """Import staff members from CSV file"""
    try:
        from email_service import generate_random_password
        
        # Verificar permisos
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'create_staff'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to import staff")
        
        # Leer archivo CSV
        contents = await file.read()
        csv_text = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_text))
        
        results = {
            'success': [],
            'errors': [],
            'total': 0
        }
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
            results['total'] += 1
            
            try:
                # Validar campos requeridos
                if not row.get('email') or not row.get('name') or not row.get('role'):
                    results['errors'].append({
                        'row': row_num,
                        'email': row.get('email', 'N/A'),
                        'error': 'Missing required fields (email, name, role)'
                    })
                    continue
                
                email = row['email'].strip().lower()
                name = row['name'].strip()
                role = row['role'].strip().lower()
                
                # Validar rol
                valid_roles = ['presidente', 'ceo', 'super_admin', 'admin', 'manager', 'coordinator', 'advisor', 'acreditador']
                if role not in valid_roles:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': f'Invalid role: {role}. Valid roles: {", ".join(valid_roles)}'
                    })
                    continue
                
                # Verificar jerarquía
                if not can_manage_role(user_role, role):
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': f'You cannot create staff with role: {role}'
                    })
                    continue
                
                # Verificar si ya existe
                existing = await db.staff.find_one({'email': email})
                if existing:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': 'Email already exists'
                    })
                    continue
                
                # Generar contraseña temporal
                temporary_password = generate_random_password(12)
                
                # Crear staff
                new_staff = StaffModel.create_staff(
                    email=email,
                    password=temporary_password,
                    name=name,
                    role=role,
                    phone=row.get('phone', '').strip(),
                    department=row.get('department', '').strip() or None,
                    linkedin=row.get('linkedin', '').strip() or None
                )
                
                # Insertar en DB
                await db.staff.insert_one(new_staff)
                
                results['success'].append({
                    'row': row_num,
                    'email': email,
                    'name': name,
                    'role': role,
                    'temporaryPassword': temporary_password
                })
                
                # Log de actividad
                log = ActivityLog.create_log(
                    staff_id=staff_payload['id'],
                    action='import_csv',
                    resource='staff',
                    resource_id=new_staff['_id'],
                    details={'name': name, 'role': role, 'source': 'csv_import'}
                )
                await db.activity_log.insert_one(log)
                
            except Exception as e:
                results['errors'].append({
                    'row': row_num,
                    'email': row.get('email', 'N/A'),
                    'error': str(e)
                })
        
        return {
            'message': f'Import completed: {len(results["success"])} success, {len(results["errors"])} errors',
            'results': results
        }
        
    except Exception as e:
        logger.error(f"CSV import error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import CSV: {str(e)}")


# Moved to before {staff_id} route to fix route conflict

@api_router.get("/admin/users/export")
async def export_users(
    staff_payload: dict = Depends(verify_staff_token),
    user_state: str = None,
    profession: str = None,
    language: str = None
):
    """Export users/clients to CSV with optional filters"""
    from fastapi.responses import StreamingResponse
    import csv
    
    try:
        # Verificar permisos
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'view_all_users') and not has_permission(user_role, 'view_assigned_users'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to export users")
        
        # Construir query
        query = {}
        if user_state:
            query['userState'] = user_state
        if profession:
            query['profession'] = profession
        if language:
            query['language'] = language
        
        # Si solo puede ver usuarios asignados, filtrar
        if not has_permission(user_role, 'view_all_users'):
            if has_permission(user_role, 'view_assigned_users'):
                query['assignedAdvisor'] = staff_payload['id']
        
        # Obtener usuarios
        users_list = await db.users.find(query).to_list(length=5000)
        
        # Crear CSV en memoria
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow([
            'ID', 'Nombre', 'Email', 'Teléfono', 'Profesión', 
            'Estado Usuario', 'Idioma', 'Fecha de Registro'
        ])
        
        # Data rows
        for user in users_list:
            writer.writerow([
                user.get('id', user.get('_id', '')),
                user.get('name', ''),
                user.get('email', ''),
                user.get('phone', ''),
                user.get('profession', ''),
                user.get('userState', ''),
                user.get('language', ''),
                user.get('createdAt', '')
            ])
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='export',
            resource='users',
            details={'count': len(users_list), 'filters': query}
        )
        await db.activity_log.insert_one(log)
        
        # Preparar respuesta
        output.seek(0)
        filename = f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export users error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export users: {str(e)}")



@api_router.post("/admin/users/import-csv")
async def import_users_csv(
    file: UploadFile = File(...),
    staff_payload: dict = Depends(verify_staff_token)
):
    """Import users/clients from CSV file"""
    try:
        from email_service import generate_random_password
        
        # Verificar permisos
        user_role = staff_payload.get('role', 'advisor')
        if not has_permission(user_role, 'edit_all_users') and not has_permission(user_role, 'edit_assigned_users'):
            raise HTTPException(status_code=403, detail="Insufficient permissions to import users")
        
        # Leer archivo CSV
        contents = await file.read()
        csv_text = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_text))
        
        results = {
            'success': [],
            'errors': [],
            'total': 0
        }
        
        for row_num, row in enumerate(csv_reader, start=2):
            results['total'] += 1
            
            try:
                # Validar campos requeridos
                if not row.get('email') or not row.get('name'):
                    results['errors'].append({
                        'row': row_num,
                        'email': row.get('email', 'N/A'),
                        'error': 'Missing required fields (email, name)'
                    })
                    continue
                
                email = row['email'].strip().lower()
                name = row['name'].strip()
                phone = row.get('phone', '').strip()
                
                # Verificar si ya existe
                existing = await db.users.find_one({'email': email})
                if existing:
                    results['errors'].append({
                        'row': row_num,
                        'email': email,
                        'error': 'Email already exists'
                    })
                    continue
                
                # Generar contraseña temporal
                temporary_password = generate_random_password(12)
                hashed_password = pwd_context.hash(temporary_password)
                
                # Crear usuario
                user_id = str(uuid.uuid4())
                new_user = {
                    'id': user_id,
                    '_id': user_id,
                    'name': name,
                    'email': email,
                    'phone': phone,
                    'password': hashed_password,
                    'userState': row.get('userState', 'U1').strip().upper(),
                    'profession': row.get('profession', '').strip(),
                    'language': row.get('language', 'es').strip().lower(),
                    'welcome': False,  # Show welcome modal on first login
                    'createdAt': datetime.now(timezone.utc).isoformat(),
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
                
                # Insertar en DB
                await db.users.insert_one(new_user)
                
                results['success'].append({
                    'row': row_num,
                    'email': email,
                    'name': name,
                    'temporaryPassword': temporary_password
                })
                
                # Log de actividad
                log = ActivityLog.create_log(
                    staff_id=staff_payload['id'],
                    action='import_csv',
                    resource='user',
                    resource_id=user_id,
                    details={'name': name, 'source': 'csv_import'}
                )
                await db.activity_log.insert_one(log)
                
            except Exception as e:
                results['errors'].append({
                    'row': row_num,
                    'email': row.get('email', 'N/A'),
                    'error': str(e)
                })
        
        return {
            'message': f'Import completed: {len(results["success"])} success, {len(results["errors"])} errors',
            'results': results
        }
        
    except Exception as e:
        logger.error(f"CSV import error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import CSV: {str(e)}")


@api_router.get("/admin/users/csv-template")
async def download_users_csv_template(staff_payload: dict = Depends(verify_staff_token)):
    """Download CSV template for users import"""
    from fastapi.responses import StreamingResponse
    
    csv_content = "email,name,phone,profession,userState,language\n"
    csv_content += "client1@example.com,John Client,+1234567890,Software Engineer,U1,es\n"
    csv_content += "client2@example.com,Jane Client,+1234567891,Medical Doctor,U2,en\n"
    
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_import_template.csv"}
    )




# ============= VISA CASES MANAGEMENT (PAY AS YOU ADVANCE) =============

from visa_case_models import (
    VisaCase, Stage, Deliverable, ClientDocument, Payment as VisaPayment, Meeting,
    VisaType, CaseStatus, StageStatus, DeliverableStatus, DocumentStatus, PaymentStatus, MeetingStatus,
    create_stages_for_case, create_deliverables_for_stage, create_document_checklist_for_stage
)

from case_template_models import (
    CaseTemplate, get_all_templates, get_template_by_id, PREDEFINED_TEMPLATES
)

# ===== Case Templates Endpoints =====

@api_router.get("/admin/case-templates")
async def get_case_templates(
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all available case templates"""
    try:
        # Cualquier staff puede ver templates
        templates = get_all_templates()
        
        # Agrupar por categoría
        templates_by_category = {
            "immigrant_visa": [],
            "non_immigrant_visa": [],
            "asylum": [],
            "other": []
        }
        
        for template in templates:
            category = template.get("category", "other")
            templates_by_category[category].append({
                "templateId": template["templateId"],
                "name": template["name"],
                "description": template["description"],
                "visaType": template["visaType"],
                "category": template["category"],
                "totalAmount": template["totalAmount"],
                "estimatedDurationMonths": template["estimatedDurationMonths"],
                "stageCount": len(template["stages"])
            })
        
        return {
            "success": True,
            "templates": templates_by_category,
            "total": len(templates)
        }
        
    except Exception as e:
        logger.error(f"Error fetching templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/admin/case-templates/{template_id}")
async def get_case_template_detail(
    template_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get detailed configuration of a specific template"""
    try:
        template = get_template_by_id(template_id)
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {
            "success": True,
            "template": template
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching template detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== User Creation with Auto Case Assignment =====

class CreateUserWithCaseRequest(BaseModel):
    name: str
    phone: str  # Teléfono ahora es obligatorio
    email: Optional[str] = None
    visaType: Optional[str] = "EB-2 NIW"
    coordinatorId: Optional[str] = None
    salesRepId: Optional[str] = None
    notes: Optional[str] = None
    cvUrl: Optional[str] = None  # URL del CV subido

@api_router.post("/admin/users/create-with-case")
async def create_user_with_case(
    request: CreateUserWithCaseRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Create a new user and automatically assign them a visa case based on master case template
    """
    try:
        # Todos los usuarios del staff pueden crear usuarios y casos
        # No se requiere verificación de permisos específicos
        
        # Validate phone is provided (now required)
        if not request.phone:
            raise HTTPException(status_code=400, detail="Phone number is required")
        
        # Clean phone: remove +, spaces, dashes, parentheses
        import re
        request.phone = re.sub(r'[^\d]', '', request.phone)
        
        # Validate phone format: only digits, 10-15 digits
        if not re.match(r'^\d{10,15}$', request.phone):
            raise HTTPException(
                status_code=400, 
                detail="Phone number must contain only digits (10-15), including area code, without spaces or symbols. Example: 584124248787"
            )
        
        # Check if user already exists by phone
        existing_user_by_phone = await db.users.find_one({'phone': request.phone})
        
        if existing_user_by_phone:
            raise HTTPException(
                status_code=400, 
                detail=f"Ya existe un usuario con el número de teléfono {request.phone}. Por favor, usa el usuario existente o verifica el número."
            )
        
        # Also check by email if provided
        if request.email:
            existing_user_by_email = await db.users.find_one({'email': request.email})
            if existing_user_by_email:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Ya existe un usuario con el email {request.email}. Por favor, usa el usuario existente o verifica el email."
                )
        
        # Create user
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "id": user_id,
            "name": request.name,
            "email": request.email or "",
            "phone": request.phone or "",
            "userState": "U1",  # Initial user state
            "cvUrl": request.cvUrl or None,  # CV URL
            "createdBy": {
                "id": staff_payload['id'],
                "name": staff_payload.get('name', 'Staff'),
                "email": staff_payload.get('email', '')
            },
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user)
        logger.info(f"User created: {user_id} - {request.name}")
        
        # Save CV to user_cvs collection if provided
        if request.cvUrl:
            cv_record = {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "url": request.cvUrl,
                "fileName": f"CV_{request.name.replace(' ', '_')}",
                "uploadedBy": {
                    "id": staff_payload['id'],
                    "name": staff_payload.get('name', 'Staff'),
                    "email": staff_payload.get('email', '')
                },
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
                "active": True
            }
            await db.user_cvs.insert_one(cv_record)
            logger.info(f"CV saved for user {user_id}: {request.cvUrl}")
        
        # Get master case template
        MASTER_CASE_ID = "master_case_eb2_niw"
        master_case = await db.visa_cases.find_one({"caseId": MASTER_CASE_ID, "isMasterCase": True})
        
        if not master_case:
            # Rollback user creation
            await db.users.delete_one({"id": user_id})
            raise HTTPException(status_code=500, detail="Master case template not found. User creation rolled back.")
        
        # Create visa case for the user
        visa_case = VisaCase(
            userId=user_id,
            visaType=request.visaType or master_case.get("visaType", "EB-2 NIW"),
            coordinatorId=request.coordinatorId or staff_payload['id'],
            salesRepId=request.salesRepId if request.salesRepId else None,
            status=CaseStatus.ELIGIBILITY_APPROVED,
            currentStage=1,
            overallProgress=0,
            eligibilityDate=datetime.now(timezone.utc),
            notes=request.notes
        )
        
        case_dict = visa_case.model_dump()
        case_dict['_id'] = case_dict['id']
        case_dict['templateId'] = "eb2-niw"
        case_dict['createdBy'] = {
            "id": staff_payload['id'],
            "name": staff_payload.get('name', 'Staff'),
            "email": staff_payload.get('email', '')
        }
        case_dict['createdAt'] = case_dict['createdAt'].isoformat()
        case_dict['updatedAt'] = case_dict['updatedAt'].isoformat()
        if case_dict.get('eligibilityDate'):
            case_dict['eligibilityDate'] = case_dict['eligibilityDate'].isoformat()
        
        await db.visa_cases.insert_one(case_dict)
        logger.info(f"✅ Visa case created: {visa_case.id}")
        
        # Copy stages from master case
        master_stages_cursor = db.visa_stages.find({'caseId': MASTER_CASE_ID}).sort('stageNumber', 1)
        master_stages = await master_stages_cursor.to_list(length=None)
        
        stages = []
        for master_stage in master_stages:
            stage_id = str(uuid.uuid4())
            stage = {
                "_id": stage_id,
                "id": stage_id,
                "caseId": visa_case.id,
                "stageNumber": master_stage["stageNumber"],
                "name": master_stage["name"],
                "description": master_stage.get("description", ""),
                "percentage": master_stage.get("percentage", 0),
                "amount": master_stage.get("amount", 0),
                "status": master_stage.get("status", "locked"),
                "isPaid": False,
                "completedDeliverablesCount": 0,
                "totalDeliverablesCount": master_stage.get("totalDeliverablesCount", 0),
                "startDate": None,
                "completionDate": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            stages.append(stage)
        
        if stages:
            await db.visa_stages.insert_many(stages)
            logger.info(f"✅ Created {len(stages)} stages")
        
        # Copy deliverables from master case
        master_deliverables_cursor = db.visa_deliverables.find({'caseId': MASTER_CASE_ID})
        master_deliverables = await master_deliverables_cursor.to_list(length=None)
        
        all_deliverables = []
        stage_id_map = {s["stageNumber"]: s["_id"] for s in stages}
        
        for master_deliv in master_deliverables:
            deliverable_id = str(uuid.uuid4())
            new_stage_id = stage_id_map.get(master_deliv["stageNumber"])
            
            deliverable = {
                "_id": deliverable_id,
                "id": deliverable_id,
                "caseId": visa_case.id,
                "stageId": new_stage_id,
                "stageNumber": master_deliv["stageNumber"],
                "deliverableName": master_deliv.get("deliverableName", ""),
                "name": master_deliv.get("name", {}),
                "description": master_deliv.get("description", ""),
                "status": "draft",
                "fileUrl": None,
                "fileName": None,
                "fileSize": None,
                "uploadedAt": None,
                "uploadedBy": None,
                "validatedAt": None,
                "validatedBy": None,
                "notes": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            all_deliverables.append(deliverable)
        
        if all_deliverables:
            await db.visa_deliverables.insert_many(all_deliverables)
            logger.info(f"✅ Created {len(all_deliverables)} deliverables")
        
        # Copy required documents from master case
        master_documents_cursor = db.visa_client_documents.find({'caseId': MASTER_CASE_ID})
        master_documents = await master_documents_cursor.to_list(length=None)
        
        all_documents = []
        for master_doc in master_documents:
            document_id = str(uuid.uuid4())
            document = {
                "_id": document_id,
                "id": document_id,
                "caseId": visa_case.id,
                "stageNumber": master_doc["stageNumber"],
                "documentName": master_doc.get("documentName", ""),
                "name": master_doc.get("name", {}),
                "description": master_doc.get("description", ""),
                "status": "pending",
                "required": master_doc.get("required", False),
                "requiresPhysicalCopy": master_doc.get("requiresPhysicalCopy", False),
                "fileUrl": None,
                "fileName": None,
                "fileSize": None,
                "uploadedAt": None,
                "reviewedAt": None,
                "reviewedBy": None,
                "rejectionReason": None,
                "notes": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            all_documents.append(document)
        
        if all_documents:
            await db.visa_client_documents.insert_many(all_documents)
            logger.info(f"✅ Created {len(all_documents)} required documents")
        
        # Generate magic link for the new user
        magic_token = secrets.token_urlsafe(16)
        magic_link_doc = {
            "phone": request.phone,
            "magicToken": magic_token,
            "userId": user_id,
            "userState": "U1",
            "createdAt": datetime.now(timezone.utc)
        }
        
        # Check if magic link already exists for this phone
        existing_link = await db.magic_links.find_one({'phone': request.phone})
        if existing_link:
            await db.magic_links.update_one(
                {'phone': request.phone},
                {'$set': magic_link_doc}
            )
            logger.info(f"🔄 Updated magic link for: {request.phone}")
        else:
            await db.magic_links.insert_one(magic_link_doc)
            logger.info(f"✅ Created magic link for: {request.phone}")
        
        # Get frontend URL for magic link
        frontend_url = os.getenv('FRONTEND_URL')
        if not frontend_url:
            backend_url = os.getenv('REACT_APP_BACKEND_URL', 'https://classic-cases-hub.preview.emergentagent.com')
            frontend_url = backend_url.replace('/api', '')
        
        magic_link_url = f"{frontend_url}/welcome/{magic_token}"
        logger.info(f"🎉 Magic link generated: {magic_link_url}")
        
        # Send data to N8N webhooks including magic link
        n8n_webhook_urls = [
            "https://n8n.urpeailab.com/webhook/464cb950-d5f8-4216-9d49-186421028558",
            "https://n8n.urpeailab.com/webhook/3198544c-d830-4e81-b71d-54fceb5ab9f16"
        ]
        
        try:
            import httpx
            
            webhook_data = {
                "user": {
                    "id": user_id,
                    "name": request.name,
                    "email": request.email or "",
                    "phone": request.phone,
                    "cvUrl": request.cvUrl or "",
                    "userState": "U1",
                    "createdAt": user["createdAt"],
                    "magicLink": magic_link_url
                },
                "case": {
                    "id": visa_case.id,
                    "caseId": visa_case.id,  # Use id as caseId
                    "visaType": visa_case.visaType,
                    "stages": len(stages),
                    "deliverables": len(all_deliverables),
                    "documents": len(all_documents),
                    "coordinatorId": visa_case.coordinatorId
                },
                "metadata": {
                    "source": "urpe_admin_panel",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            
            # Log the webhook payload for debugging
            logger.info(f"📤 Sending to N8N webhooks - CV URL: {request.cvUrl or 'NOT PROVIDED'}")
            logger.info(f"📦 Webhook payload user data: name={request.name}, email={request.email}, phone={request.phone}")
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Send to both webhooks
                for i, webhook_url in enumerate(n8n_webhook_urls, 1):
                    try:
                        webhook_response = await client.post(webhook_url, json=webhook_data)
                        
                        if webhook_response.status_code == 200:
                            logger.info(f"✅ Data sent to N8N webhook #{i} successfully for user {user_id}")
                        else:
                            logger.warning(f"⚠️ N8N webhook #{i} returned status {webhook_response.status_code}")
                    except Exception as individual_webhook_error:
                        logger.error(f"❌ Error sending to N8N webhook #{i}: {str(individual_webhook_error)}")
                    
        except Exception as webhook_error:
            # Don't fail the user creation if webhook fails
            logger.error(f"❌ Error sending data to N8N webhooks: {str(webhook_error)}")
        
        # 📤 Notify case webhook about new case creation (admin created)
        await notify_case_webhook(
            action="caso_creado",
            client_data={
                "id": user_id,
                "name": request.name,
                "email": request.email or "",
                "phone": request.phone or ""
            },
            case_data={
                "caseId": visa_case.id,
                "visaType": visa_case.visaType,
                "status": visa_case.status.value if hasattr(visa_case.status, 'value') else str(visa_case.status),
                "currentStage": visa_case.currentStage
            },
            extra_data={
                "source": "admin_panel_create",
                "stagesCount": len(stages),
                "deliverablesCount": len(all_deliverables),
                "documentsCount": len(all_documents),
                "createdBy": staff_payload.get('name', 'Admin')
            }
        )
        
        # Return success response including magic link
        return {
            "success": True,
            "message": "User and visa case created successfully",
            "user": {
                "id": user_id,
                "name": request.name,
                "email": request.email or "",
                "phone": request.phone or ""
            },
            "case": {
                "id": visa_case.id,
                "caseId": visa_case.id,  # Use id as caseId
                "visaType": visa_case.visaType,
                "stages": len(stages),
                "deliverables": len(all_deliverables),
                "documents": len(all_documents)
            },
            "magicLink": magic_link_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user with case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== INTEGRATION ENDPOINT: Upsert Client =====

class IntegrationUpsertPayload(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    cvUrl: Optional[str] = None
    originalFileUrl: Optional[str] = None
    visaType: Optional[str] = "EB-2 NIW"

@api_router.post("/integration/upsert-client")
async def integration_upsert_client(
    request: IntegrationUpsertPayload,
    authorization: Optional[str] = Header(None)
):
    """
    Endpoint de integración (N8N / externos).
    Crea o actualiza un cliente + visa_case usando Bearer token estático.
    """
    # Validar token
    expected = os.environ.get("INTEGRATION_API_TOKEN", "")
    token = (authorization or "").replace("Bearer ", "").strip()
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Token de integración inválido")

    import re as _re
    now_iso = datetime.now(timezone.utc).isoformat()

    # Verificar si el teléfono ya está en uso por otro usuario
    clean_phone = _re.sub(r'[^\d+]', '', request.phone or "")
    phone_in_use = False
    if clean_phone:
        phone_owner = await db.users.find_one({"phone": clean_phone})
        if phone_owner and str(phone_owner.get("_id", phone_owner.get("id", ""))) != str((await db.users.find_one({"email": request.email}) or {}).get("_id", "")):
            phone_in_use = True
            logger.info(f"[integration] Phone {clean_phone} already in use — skipping phone field")
    MASTER_CASE_ID = "master_case_eb2_niw"

    # ─── Buscar usuario por email ────────────────────────────────────────────
    existing_user = await db.users.find_one({"email": request.email})

    if existing_user:
        # ── UPDATE ──────────────────────────────────────────────────────────
        user_id = str(existing_user.get("_id") or existing_user.get("id", ""))
        update_fields = {
            "updatedAt": now_iso,
            "name": request.name,
        }
        if request.phone and not phone_in_use:
            update_fields["phone"] = _re.sub(r'[^\d+]', '', request.phone)
        if request.cvUrl:
            update_fields["cvUrl"] = request.cvUrl
        if request.originalFileUrl:
            update_fields["originalFileUrl"] = request.originalFileUrl
        if request.visaType:
            update_fields["visaType"] = request.visaType

        await db.users.update_one({"_id": existing_user["_id"]}, {"$set": update_fields})
        action = "updated"
        logger.info(f"✅ [integration] User updated: {user_id} ({request.email})")
    else:
        # ── CREATE ──────────────────────────────────────────────────────────
        user_id = str(uuid.uuid4())
        clean_phone = _re.sub(r'[^\d+]', '', request.phone or "")
        new_user = {
            "_id": user_id,
            "id": user_id,
            "name": request.name,
            "email": request.email,
            "phone": clean_phone if not phone_in_use else "",
            "userState": "U1",
            "cvUrl": request.cvUrl or None,
            "originalFileUrl": request.originalFileUrl or None,
            "visaType": request.visaType or "EB-2 NIW",
            "createdBy": {"id": "integration", "name": "Integration API"},
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }
        await db.users.insert_one(new_user)
        action = "created"
        logger.info(f"✅ [integration] User created: {user_id} ({request.email})")

    # ─── Guardar CV en user_cvs si viene ────────────────────────────────────
    if request.cvUrl:
        existing_cv = await db.user_cvs.find_one({"userId": user_id, "url": request.cvUrl})
        if not existing_cv:
            await db.user_cvs.insert_one({
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "url": request.cvUrl,
                "fileName": f"CV_{request.name.replace(' ', '_')}.pdf",
                "fileType": "cv",
                "source": "integration",
                "uploadedBy": {"id": "integration", "name": "Integration API"},
                "uploadedAt": now_iso,
                "active": True,
            })

    # ─── Guardar documento original en user_cvs si viene ────────────────────
    if request.originalFileUrl:
        existing_orig = await db.user_cvs.find_one({"userId": user_id, "url": request.originalFileUrl})
        if not existing_orig:
            await db.user_cvs.insert_one({
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "url": request.originalFileUrl,
                "fileName": f"Documento_Original_{request.name.replace(' ', '_')}.pdf",
                "fileType": "original_document",
                "source": "integration",
                "uploadedBy": {"id": "integration", "name": "Integration API"},
                "uploadedAt": now_iso,
                "active": True,
            })

    # ─── Upsert visa_case ────────────────────────────────────────────────────
    existing_case = await db.visa_cases.find_one({"userId": user_id, "isMasterCase": {"$ne": True}})
    case_id = None
    case_action = "none"

    if existing_case:
        case_id = str(existing_case.get("id") or existing_case.get("_id", ""))
        await db.visa_cases.update_one(
            {"_id": existing_case["_id"]},
            {"$set": {
                "visaType": request.visaType or existing_case.get("visaType", "EB-2 NIW"),
                "updatedAt": now_iso,
            }}
        )
        case_action = "updated"
        logger.info(f"✅ [integration] Visa case updated: {case_id}")
    else:
        # Crear caso desde master template
        master_case = await db.visa_cases.find_one({"caseId": MASTER_CASE_ID, "isMasterCase": True})
        if not master_case:
            logger.warning("[integration] Master case template not found — caso no creado")
        else:
            visa_case = VisaCase(
                userId=user_id,
                visaType=request.visaType or "EB-2 NIW",
                coordinatorId=None,
                salesRepId=None,
                status=CaseStatus.ELIGIBILITY_APPROVED,
                currentStage=1,
                overallProgress=0,
                eligibilityDate=datetime.now(timezone.utc),
            )
            case_dict = visa_case.model_dump()
            case_dict["_id"] = case_dict["id"]
            case_dict["createdBy"] = {"id": "integration", "name": "Integration API"}
            case_dict["createdAt"] = case_dict["createdAt"].isoformat()
            case_dict["updatedAt"] = case_dict["updatedAt"].isoformat()
            if case_dict.get("eligibilityDate"):
                case_dict["eligibilityDate"] = case_dict["eligibilityDate"].isoformat()
            await db.visa_cases.insert_one(case_dict)
            case_id = visa_case.id

            # Copiar stages del master
            master_stages = await db.visa_stages.find({"caseId": MASTER_CASE_ID}).sort("stageNumber", 1).to_list(None)
            stages = []
            for ms in master_stages:
                sid = str(uuid.uuid4())
                stages.append({
                    "_id": sid, "id": sid, "caseId": case_id,
                    "stageNumber": ms["stageNumber"], "name": ms["name"],
                    "description": ms.get("description", ""), "percentage": ms.get("percentage", 0),
                    "amount": ms.get("amount", 0), "status": ms.get("status", "locked"),
                    "isPaid": False, "completedDeliverablesCount": 0,
                    "totalDeliverablesCount": ms.get("totalDeliverablesCount", 0),
                    "startDate": None, "completionDate": None,
                    "createdAt": now_iso, "updatedAt": now_iso,
                })
            if stages:
                await db.visa_stages.insert_many(stages)

            # Copiar entregables del master
            stage_id_map = {s["stageNumber"]: s["_id"] for s in stages}
            master_delivs = await db.visa_deliverables.find({"caseId": MASTER_CASE_ID}).to_list(None)
            delivs = []
            for md in master_delivs:
                did = str(uuid.uuid4())
                delivs.append({
                    "_id": did, "id": did, "caseId": case_id,
                    "stageId": stage_id_map.get(md["stageNumber"]),
                    "stageNumber": md["stageNumber"],
                    "deliverableName": md.get("deliverableName", ""),
                    "name": md.get("name", {}), "description": md.get("description", ""),
                    "status": "draft", "fileUrl": None, "fileName": None,
                    "uploadedAt": None, "validatedAt": None,
                    "createdAt": now_iso, "updatedAt": now_iso,
                })
            if delivs:
                await db.visa_deliverables.insert_many(delivs)

            # Copiar documentos del master
            master_docs = await db.visa_client_documents.find({"caseId": MASTER_CASE_ID}).to_list(None)
            docs = []
            for md in master_docs:
                docid = str(uuid.uuid4())
                docs.append({
                    "_id": docid, "id": docid, "caseId": case_id,
                    "stageNumber": md["stageNumber"],
                    "documentName": md.get("documentName", ""),
                    "name": md.get("name", {}), "description": md.get("description", ""),
                    "status": "pending", "required": md.get("required", False),
                    "requiresPhysicalCopy": md.get("requiresPhysicalCopy", False),
                    "fileUrl": None, "createdAt": now_iso, "updatedAt": now_iso,
                })
            if docs:
                await db.visa_client_documents.insert_many(docs)

            case_action = "created"
            logger.info(f"✅ [integration] Visa case created: {case_id} with {len(stages)} stages")

    return {
        "success": True,
        "status": action,
        "userId": user_id,
        "email": request.email,
        "caseAction": case_action,
        "caseId": case_id,
    }


# ===== Visa Cases Endpoints =====

class VisaCaseCreateRequest(BaseModel):
    userId: str
    templateId: Optional[str] = "eb2-niw"  # Template ID for case type
    visaType: Optional[str] = None  # Will be set from template if not provided
    coordinatorId: Optional[str] = None
    salesRepId: Optional[str] = None
    notes: Optional[str] = None

class VisaCaseUpdateRequest(BaseModel):
    visaType: Optional[str] = None
    coordinatorId: Optional[str] = None
    salesRepId: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    totalAmount: Optional[float] = None

@api_router.post("/admin/visa-cases")
async def create_visa_case(
    request: VisaCaseCreateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new visa case for a client using a template"""
    try:
        # Todos los usuarios del staff pueden crear casos
        # No se requiere verificación de permisos específicos
        
        # Verificar que el usuario existe
        from bson import ObjectId
        user = None
        try:
            # Try with ObjectId first
            user_id = ObjectId(request.userId)
            user = await db.users.find_one({'_id': user_id})
        except Exception:
            # If ObjectId conversion fails, try with string ID
            user = await db.users.find_one({'_id': request.userId})
        
        # Also try with 'id' field if not found
        if not user:
            user = await db.users.find_one({'id': request.userId})
            
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Use master case from MongoDB instead of hardcoded templates
        MASTER_CASE_ID = "master_case_eb2_niw"
        master_case = await db.visa_cases.find_one({"caseId": MASTER_CASE_ID, "isMasterCase": True})
        
        if not master_case:
            raise HTTPException(status_code=500, detail="Master case template not found in database")
        
        visa_type = request.visaType or master_case.get("visaType", "EB-2 NIW")
        
        # Crear el caso de visa con estado "on_hold" por defecto
        visa_case = VisaCase(
            userId=request.userId,
            visaType=visa_type,
            coordinatorId=request.coordinatorId if request.coordinatorId else None,
            salesRepId=request.salesRepId if request.salesRepId else None,
            status="on_hold",  # Estado por defecto: En Espera
            currentStage=1,
            overallProgress=0,
            eligibilityDate=datetime.now(timezone.utc),
            notes=request.notes
        )
        
        case_dict = visa_case.model_dump()
        case_dict['_id'] = case_dict['id']  # MongoDB necesita _id
        case_dict['templateId'] = request.templateId or "eb2-niw"  # ⭐ NUEVO: Guardar template ID
        case_dict['createdBy'] = {
            "id": staff_payload['id'],
            "name": staff_payload.get('name', 'Staff'),
            "email": staff_payload.get('email', '')
        }
        case_dict['createdAt'] = case_dict['createdAt'].isoformat()
        case_dict['updatedAt'] = case_dict['updatedAt'].isoformat()
        if case_dict.get('eligibilityDate'):
            case_dict['eligibilityDate'] = case_dict['eligibilityDate'].isoformat()
        
        # Insertar caso
        await db.visa_cases.insert_one(case_dict)
        
        # Copy stages from master case
        master_stages_cursor = db.visa_stages.find({'caseId': MASTER_CASE_ID}).sort('stageNumber', 1)
        master_stages = await master_stages_cursor.to_list(length=None)
        
        logger.info(f"📋 Copying {len(master_stages)} stages from master case...")
        
        stages = []
        for master_stage in master_stages:
            stage_id = str(uuid.uuid4())
            stage = {
                "_id": stage_id,
                "id": stage_id,
                "caseId": visa_case.id,
                "stageNumber": master_stage["stageNumber"],
                "name": master_stage["name"],
                "description": master_stage.get("description", ""),
                "percentage": master_stage.get("percentage", 0),
                "amount": master_stage.get("amount", 0),
                "status": master_stage.get("status", "locked"),
                "isPaid": False,
                "completedDeliverablesCount": 0,
                "totalDeliverablesCount": master_stage.get("totalDeliverablesCount", 0),
                "startDate": None,
                "completionDate": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            stages.append(stage)
        
        if stages:
            await db.visa_stages.insert_many(stages)
            logger.info(f"✅ Created {len(stages)} stages")
        
        # Copy deliverables from master case
        master_deliverables_cursor = db.visa_deliverables.find({'caseId': MASTER_CASE_ID})
        master_deliverables = await master_deliverables_cursor.to_list(length=None)
        
        logger.info(f"📦 Copying {len(master_deliverables)} deliverables from master case...")
        
        all_deliverables = []
        stage_id_map = {s["stageNumber"]: s["_id"] for s in stages}
        
        for master_deliv in master_deliverables:
            deliverable_id = str(uuid.uuid4())
            new_stage_id = stage_id_map.get(master_deliv["stageNumber"])
            
            deliverable = {
                "_id": deliverable_id,
                "id": deliverable_id,
                "caseId": visa_case.id,
                "stageId": new_stage_id,
                "stageNumber": master_deliv["stageNumber"],
                "deliverableName": master_deliv.get("deliverableName", ""),
                "name": master_deliv.get("name", {}),
                "description": master_deliv.get("description", ""),
                "status": "draft",
                "fileUrl": None,
                "fileName": None,
                "fileSize": None,
                "uploadedAt": None,
                "uploadedBy": None,
                "validatedAt": None,
                "validatedBy": None,
                "notes": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            all_deliverables.append(deliverable)
        
        if all_deliverables:
            await db.visa_deliverables.insert_many(all_deliverables)
            logger.info(f"✅ Created {len(all_deliverables)} deliverables")
        
        # Copy required documents from master case
        master_documents_cursor = db.visa_client_documents.find({'caseId': MASTER_CASE_ID})
        master_documents = await master_documents_cursor.to_list(length=None)
        
        logger.info(f"📄 Copying {len(master_documents)} required documents from master case...")
        
        all_documents = []
        for master_doc in master_documents:
            document_id = str(uuid.uuid4())
            document = {
                "_id": document_id,
                "id": document_id,
                "caseId": visa_case.id,
                "stageNumber": master_doc["stageNumber"],
                "documentName": master_doc.get("documentName", ""),
                "name": master_doc.get("name", {}),
                "description": master_doc.get("description", ""),
                "status": "pending",
                "required": master_doc.get("required", False),
                "requiresPhysicalCopy": master_doc.get("requiresPhysicalCopy", False),
                "fileUrl": None,
                "fileName": None,
                "fileSize": None,
                "uploadedAt": None,
                "reviewedAt": None,
                "reviewedBy": None,
                "rejectionReason": None,
                "notes": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            all_documents.append(document)
        
        if all_documents:
            await db.visa_client_documents.insert_many(all_documents)
            logger.info(f"✅ Created {len(all_documents)} required documents")
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='create',
            resource='visa_case',
            resource_id=visa_case.id,
            details={
                'userId': request.userId,
                'visaType': visa_type,
                'templateId': request.templateId or "eb2-niw",
                'coordinatorId': visa_case.coordinatorId
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"✅ Visa case created from master template: {visa_case.id} for user {request.userId}")
        logger.info(f"   - {len(stages)} stages, {len(all_deliverables)} deliverables, {len(all_documents)} documents")
        
        # 📤 Notify case webhook about new case creation
        user_info = await db.users.find_one({"id": request.userId}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        await notify_case_webhook(
            action="caso_creado",
            client_data={
                "id": request.userId,
                "name": user_info.get("name", "") if user_info else "",
                "email": user_info.get("email", "") if user_info else "",
                "phone": user_info.get("phone", "") if user_info else ""
            },
            case_data={
                "caseId": visa_case.id,
                "visaType": visa_case.visaType,
                "status": visa_case.status.value if hasattr(visa_case.status, 'value') else str(visa_case.status),
                "currentStage": visa_case.currentStage
            },
            extra_data={
                "source": "admin_create_visa_case",
                "stagesCount": len(stages),
                "deliverablesCount": len(all_deliverables),
                "documentsCount": len(all_documents)
            }
        )
        
        return {
            'case': case_dict,
            'stages': stages,
            'deliverables': all_deliverables,
            'documents': all_documents,
            'message': f'Visa case created successfully from master template'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create visa case error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create visa case: {str(e)}")


@api_router.get("/admin/visa-cases")
async def get_all_visa_cases(
    staff_payload: dict = Depends(verify_staff_token),
    page: int = 1,
    limit: int = 50,
    status: str = None,
    visaType: str = None,
    coordinatorId: str = None,
    coordinatorName: str = None,
    salesRepId: str = None,
    salesRepName: str = None,
    advisorName: str = None,
    stageFilter: int = None,
    coordinatorOrAdvisor: str = None,
    unassigned: bool = None,
    search: str = None,
    dateFrom: str = None,
    dateTo: str = None,
    progressMin: int = None,
    progressMax: int = None,
    sortBy: str = "priority",
    userId: str = None
):
    """Get list of all visa cases with filters, search and intelligent sorting"""
    try:
        # Construir query
        query = {}
        
        # Filtro por userId específico (para página de detalle de usuario)
        if userId:
            query['userId'] = userId
        
        if status:
            query['status'] = status
        if visaType:
            query['visaType'] = visaType
        if coordinatorId:
            query['coordinatorId'] = coordinatorId
        
        # Filtro por nombre de coordinador - buscar primero el ID del coordinador
        if coordinatorName and coordinatorName != 'all':
            # Buscar el staff por nombre para obtener su ID
            coordinator_staff = await db.staff.find_one(
                {'name': {'$regex': f'^{coordinatorName}$', '$options': 'i'}},
                {'_id': 1, 'id': 1}
            )
            if coordinator_staff:
                # Staff uses _id as string UUID, not 'id' field
                coord_id = str(coordinator_staff.get('_id'))
                query['coordinatorId'] = coord_id
            else:
                # Si no se encuentra el coordinador, retornar vacío
                query['coordinatorId'] = 'NOT_FOUND_COORDINATOR'
        
        if salesRepId:
            query['salesRepId'] = salesRepId
        
        # El filtro por etapa pagada se hará post-procesamiento porque lastPaidStage se calcula después
        # de obtener las etapas de cada caso
        
        # El filtro coordinatorOrAdvisor se aplica post-procesamiento porque advisorName viene del usuario
        
        # Filtro por nombre de vendedor - buscar en sellerId
        if salesRepName and salesRepName != 'all':
            seller_staff = await db.staff.find_one(
                {'name': {'$regex': f'^{salesRepName}$', '$options': 'i'}},
                {'_id': 1, 'id': 1}
            )
            if seller_staff:
                # Staff uses _id as string UUID, not 'id' field
                seller_id = str(seller_staff.get('_id'))
                query['sellerId'] = seller_id
            else:
                query['sellerId'] = 'NOT_FOUND_SELLER'
        
        # Filtro para casos sin coordinador asignado (solo admins)
        # Solo casos que NO tienen coordinatorId O tienen coordinatorId vacío
        if unassigned:
            query['$or'] = [
                {'coordinatorId': None},
                {'coordinatorId': ''},
                {'coordinatorId': {'$exists': False}}
            ]
        
        # Si es coordinador o advisor, ver sus casos asignados (como coordinador O como vendedor)
        user_role = staff_payload.get('role', 'advisor')
        staff_id = staff_payload.get('id')
        if user_role in ['coordinator', 'advisor'] and staff_id:
            query['$or'] = [
                {'coordinatorId': staff_id},
                {'salesRepId': staff_id},
                {'sellerId': staff_id}  # Support both field names
            ]
        
        # Acreditador: solo ve casos con más de 1 etapa pagada (filtro post-query)
        is_acreditador = user_role == 'acreditador'
        
        # Si hay búsqueda, buscar en usuarios primero y luego en casos
        if search:
            # Buscar usuarios por nombre, email o teléfono usando regex case-insensitive
            user_query = {
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}},
                    {'phone': {'$regex': search, '$options': 'i'}}
                ]
            }
            
            # Obtener IDs de usuarios que coinciden
            matching_users = await db.users.find(user_query, {'_id': 1, 'id': 1}).to_list(length=1000)
            user_ids = []
            for user in matching_users:
                # Agregar tanto _id como id (pueden ser diferentes formatos)
                if '_id' in user:
                    user_ids.append(user['_id'])
                    # También agregar como string para casos que usen string IDs
                    user_ids.append(str(user['_id']))
                if 'id' in user and user['id'] not in user_ids:
                    user_ids.append(user['id'])
            
            # Filtrar casos por userId que coincidan con los usuarios encontrados
            if user_ids:
                query['userId'] = {'$in': user_ids}
            else:
                # Si no hay usuarios que coincidan, no mostrar ningún caso
                # (esto fuerza que el resultado sea vacío)
                query['userId'] = {'$in': []}  # Array vacío = no resultados
        
        # Filtro de rango de fechas
        if dateFrom or dateTo:
            date_query = {}
            if dateFrom:
                # Parse fecha desde (inicio del día)
                date_query['$gte'] = dateFrom + "T00:00:00"
            if dateTo:
                # Parse fecha hasta (final del día)
                date_query['$lte'] = dateTo + "T23:59:59"
            query['createdAt'] = date_query
        
        # Filtro de rango de progreso
        if progressMin is not None or progressMax is not None:
            progress_query = {}
            if progressMin is not None:
                progress_query['$gte'] = progressMin
            if progressMax is not None:
                progress_query['$lte'] = progressMax
            query['overallProgress'] = progress_query
        
        # Obtener TODOS los casos (sin paginación todavía) para calcular score
        all_cases = await db.visa_cases.find(query).to_list(length=None)
        total = len(all_cases)
        
        # ============ OPTIMIZACIÓN: BATCH QUERIES ============
        # Pre-cargar todos los datos relacionados en memoria para evitar N+1 queries
        
        # 1. Recopilar todos los IDs únicos
        user_ids = set()
        coordinator_ids = set()
        seller_ids = set()
        case_ids = set()
        
        for case in all_cases:
            if case.get('userId'):
                user_ids.add(case.get('userId'))
            if case.get('coordinatorId'):
                coordinator_ids.add(case.get('coordinatorId'))
            seller_id = case.get('salesRepId') or case.get('sellerId')
            if seller_id:
                seller_ids.add(seller_id)
            case_id = case.get('id') or case.get('_id')
            if case_id:
                case_ids.add(str(case_id))
        
        # 2. Cargar todos los usuarios en batch
        users_map = {}
        if user_ids:
            # Intentar cargar por ObjectId y por string id
            from bson import ObjectId
            object_ids = []
            string_ids = list(user_ids)
            
            for uid in user_ids:
                if isinstance(uid, str) and len(uid) == 24:
                    try:
                        object_ids.append(ObjectId(uid))
                    except:
                        pass
            
            users_query = {'$or': []}
            if object_ids:
                users_query['$or'].append({'_id': {'$in': object_ids}})
            if string_ids:
                users_query['$or'].append({'id': {'$in': string_ids}})
                users_query['$or'].append({'_id': {'$in': string_ids}})
            
            if users_query['$or']:
                users_list = await db.users.find(users_query).to_list(length=None)
                for u in users_list:
                    # Map by both _id and id
                    if u.get('_id'):
                        users_map[str(u['_id'])] = u
                    if u.get('id'):
                        users_map[str(u['id'])] = u
        
        # 3. Cargar todo el staff en batch (para coordinadores y vendedores)
        staff_map = {}
        all_staff_ids = coordinator_ids | seller_ids
        if all_staff_ids:
            staff_list = await db.staff.find({
                '$or': [
                    {'_id': {'$in': list(all_staff_ids)}},
                    {'id': {'$in': list(all_staff_ids)}}
                ]
            }).to_list(length=None)
            for s in staff_list:
                if s.get('_id'):
                    staff_map[str(s['_id'])] = s
                if s.get('id'):
                    staff_map[str(s['id'])] = s
        
        # 4. Cargar todas las etapas pagadas en batch (última etapa por caso)
        stages_map = {}  # case_id -> last_paid_stage
        total_stages_map = {}  # case_id -> total_stages
        if case_ids:
            # Agregación para obtener última etapa pagada por caso
            pipeline = [
                {'$match': {'caseId': {'$in': list(case_ids)}, 'isPaid': True}},
                {'$group': {
                    '_id': '$caseId',
                    'lastPaidStage': {'$max': '$stageNumber'}
                }}
            ]
            stages_agg = await db.visa_stages.aggregate(pipeline).to_list(length=None)
            for s in stages_agg:
                stages_map[s['_id']] = s['lastPaidStage']
            
            # Contar total de etapas por caso
            count_pipeline = [
                {'$match': {'caseId': {'$in': list(case_ids)}}},
                {'$group': {
                    '_id': '$caseId',
                    'count': {'$sum': 1}
                }}
            ]
            count_agg = await db.visa_stages.aggregate(count_pipeline).to_list(length=None)
            for c in count_agg:
                total_stages_map[c['_id']] = c['count']
        
        # ============ FIN BATCH QUERIES ============
        
        # Para cada caso, usar los datos pre-cargados
        for case in all_cases:
            # Obtener usuario desde el mapa
            user_id = case.get('userId')
            user = users_map.get(str(user_id)) if user_id else None
            
            if user:
                case['userName'] = user.get('name', 'Cliente Sin Nombre')
                case['userEmail'] = user.get('email', 'No disponible')
                case['userPhone'] = user.get('phone', 'No disponible')
                # Obtener advisor/vendedor del usuario
                advisor = user.get('advisor')
                if advisor and isinstance(advisor, dict):
                    case['advisorName'] = advisor.get('name', '')
                    case['advisorTitle'] = advisor.get('title', '')
                elif advisor and isinstance(advisor, str):
                    case['advisorName'] = advisor
            else:
                case['userName'] = 'Cliente Sin Nombre'
                case['userEmail'] = 'No disponible'
                case['userPhone'] = 'No disponible'
            
            # Obtener coordinador/a desde el mapa pre-cargado
            if case.get('coordinatorId'):
                coordinator = staff_map.get(str(case['coordinatorId']))
                if coordinator:
                    coord_name = coordinator.get('name')
                    if not coord_name:
                        coord_name = f"{coordinator.get('firstName', '')} {coordinator.get('lastName', '')}".strip()
                    case['coordinatorName'] = coord_name if coord_name else 'Coordinador Sin Nombre'
            
            # Obtener vendedora desde el mapa pre-cargado
            seller_id = case.get('salesRepId') or case.get('sellerId')
            if seller_id:
                sales_rep = staff_map.get(str(seller_id))
                if sales_rep:
                    sales_name = sales_rep.get('name')
                    if not sales_name:
                        sales_name = f"{sales_rep.get('firstName', '')} {sales_rep.get('lastName', '')}".strip()
                    case['salesRepName'] = sales_name if sales_name else 'Vendedora Sin Nombre'
                    case['advisorName'] = sales_name if sales_name else ''
            
            # ============ OBTENER ÚLTIMA ETAPA PAGADA DESDE MAPA ============
            case_id_for_stages = str(case.get('caseId') or case.get('id') or case.get('_id'))
            case['lastPaidStage'] = stages_map.get(case_id_for_stages, 0)
            case['totalStages'] = total_stages_map.get(case_id_for_stages, 11)
            
            # ============ CALCULAR SCORE DE PRIORIDAD (siempre) ============
            # El score siempre se calcula para mostrarlo en las cards
            if True:  # Siempre calcular
                case_id = case.get('id')
                current_stage = case.get('currentStage', 1)
                
                # Obtener stats de documentos de la etapa actual
                docs_stats = await db.visa_client_documents.aggregate([
                    {
                        "$match": {
                            "caseId": case_id,
                            "stageNumber": current_stage
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "total_required": {
                                "$sum": {"$cond": [{"$eq": ["$required", True]}, 1, 0]}
                            },
                            "required_validated": {
                                "$sum": {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$eq": ["$required", True]},
                                                {"$eq": ["$status", "validated"]}
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },
                            "uploaded_pending": {
                                "$sum": {"$cond": [{"$eq": ["$status", "uploaded"]}, 1, 0]}
                            }
                        }
                    }
                ]).to_list(1)
                
                # Entregables pendientes de etapa actual
                deliverables_pending = await db.visa_deliverables.count_documents({
                    "caseId": case_id,
                    "stageNumber": current_stage,
                    "isCompleted": False
                })
                
                # Etapas sin pagar
                stages_unpaid = await db.visa_stages.count_documents({
                    "caseId": case_id,
                    "isPaid": False
                })
                
                # Calcular días desde última actualización
                from datetime import datetime, timezone
                try:
                    updated_at_str = case.get('updatedAt', case.get('createdAt'))
                    if isinstance(updated_at_str, str):
                        updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                    else:
                        updated_at = updated_at_str
                    days_since_update = (datetime.now(timezone.utc) - updated_at).days
                except:
                    days_since_update = 0
                
                # ============ CALCULAR URGENCIA (50 pts) ============
                urgency_score = 0
                urgency_breakdown = []
                
                total_required = 0
                required_validated = 0
                uploaded_pending = 0
                all_required_complete = False
                
                if docs_stats:
                    stats = docs_stats[0]
                    total_required = stats['total_required']
                    required_validated = stats['required_validated']
                    uploaded_pending = stats['uploaded_pending']
                    
                    # A. Docs requeridos completos (validated)
                    all_required_complete = (
                        total_required > 0 and
                        required_validated == total_required
                    )
                    
                    if all_required_complete:
                        urgency_score += 40  # MÁXIMA PRIORIDAD
                        urgency_breakdown.append(f"✅ Todos los docs requeridos completos ({required_validated}/{total_required}): +40 pts")
                    # B. Docs pendientes de aprobar (uploaded)
                    elif uploaded_pending > 0:
                        urgency_score += 25
                        urgency_breakdown.append(f"⚠️ {uploaded_pending} doc(s) pendientes de aprobar: +25 pts")
                    else:
                        urgency_breakdown.append(f"⏳ Sin docs completos o pendientes: 0 pts")
                else:
                    urgency_breakdown.append("📄 Sin documentos en etapa actual: 0 pts")
                
                # C. Status activo
                if case.get('status') == 'active':
                    urgency_score += 15
                    urgency_breakdown.append("🟢 Status activo: +15 pts")
                else:
                    urgency_breakdown.append(f"⏸️ Status {case.get('status')}: 0 pts")
                
                # D. Sin actualizar > 3 días
                if days_since_update > 3:
                    urgency_score += 10
                    urgency_breakdown.append(f"⏰ Sin actualizar hace {days_since_update} días: +10 pts")
                else:
                    urgency_breakdown.append(f"🕐 Actualizado hace {days_since_update} día(s): 0 pts")
                
                urgency_score = min(urgency_score, 50)
                
                # ============ CALCULAR ACTIVIDAD (30 pts) ============
                activity_score = 0
                activity_breakdown = []
                
                if deliverables_pending > 0:
                    activity_score += 15
                    activity_breakdown.append(f"📋 {deliverables_pending} entregable(s) pendientes: +15 pts")
                else:
                    activity_breakdown.append("✓ Sin entregables pendientes: 0 pts")
                
                if stages_unpaid > 0:
                    activity_score += 10
                    activity_breakdown.append(f"💰 {stages_unpaid} etapa(s) sin pagar: +10 pts")
                else:
                    activity_breakdown.append("✓ Todas las etapas pagadas: 0 pts")
                
                if current_stage <= 3:
                    activity_score += 5
                    activity_breakdown.append(f"🆕 Etapa inicial ({current_stage}): +5 pts")
                else:
                    activity_breakdown.append(f"📊 Etapa avanzada ({current_stage}): 0 pts")
                
                activity_score = min(activity_score, 30)
                
                # ============ CALCULAR PROGRESO (20 pts) ============
                progress = case.get('overallProgress', 0)
                progress_score = 20 - (progress * 0.2)
                progress_score = max(0, progress_score)
                progress_breakdown = [f"📈 Progreso: {progress}% → {round(progress_score, 1)} pts"]
                
                # ============ SCORE TOTAL ============
                total_score = urgency_score + activity_score + progress_score
                case['priorityScore'] = round(total_score, 1)
                case['scoreBreakdown'] = {
                    'urgency': {
                        'score': round(urgency_score, 1),
                        'max': 50,
                        'details': urgency_breakdown
                    },
                    'activity': {
                        'score': round(activity_score, 1),
                        'max': 30,
                        'details': activity_breakdown
                    },
                    'progress': {
                        'score': round(progress_score, 1),
                        'max': 20,
                        'details': progress_breakdown
                    }
                }
        
        # ============ FILTRO POST-PROCESAMIENTO POR ADVISOR ============
        # El advisor está en el usuario, no en el caso, así que filtramos después
        if advisorName and advisorName != 'all':
            all_cases = [c for c in all_cases if c.get('advisorName', '').lower() == advisorName.lower()]
            total = len(all_cases)
        
        # ============ FILTRO POST-PROCESAMIENTO POR ETAPA PAGADA ============
        # lastPaidStage se calcula después de obtener las etapas, así que filtramos aquí
        if stageFilter is not None and stageFilter >= 0:
            all_cases = [c for c in all_cases if c.get('lastPaidStage', 0) == stageFilter]
            total = len(all_cases)
        
        # ============ FILTRO ACREDITADOR: solo casos con +1 etapa pagada ============
        if is_acreditador:
            all_cases = [c for c in all_cases if c.get('lastPaidStage', 0) > 1]
            total = len(all_cases)
        
        # ============ FILTRO POST-PROCESAMIENTO POR COORDINADOR O VENDEDOR ============
        # Para rol de coordinador: ver casos donde es coordinador O es el vendedor (salesRep)
        if coordinatorOrAdvisor:
            name_lower = coordinatorOrAdvisor.lower()
            all_cases = [
                c for c in all_cases 
                if (c.get('coordinatorName', '').lower() == name_lower or 
                    c.get('salesRepName', '').lower() == name_lower or
                    c.get('advisorName', '').lower() == name_lower)
            ]
            total = len(all_cases)
        
        # ============ APLICAR ORDENAMIENTO ============
        if sortBy == "priority":
            all_cases.sort(key=lambda x: x.get('priorityScore', 0), reverse=True)
        elif sortBy == "recent":
            all_cases.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        elif sortBy == "oldest":
            all_cases.sort(key=lambda x: x.get('createdAt', ''))
        elif sortBy == "progress_desc":
            all_cases.sort(key=lambda x: x.get('overallProgress', 0), reverse=True)
        elif sortBy == "progress_asc":
            all_cases.sort(key=lambda x: x.get('overallProgress', 0))
        elif sortBy == "stage":
            all_cases.sort(key=lambda x: x.get('currentStage', 0))
        elif sortBy == "status":
            status_order = {'active': 0, 'elegibility_approved': 1, 'pending': 2, 'completed': 3}
            all_cases.sort(key=lambda x: status_order.get(x.get('status', 'pending'), 99))
        elif sortBy == "updated":
            all_cases.sort(key=lambda x: x.get('updatedAt', ''))
        
        # ============ APLICAR PAGINACIÓN ============
        skip = (page - 1) * limit
        cases = all_cases[skip:skip + limit]
        
        return {
            'cases': cases,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }
        
    except Exception as e:
        logger.error(f"Get visa cases error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get visa cases: {str(e)}")


@api_router.get("/admin/visa-cases/{case_id}")
async def get_visa_case_detail(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get detailed information about a visa case"""
    try:
        # Obtener caso
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Visa case not found")
        
        # Verificar permisos - coordinador/seller asignado o admins
        user_role = staff_payload.get('role', 'advisor')
        staff_id = staff_payload['id']
        if user_role in ['coordinator', 'advisor']:
            is_coordinator = case.get('coordinatorId') == staff_id
            is_seller = case.get('sellerId') == staff_id or case.get('salesRepId') == staff_id
            if not is_coordinator and not is_seller:
                raise HTTPException(status_code=403, detail="No tienes acceso a este caso")
        
        # Obtener etapas
        stages = await db.visa_stages.find({'caseId': case_id}).sort('stageNumber', 1).to_list(length=None)
        
        # Acreditador: verificar que el caso tiene +1 etapa pagada y restringir a la etapa del entregable de acreditación
        if user_role == 'acreditador':
            max_paid_stage = max((s.get('stageNumber', 0) for s in stages if s.get('isPaid') or s.get('paidAmount', 0) > 0), default=0)
            if max_paid_stage <= 1:
                raise HTTPException(status_code=403, detail="No tienes acceso a este caso")
            # Find stage containing the "Acreditación de títulos" deliverable
            acred_deliverable = await db.visa_deliverables.find_one({
                'caseId': case_id,
                'deliverableName': {'$regex': 'acreditaci', '$options': 'i'}
            }, {'stageNumber': 1})
            acred_stage = acred_deliverable.get('stageNumber') if acred_deliverable else None
            if acred_stage:
                stages = [s for s in stages if s.get('stageNumber') == acred_stage]
            else:
                stages = []
        
        # Obtener entregables
        deliverables_query = {'caseId': case_id}
        if user_role == 'acreditador' and acred_stage:
            deliverables_query['stageNumber'] = acred_stage
        deliverables = await db.visa_deliverables.find(deliverables_query).to_list(length=100)
        
        # Obtener documentos del cliente
        documents_query = {'caseId': case_id}
        if user_role == 'acreditador' and acred_stage:
            documents_query['stageNumber'] = acred_stage
        documents = await db.visa_client_documents.find(documents_query).to_list(length=100)
        
        # Obtener pagos
        payments = await db.visa_payments.find({'caseId': case_id}).to_list(length=10)
        
        # Obtener reuniones
        meetings = await db.visa_meetings.find({'caseId': case_id}).sort('scheduledAt', -1).to_list(length=20)
        
        # Obtener info del usuario
        user = None
        if case.get('userId'):
            # Intentar primero como ObjectId si parece ser uno
            try:
                user = await db.users.find_one({'_id': ObjectId(case['userId'])})
            except:
                pass
            
            # Si no se encontró, intentar como UUID en el campo 'id'
            if not user:
                user = await db.users.find_one({'id': case['userId']})
        
        if user:
            case['user'] = {
                'id': str(user.get('_id') or user.get('id')),
                'name': user.get('name', 'Cliente'),
                'email': user.get('email', ''),
                'phone': user.get('phone', ''),
                'userState': user.get('userState', 'U3')
            }
        else:
            # Si no se encuentra el usuario, proporcionar valores por defecto
            case['user'] = {
                'id': case.get('userId', ''),
                'name': 'Cliente',
                'email': 'No disponible',
                'phone': '',
                'userState': 'U3'
            }
        
        # Obtener info de coordinadora
        if case.get('coordinatorId'):
            coordinator = await db.staff.find_one({'_id': case['coordinatorId']})
            if not coordinator:
                coordinator = await db.staff.find_one({'id': case['coordinatorId']})
            if coordinator:
                case['coordinator'] = {
                    'id': str(coordinator.get('_id') or coordinator.get('id')),
                    'name': coordinator.get('name'),
                    'email': coordinator.get('email'),
                    'phone': coordinator.get('phone')
                }
                # Add coordinatorName for frontend compatibility
                case['coordinatorName'] = coordinator.get('name', '')
        
        # Obtener info de vendedor/a (check both sellerId and salesRepId)
        seller_id = case.get('sellerId') or case.get('salesRepId')
        if seller_id:
            seller = await db.staff.find_one({'_id': seller_id})
            if not seller:
                seller = await db.staff.find_one({'id': seller_id})
            if seller:
                case['seller'] = {
                    'id': str(seller.get('_id') or seller.get('id')),
                    'name': seller.get('name'),
                    'email': seller.get('email'),
                    'phone': seller.get('phone')
                }
                case['salesRep'] = case['seller']  # Keep backwards compatibility
                # Add advisorName for frontend compatibility
                case['advisorName'] = seller.get('name', '')
        
        return sanitize_mongo_response({
            'case': case,
            'stages': stages,
            'deliverables': deliverables,
            'documents': documents,
            'payments': payments,
            'meetings': meetings
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get visa case detail error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get visa case: {str(e)}")


@api_router.put("/admin/visa-cases/{case_id}")
async def update_visa_case(
    case_id: str,
    request: VisaCaseUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update a visa case"""
    try:
        # Obtener caso
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Visa case not found")
        
        # Preparar actualización
        update_data = {'updatedAt': datetime.now(timezone.utc).isoformat()}
        
        if request.visaType:
            update_data['visaType'] = request.visaType
        if request.coordinatorId is not None:
            update_data['coordinatorId'] = request.coordinatorId
        if request.salesRepId is not None:
            update_data['salesRepId'] = request.salesRepId
        if request.status:
            update_data['status'] = request.status
        if request.notes is not None:
            update_data['notes'] = request.notes
        if request.tags is not None:
            update_data['tags'] = request.tags
        if request.totalAmount is not None:
            update_data['totalAmount'] = request.totalAmount
        
        # Actualizar
        await db.visa_cases.update_one(
            {'_id': case_id},
            {'$set': update_data}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='update',
            resource='visa_case',
            resource_id=case_id,
            details=update_data
        )
        await db.activity_log.insert_one(log)
        
        # Notifications for coordinator assignment and status change
        from services.case_notifications import notify_coordinator_assigned, notify_case_status_changed
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        performer = {"id": staff_payload['id'], "name": staff.get('name', 'Admin') if staff else 'Admin', "role": staff_payload.get('role', '')}
        
        if request.coordinatorId is not None:
            new_coord = await db.staff.find_one({'_id': request.coordinatorId})
            if new_coord:
                user_doc = await db.users.find_one({"$or": [{"_id": case.get("userId")}, {"id": case.get("userId")}]})
                client_name = user_doc.get("name", "Cliente") if user_doc else "Cliente"
                await notify_coordinator_assigned(db, case_id, new_coord.get('name', ''), new_coord.get('email', ''), client_name, performer)
        
        if request.status and request.status != case.get('status'):
            await notify_case_status_changed(db, case_id, case.get('status', ''), request.status, performer)
        
        # Obtener caso actualizado
        updated_case = await db.visa_cases.find_one({'_id': case_id})
        
        return {
            'case': updated_case,
            'message': 'Visa case updated successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update visa case error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update visa case: {str(e)}")


@api_router.delete("/admin/visa-cases/{case_id}")
async def delete_visa_case(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Delete a visa case (Admin and Super Admin only)
    This will also delete all related data: stages, deliverables, documents, payments, meetings
    """
    try:
        # Verify Admin or Super Admin role
        user_role = staff_payload.get('role')
        if user_role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=403, 
                detail="Solo Admins y Super Admins pueden eliminar casos"
            )
        
        # Check if case exists
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        
        # Delete all related data
        # 1. Delete stages
        stages_result = await db.visa_stages.delete_many({'caseId': case_id})
        
        # 2. Delete deliverables
        deliverables_result = await db.visa_deliverables.delete_many({'caseId': case_id})
        
        # 3. Delete client documents
        documents_result = await db.visa_client_documents.delete_many({'caseId': case_id})
        
        # 4. Delete payments
        payments_result = await db.visa_payments.delete_many({'caseId': case_id})
        
        # 5. Delete meetings
        meetings_result = await db.visa_meetings.delete_many({'caseId': case_id})
        
        # 6. Finally, delete the case itself
        case_result = await db.visa_cases.delete_one({'_id': case_id})
        
        if case_result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Error al eliminar el caso")
        
        # Log the deletion
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
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
        
        logger.info(f"✅ Case {case_id} deleted by {staff_payload['id']}")
        
        return {
            'success': True,
            'message': 'Caso eliminado exitosamente',
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
        logger.error(f"❌ Error deleting visa case: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error al eliminar el caso: {str(e)}"
        )



# ===== Master Case Endpoints =====

@api_router.get("/admin/master-case")
async def get_master_case(staff_payload: dict = Depends(verify_staff_token)):
    """Get the master case template with all its stages, deliverables, and documents"""
    try:
        # Get master case
        master_case = await db.visa_cases.find_one(
            {"caseId": MASTER_CASE_ID, "isMasterCase": True},
            {'_id': 0}
        )
        
        if not master_case:
            raise HTTPException(status_code=404, detail="Master case not found")
        
        # Get stages
        stages_cursor = db.visa_stages.find({'caseId': MASTER_CASE_ID}, {'_id': 0}).sort('stageNumber', 1)
        stages = await stages_cursor.to_list(length=100)
        
        # Get deliverables
        deliverables_cursor = db.visa_deliverables.find({'caseId': MASTER_CASE_ID}, {'_id': 0})
        deliverables = await deliverables_cursor.to_list(length=1000)
        
        # Get documents
        documents_cursor = db.visa_client_documents.find({'caseId': MASTER_CASE_ID}, {'_id': 0})
        documents = await documents_cursor.to_list(length=1000)
        
        return {
            "success": True,
            "masterCase": master_case,
            "stages": stages,
            "deliverables": deliverables,
            "documents": documents
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching master case: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch master case")


@api_router.put("/admin/master-case")
async def update_master_case(
    request: dict,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update the master case template"""
    try:
        # Clear existing data
        await db.visa_stages.delete_many({'caseId': MASTER_CASE_ID})
        await db.visa_deliverables.delete_many({'caseId': MASTER_CASE_ID})
        await db.visa_client_documents.delete_many({'caseId': MASTER_CASE_ID})
        
        # Insert stages
        if request.get('stages'):
            stages = request['stages']
            for stage in stages:
                stage['caseId'] = MASTER_CASE_ID
                stage['id'] = f"{MASTER_CASE_ID}_stage_{stage['stageNumber']}"
            await db.visa_stages.insert_many(stages)
        
        # Insert deliverables
        if request.get('deliverables'):
            deliverables = request['deliverables']
            for i, deliverable in enumerate(deliverables):
                deliverable['caseId'] = MASTER_CASE_ID
                deliverable['id'] = f"{MASTER_CASE_ID}_deliverable_{i+1}"
            await db.visa_deliverables.insert_many(deliverables)
        
        # Insert documents
        if request.get('documents'):
            documents = request['documents']
            for i, doc in enumerate(documents):
                doc['caseId'] = MASTER_CASE_ID
                doc['id'] = f"{MASTER_CASE_ID}_document_{i+1}"
                doc['status'] = 'pending'
            await db.visa_client_documents.insert_many(documents)
        
        logger.info(f"Master case updated by {staff_payload.get('name', 'admin')}")
        
        return {
            "success": True,
            "message": "Master case updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating master case: {e}")
        raise HTTPException(status_code=500, detail="Failed to update master case")


# ===== Deliverables Endpoints =====

class DeliverableUploadRequest(BaseModel):
    caseId: str
    stageNumber: int
    deliverableId: str
    fileName: str
    fileUrl: str
    fileSize: Optional[int] = None
    notes: Optional[str] = None

@api_router.delete("/admin/deliverables/{deliverable_id}")
async def delete_deliverable(
    deliverable_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete an entire deliverable from a case. Admin/Super Admin only."""
    try:
        # Verify role
        role = staff_payload.get('role', '')
        if role not in ('admin', 'super_admin'):
            raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar entregables")

        deliverable = await db.visa_deliverables.find_one({"_id": deliverable_id})
        if not deliverable:
            deliverable = await db.visa_deliverables.find_one({"id": deliverable_id})
        if not deliverable:
            raise HTTPException(status_code=404, detail="Entregable no encontrado")

        await db.visa_deliverables.delete_one({"_id": deliverable["_id"]})
        logger.info(f"Deliverable deleted: {deliverable_id} by {staff_payload.get('email')}")

        return {"success": True, "message": "Entregable eliminado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete deliverable error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/deliverables/{deliverable_id}/file")
async def delete_deliverable_file(
    deliverable_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete ALL files from a deliverable (legacy endpoint)"""
    try:
        # Verificar que el deliverable existe
        deliverable = await db.visa_deliverables.find_one({'_id': deliverable_id})
        if not deliverable:
            raise HTTPException(status_code=404, detail="Deliverable not found")
        
        # Si hay un archivo físico, intentar eliminarlo
        if deliverable.get('fileUrl'):
            file_url = deliverable['fileUrl']
            if file_url.startswith('/api/documents/download/'):
                filename = file_url.split('/')[-1]
                file_path = Path("/app/backend/uploads") / filename
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Physical file deleted: {filename}")
        
        # Limpiar la información del archivo en el deliverable
        update_data = {
            'fileName': None,
            'fileUrl': None,
            'fileSize': None,
            'files': [],  # Clear files array
            'status': DeliverableStatus.PENDING,
            'isDraft': False,
            'uploadedBy': None,
            'uploadedAt': None,
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }
        
        await db.visa_deliverables.update_one(
            {'_id': deliverable_id},
            {'$set': update_data, '$unset': {'notes': ''}}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='delete',
            resource='deliverable_file',
            resource_id=deliverable_id,
            details={
                'fileName': deliverable.get('fileName')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Deliverable file deleted: {deliverable_id} by staff {staff_payload['id']}")
        
        return {
            'message': 'Deliverable file deleted successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete deliverable file error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete deliverable file: {str(e)}")

@api_router.delete("/admin/deliverables/{deliverable_id}/files/{file_id}")
async def delete_single_deliverable_file(
    deliverable_id: str,
    file_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a specific file from a deliverable's files array"""
    try:
        # Verificar que el deliverable existe
        deliverable = await db.visa_deliverables.find_one({'_id': deliverable_id})
        if not deliverable:
            raise HTTPException(status_code=404, detail="Deliverable not found")
        
        # Get files array and remove the specified file
        files = deliverable.get('files', [])
        file_to_delete = next((f for f in files if f.get('id') == file_id), None)
        
        if not file_to_delete:
            raise HTTPException(status_code=404, detail="File not found")
        
        updated_files = [f for f in files if f.get('id') != file_id]
        
        # Update deliverable
        update_data = {
            'files': updated_files,
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }
        
        # If no files left, reset status
        if len(updated_files) == 0:
            update_data['status'] = DeliverableStatus.PENDING
            update_data['isDraft'] = False
            update_data['fileUrl'] = None
            update_data['fileName'] = None
        else:
            # Update fileUrl to last file for backward compatibility
            update_data['fileUrl'] = updated_files[-1].get('fileUrl')
            update_data['fileName'] = updated_files[-1].get('fileName')
        
        await db.visa_deliverables.update_one(
            {'_id': deliverable_id},
            {'$set': update_data}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='delete',
            resource='deliverable_single_file',
            resource_id=deliverable_id,
            details={
                'fileId': file_id,
                'fileName': file_to_delete.get('fileName'),
                'remainingFiles': len(updated_files)
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Single file {file_id} deleted from deliverable {deliverable_id} by staff {staff_payload['id']}")
        
        return {
            'message': 'File deleted successfully',
            'remainingFiles': len(updated_files)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete single deliverable file error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


# ============= SINGLE CASE MOVE OPERATIONS =============

class MoveSingleDeliverableRequest(BaseModel):
    deliverable_id: str
    to_stage: int

@api_router.post("/admin/cases/{case_id}/deliverables/move")
async def move_single_deliverable(
    case_id: str,
    request: MoveSingleDeliverableRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Move a deliverable to a different stage for a SINGLE case"""
    try:
        # Verify case exists
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        
        # Verify deliverable exists and belongs to this case
        deliverable = await db.visa_deliverables.find_one({
            '_id': request.deliverable_id,
            'caseId': case_id
        })
        
        if not deliverable:
            raise HTTPException(status_code=404, detail="Entregable no encontrado en este caso")
        
        old_stage = deliverable.get('stageNumber')
        
        # Update the deliverable's stage
        result = await db.visa_deliverables.update_one(
            {'_id': request.deliverable_id},
            {
                '$set': {
                    'stageNumber': request.to_stage,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='move_deliverable',
            resource='deliverable',
            resource_id=request.deliverable_id,
            details={
                'caseId': case_id,
                'fromStage': old_stage,
                'toStage': request.to_stage,
                'deliverableName': deliverable.get('deliverableName') or deliverable.get('name', {}).get('es')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Deliverable {request.deliverable_id} moved from stage {old_stage} to {request.to_stage} for case {case_id}")
        
        return {
            'message': 'Entregable movido exitosamente',
            'deliverableId': request.deliverable_id,
            'fromStage': old_stage,
            'toStage': request.to_stage
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Move single deliverable error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class MoveSingleDocumentRequest(BaseModel):
    document_id: str
    to_stage: int

@api_router.post("/admin/cases/{case_id}/documents/move")
async def move_single_document(
    case_id: str,
    request: MoveSingleDocumentRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Move a document to a different stage for a SINGLE case"""
    try:
        # Verify case exists
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        
        # Verify document exists and belongs to this case
        document = await db.visa_client_documents.find_one({
            '_id': request.document_id,
            'caseId': case_id
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Documento no encontrado en este caso")
        
        old_stage = document.get('stageNumber')
        
        # Update the document's stage
        result = await db.visa_client_documents.update_one(
            {'_id': request.document_id},
            {
                '$set': {
                    'stageNumber': request.to_stage,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='move_document',
            resource='document',
            resource_id=request.document_id,
            details={
                'caseId': case_id,
                'fromStage': old_stage,
                'toStage': request.to_stage,
                'documentName': document.get('documentName') or document.get('name', {}).get('es')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Document {request.document_id} moved from stage {old_stage} to {request.to_stage} for case {case_id}")
        
        return {
            'message': 'Documento movido exitosamente',
            'documentId': request.document_id,
            'fromStage': old_stage,
            'toStage': request.to_stage
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Move single document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Change Stage Endpoints (for UI modal)
# ============================================

class ChangeStageRequest(BaseModel):
    stageNumber: int

@api_router.put("/admin/deliverables/{deliverable_id}/change-stage")
async def change_deliverable_stage(
    deliverable_id: str,
    request: ChangeStageRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Change the stage of a deliverable"""
    try:
        # Find the deliverable
        deliverable = await db.visa_deliverables.find_one({'_id': deliverable_id})
        if not deliverable:
            raise HTTPException(status_code=404, detail="Entregable no encontrado")
        
        old_stage = deliverable.get('stageNumber')
        
        # Update the deliverable's stage
        result = await db.visa_deliverables.update_one(
            {'_id': deliverable_id},
            {
                '$set': {
                    'stageNumber': request.stageNumber,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No se pudo actualizar el entregable")
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='change_stage',
            resource='deliverable',
            resource_id=deliverable_id,
            details={
                'caseId': deliverable.get('caseId'),
                'fromStage': old_stage,
                'toStage': request.stageNumber,
                'deliverableName': deliverable.get('deliverableName') or deliverable.get('name', {}).get('es')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Deliverable {deliverable_id} stage changed from {old_stage} to {request.stageNumber}")
        
        return {
            'message': 'Etapa del entregable actualizada exitosamente',
            'deliverableId': deliverable_id,
            'fromStage': old_stage,
            'toStage': request.stageNumber
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change deliverable stage error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/admin/client-documents/{document_id}/change-stage")
async def change_document_stage(
    document_id: str,
    request: ChangeStageRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Change the stage of a client document"""
    try:
        # Find the document
        document = await db.visa_client_documents.find_one({'_id': document_id})
        if not document:
            raise HTTPException(status_code=404, detail="Documento no encontrado")
        
        old_stage = document.get('stageNumber')
        
        # Update the document's stage
        result = await db.visa_client_documents.update_one(
            {'_id': document_id},
            {
                '$set': {
                    'stageNumber': request.stageNumber,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No se pudo actualizar el documento")
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='change_stage',
            resource='document',
            resource_id=document_id,
            details={
                'caseId': document.get('caseId'),
                'fromStage': old_stage,
                'toStage': request.stageNumber,
                'documentName': document.get('documentName') or document.get('name', {}).get('es')
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Document {document_id} stage changed from {old_stage} to {request.stageNumber}")
        
        return {
            'message': 'Etapa del documento actualizada exitosamente',
            'documentId': document_id,
            'fromStage': old_stage,
            'toStage': request.stageNumber
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change document stage error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/deliverables/upload")
async def upload_deliverable(
    request: DeliverableUploadRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Upload a deliverable file for a case. Supports multiple files per deliverable."""
    try:
        # Verificar que el caso existe
        case = await db.visa_cases.find_one({'_id': request.caseId})
        if not case:
            raise HTTPException(status_code=404, detail="Visa case not found")
        
        # Verificar que el deliverable existe
        deliverable = await db.visa_deliverables.find_one({'_id': request.deliverableId})
        if not deliverable:
            deliverable = await db.visa_deliverables.find_one({'id': request.deliverableId})
        if not deliverable:
            raise HTTPException(status_code=404, detail="Deliverable not found")
        
        # Create new file object
        new_file = {
            'id': str(uuid.uuid4()),
            'fileName': request.fileName,
            'fileUrl': request.fileUrl,
            'fileSize': request.fileSize,
            'uploadedBy': staff_payload['id'],
            'uploadedAt': datetime.now(timezone.utc).isoformat()
        }
        if request.notes:
            new_file['notes'] = request.notes
        
        # Get existing files array or create from legacy fileUrl
        existing_files = deliverable.get('files', [])
        if not existing_files and deliverable.get('fileUrl'):
            # Migrate legacy single file to array
            existing_files = [{
                'id': str(uuid.uuid4()),
                'fileName': deliverable.get('fileName', 'archivo'),
                'fileUrl': deliverable.get('fileUrl'),
                'fileSize': deliverable.get('fileSize', 0),
                'uploadedBy': deliverable.get('uploadedBy'),
                'uploadedAt': deliverable.get('uploadedAt')
            }]
        
        # Append new file
        existing_files.append(new_file)
        
        # Actualizar el deliverable
        update_data = {
            'files': existing_files,
            'fileName': request.fileName,  # Keep for backward compatibility
            'fileUrl': request.fileUrl,    # Keep for backward compatibility
            'fileSize': request.fileSize,
            'status': DeliverableStatus.DRAFT,
            'isDraft': True,
            'uploadedBy': staff_payload['id'],
            'uploadedAt': datetime.now(timezone.utc).isoformat(),
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }
        
        if request.notes:
            update_data['notes'] = request.notes
        
        await db.visa_deliverables.update_one(
            {'_id': request.deliverableId},
            {'$set': update_data}
        )
        
        # Marcar actividad reciente en el caso principal para el cálculo de inactividad
        await db.visa_cases.update_one(
            {"id": request.caseId},
            {"$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}}
        )

        # Actualizar progreso de la etapa
        stage = await db.visa_stages.find_one({
            'caseId': request.caseId,
            'stageNumber': request.stageNumber
        })
        
        if stage:
            # Contar deliverables completados
            completed = await db.visa_deliverables.count_documents({
                'stageId': stage['_id'],
                'fileUrl': {'$exists': True, '$ne': None}
            })
            
            await db.visa_stages.update_one(
                {'_id': stage['_id']},
                {
                    '$set': {
                        'deliverablesCompleted': completed,
                        'updatedAt': datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            # 🔧 FIX: Update currentStage after deliverable completion
            await update_case_current_stage(request.caseId)
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='upload',
            resource='deliverable',
            resource_id=request.deliverableId,
            details={
                'caseId': request.caseId,
                'fileName': request.fileName,
                'stageNumber': request.stageNumber,
                'totalFiles': len(existing_files)
            }
        )
        await db.activity_log.insert_one(log)
        
        # Case audit log
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        await log_case_audit(
            case_id=request.caseId,
            action=f"Archivo '{request.fileName}' subido al entregable",
            action_type=AuditActionTypes.DELIVERABLE_FILE_UPLOADED,
            performed_by_id=staff_payload['id'],
            performed_by_name=staff.get('name', 'Staff') if staff else 'Staff',
            performed_by_role=staff_payload.get('role', 'coordinator'),
            details={
                'deliverableId': request.deliverableId,
                'fileName': request.fileName,
                'stageNumber': request.stageNumber,
                'totalFiles': len(existing_files)
            }
        )
        
        logger.info(f"Deliverable uploaded: {request.deliverableId} for case {request.caseId} (total files: {len(existing_files)})")
        
        # Notify client about new deliverable
        from services.case_notifications import notify_deliverable_uploaded
        del_name = deliverable.get('name', {})
        del_display = del_name.get('es', del_name.get('en', request.fileName)) if isinstance(del_name, dict) else str(del_name or request.fileName)
        await notify_deliverable_uploaded(db, request.caseId, del_display, request.stageNumber, {
            "id": staff_payload['id'], "name": staff.get('name', 'Staff') if staff else 'Staff', "role": staff_payload.get('role', '')
        })
        
        updated_deliverable = await db.visa_deliverables.find_one({'_id': request.deliverableId})
        
        return {
            'message': 'Deliverable uploaded successfully',
            'deliverable': updated_deliverable,
            'totalFiles': len(existing_files)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload deliverable error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload deliverable: {str(e)}")


@api_router.get("/admin/visa-cases/{case_id}/deliverables")
async def get_case_deliverables(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token),
    stageNumber: int = None
):
    """Get all deliverables for a case, optionally filtered by stage"""
    try:
        query = {'caseId': case_id}
        if stageNumber:
            query['stageNumber'] = stageNumber
        
        deliverables = await db.visa_deliverables.find(query).to_list(length=100)
        
        return {
            'deliverables': deliverables,
            'total': len(deliverables)
        }
        
    except Exception as e:
        logger.error(f"Get deliverables error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get deliverables: {str(e)}")


# ===== Client Documents Endpoints =====

@api_router.get("/admin/visa-cases/{case_id}/documents")
async def get_case_documents(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token),
    status: str = None
):
    """Get all documents for a case"""
    try:
        query = {'caseId': case_id}
        if status:
            query['status'] = status
        
        documents = await db.visa_client_documents.find(query).to_list(length=100)
        
        return {
            'documents': documents,
            'total': len(documents)
        }
        
    except Exception as e:
        logger.error(f"Get case documents error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")


# ============= STAGE NAME MANAGEMENT (BULK) =============

class StageNameUpdateRequest(BaseModel):
    stage_number: int
    name_es: str
    name_en: Optional[str] = None

class StageCreateRequest(BaseModel):
    name_es: str
    name_en: Optional[str] = None
    description_es: Optional[str] = None
    description_en: Optional[str] = None
    apply_to: str = 'new_only'  # 'new_only', 'all_cases', 'selected_cases'
    case_ids: List[str] = []

@api_router.post("/admin/stage-templates")
async def create_stage_template(
    request: StageCreateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new stage template and optionally apply it to existing cases"""
    try:
        # Verify staff has admin/super_admin role
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can create stage templates")
        
        # Find the highest stage number in both collections
        pipeline_visa = [
            {"$group": {"_id": None, "maxStageNumber": {"$max": "$stageNumber"}}},
        ]
        pipeline_stages = [
            {"$group": {"_id": None, "maxStageNumber": {"$max": "$stageNumber"}}},
        ]
        
        result_visa = list(await db.visa_stages.aggregate(pipeline_visa).to_list(1))
        result_stages = list(await db.stages.aggregate(pipeline_stages).to_list(1))
        
        max_visa = (result_visa[0]['maxStageNumber']) if result_visa and result_visa[0].get('maxStageNumber') else 0
        max_stages = (result_stages[0]['maxStageNumber']) if result_stages and result_stages[0].get('maxStageNumber') else 0
        
        new_stage_number = max(max_visa, max_stages) + 1
        
        # Build stage name and description objects
        stage_name = {
            "es": request.name_es,
            "en": request.name_en or request.name_es
        }
        
        stage_description = {
            "es": request.description_es or "",
            "en": request.description_en or request.description_es or ""
        }
        
        # Check if stage template already exists
        existing = await db.stages.find_one({"stageNumber": new_stage_number})
        if existing:
            raise HTTPException(status_code=400, detail=f"Stage {new_stage_number} already exists")
        
        # Create the stage template document
        stage_template = {
            "stageNumber": new_stage_number,
            "name": stage_name,
            "description": stage_description,
            "amount": 0,
            "status": "template",
            "isTemplate": True,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "createdBy": staff_payload['id']
        }
        
        # Insert the stage template
        result = await db.stages.insert_one(stage_template)
        
        # Apply to cases based on the option
        cases_affected = 0
        
        if request.apply_to == 'all_cases':
            # Get all cases - use _id as fallback
            all_cases = await db.visa_cases.find({}).to_list(None)
            case_ids_to_apply = [case.get('id') or case.get('_id') for case in all_cases if case.get('id') or case.get('_id')]
            
        elif request.apply_to == 'selected_cases':
            case_ids_to_apply = request.case_ids
        else:
            # new_only - don't apply to any existing cases
            case_ids_to_apply = []
        
        # Create stage instances for selected cases
        if case_ids_to_apply:
            import uuid
            stage_instances = []
            
            for case_id in case_ids_to_apply:
                try:
                    # Get case - try both id and _id fields
                    case = await db.visa_cases.find_one({
                        "$or": [
                            {"id": case_id},
                            {"_id": case_id}
                        ]
                    })
                    
                    if not case:
                        logger.warning(f"Case {case_id} not found, skipping")
                        continue
                    
                    # Use the correct id field
                    actual_case_id = case.get('id') or case.get('_id')
                    
                    stage_instance = {
                        "id": str(uuid.uuid4()),
                        "caseId": actual_case_id,
                        "stageNumber": new_stage_number,
                        "name": stage_name,
                        "description": stage_description,
                        "percentage": 0,
                        "amount": 0,
                        "status": "locked",  # New stages start as locked
                        "isPaid": False,
                        "completedDeliverablesCount": 0,
                        "totalDeliverablesCount": 0,
                        "startDate": None,
                        "completionDate": None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                        "paidAmount": 0,
                        "paidAt": None,
                        "paymentId": None
                    }
                    stage_instances.append(stage_instance)
                    
                except Exception as case_error:
                    logger.error(f"Error processing case {case_id}: {case_error}")
                    continue
            
            if stage_instances:
                await db.visa_stages.insert_many(stage_instances)
                cases_affected = len(stage_instances)
        
        # Log the activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='create',
            resource='stage_template',
            resource_id=f"stage_{new_stage_number}",
            details={
                'stageNumber': new_stage_number,
                'name': stage_name,
                'description': stage_description,
                'applyTo': request.apply_to,
                'casesAffected': cases_affected
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"New stage template created: Stage {new_stage_number} - '{stage_name['es']}' by staff {staff_payload['id']} - Applied to {cases_affected} cases")
        
        return {
            "message": f"Nueva etapa creada exitosamente",
            "stage_number": new_stage_number,
            "name": stage_name,
            "description": stage_description,
            "template_id": str(result.inserted_id),
            "cases_affected": cases_affected
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create stage template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create stage template: {str(e)}")

@api_router.get("/admin/stage-templates")
async def get_stage_templates(
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get unique stage configurations with counts, including templates without cases"""
    try:
        # Aggregate from visa_stages to get stages used in cases
        pipeline = [
            {
                "$group": {
                    "_id": "$stageNumber",
                    "names": {"$addToSet": "$name"},
                    "descriptions": {"$addToSet": "$description"},
                    "totalCases": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        stages_in_cases = await db.visa_stages.aggregate(pipeline).to_list(100)
        
        # Get all stage templates from stages collection
        stage_templates = await db.stages.find({"isTemplate": True}).to_list(100)
        
        # Create a dict for quick lookup
        stages_dict = {}
        
        # Add stages from cases
        for stage in stages_in_cases:
            current_name = stage["names"][0] if stage["names"] else {"es": f"Etapa {stage['_id']}", "en": f"Stage {stage['_id']}"}
            current_desc = stage["descriptions"][0] if stage["descriptions"] else {"es": "", "en": ""}
            
            stages_dict[stage["_id"]] = {
                "stageNumber": stage["_id"],
                "currentName": current_name,
                "currentDescription": current_desc,
                "totalCases": stage["totalCases"],
                "hasVariations": len(stage["names"]) > 1,
                "isTemplate": False
            }
        
        # Add templates that don't have cases yet
        for template in stage_templates:
            stage_num = template["stageNumber"]
            if stage_num not in stages_dict:
                stages_dict[stage_num] = {
                    "stageNumber": stage_num,
                    "currentName": template["name"],
                    "currentDescription": template.get("description", {"es": "", "en": ""}),
                    "totalCases": 0,
                    "hasVariations": False,
                    "isTemplate": True
                }
        
        # Convert dict to sorted list
        result = sorted(stages_dict.values(), key=lambda x: x["stageNumber"])
        
        return {
            "stages": result,
            "totalStages": len(result)
        }
        
    except Exception as e:
        logger.error(f"Get stage templates error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stage templates: {str(e)}")

@api_router.put("/admin/stage-templates/{stage_number}/name")
async def update_stage_name_bulk(
    stage_number: int,
    request: StageNameUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update stage name for ALL cases with this stage number"""
    try:
        # Verify staff has admin/super_admin role
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can update stage names")
        
        # Build the new name object
        new_name = {
            "es": request.name_es,
            "en": request.name_en or request.name_es  # Use Spanish as fallback for English
        }
        
        # Count affected stages before update
        affected_count = await db.visa_stages.count_documents({"stageNumber": stage_number})
        
        if affected_count == 0:
            raise HTTPException(status_code=404, detail=f"No stages found with number {stage_number}")
        
        # Update all stages with this stage number
        result = await db.visa_stages.update_many(
            {"stageNumber": stage_number},
            {
                "$set": {
                    "name": new_name,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log the activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='bulk_update',
            resource='stage_name',
            resource_id=f"stage_{stage_number}",
            details={
                'stageNumber': stage_number,
                'newName': new_name,
                'affectedCases': result.modified_count
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Bulk stage name update: Stage {stage_number} renamed to '{new_name['es']}' - {result.modified_count} cases affected by staff {staff_payload['id']}")
        
        return {
            "message": f"Nombre de Etapa {stage_number} actualizado exitosamente",
            "stageNumber": stage_number,
            "newName": new_name,
            "casesUpdated": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk update stage name error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update stage name: {str(e)}")

# Update stage price for a specific case
class StagePriceUpdateRequest(BaseModel):
    amount: float

@api_router.put("/admin/visa-cases/{case_id}/stages/{stage_number}/price")
async def update_stage_price(
    case_id: str,
    stage_number: int,
    request: StagePriceUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update the price/amount of a specific stage for a case"""
    try:
        # Verify admin or coordinator role
        user_type = staff_payload.get('type')
        user_role = staff_payload.get('role')
        
        is_allowed = (
            user_type == 'admin' or 
            (user_type == 'staff' and user_role in ['admin', 'super_admin', 'coordinator'])
        )
        
        if not is_allowed:
            raise HTTPException(status_code=403, detail="Solo administradores y coordinadores pueden editar precios")
        
        # Find the stage
        stage = await db.visa_stages.find_one({
            "caseId": case_id,
            "stageNumber": stage_number
        })
        
        if not stage:
            raise HTTPException(status_code=404, detail=f"Etapa {stage_number} no encontrada para este caso")
        
        # Update the stage amount
        result = await db.visa_stages.update_one(
            {"caseId": case_id, "stageNumber": stage_number},
            {"$set": {"amount": request.amount}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No se pudo actualizar el precio")
        
        # Log the action
        logger.info(f"Stage {stage_number} price updated to ${request.amount} for case {case_id} by {staff_payload.get('email')}")
        
        return {
            "success": True,
            "message": f"Precio de Etapa {stage_number} actualizado a ${request.amount}",
            "stageNumber": stage_number,
            "newAmount": request.amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update stage price error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar precio: {str(e)}")

# Update stage for a specific case (full update)
class StageFullUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    isPaid: Optional[bool] = None
    isUnlocked: Optional[bool] = None

@api_router.put("/admin/visa-cases/{case_id}/stages/{stage_number}")
async def update_stage_full(
    case_id: str,
    stage_number: int,
    request: StageFullUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update all fields of a specific stage for a case"""
    try:
        # Verify admin or coordinator role
        user_type = staff_payload.get('type')
        user_role = staff_payload.get('role')
        
        is_allowed = (
            user_type == 'admin' or 
            (user_type == 'staff' and user_role in ['admin', 'super_admin', 'coordinator'])
        )
        
        if not is_allowed:
            raise HTTPException(status_code=403, detail="Solo administradores y coordinadores pueden editar etapas")
        
        # Check if user is admin for isPaid changes
        is_admin = user_type == 'admin' or (user_type == 'staff' and user_role in ['admin', 'super_admin'])
        
        # Find the stage
        stage = await db.visa_stages.find_one({
            "caseId": case_id,
            "stageNumber": stage_number
        })
        
        if not stage:
            raise HTTPException(status_code=404, detail=f"Etapa {stage_number} no encontrada para este caso")
        
        # Build update object
        update_data = {"updatedAt": datetime.now(timezone.utc).isoformat()}
        
        if request.name is not None:
            # Handle both string and object formats
            update_data["name"] = {"es": request.name, "en": request.name}
        
        if request.description is not None:
            update_data["description"] = {"es": request.description, "en": request.description}
        
        if request.amount is not None:
            update_data["amount"] = request.amount
        
        if request.status is not None:
            valid_statuses = ['pending', 'in_progress', 'completed', 'blocked', 'unlocked', 'locked', '', None]
            if request.status and request.status not in ['pending', 'in_progress', 'completed', 'blocked', 'unlocked', 'locked']:
                raise HTTPException(status_code=400, detail=f"Estado inválido. Debe ser uno de: pending, in_progress, completed, blocked, unlocked, locked")
            # Only set status if it has a value (allow clearing status)
            if request.status:
                update_data["status"] = request.status
            else:
                update_data["status"] = None
        
        # Only admins can change isPaid
        if request.isPaid is not None and is_admin:
            update_data["isPaid"] = request.isPaid
            if request.isPaid:
                # If marking as paid, set paidAmount to full amount
                update_data["paidAmount"] = stage.get("amount", 0)
            else:
                # If marking as not paid, reset paidAmount
                update_data["paidAmount"] = 0
        
        # Handle isUnlocked field
        if request.isUnlocked is not None:
            update_data["isUnlocked"] = request.isUnlocked
        
        # Update the stage
        result = await db.visa_stages.update_one(
            {"caseId": case_id, "stageNumber": stage_number},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No se pudo actualizar la etapa")
        
        # Log the action
        logger.info(f"Stage {stage_number} updated for case {case_id} by {staff_payload.get('email')}")
        
        return {
            "success": True,
            "message": f"Etapa {stage_number} actualizada exitosamente",
            "stageNumber": stage_number
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update stage error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar etapa: {str(e)}")

class StageDescriptionUpdateRequest(BaseModel):
    stage_number: int
    description_es: str
    description_en: Optional[str] = None

@api_router.put("/admin/stage-templates/{stage_number}/description")
async def update_stage_description_bulk(
    stage_number: int,
    request: StageDescriptionUpdateRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Update stage description for ALL cases with this stage number"""
    try:
        # Verify staff has admin/super_admin role
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can update stage descriptions")
        
        new_description = {
            "es": request.description_es,
            "en": request.description_en or request.description_es
        }
        
        affected_count = await db.visa_stages.count_documents({"stageNumber": stage_number})
        
        if affected_count == 0:
            raise HTTPException(status_code=404, detail=f"No stages found with number {stage_number}")
        
        result = await db.visa_stages.update_many(
            {"stageNumber": stage_number},
            {
                "$set": {
                    "description": new_description,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='bulk_update',
            resource='stage_description',
            resource_id=f"stage_{stage_number}",
            details={
                'stageNumber': stage_number,
                'affectedCases': result.modified_count
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Bulk stage description update: Stage {stage_number} - {result.modified_count} cases affected")
        
        return {
            "message": f"Descripción de Etapa {stage_number} actualizada exitosamente",
            "stageNumber": stage_number,
            "casesUpdated": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk update stage description error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update stage description: {str(e)}")

@api_router.delete("/admin/stage-templates/{stage_number}")
async def delete_stage_template(
    stage_number: int,
    delete_from_cases: bool = False,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a stage template and optionally remove it from all cases"""
    try:
        # Verify staff has admin/super_admin role
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can delete stage templates")
        
        # Check if template exists
        template = await db.stages.find_one({"stageNumber": stage_number, "isTemplate": True})
        if not template:
            raise HTTPException(status_code=404, detail=f"Stage template {stage_number} not found")
        
        # Count how many cases have this stage
        cases_with_stage = await db.visa_stages.count_documents({"stageNumber": stage_number})
        
        cases_affected = 0
        
        # Delete from cases if requested
        if delete_from_cases and cases_with_stage > 0:
            result = await db.visa_stages.delete_many({"stageNumber": stage_number})
            cases_affected = result.deleted_count
            logger.info(f"Deleted stage {stage_number} from {cases_affected} cases")
        
        # Delete the template
        await db.stages.delete_one({"_id": template["_id"]})
        
        # Log the activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='delete',
            resource='stage_template',
            resource_id=f"stage_{stage_number}",
            details={
                'stageNumber': stage_number,
                'stageName': template.get('name', {}),
                'deletedFromCases': delete_from_cases,
                'casesAffected': cases_affected
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Stage template {stage_number} deleted by staff {staff_payload['id']} - {cases_affected} cases affected")
        
        return {
            "message": f"Etapa {stage_number} eliminada exitosamente",
            "stage_number": stage_number,
            "cases_affected": cases_affected,
            "deleted_from_cases": delete_from_cases
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete stage template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete stage template: {str(e)}")


# ============= DELIVERABLE TEMPLATES MANAGEMENT =============

@api_router.get("/admin/deliverable-templates")
async def get_deliverable_templates(
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get unique deliverables grouped by stage number"""
    try:
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "stageNumber": "$stageNumber",
                        "name": "$name"
                    },
                    "deliverableName": {"$first": "$deliverableName"},
                    "description": {"$first": "$description"},
                    "required": {"$first": "$required"},
                    "count": {"$sum": 1},
                    "sampleId": {"$first": "$_id"}
                }
            },
            {"$sort": {"_id.stageNumber": 1, "_id.name.es": 1}}
        ]
        
        deliverables = await db.visa_deliverables.aggregate(pipeline).to_list(500)
        
        # Group by stage
        stages_dict = {}
        for d in deliverables:
            stage_num = d['_id']['stageNumber']
            if stage_num not in stages_dict:
                stages_dict[stage_num] = {
                    'stageNumber': stage_num,
                    'deliverables': []
                }
            
            name = d['_id'].get('name') or {}
            stages_dict[stage_num]['deliverables'].append({
                'name': name,
                'deliverableName': d.get('deliverableName') or name.get('es', 'Sin nombre'),
                'description': d.get('description'),
                'required': d.get('required', True),
                'count': d['count'],
                'sampleId': str(d['sampleId'])
            })
        
        # Sort stages by stage number and sort deliverables within each stage alphabetically
        sorted_stages = []
        for stage_num in sorted(stages_dict.keys()):
            stage = stages_dict[stage_num]
            # Sort deliverables alphabetically by name (Spanish)
            stage['deliverables'].sort(key=lambda x: x['name'].get('es', '').lower())
            sorted_stages.append(stage)
        
        return {
            'stages': sorted_stages,
            'totalStages': len(sorted_stages)
        }
        
    except Exception as e:
        logger.error(f"Get deliverable templates error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CreateDeliverableRequest(BaseModel):
    stage_number: int
    name_es: str
    name_en: Optional[str] = None
    apply_to: str = 'new_only'
    case_ids: List[str] = []

@api_router.post("/admin/deliverable-templates")
async def create_deliverable_template(
    request: CreateDeliverableRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new deliverable template and optionally apply to existing cases"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can create deliverable templates")
        
        name = {
            "es": request.name_es,
            "en": request.name_en or request.name_es
        }
        
        # Determine which cases to apply to
        cases_affected = 0
        case_ids_to_apply = []
        
        if request.apply_to == 'all_cases':
            # Get all cases that have this stage
            pipeline = [
                {"$match": {"stageNumber": request.stage_number}},
                {"$group": {"_id": "$caseId"}}
            ]
            result = await db.visa_stages.aggregate(pipeline).to_list(None)
            case_ids_to_apply = [doc['_id'] for doc in result]
            
        elif request.apply_to == 'selected_cases':
            case_ids_to_apply = request.case_ids
        
        # Create deliverable instances for selected cases
        if case_ids_to_apply:
            import uuid
            deliverable_instances = []
            
            for case_id in case_ids_to_apply:
                try:
                    case = await db.visa_cases.find_one({
                        "$or": [{"id": case_id}, {"_id": case_id}]
                    })
                    if not case:
                        continue
                    
                    actual_case_id = case.get('id') or case.get('_id')
                    
                    deliverable_instance = {
                        "_id": str(uuid.uuid4()),
                        "caseId": actual_case_id,
                        "stageNumber": request.stage_number,
                        "name": name,
                        "isComplete": False,
                        "completedAt": None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    }
                    deliverable_instance["id"] = deliverable_instance["_id"]
                    deliverable_instances.append(deliverable_instance)
                    
                except Exception as case_error:
                    logger.error(f"Error processing case {case_id}: {case_error}")
                    continue
            
            if deliverable_instances:
                await db.visa_deliverables.insert_many(deliverable_instances)
                cases_affected = len(deliverable_instances)
        
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='create',
            resource='deliverable_template',
            resource_id=f"stage_{request.stage_number}_{name['es']}",
            details={
                'stageNumber': request.stage_number,
                'name': name,
                'applyTo': request.apply_to,
                'casesAffected': cases_affected
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Deliverable template created: Stage {request.stage_number} - '{name['es']}' by staff {staff_payload['id']} - Applied to {cases_affected} cases")
        
        return {
            "message": "Entregable creado exitosamente",
            "stage_number": request.stage_number,
            "name": name,
            "cases_affected": cases_affected
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create deliverable template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create deliverable template: {str(e)}")


class MoveDeliverableRequest(BaseModel):
    deliverable_name_es: str
    from_stage: int
    to_stage: int

@api_router.post("/admin/deliverable-templates/move")
async def move_deliverable_to_stage(
    request: MoveDeliverableRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Move a deliverable from one stage to another for ALL cases"""
    try:
        # Verify admin role
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Solo admins pueden mover entregables")
        
        # Find deliverables matching the name and source stage
        query = {
            "stageNumber": request.from_stage,
            "$or": [
                {"name.es": request.deliverable_name_es},
                {"deliverableName": request.deliverable_name_es}
            ]
        }
        
        affected_count = await db.visa_deliverables.count_documents(query)
        
        if affected_count == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"No se encontraron entregables '{request.deliverable_name_es}' en la Etapa {request.from_stage}"
            )
        
        # Update stage number for all matching deliverables
        result = await db.visa_deliverables.update_many(
            query,
            {
                "$set": {
                    "stageNumber": request.to_stage,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='move_deliverable',
            resource='deliverable_template',
            resource_id=request.deliverable_name_es,
            details={
                'fromStage': request.from_stage,
                'toStage': request.to_stage,
                'affectedCount': result.modified_count
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Moved deliverable '{request.deliverable_name_es}' from stage {request.from_stage} to {request.to_stage} - {result.modified_count} cases")
        
        return {
            "message": f"Entregable movido exitosamente",
            "deliverableName": request.deliverable_name_es,
            "fromStage": request.from_stage,
            "toStage": request.to_stage,
            "casesUpdated": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Move deliverable error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateDeliverableNameRequest(BaseModel):
    old_name_es: str
    new_name_es: str
    new_name_en: Optional[str] = None
    stage_number: int

@api_router.put("/admin/deliverable-templates/rename")
async def rename_deliverable(
    request: UpdateDeliverableNameRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Rename a deliverable for ALL cases in a specific stage"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Solo admins pueden renombrar entregables")
        
        query = {
            "stageNumber": request.stage_number,
            "$or": [
                {"name.es": request.old_name_es},
                {"deliverableName": request.old_name_es}
            ]
        }
        
        new_name = {
            "es": request.new_name_es,
            "en": request.new_name_en or request.new_name_es
        }
        
        result = await db.visa_deliverables.update_many(
            query,
            {
                "$set": {
                    "name": new_name,
                    "deliverableName": request.new_name_es,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="No se encontraron entregables para actualizar")
        
        logger.info(f"Renamed deliverable '{request.old_name_es}' to '{request.new_name_es}' - {result.modified_count} cases")
        
        return {
            "message": "Entregable renombrado exitosamente",
            "oldName": request.old_name_es,
            "newName": request.new_name_es,
            "casesUpdated": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rename deliverable error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/admin/deliverable-templates")
async def delete_deliverable_template(
    stage_number: int,
    name_es: str,
    delete_from_cases: bool = False,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a deliverable template and optionally remove it from all cases"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can delete deliverable templates")
        
        # Count how many cases have this deliverable
        cases_with_deliverable = await db.visa_deliverables.count_documents({
            "stageNumber": stage_number,
            "name.es": name_es
        })
        
        cases_affected = 0
        
        # Delete from cases if requested
        if delete_from_cases and cases_with_deliverable > 0:
            result = await db.visa_deliverables.delete_many({
                "stageNumber": stage_number,
                "name.es": name_es
            })
            cases_affected = result.deleted_count
            logger.info(f"Deleted deliverable '{name_es}' from stage {stage_number} - {cases_affected} cases affected")
        
        # Log the activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='delete',
            resource='deliverable_template',
            resource_id=f"stage_{stage_number}_{name_es}",
            details={
                'stageNumber': stage_number,
                'name': name_es,
                'deletedFromCases': delete_from_cases,
                'casesAffected': cases_affected
            }
        )
        await db.activity_log.insert_one(log)
        
        return {
            "message": f"Entregable eliminado exitosamente",
            "stage_number": stage_number,
            "name": name_es,
            "cases_affected": cases_affected,
            "deleted_from_cases": delete_from_cases
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete deliverable template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete deliverable template: {str(e)}")


# ============= DOCUMENT TEMPLATES MANAGEMENT =============

@api_router.get("/admin/document-templates")
async def get_document_templates(
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get unique client documents grouped by stage number from both collections"""
    try:
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "stageNumber": "$stageNumber",
                        "name": "$name"
                    },
                    "count": {"$sum": 1},
                    "sampleId": {"$first": "$_id"}
                }
            },
            {"$sort": {"_id.stageNumber": 1, "_id.name.es": 1}}
        ]
        
        # Get documents from both collections and merge them
        documents_new = await db.case_documents.aggregate(pipeline).to_list(500)
        documents_old = await db.visa_client_documents.aggregate(pipeline).to_list(500)
        
        # Merge both results
        all_documents = documents_new + documents_old
        
        # Group by stage
        stages_dict = {}
        for d in all_documents:
            stage_num = d['_id']['stageNumber']
            if stage_num not in stages_dict:
                stages_dict[stage_num] = {
                    'stageNumber': stage_num,
                    'documents': []
                }
            
            name = d['_id'].get('name') or {}
            # Check if document already exists in this stage (avoid duplicates)
            doc_name_es = name.get('es', 'Sin nombre')
            existing = [doc for doc in stages_dict[stage_num]['documents'] if doc['name'].get('es') == doc_name_es]
            
            if not existing:
                stages_dict[stage_num]['documents'].append({
                    'name': name,
                    'documentName': doc_name_es,
                    'count': d['count'],
                    'sampleId': str(d.get('sampleId', ''))
                })
        
        # Sort stages by stage number and sort documents within each stage alphabetically
        sorted_stages = []
        for stage_num in sorted(stages_dict.keys()):
            stage = stages_dict[stage_num]
            # Sort documents alphabetically by name (Spanish)
            stage['documents'].sort(key=lambda x: x['name'].get('es', '').lower())
            sorted_stages.append(stage)
        
        return {
            'stages': sorted_stages,
            'totalStages': len(sorted_stages)
        }
        
    except Exception as e:
        logger.error(f"Get document templates error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get document templates: {str(e)}")


class CreateDocumentRequest(BaseModel):
    stage_number: int
    name_es: str
    name_en: Optional[str] = None
    apply_to: str = 'new_only'
    case_ids: List[str] = []

@api_router.post("/admin/document-templates")
async def create_document_template(
    request: CreateDocumentRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new document template and optionally apply to existing cases"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can create document templates")
        
        name = {
            "es": request.name_es,
            "en": request.name_en or request.name_es
        }
        
        # Determine which cases to apply to
        cases_affected = 0
        case_ids_to_apply = []
        
        if request.apply_to == 'all_cases':
            # Get all cases that have this stage
            pipeline = [
                {"$match": {"stageNumber": request.stage_number}},
                {"$group": {"_id": "$caseId"}}
            ]
            result = await db.visa_stages.aggregate(pipeline).to_list(None)
            case_ids_to_apply = [doc['_id'] for doc in result]
            
        elif request.apply_to == 'selected_cases':
            case_ids_to_apply = request.case_ids
        
        # Create document instances for selected cases
        if case_ids_to_apply:
            import uuid
            document_instances = []
            
            for case_id in case_ids_to_apply:
                try:
                    case = await db.visa_cases.find_one({
                        "$or": [{"id": case_id}, {"_id": case_id}]
                    })
                    if not case:
                        continue
                    
                    actual_case_id = case.get('id') or case.get('_id')
                    user_id = case.get('userId')
                    
                    document_instance = {
                        "id": str(uuid.uuid4()),
                        "caseId": actual_case_id,
                        "userId": user_id,
                        "stageNumber": request.stage_number,
                        "name": name,
                        "isUploaded": False,
                        "fileUrl": None,
                        "uploadedAt": None,
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    }
                    document_instances.append(document_instance)
                    
                except Exception as case_error:
                    logger.error(f"Error processing case {case_id}: {case_error}")
                    continue
            
            if document_instances:
                await db.case_documents.insert_many(document_instances)
                cases_affected = len(document_instances)
        
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='create',
            resource='document_template',
            resource_id=f"stage_{request.stage_number}_{name['es']}",
            details={
                'stageNumber': request.stage_number,
                'name': name,
                'applyTo': request.apply_to,
                'casesAffected': cases_affected
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Document template created: Stage {request.stage_number} - '{name['es']}' by staff {staff_payload['id']} - Applied to {cases_affected} cases")
        
        return {
            "message": "Documento creado exitosamente",
            "stage_number": request.stage_number,
            "name": name,
            "cases_affected": cases_affected
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create document template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create document template: {str(e)}")


class MoveDocumentRequest(BaseModel):
    document_name_es: str
    from_stage: int
    to_stage: int

@api_router.post("/admin/document-templates/move")
async def move_document_to_stage(
    request: MoveDocumentRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Move a document requirement from one stage to another for ALL cases"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Solo admins pueden mover documentos")
        
        query = {
            "stageNumber": request.from_stage,
            "$or": [
                {"name.es": request.document_name_es},
                {"documentName": request.document_name_es}
            ]
        }
        
        affected_count = await db.visa_client_documents.count_documents(query)
        
        if affected_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontraron documentos '{request.document_name_es}' en la Etapa {request.from_stage}"
            )
        
        result = await db.visa_client_documents.update_many(
            query,
            {
                "$set": {
                    "stageNumber": request.to_stage,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='move_document',
            resource='document_template',
            resource_id=request.document_name_es,
            details={
                'fromStage': request.from_stage,
                'toStage': request.to_stage,
                'affectedCount': result.modified_count
            }
        )
        await db.activity_log.insert_one(log)
        
        logger.info(f"Moved document '{request.document_name_es}' from stage {request.from_stage} to {request.to_stage} - {result.modified_count} cases")
        
        return {
            "message": "Documento movido exitosamente",
            "documentName": request.document_name_es,
            "fromStage": request.from_stage,
            "toStage": request.to_stage,
            "casesUpdated": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Move document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateDocumentNameRequest(BaseModel):
    old_name_es: str
    new_name_es: str
    new_name_en: Optional[str] = None
    stage_number: int

@api_router.put("/admin/document-templates/rename")
async def rename_document(
    request: UpdateDocumentNameRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Rename a document for ALL cases in a specific stage"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Solo admins pueden renombrar documentos")
        
        query = {
            "stageNumber": request.stage_number,
            "$or": [
                {"name.es": request.old_name_es},
                {"documentName": request.old_name_es}
            ]
        }
        
        new_name = {
            "es": request.new_name_es,
            "en": request.new_name_en or request.new_name_es
        }
        
        result = await db.visa_client_documents.update_many(
            query,
            {
                "$set": {
                    "name": new_name,
                    "documentName": request.new_name_es,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="No se encontraron documentos para actualizar")
        
        logger.info(f"Renamed document '{request.old_name_es}' to '{request.new_name_es}' - {result.modified_count} cases")
        
        return {
            "message": "Documento renombrado exitosamente",
            "oldName": request.old_name_es,
            "newName": request.new_name_es,
            "casesUpdated": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rename document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/admin/document-templates")
async def delete_document_template(
    stage_number: int,
    name_es: str,
    delete_from_cases: bool = False,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a document template and optionally remove it from all cases"""
    try:
        staff = await db.staff.find_one({'_id': staff_payload['id']})
        if not staff or staff.get('role') not in ['admin', 'super_admin']:
            raise HTTPException(status_code=403, detail="Only admins can delete document templates")
        
        # Count how many cases have this document in both collections
        cases_with_doc_new = await db.case_documents.count_documents({
            "stageNumber": stage_number,
            "name.es": name_es
        })
        
        cases_with_doc_old = await db.visa_client_documents.count_documents({
            "stageNumber": stage_number,
            "name.es": name_es
        })
        
        total_cases = cases_with_doc_new + cases_with_doc_old
        cases_affected = 0
        
        # Delete from cases if requested
        if delete_from_cases and total_cases > 0:
            result_new = await db.case_documents.delete_many({
                "stageNumber": stage_number,
                "name.es": name_es
            })
            result_old = await db.visa_client_documents.delete_many({
                "stageNumber": stage_number,
                "name.es": name_es
            })
            cases_affected = result_new.deleted_count + result_old.deleted_count
            logger.info(f"Deleted document '{name_es}' from stage {stage_number} - {cases_affected} cases affected")
        
        # Log the activity
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='delete',
            resource='document_template',
            resource_id=f"stage_{stage_number}_{name_es}",
            details={
                'stageNumber': stage_number,
                'name': name_es,
                'deletedFromCases': delete_from_cases,
                'casesAffected': cases_affected
            }
        )
        await db.activity_log.insert_one(log)
        
        return {
            "message": f"Documento eliminado exitosamente",
            "stage_number": stage_number,
            "name": name_es,
            "cases_affected": cases_affected,
            "deleted_from_cases": delete_from_cases
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document template: {str(e)}")


class DocumentValidationRequest(BaseModel):
    validationNotes: Optional[str] = None

@api_router.put("/admin/client-documents/{document_id}/validate")
async def validate_client_document(
    document_id: str,
    request: DocumentValidationRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Validate a client document"""
    try:
        document = await db.visa_client_documents.find_one({'_id': document_id})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Actualizar documento
        update_data = {
            'status': DocumentStatus.VALIDATED,
            'reviewedBy': staff_payload['id'],
            'reviewedAt': datetime.now(timezone.utc).isoformat(),
            'validatedAt': datetime.now(timezone.utc).isoformat(),
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }
        
        if request.validationNotes:
            update_data['validationNotes'] = request.validationNotes
        
        await db.visa_client_documents.update_one(
            {'_id': document_id},
            {'$set': update_data}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='validate',
            resource='client_document',
            resource_id=document_id,
            details={'documentType': document.get('documentType')}
        )
        await db.activity_log.insert_one(log)
        
        # Case audit log
        case_id = document.get('caseId')
        if case_id:
            # Marcar actividad reciente en el caso para el cálculo de inactividad
            await db.visa_cases.update_one(
                {"id": case_id},
                {"$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            staff = await db.staff.find_one({'_id': staff_payload['id']})
            doc_name = document.get('documentName') or document.get('name', {}).get('es', 'Documento')
            await log_case_audit(
                case_id=case_id,
                action=f"Documento '{doc_name}' validado",
                action_type=AuditActionTypes.DOCUMENT_VALIDATED,
                performed_by_id=staff_payload['id'],
                performed_by_name=staff.get('name', 'Staff') if staff else 'Staff',
                performed_by_role=staff_payload.get('role', 'coordinator'),
                details={
                    'documentId': document_id,
                    'documentType': document.get('documentType'),
                    'stageNumber': document.get('stageNumber')
                }
            )
        
        # Notify client about validated document
        if case_id:
            from services.case_notifications import notify_doc_validated
            await notify_doc_validated(db, case_id, doc_name, {
                "id": staff_payload['id'], "name": staff.get('name', 'Staff') if staff else 'Staff', "role": staff_payload.get('role', '')
            })
        
        return {
            'message': 'Document validated successfully',
            'document': await db.visa_client_documents.find_one({'_id': document_id})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Validate document error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate document: {str(e)}")


class DocumentRejectionRequest(BaseModel):
    rejectionReason: str

@api_router.put("/admin/client-documents/{document_id}/reject")
async def reject_client_document(
    document_id: str,
    request: DocumentRejectionRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Reject a client document"""
    try:
        document = await db.visa_client_documents.find_one({'_id': document_id})
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Actualizar documento
        update_data = {
            'status': DocumentStatus.REJECTED,
            'reviewedBy': staff_payload['id'],
            'reviewedAt': datetime.now(timezone.utc).isoformat(),
            'rejectionReason': request.rejectionReason,
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }
        
        await db.visa_client_documents.update_one(
            {'_id': document_id},
            {'$set': update_data}
        )
        
        # Log de actividad
        log = ActivityLog.create_log(
            staff_id=staff_payload['id'],
            action='reject',
            resource='client_document',
            resource_id=document_id,
            details={
                'documentType': document.get('documentType'),
                'reason': request.rejectionReason
            }
        )
        await db.activity_log.insert_one(log)
        
        # Case audit log
        case_id = document.get('caseId')
        if case_id:
            # Marcar actividad reciente en el caso para el cálculo de inactividad
            await db.visa_cases.update_one(
                {"id": case_id},
                {"$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            staff = await db.staff.find_one({'_id': staff_payload['id']})
            doc_name = document.get('documentName') or document.get('name', {}).get('es', 'Documento')
            await log_case_audit(
                case_id=case_id,
                action=f"Documento '{doc_name}' rechazado: {request.rejectionReason}",
                action_type=AuditActionTypes.DOCUMENT_REJECTED,
                performed_by_id=staff_payload['id'],
                performed_by_name=staff.get('name', 'Staff') if staff else 'Staff',
                performed_by_role=staff_payload.get('role', 'coordinator'),
                details={
                    'documentId': document_id,
                    'documentType': document.get('documentType'),
                    'rejectionReason': request.rejectionReason,
                    'stageNumber': document.get('stageNumber')
                }
            )
        
        # Notify client about rejected document
        if case_id:
            from services.case_notifications import notify_doc_rejected
            await notify_doc_rejected(db, case_id, doc_name, request.rejectionReason, {
                "id": staff_payload['id'], "name": staff.get('name', 'Staff') if staff else 'Staff', "role": staff_payload.get('role', '')
            })
        
        return {
            'message': 'Document rejected',
            'document': await db.visa_client_documents.find_one({'_id': document_id})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reject document error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reject document: {str(e)}")


# ===== Stages Endpoints =====

@api_router.get("/admin/visa-cases/{case_id}/stages")
async def get_case_stages(
    case_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all stages for a case"""
    try:
        stages = await db.visa_stages.find({'caseId': case_id}).sort('stageNumber', 1).to_list(length=4)
        
        return {
            'stages': stages,
            'total': len(stages)
        }
        
    except Exception as e:
        logger.error(f"Get stages error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stages: {str(e)}")


@api_router.get("/admin/visa-cases/{case_id}/stages/{stage_number}")
async def get_stage_detail(
    case_id: str,
    stage_number: int,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get detailed information about a specific stage"""
    try:
        stage = await db.visa_stages.find_one({
            'caseId': case_id,
            'stageNumber': stage_number
        })
        
        if not stage:
            raise HTTPException(status_code=404, detail="Stage not found")
        
        # Obtener entregables de esta etapa
        deliverables = await db.visa_deliverables.find({'stageId': stage['_id']}).to_list(length=50)
        
        # Obtener documentos de esta etapa
        documents = await db.visa_client_documents.find({
            'caseId': case_id,
            'stageNumber': stage_number
        }).to_list(length=50)
        
        return {
            'stage': stage,
            'deliverables': deliverables,
            'documents': documents
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get stage detail error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stage: {str(e)}")


class UpdateStageAmountRequest(BaseModel):
    amount: float = Field(..., gt=0, description="New amount for the stage (must be greater than 0)")


@api_router.patch("/admin/visa-cases/{case_id}/stages/{stage_number}/amount")
async def update_stage_amount(
    case_id: str,
    stage_number: int,
    request: UpdateStageAmountRequest,
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Update the amount/price of a specific stage (Admin only)
    """
    try:
        # Verify stage exists
        stage = await db.visa_stages.find_one({
            'caseId': case_id,
            'stageNumber': stage_number
        })
        
        if not stage:
            raise HTTPException(status_code=404, detail="Stage not found")
        
        # Check if stage is already paid
        if stage.get('isPaid', False):
            raise HTTPException(
                status_code=400, 
                detail="Cannot modify amount of a paid stage"
            )
        
        # Update the stage amount
        result = await db.visa_stages.update_one(
            {
                'caseId': case_id,
                'stageNumber': stage_number
            },
            {
                '$set': {
                    'amount': request.amount,
                    'updatedAt': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update stage amount")
        
        logger.info(f"Admin {staff_payload.get('email')} updated stage {stage_number} amount to ${request.amount} for case {case_id}")
        
        # Get updated stage
        updated_stage = await db.visa_stages.find_one({
            'caseId': case_id,
            'stageNumber': stage_number
        })
        
        return {
            'success': True,
            'message': f'Stage amount updated to ${request.amount}',
            'stage': updated_stage
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update stage amount error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update stage amount: {str(e)}")


# Client auth function
async def verify_user_token(authorization: Annotated[str, Header()] = None):
    """Verify user JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No authorization token provided")
    
    token = authorization.replace('Bearer ', '')
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Verificar que sea token de usuario
        if payload.get('type') != 'user':
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # Verificar que el usuario existe
        from bson import ObjectId
        try:
            user_id = ObjectId(payload['id'])
            user = await db.users.find_one({'_id': user_id})
        except Exception:
            # If ObjectId conversion fails, try with string ID
            user = await db.users.find_one({'_id': payload['id']})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Import and setup client endpoints
from client_endpoints import setup_client_endpoints
client_router = setup_client_endpoints(db, verify_user_token)

# Endpoint to mark intake form as completed (called by N8N when user finishes form)
@api_router.post("/documents/mark-intake-completed")
async def mark_intake_completed(phone: str = Form(...)):
    """
    Mark intake form as completed when user finishes the N8N form.
    This endpoint is public and called by N8N webhook.
    """
    try:
        # Find user by phone
        target_user = await db.users.find_one({"phone": phone})
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user id (handle both _id and id fields)
        user_id = target_user.get("id") or str(target_user.get("_id"))
        
        # Find the user's case
        visa_case = await db.visa_cases.find_one({"userId": user_id})
        
        if not visa_case:
            raise HTTPException(status_code=404, detail="Case not found for user")
        
        # Find the "Formulario de Intake" document
        # Try both old format (documentName) and new format (name.es or name.en)
        intake_doc = await db.visa_client_documents.find_one({
            "caseId": visa_case["id"],
            "$or": [
                {"documentName": "Formulario de Intake"},
                {"name.es": "Formulario de Intake"},
                {"name.en": "Intake Form"}
            ]
        })
        
        if not intake_doc:
            raise HTTPException(status_code=404, detail="Intake form document not found")
        
        # Update document status to "uploaded" (waiting for admin review)
        await db.visa_client_documents.update_one(
            {"_id": intake_doc["_id"]},
            {
                "$set": {
                    "status": "uploaded",  # Changed from pending to uploaded
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"Intake form marked as completed for user {phone}")
        
        return {
            "success": True,
            "message": "Formulario de intake marcado como completado",
            "userId": user_id,
            "caseId": visa_case["id"],
            "status": "uploaded"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking intake form as completed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Endpoint to upload intake form (PUBLIC - called by N8N)
@api_router.post("/documents/{document_id}/submit-text")
async def submit_document_text(
    document_id: str,
    request: dict,
    user_payload: dict = Depends(verify_user_token)
):
    """
    Submit text value for a document that accepts text input instead of file upload.
    """
    try:
        text_value = request.get('textValue', '').strip()
        
        if not text_value:
            raise HTTPException(status_code=400, detail="Text value is required")
        
        # Find the document
        document = await db.visa_client_documents.find_one({"_id": document_id})
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Verify user owns this document's case
        user_id = user_payload.get('id') or user_payload.get('_id')
        case = await db.visa_cases.find_one({"caseId": document['caseId']})
        
        if not case or case.get('userId') != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update document with text value
        await db.visa_client_documents.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "textValue": text_value,
                    "status": "uploaded",  # Mark as uploaded for review
                    "uploadedAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"Text document submitted: {document_id} by user {user_id}")
        
        return {
            "message": "Text submitted successfully",
            "documentId": document_id,
            "status": "uploaded"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting text document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/documents/upload-intake-form")
async def upload_intake_form(
    phone: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload intake form for a user.
    This endpoint is public and called by N8N webhook after form completion.
    """
    try:
        # Find user by phone
        target_user = await db.users.find_one({"phone": phone})
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user id (handle both _id and id fields)
        user_id = target_user.get("id") or str(target_user.get("_id"))
        
        # Find the user's case
        visa_case = await db.visa_cases.find_one({"userId": user_id})
        
        if not visa_case:
            raise HTTPException(status_code=404, detail="Case not found for user")
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("/app/backend/uploads")
        upload_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"intake_form_{user_id}_{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Find the "Formulario de Intake" document
        # Try both old format (documentName) and new format (name.es or name.en)
        intake_doc = await db.visa_client_documents.find_one({
            "caseId": visa_case["id"],
            "$or": [
                {"documentName": "Formulario de Intake"},
                {"name.es": "Formulario de Intake"},
                {"name.en": "Intake Form"}
            ]
        })
        
        file_url = f"/api/documents/download/{unique_filename}"
        update_data = {
            "status": "validated",
            "fileUrl": file_url,
            "fileName": file.filename,
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        if intake_doc:
            # Update Formulario de Intake document with file info
            await db.visa_client_documents.update_one(
                {"_id": intake_doc["_id"]},
                {"$set": update_data}
            )
        
        # Also update "Formulario I-140 Completado" with the same file
        # Try both old format (documentName) and new format (name.es or name.en)
        i140_doc = await db.visa_client_documents.find_one({
            "caseId": visa_case["id"],
            "$or": [
                {"documentName": "Formulario I-140 Completado"},
                {"name.es": "Formulario I-140 Completado"},
                {"name.en": "Completed I-140 Form"}
            ]
        })
        
        # If I-140 doesn't exist in documents, check deliverables
        if not i140_doc:
            i140_deliverable = await db.visa_deliverables.find_one({
                "caseId": visa_case["id"],
                "$or": [
                    {"deliverableName": "Formulario I-140 Completado"},
                    {"name.es": "Formulario I-140 Completado"},
                    {"name.en": "Completed I-140 Form"}
                ]
            })
            
            if i140_deliverable:
                # Update deliverable with file info
                await db.visa_deliverables.update_one(
                    {"_id": i140_deliverable["_id"]},
                    {
                        "$set": {
                            "status": "completed",
                            "fileUrl": file_url,
                            "fileName": file.filename,
                            "completedAt": datetime.now(timezone.utc).isoformat(),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
        else:
            # Update I-140 document with the same file
            await db.visa_client_documents.update_one(
                {"_id": i140_doc["_id"]},
                {"$set": update_data}
            )
        
        logger.info(f"Intake form uploaded for user {phone}: {unique_filename}")
        logger.info(f"File also linked to Formulario I-140 Completado")
        
        return {
            "success": True,
            "message": "Formulario de intake subido exitosamente y vinculado a I-140",
            "fileUrl": file_url,
            "fileName": file.filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading intake form: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

# Endpoint to upload deliverable file (ADMIN)
@api_router.post("/admin/deliverables/upload-file")
async def upload_deliverable_file(
    file: UploadFile = File(...),
    staff_payload: dict = Depends(verify_staff_token)
):
    """
    Upload a deliverable file to Supabase Storage and return the file URL
    """
    try:
        from storage_service import upload_file as supabase_upload
        
        # Leer contenido del archivo
        file_content = await file.read()
        
        # Subir a Supabase Storage
        result = supabase_upload(
            file_content=file_content,
            filename=file.filename,
            folder="deliverables"  # Carpeta específica para deliverables
        )
        
        if not result.get('success'):
            raise HTTPException(
                status_code=500, 
                detail=f"Error uploading to Supabase: {result.get('error', 'Unknown error')}"
            )
        
        logger.info(f"Deliverable file uploaded to Supabase by staff {staff_payload['id']}: {result['filePath']}")
        
        return {
            "message": "File uploaded successfully to Supabase Storage",
            "fileUrl": result['fileUrl'],  # URL pública de Supabase
            "fileName": file.filename,
            "fileSize": len(file_content),
            "filePath": result['filePath']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading deliverable file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

# Endpoint to download uploaded documents
@api_router.get("/documents/download/{filename}")
async def download_document(filename: str):
    """
    Download an uploaded document
    """
    try:
        file_path = Path("/app/backend/uploads") / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/octet-stream"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")

# Admin endpoint to delete test user (based on LIMPIAR_USUARIO_PRUEBAS.md)
class DeleteTestUserRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None

@api_router.delete("/admin/test-users/delete")
async def delete_test_user(request: DeleteTestUserRequest):
    """
    Delete a test user and all related data (case, stages, deliverables, documents, payments).
    Based on LIMPIAR_USUARIO_PRUEBAS.md documentation.
    
    ⚠️ PUBLIC ENDPOINT: No authentication required
    Does NOT touch Supabase (read-only).
    Preserves master case.
    """
    try:
        # Validate that at least one identifier is provided
        if not request.email and not request.phone:
            raise HTTPException(
                status_code=400, 
                detail="Either email or phone must be provided"
            )
        
        # Find user by email or phone
        query = {}
        if request.email:
            query['email'] = request.email
        elif request.phone:
            query['phone'] = request.phone
        
        user = await db.users.find_one(query)
        
        if not user:
            raise HTTPException(
                status_code=404, 
                detail=f"User not found with {'email: ' + request.email if request.email else 'phone: ' + request.phone}"
            )
        
        user_id = str(user['_id'])
        user_name = user.get('name', 'Unknown')
        user_email = user.get('email', 'N/A')
        
        deletion_summary = {
            "user": {
                "name": user_name,
                "email": user_email,
                "phone": user.get('phone', 'N/A'),
                "id": user_id
            },
            "deleted": {
                "cases": 0,
                "stages": 0,
                "deliverables": 0,
                "documents": 0,
                "payments": 0
            }
        }
        
        # Find and delete user's case
        user_case = await db.visa_cases.find_one({"userId": user_id})
        
        if user_case:
            case_id = user_case.get('caseId') or user_case.get('id')
            
            # Delete stages
            stages_result = await db.visa_stages.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["stages"] = stages_result.deleted_count
            
            # Delete deliverables
            deliverables_result = await db.visa_deliverables.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["deliverables"] = deliverables_result.deleted_count
            
            # Delete documents
            docs_result = await db.visa_client_documents.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["documents"] = docs_result.deleted_count
            
            # Delete payments
            payments_result = await db.payments.delete_many({"caseId": case_id})
            deletion_summary["deleted"]["payments"] = payments_result.deleted_count
            
            # Delete case
            case_result = await db.visa_cases.delete_one({"caseId": case_id})
            deletion_summary["deleted"]["cases"] = case_result.deleted_count
        
        # Delete user
        await db.users.delete_one({"_id": user['_id']})
        
        # Verify master case is intact
        master_case = await db.visa_cases.find_one({"caseId": "master_case_eb2_niw"})
        
        logger.info(f"✅ Test user deleted by admin: {user_email} (ID: {user_id})")
        
        return {
            "success": True,
            "message": "Test user and all related data deleted successfully",
            "summary": deletion_summary,
            "master_case_intact": master_case is not None,
            "note": "Supabase was not modified (read-only)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting test user: {str(e)}")

# Setup appointments endpoints
from appointments_endpoints import setup_appointments_router
appointments_router = setup_appointments_router(db, verify_user_token, verify_staff_token)

# USCIS Case Tracker
from services.uscis_tracker_endpoints import setup_uscis_tracker_router
uscis_tracker_router = setup_uscis_tracker_router(db, verify_staff_token, verify_token_header)

# Payment Authorization (public form)
from services.payment_auth_endpoints import setup_payment_auth_router
payment_auth_router = setup_payment_auth_router(db)

# Classic Cases (checklist-based)
from services.classic_cases_endpoints import setup_classic_cases_router
classic_cases_router = setup_classic_cases_router(db, verify_staff_token)

# Setup manual payments endpoints
from manual_payments_endpoints import setup_manual_payments_router
manual_payments_router = setup_manual_payments_router(db, verify_staff_token)

from webinars_endpoints import setup_webinars_router
webinars_router = setup_webinars_router(db, verify_staff_token)

from legal_library_endpoints import setup_legal_library_router
legal_library_router = setup_legal_library_router(db, verify_staff_token)

from success_stories_endpoints import setup_success_stories_router
success_stories_router = setup_success_stories_router(db, verify_staff_token)

# Master Case ID constant
MASTER_CASE_ID = "master_case_eb2_niw"

# Setup storage endpoints
from storage_endpoints import setup_storage_endpoints
storage_router = setup_storage_endpoints(verify_staff_token, db)

# Setup system management endpoints
from system_endpoints import setup_system_endpoints
system_router = setup_system_endpoints(db, verify_staff_token)

# =====================================================
# MIGRATION ENDPOINTS - Export/Import USCIS Forms Module
# =====================================================

@api_router.get("/admin/migration/uscis/export")
async def export_uscis_migration_data():
    """
    Export USCIS Forms module data for migration to production.
    Collections: uscis_templates, uscis_shared_forms, uscis_submissions
    """
    import base64
    from datetime import datetime
    from bson import ObjectId
    
    def serialize_value(val):
        """Convert non-JSON-serializable values to serializable format"""
        if val is None:
            return None
        if isinstance(val, ObjectId):
            return str(val)
        if isinstance(val, datetime):
            return val.isoformat()
        if isinstance(val, bytes):
            return base64.b64encode(val).decode('utf-8')
        if isinstance(val, dict):
            return {k: serialize_value(v) for k, v in val.items()}
        if isinstance(val, list):
            return [serialize_value(item) for item in val]
        return val
    
    def serialize_doc(doc):
        """Serialize a MongoDB document to JSON-safe format"""
        return {k: serialize_value(v) for k, v in doc.items()}
    
    try:
        migration_data = {}
        
        # Export uscis_templates
        templates = await db.uscis_templates.find({}).to_list(None)
        migration_data['uscis_templates'] = [serialize_doc(t) for t in templates]
        logger.info(f"Exported {len(templates)} USCIS templates")
        
        # Export uscis_shared_forms
        shared_forms = await db.uscis_shared_forms.find({}).to_list(None)
        migration_data['uscis_shared_forms'] = [serialize_doc(sf) for sf in shared_forms]
        logger.info(f"Exported {len(shared_forms)} USCIS shared forms")
        
        # Export uscis_submissions
        submissions = await db.uscis_submissions.find({}).to_list(None)
        migration_data['uscis_submissions'] = [serialize_doc(s) for s in submissions]
        logger.info(f"Exported {len(submissions)} USCIS submissions")
        
        return {
            "success": True,
            "message": "Datos del módulo USCIS exportados exitosamente",
            "summary": {
                "uscis_templates": len(templates),
                "uscis_shared_forms": len(shared_forms),
                "uscis_submissions": len(submissions)
            },
            "data": migration_data
        }
        
    except Exception as e:
        logger.error(f"Export USCIS migration error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al exportar datos USCIS: {str(e)}")


class USCISMigrationImportRequest(BaseModel):
    uscis_templates: Optional[List[dict]] = []
    uscis_shared_forms: Optional[List[dict]] = []
    uscis_submissions: Optional[List[dict]] = []
    clear_existing: Optional[bool] = False


@api_router.post("/admin/migration/uscis/import")
async def import_uscis_migration_data(
    request: USCISMigrationImportRequest
):
    """
    Import USCIS Forms module data from another environment.
    Use clear_existing=true to replace all USCIS data (use with caution!)
    """
    try:
        results = {}
        
        # If clear_existing is True, delete existing USCIS data first
        if request.clear_existing:
            logger.warning("Clearing existing USCIS data before import")
            await db.uscis_templates.delete_many({})
            await db.uscis_shared_forms.delete_many({})
            await db.uscis_submissions.delete_many({})
        
        # Import uscis_templates
        if request.uscis_templates:
            for template in request.uscis_templates:
                t_id = template.get('_id') or template.get('id')
                if t_id:
                    # Try to use ObjectId if it's a valid ObjectId string
                    try:
                        obj_id = ObjectId(t_id)
                        await db.uscis_templates.update_one(
                            {'_id': obj_id},
                            {'$set': {**template, '_id': obj_id}},
                            upsert=True
                        )
                    except:
                        await db.uscis_templates.update_one(
                            {'_id': t_id},
                            {'$set': {**template, '_id': t_id}},
                            upsert=True
                        )
                else:
                    await db.uscis_templates.insert_one(template)
            results['uscis_templates'] = len(request.uscis_templates)
            logger.info(f"Imported {len(request.uscis_templates)} USCIS templates")
        
        # Import uscis_shared_forms
        if request.uscis_shared_forms:
            for shared in request.uscis_shared_forms:
                s_id = shared.get('_id') or shared.get('id')
                if s_id:
                    await db.uscis_shared_forms.update_one(
                        {'_id': s_id},
                        {'$set': {**shared, '_id': s_id}},
                        upsert=True
                    )
                else:
                    await db.uscis_shared_forms.insert_one(shared)
            results['uscis_shared_forms'] = len(request.uscis_shared_forms)
            logger.info(f"Imported {len(request.uscis_shared_forms)} USCIS shared forms")
        
        # Import uscis_submissions
        if request.uscis_submissions:
            for submission in request.uscis_submissions:
                sub_id = submission.get('_id') or submission.get('id')
                if sub_id:
                    await db.uscis_submissions.update_one(
                        {'_id': sub_id},
                        {'$set': {**submission, '_id': sub_id}},
                        upsert=True
                    )
                else:
                    await db.uscis_submissions.insert_one(submission)
            results['uscis_submissions'] = len(request.uscis_submissions)
            logger.info(f"Imported {len(request.uscis_submissions)} USCIS submissions")
        
        return {
            "success": True,
            "message": "Datos del módulo USCIS importados exitosamente",
            "imported": results,
            "clear_existing_used": request.clear_existing
        }
        
    except Exception as e:
        logger.error(f"Import USCIS migration error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al importar datos USCIS: {str(e)}")


# =====================================================
# END MIGRATION ENDPOINTS
# =====================================================

# =====================================================
# TIMELINE TEMPLATES ENDPOINTS
# =====================================================

class TimelineTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visaType: str = "EB-2 NIW"
    stages: List[dict] = []

@api_router.get("/admin/timeline-templates")
async def get_timeline_templates(
    limit: int = 100,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all timeline templates"""
    try:
        cursor = db.timeline_templates.find({}, {'_id': 0}).limit(limit)
        templates = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "templates": templates,
            "total": len(templates)
        }
    except Exception as e:
        logger.error(f"Error fetching timeline templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch timeline templates")

@api_router.post("/admin/timeline-templates")
async def create_timeline_template(
    request: TimelineTemplateCreate,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new timeline template"""
    try:
        template_id = str(uuid.uuid4())
        template = {
            "id": template_id,
            "name": request.name,
            "description": request.description,
            "visaType": request.visaType,
            "stages": request.stages,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "createdBy": staff_payload['id']
        }
        
        await db.timeline_templates.insert_one(template)
        return {"success": True, "template": template}
    except Exception as e:
        logger.error(f"Error creating timeline template: {e}")
        raise HTTPException(status_code=500, detail="Failed to create timeline template")

@api_router.delete("/admin/timeline-templates/{template_id}")
async def delete_timeline_template(
    template_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete a timeline template"""
    try:
        await db.timeline_templates.delete_one({'id': template_id})
        return {"success": True, "message": "Template deleted"}
    except Exception as e:
        logger.error(f"Error deleting timeline template: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete timeline template")

# =====================================================
# END TIMELINE TEMPLATES ENDPOINTS
# =====================================================

# =====================================================
# ELIGIBILITY TEMPLATES ENDPOINTS
# =====================================================

class EligibilityTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visaType: str = "EB-2 NIW"
    criteria: List[dict] = []

@api_router.get("/admin/eligibility-templates")
async def get_eligibility_templates(
    limit: int = 100,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Get all eligibility templates"""
    try:
        cursor = db.eligibility_templates.find({}, {'_id': 0}).limit(limit)
        templates = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "templates": templates,
            "total": len(templates)
        }
    except Exception as e:
        logger.error(f"Error fetching eligibility templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch eligibility templates")

@api_router.post("/admin/eligibility-templates")
async def create_eligibility_template(
    request: EligibilityTemplateCreate,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Create a new eligibility template"""
    try:
        template_id = str(uuid.uuid4())
        template = {
            "id": template_id,
            "name": request.name,
            "description": request.description,
            "visaType": request.visaType,
            "criteria": request.criteria,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "createdBy": staff_payload['id']
        }
        
        await db.eligibility_templates.insert_one(template)
        return {"success": True, "template": template}
    except Exception as e:
        logger.error(f"Error creating eligibility template: {e}")
        raise HTTPException(status_code=500, detail="Failed to create eligibility template")

@api_router.delete("/admin/eligibility-templates/{template_id}")
async def delete_eligibility_template(
    template_id: str,
    staff_payload: dict = Depends(verify_staff_token)
):
    """Delete an eligibility template"""
    try:
        await db.eligibility_templates.delete_one({'id': template_id})
        return {"success": True, "message": "Template deleted"}
    except Exception as e:
        logger.error(f"Error deleting eligibility template: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete eligibility template")

# =====================================================
# END ELIGIBILITY TEMPLATES ENDPOINTS
# =====================================================

# 🆕 REFACTORED ROUTERS - New modular structure
from routes.auth_user import router as auth_user_router
from routes.auth_admin import router as auth_admin_router
from routes.users_admin import router as users_admin_router
from routes.staff_admin import router as staff_admin_router
from routes.cases_admin import router as cases_admin_router
from routes.payments_admin import router as payments_admin_router
from routes.uscis_forms import router as uscis_forms_router
from routes.audit import router as audit_router

# Leads router (no auth needed for create, but needed for admin endpoints)
from leads_endpoints import router as leads_router

# Mount the API router
app.include_router(api_router)
app.include_router(client_router)

# 🆕 Refactored routers (modular structure)
app.include_router(auth_user_router, prefix="/api")
app.include_router(auth_admin_router, prefix="/api")
app.include_router(users_admin_router, prefix="/api")
app.include_router(staff_admin_router, prefix="/api")
app.include_router(cases_admin_router, prefix="/api")
app.include_router(payments_admin_router, prefix="/api")
app.include_router(audit_router, prefix="/api")

# USCIS Forms module (admin/super_admin only)
app.include_router(uscis_forms_router, prefix="/api")

# Legacy routers
app.include_router(appointments_router, prefix="/api")
app.include_router(uscis_tracker_router, prefix="/api")
app.include_router(payment_auth_router, prefix="/api")
app.include_router(classic_cases_router, prefix="/api")
app.include_router(manual_payments_router, prefix="/api")
app.include_router(webinars_router, prefix="/api")
app.include_router(legal_library_router, prefix="/api")
app.include_router(success_stories_router, prefix="/api")
app.include_router(storage_router)
app.include_router(system_router)

# Leads router (public POST, admin GET/PATCH/DELETE)
app.include_router(leads_router)

# Static files are served via API endpoints (e.g., /api/static/manual-diy-completo.pdf)
# Not using app.mount to avoid conflicts with API routes

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start USCIS cron job on startup
@app.on_event("startup")
async def start_uscis_cron():
    import asyncio as _asyncio
    from services.uscis_cron import uscis_cron_loop
    _asyncio.ensure_future(uscis_cron_loop(db))

@app.on_event("startup")
async def start_classic_alerts_cron():
    import asyncio as _asyncio

    async def classic_alerts_loop():
        """Run classic case alerts daily at 7 AM EST (12:00 UTC)."""
        from datetime import timedelta
        logger.info("Classic alerts cron started")
        EST_OFFSET = timedelta(hours=-5)

        while True:
            try:
                now_utc = datetime.now(timezone.utc)
                now_est = now_utc + EST_OFFSET
                if now_est.hour == 7 and now_est.minute == 0:
                    logger.info("Classic alerts cron triggered at 7 AM EST")
                    from services.classic_case_alerts import run_classic_case_alerts
                    await run_classic_case_alerts(db)
                    await _asyncio.sleep(61)
                else:
                    await _asyncio.sleep(30)
            except Exception as e:
                logger.error(f"Classic alerts cron error: {e}")
                await _asyncio.sleep(60)

    _asyncio.ensure_future(classic_alerts_loop())
