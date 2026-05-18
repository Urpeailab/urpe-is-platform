"""
Routers package for Monica NIW
"""
from .auth_router import router as auth_router
from .auth_router import (
    User, 
    UserRegister, 
    UserLogin, 
    UserCreate, 
    UserUpdate,
    get_current_user, 
    require_admin,
    get_admin_user,
    set_database as set_auth_database,
    ADMIN_WHITELIST,
    security
)

from .clients_router import router as clients_router
from .clients_router import (
    Client,
    ClientInput,
    ClientTransferRequest,
    init_router as init_clients_router,
    get_client_documents_count
)
