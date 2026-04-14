# Admin Models and Utilities
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import os
from typing import Optional, Dict, Any

# JWT Secret (en producción usar variable de entorno)
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24
MAGIC_LINK_EXPIRATION_MINUTES = 15

# Role hierarchy
ROLE_LEVELS = {
    'super_admin': 1,
    'admin': 2,
    'manager': 3,
    'coordinator': 4,
    'advisor': 5,
    'acreditador': 6
}

# Default permissions by role
DEFAULT_PERMISSIONS = {
    'super_admin': {
        'canManageStaff': True,
        'canManageUsers': True,
        'canManageContent': True,
        'canExportData': True,
        'canManageFinances': True,
        'canDeleteAny': True,
        'canViewAll': True
    },
    'admin': {
        'canManageStaff': True,
        'canManageUsers': True,
        'canManageContent': True,
        'canExportData': True,
        'canManageFinances': True,
        'canDeleteAny': False,  # Cannot delete super admins
        'canViewAll': True
    },
    'manager': {
        'canManageStaff': False,
        'canManageUsers': True,
        'canManageContent': True,
        'canExportData': True,
        'canManageFinances': False,
        'canDeleteAny': False,
        'canViewAll': True
    },
    'coordinator': {
        'canManageStaff': False,
        'canManageUsers': True,
        'canManageContent': False,
        'canExportData': False,
        'canManageFinances': False,
        'canDeleteAny': False,
        'canViewAll': False  # Only assigned users
    },
    'advisor': {
        'canManageStaff': False,
        'canManageUsers': False,
        'canManageContent': False,
        'canExportData': False,
        'canManageFinances': False,
        'canDeleteAny': False,
        'canViewAll': False  # Only assigned users
    },
    'acreditador': {
        'canManageStaff': False,
        'canManageUsers': False,
        'canManageContent': False,
        'canExportData': False,
        'canManageFinances': False,
        'canDeleteAny': False,
        'canViewAll': False,
        'canOnlyViewVisaCases': True,
        'restrictedToDeliverable': 'acreditación de títulos',
        'requiresMultiplePaidStages': True
    }
}

class StaffModel:
    """Staff member model"""
    
    @staticmethod
    def create_staff(email: str, password: str, name: str, role: str, phone: str = None, 
                    department: str = None, linkedin: str = None) -> Dict[str, Any]:
        """Create new staff member"""
        staff_id = str(uuid.uuid4())
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        return {
            '_id': staff_id,
            'email': email.lower(),
            'name': name,
            'role': role,
            'roleLevel': ROLE_LEVELS.get(role, 5),
            'phone': phone,
            'department': department,
            'linkedin': linkedin,
            'photo': None,
            'status': 'active',
            'permissions': DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS['advisor']),
            'managedBy': None,
            'teamMembers': [],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
            'lastLogin': None,
            'passwordHash': password_hash,
            'magicLinkToken': None,
            'magicLinkExpires': None
        }
    
    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except Exception as e:
            print(f"Password verification error: {e}")
            return False
    
    @staticmethod
    def generate_jwt(staff: Dict[str, Any]) -> str:
        """Generate JWT token for staff"""
        # Get roleLevel with default fallback
        role = staff.get('role', 'advisor')
        role_level = staff.get('roleLevel', ROLE_LEVELS.get(role, 5))
        permissions = staff.get('permissions', DEFAULT_PERMISSIONS.get(role, {}))
        
        payload = {
            'id': staff.get('id') or staff.get('_id'),
            'email': staff['email'],
            'name': staff.get('name', ''),
            'role': role,
            'roleLevel': role_level,
            'permissions': permissions,
            'type': 'staff',  # Distinguir de usuarios regulares
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    @staticmethod
    def verify_jwt(token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            # Verificar que es un staff token
            if payload.get('type') not in ('staff', 'api_token', 'admin_system'):
                return None
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    @staticmethod
    def generate_magic_link_token() -> str:
        """Generate secure token for magic link"""
        return str(uuid.uuid4())
    
    @staticmethod
    def get_magic_link_expiration() -> datetime:
        """Get expiration datetime for magic link"""
        return datetime.utcnow() + timedelta(minutes=MAGIC_LINK_EXPIRATION_MINUTES)


class ActivityLog:
    """Activity log model"""
    
    @staticmethod
    def create_log(staff_id: str, action: str, resource: str, resource_id: str = None, 
                   details: Dict = None, ip_address: str = None) -> Dict[str, Any]:
        """Create activity log entry"""
        return {
            '_id': str(uuid.uuid4()),
            'staffId': staff_id,
            'action': action,
            'resource': resource,
            'resourceId': resource_id,
            'details': details or {},
            'ipAddress': ip_address,
            'timestamp': datetime.utcnow()
        }


# Utility functions
def has_permission(role: str, permission: str) -> bool:
    """Check if role has specific permission"""
    permissions = DEFAULT_PERMISSIONS.get(role, {})
    return permissions.get(permission, False)


def can_manage_role(manager_role: str, target_role: str) -> bool:
    """Check if manager can manage target role"""
    manager_level = ROLE_LEVELS.get(manager_role, 99)
    target_level = ROLE_LEVELS.get(target_role, 99)
    
    # Super admin can manage everyone
    if manager_role == 'super_admin':
        return True
    
    # Admin can manage everyone except super admin
    if manager_role == 'admin' and target_role != 'super_admin':
        return True
    
    # Others can only manage lower levels
    return manager_level < target_level


def serialize_staff(staff: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize staff for JSON response (remove sensitive data)"""
    staff_copy = staff.copy()
    staff_copy.pop('passwordHash', None)
    staff_copy.pop('password_hash', None)
    staff_copy.pop('password', None)
    staff_copy.pop('magicLinkToken', None)
    staff_copy.pop('magicLinkExpires', None)

    # Convert any datetime values to ISO string
    for k, v in list(staff_copy.items()):
        if isinstance(v, datetime):
            staff_copy[k] = v.isoformat()

    return staff_copy
