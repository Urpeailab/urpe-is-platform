"""
Email Service for sending notifications
"""
import os
import random
import string
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def generate_random_password(length: int = 12) -> str:
    """
    Generate a random temporary password
    """
    # Incluir mayúsculas, minúsculas, números y símbolos
    characters = string.ascii_letters + string.digits + "!@#$%&*"
    
    # Asegurar que tenga al menos uno de cada tipo
    password = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(string.digits),
        random.choice("!@#$%&*")
    ]
    
    # Completar el resto
    password += random.choices(characters, k=length - 4)
    
    # Mezclar
    random.shuffle(password)
    
    return ''.join(password)


async def send_welcome_email(
    recipient_email: str,
    recipient_name: str,
    temporary_password: str,
    role: str = "staff"
) -> dict:
    """
    Send welcome email with temporary password
    Currently MOCKED - will simulate sending
    
    Returns:
        dict: Status of email sending
    """
    
    email_content = f"""
    ╔══════════════════════════════════════════════════════════╗
    ║          Bienvenido a URPE Integral Services            ║
    ╚══════════════════════════════════════════════════════════╝
    
    Hola {recipient_name},
    
    Tu cuenta ha sido creada exitosamente en el sistema de URPE.
    
    📧 Email: {recipient_email}
    🔑 Contraseña temporal: {temporary_password}
    👤 Rol: {role}
    
    🔗 Accede al sistema en:
    {os.environ.get('FRONTEND_URL', 'https://panel.urpeintegralservices.co')}/admin/login
    
    ⚠️ IMPORTANTE:
    - Esta es una contraseña temporal
    - Debes cambiarla al iniciar sesión por primera vez
    - Ve a tu perfil → Cambiar Contraseña
    
    Si tienes algún problema, contacta al administrador.
    
    Saludos,
    Equipo URPE
    """
    
    # MOCK: Simular envío de email
    logger.info(f"📧 [MOCK EMAIL] Enviando email a: {recipient_email}")
    logger.info(f"📧 [MOCK EMAIL] Contenido:\n{email_content}")
    
    # En producción, aquí iría la lógica real de envío
    # Por ahora, solo retornamos éxito simulado
    
    return {
        "success": True,
        "mocked": True,
        "message": f"Email simulado enviado a {recipient_email}",
        "recipient": recipient_email,
        "password_shown": temporary_password  # Para mostrar en pantalla
    }


async def send_password_reset_email(
    recipient_email: str,
    recipient_name: str,
    reset_link: str
) -> dict:
    """
    Send password reset email
    Currently MOCKED
    """
    
    email_content = f"""
    Hola {recipient_name},
    
    Recibimos una solicitud para restablecer tu contraseña.
    
    Haz clic en el siguiente enlace para crear una nueva contraseña:
    {reset_link}
    
    Si no solicitaste este cambio, ignora este mensaje.
    
    Saludos,
    Equipo URPE
    """
    
    logger.info(f"📧 [MOCK EMAIL] Reset password email to: {recipient_email}")
    
    return {
        "success": True,
        "mocked": True,
        "message": f"Reset email simulado enviado a {recipient_email}"
    }


# Función auxiliar para configurar email real en el futuro
def configure_email_service(
    smtp_host: Optional[str] = None,
    smtp_port: Optional[int] = None,
    smtp_user: Optional[str] = None,
    smtp_password: Optional[str] = None
):
    """
    Configure real email service (for future implementation)
    """
    # TODO: Implementar cuando se tengan las credenciales
    pass
