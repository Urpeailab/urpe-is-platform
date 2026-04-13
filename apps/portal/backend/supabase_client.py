"""
Supabase client configuration and utilities for URPE application.
"""
import os
from supabase import create_client, Client
from typing import Optional, Dict, Any
import logging
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Supabase client (wp_contactos)
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("Supabase credentials not found in environment variables")
    supabase: Optional[Client] = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        supabase = None

# Initialize second Supabase client (cliente_profile)
SUPABASE_USERS_URL = os.environ.get("SUPABASE_USERS_URL", "")
SUPABASE_USERS_SERVICE_KEY = os.environ.get("SUPABASE_USERS_SERVICE_KEY", "")

try:
    supabase_users: Client = create_client(SUPABASE_USERS_URL, SUPABASE_USERS_SERVICE_KEY)
    logger.info("Supabase users client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase users client: {e}")
    supabase_users = None


def clean_phone_number(phone: str) -> str:
    """
    Clean and normalize phone number by removing all non-digit characters.
    
    Args:
        phone: Raw phone number string
        
    Returns:
        Cleaned phone number with only digits
    """
    # Remove all non-digit characters
    cleaned = re.sub(r'\D', '', phone)
    return cleaned


async def find_contact_by_phone(phone: str, empresa_id: int = 4) -> Optional[Dict[str, Any]]:
    """
    Find a contact in wp_contactos table by phone number and empresa_id.
    
    Args:
        phone: Phone number to search for
        empresa_id: Company ID to filter by (default: 4)
        
    Returns:
        Contact data if found and active, None otherwise
    """
    # Use supabase client (from .env) which has wp_contactos table
    if not supabase:
        logger.error("Supabase client not initialized")
        return None
    
    try:
        # Clean the phone number
        cleaned_phone = clean_phone_number(phone)
        
        logger.info(f"Searching for contact with phone: {cleaned_phone}, empresa_id: {empresa_id}")
        
        # Query wp_contactos table
        # Try multiple phone format variations
        phone_variations = [
            cleaned_phone,  # Just digits
            f"+{cleaned_phone}",  # With + prefix
            f"+1{cleaned_phone}" if not cleaned_phone.startswith('1') else f"+{cleaned_phone}",  # US format
        ]
        
        contact = None
        for phone_var in phone_variations:
            # Query without JOIN (wp_team_humano table may not exist in this database)
            response = supabase.table('wp_contactos')\
                .select('*')\
                .eq('telefono', phone_var)\
                .eq('empresa_id', empresa_id)\
                .eq('is_active', True)\
                .execute()
            
            if response.data and len(response.data) > 0:
                contact = response.data[0]
                logger.info(f"Contact found with phone variation: {phone_var}")
                break
        
        if not contact:
            logger.info(f"No active contact found with phone: {cleaned_phone} and empresa_id: {empresa_id}")
            return None
        
        logger.info(f"Contact found: {contact.get('nombre')} {contact.get('apellido')} (ID: {contact.get('id')})")
        return contact
        
    except Exception as e:
        logger.error(f"Error finding contact by phone: {e}")
        return None


async def verify_user_access(phone: str) -> Optional[Dict[str, Any]]:
    """
    Verify if a user has access to the dashboard based on their phone number
    and empresa_id = 4.
    
    Args:
        phone: Phone number to verify
        
    Returns:
        User data if authorized, None otherwise
    """
    contact = await find_contact_by_phone(phone, empresa_id=4)
    
    if not contact:
        return None
    
    # Transform Supabase contact data to user format expected by frontend
    # Handle None values for nombre and apellido
    nombre = contact.get('nombre') or ''
    apellido = contact.get('apellido') or ''
    
    # Build full name, handling None/empty values
    if nombre and apellido:
        full_name = f"{nombre} {apellido}".strip()
    elif nombre:
        full_name = nombre.strip()
    elif apellido:
        full_name = apellido.strip()
    else:
        full_name = "Cliente"
    
    # Use default advisor since wp_team_humano table is not available in this database
    advisor = {
        'name': 'Gigliola Bocanegra',
        'photo': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gigliola&backgroundColor=ffc700',
        'title': 'Asesora de Inmigración',
        'rol': 'asesor',
    }
    logger.info("Using default advisor: Gigliola Bocanegra")
    
    user_data = {
        'id': str(contact.get('id')),
        'name': full_name,
        'email': contact.get('email', ''),
        'phone': contact.get('telefono', ''),
        'userState': map_estado_to_user_state(contact.get('estado', 'prospecto')),
        'language': 'es',  # Default to Spanish
        'supabaseId': contact.get('id'),
        'empresaId': contact.get('empresa_id'),
        'origen': contact.get('origen'),
        'etapaEmocional': contact.get('etapa_emocional'),
        'esCalificado': contact.get('es_calificado'),
        'estado': contact.get('estado'),
        'advisor': advisor,
        'teamHumanoId': contact.get('team_humano_id'),
    }
    
    return user_data


def map_estado_to_user_state(estado: str) -> str:
    """
    Map Supabase estado to internal userState.
    
    Args:
        estado: Estado from Supabase (prospecto, cliente, etc.)
        
    Returns:
        userState code (U0, U1, U2, U3, U4)
    """
    estado_map = {
        'prospecto': 'U1',  # Prospect
        'cliente': 'U2',    # Active client
        'lead': 'U0',       # Lead
        'calificado': 'U2', # Qualified client
    }
    return estado_map.get(estado.lower(), 'U1')
