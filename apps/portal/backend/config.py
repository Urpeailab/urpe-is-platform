"""Configuration module for shared settings and dependencies."""
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pathlib import Path
from dotenv import load_dotenv
import os
import logging

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

# Import JWT constants
from admin_models import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS, StaffModel
