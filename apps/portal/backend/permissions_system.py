"""
Sistema de Permisos RBAC (Role-Based Access Control) para URPE
Basado en mejores prácticas de seguridad y gestión empresarial
"""

# ========== JERARQUÍA DE ROLES ==========
ROLE_HIERARCHY = {
    'presidente': 0,      # Acceso total estratégico
    'ceo': 1,            # Acceso total operativo
    'super_admin': 2,    # Administración completa
    'admin': 3,          # Administración general
    'manager': 4,        # Gestión departamental
    'coordinator': 5,    # Coordinación de equipo
    'advisor': 6,        # Operación con clientes
    'acreditador': 7     # Solo casos de visa etapa 3
}

# ========== PERMISOS DETALLADOS POR ROL ==========
ROLE_PERMISSIONS = {
    'presidente': {
        # Dashboard y Métricas
        'view_all_metrics': True,
        'view_financial_data': True,
        'export_all_data': True,

        # Gestión de Personal
        'view_all_staff': True,
        'create_staff': True,
        'edit_all_staff': True,
        'delete_staff': True,
        'change_roles': True,
        'view_all_departments': True,

        # Usuarios/Clientes
        'view_all_users': True,
        'edit_all_users': True,
        'delete_users': True,
        'assign_users': True,

        # Contenido
        'manage_webinars': True,
        'manage_legal_library': True,
        'manage_comparator': True,
        'manage_timelines': True,
        'manage_eligibility': True,

        # Aprendizaje
        'manage_learning': True,
        'view_learning_sessions': True,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': True,
        'system_settings': True,
        'backup_restore': True
    },
    
    'ceo': {
        # Dashboard y Métricas
        'view_all_metrics': True,
        'view_financial_data': True,
        'export_all_data': True,
        
        # Gestión de Personal (no puede eliminar presidente)
        'view_all_staff': True,
        'create_staff': True,
        'edit_all_staff': True,
        'delete_staff': True,  # Limitado por jerarquía
        'change_roles': True,  # Limitado por jerarquía
        'view_all_departments': True,
        
        # Usuarios/Clientes
        'view_all_users': True,
        'edit_all_users': True,
        'delete_users': True,
        'assign_users': True,
        
        # Contenido
        'manage_webinars': True,
        'manage_legal_library': True,
        'manage_comparator': True,
        'manage_timelines': True,
        'manage_eligibility': True,

        # Aprendizaje
        'manage_learning': True,
        'view_learning_sessions': True,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': True,
        'system_settings': True,
        'backup_restore': False
    },

    'super_admin': {
        # Dashboard y Métricas
        'view_all_metrics': True,
        'view_financial_data': True,
        'export_all_data': True,
        
        # Gestión de Personal
        'view_all_staff': True,
        'create_staff': True,
        'edit_all_staff': True,
        'delete_staff': True,  # Solo roles inferiores
        'change_roles': True,  # Solo roles inferiores
        'view_all_departments': True,
        
        # Usuarios/Clientes
        'view_all_users': True,
        'edit_all_users': True,
        'delete_users': True,
        'assign_users': True,
        
        # Contenido
        'manage_webinars': True,
        'manage_legal_library': True,
        'manage_comparator': True,
        'manage_timelines': True,
        'manage_eligibility': True,

        # Aprendizaje
        'manage_learning': True,
        'view_learning_sessions': True,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': True,
        'system_settings': True,
        'backup_restore': False
    },

    'admin': {
        # Dashboard y Métricas
        'view_all_metrics': True,
        'view_financial_data': False,
        'export_all_data': True,
        
        # Gestión de Personal
        'view_all_staff': True,
        'create_staff': True,
        'edit_all_staff': True,  # Solo roles iguales o inferiores
        'delete_staff': False,
        'change_roles': False,
        'view_all_departments': True,
        
        # Usuarios/Clientes
        'view_all_users': True,
        'edit_all_users': True,
        'delete_users': False,
        'assign_users': True,
        
        # Contenido
        'manage_webinars': True,
        'manage_legal_library': True,
        'manage_comparator': True,
        'manage_timelines': True,
        'manage_eligibility': True,

        # Aprendizaje
        'manage_learning': True,
        'view_learning_sessions': True,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': True,
        'system_settings': False,
        'backup_restore': False
    },

    'manager': {
        # Dashboard y Métricas
        'view_all_metrics': False,  # Solo su departamento
        'view_department_metrics': True,
        'view_financial_data': False,
        'export_all_data': False,
        'export_department_data': True,
        
        # Gestión de Personal
        'view_all_staff': False,
        'view_department_staff': True,
        'create_staff': True,  # Solo para su departamento
        'edit_all_staff': False,
        'edit_department_staff': True,
        'delete_staff': False,
        'change_roles': False,
        'view_all_departments': False,
        
        # Usuarios/Clientes
        'view_all_users': False,
        'view_assigned_users': True,
        'view_department_users': True,
        'edit_all_users': False,
        'edit_assigned_users': True,
        'delete_users': False,
        'assign_users': True,  # A su equipo
        
        # Contenido
        'manage_webinars': True,
        'manage_legal_library': True,
        'manage_comparator': False,
        'view_comparator': True,
        'manage_timelines': False,
        'view_timelines': True,
        'manage_eligibility': False,

        # Aprendizaje
        'manage_learning': True,
        'view_learning_sessions': False,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': True,  # Solo su departamento
        'system_settings': False,
        'backup_restore': False
    },
    
    'coordinator': {
        # Dashboard y Métricas
        'view_all_metrics': False,
        'view_department_metrics': True,
        'view_team_metrics': True,
        'view_financial_data': False,
        'export_all_data': False,
        'export_team_data': True,
        
        # Gestión de Personal
        'view_all_staff': False,
        'view_department_staff': True,
        'view_team_staff': True,
        'create_staff': False,
        'edit_all_staff': False,
        'edit_team_staff': False,  # Solo lectura
        'delete_staff': False,
        'change_roles': False,
        'view_all_departments': False,
        
        # Usuarios/Clientes
        'view_all_users': False,
        'view_assigned_users': True,
        'view_team_users': True,
        'edit_all_users': False,
        'edit_assigned_users': True,
        'delete_users': False,
        'assign_users': False,
        
        # Contenido
        'manage_webinars': False,
        'view_webinars': True,
        'manage_legal_library': False,
        'view_legal_library': True,
        'manage_comparator': False,
        'view_comparator': True,
        'manage_timelines': False,
        'view_timelines': True,
        'manage_eligibility': False,

        # Aprendizaje
        'manage_learning': False,
        'view_learning_sessions': False,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': True,  # Solo su equipo
        'system_settings': False,
        'backup_restore': False
    },

    'advisor': {
        # Dashboard y Métricas
        'view_all_metrics': False,
        'view_department_metrics': False,
        'view_personal_metrics': True,
        'view_financial_data': False,
        'export_all_data': False,
        'export_personal_data': True,
        
        # Gestión de Personal
        'view_all_staff': False,
        'view_department_staff': False,
        'view_team_staff': True,  # Ver sus compañeros
        'create_staff': False,
        'edit_all_staff': False,
        'delete_staff': False,
        'change_roles': False,
        'view_all_departments': False,
        
        # Usuarios/Clientes
        'view_all_users': False,
        'view_assigned_users': True,  # Solo sus clientes
        'edit_all_users': False,
        'edit_assigned_users': True,  # Solo actualizar info
        'delete_users': False,
        'assign_users': False,
        
        # Contenido
        'manage_webinars': False,
        'view_webinars': True,
        'manage_legal_library': False,
        'view_legal_library': True,
        'manage_comparator': False,
        'view_comparator': True,
        'manage_timelines': False,
        'view_timelines': True,  # Solo de sus clientes
        'manage_eligibility': False,

        # Aprendizaje
        'manage_learning': False,
        'view_learning_sessions': False,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': False,
        'system_settings': False,
        'backup_restore': False
    },
    
    'acreditador': {
        # Dashboard y Métricas
        'view_all_metrics': False,
        'view_department_metrics': False,
        'view_personal_metrics': False,
        'view_financial_data': False,
        'export_all_data': False,
        'export_personal_data': False,
        
        # Gestión de Personal
        'view_all_staff': False,
        'view_department_staff': False,
        'view_team_staff': False,
        'create_staff': False,
        'edit_all_staff': False,
        'delete_staff': False,
        'change_roles': False,
        'view_all_departments': False,
        
        # Usuarios/Clientes
        'view_all_users': False,
        'view_assigned_users': False,
        'view_visa_cases': True,
        'edit_all_users': False,
        'edit_assigned_users': False,
        'delete_users': False,
        'assign_users': False,
        
        # Contenido
        'manage_webinars': False,
        'view_webinars': False,
        'manage_legal_library': False,
        'view_legal_library': False,
        'manage_comparator': False,
        'view_comparator': False,
        'manage_timelines': False,
        'view_timelines': False,
        'manage_eligibility': False,

        # Aprendizaje
        'manage_learning': False,
        'view_learning_sessions': False,
        'consume_learning': True,

        # Sistema
        'view_audit_logs': False,
        'system_settings': False,
        'backup_restore': False
    }
}

# ========== FUNCIONES DE UTILIDAD ==========

def has_permission(user_role: str, permission: str) -> bool:
    """
    Verifica si un rol tiene un permiso específico
    """
    permissions = ROLE_PERMISSIONS.get(user_role, {})
    return permissions.get(permission, False)

def can_manage_role(manager_role: str, target_role: str) -> bool:
    """
    Verifica si un rol puede gestionar otro rol (basado en jerarquía)
    Un rol solo puede gestionar roles de nivel inferior
    Super admin puede gestionar a todos, incluyendo otros super admins
    """
    # Super admin puede gestionar a todos, incluyendo otros super admins
    if manager_role == 'super_admin':
        return True
    
    manager_level = ROLE_HIERARCHY.get(manager_role, 999)
    target_level = ROLE_HIERARCHY.get(target_role, 999)
    
    # Admin puede gestionar todos excepto super_admin
    if manager_role == 'admin' and target_role != 'super_admin':
        return True
    
    # Otros roles solo pueden gestionar roles de nivel inferior
    return manager_level < target_level

def get_accessible_departments(user_role: str, user_department: str) -> list:
    """
    Retorna lista de departamentos accesibles según rol
    """
    if has_permission(user_role, 'view_all_departments'):
        return ['all']
    elif has_permission(user_role, 'view_department_staff'):
        return [user_department]
    else:
        return []

def get_menu_items_for_role(user_role: str) -> list:
    """
    Retorna items del menú según permisos del rol
    """
    menu = []
    
    # Acreditador: solo ve Casos de Visa
    if user_role == 'acreditador':
        menu.append({
            'id': 'visa-cases',
            'label': 'Casos de Visa',
            'path': '/admin/visa-cases',
            'show': True
        })
        return menu
    
    # Dashboard (todos lo ven)
    menu.append({
        'id': 'dashboard',
        'label': 'Panel de Control',
        'path': '/admin/dashboard',
        'show': True
    })
    
    # Casos de Visa (Pay As You Advance)
    if has_permission(user_role, 'view_all_users') or has_permission(user_role, 'view_assigned_users'):
        menu.append({
            'id': 'visa-cases',
            'label': 'Casos de Visa',
            'path': '/admin/visa-cases',
            'show': True
        })
    
    # Usuarios
    if has_permission(user_role, 'view_all_users') or has_permission(user_role, 'view_assigned_users'):
        menu.append({
            'id': 'users',
            'label': 'Usuarios' if has_permission(user_role, 'view_all_users') else 'Mis Clientes',
            'path': '/admin/users',
            'show': True
        })
    
    # Gestión de Personal
    if has_permission(user_role, 'view_all_staff') or has_permission(user_role, 'view_department_staff'):
        menu.append({
            'id': 'staff-management',
            'label': 'Gestión de Personal',
            'path': '/admin/staff-management',
            'show': True
        })
    
    # Webinars
    if has_permission(user_role, 'manage_webinars') or has_permission(user_role, 'view_webinars'):
        menu.append({
            'id': 'webinars',
            'label': 'Webinars',
            'path': '/admin/webinars',
            'show': True
        })
    
    # Biblioteca Legal
    if has_permission(user_role, 'manage_legal_library') or has_permission(user_role, 'view_legal_library'):
        menu.append({
            'id': 'legal-library',
            'label': 'Biblioteca Legal',
            'path': '/admin/legal-library',
            'show': True
        })
    
    # Comparador
    if has_permission(user_role, 'manage_comparator') or has_permission(user_role, 'view_comparator'):
        menu.append({
            'id': 'comparator',
            'label': 'Comparador',
            'path': '/admin/comparator',
            'show': True
        })
    
    # Cronogramas (solo super_admin)
    if user_role == 'super_admin':
        menu.append({
            'id': 'timeline-management',
            'label': 'Gestión de Cronogramas',
            'path': '/admin/timeline-management',
            'show': True
        })
    
    # Audit Logs (solo roles superiores)
    if has_permission(user_role, 'view_audit_logs'):
        menu.append({
            'id': 'audit-logs',
            'label': 'Logs de Auditoría',
            'path': '/admin/audit-logs',
            'show': True
        })
    
    # Plantillas de Elegibilidad (solo super_admin)
    if user_role == 'super_admin':
        menu.append({
            'id': 'eligibility',
            'label': 'Plantillas de Elegibilidad',
            'path': '/admin/eligibility-templates',
            'show': True
        })

    # Aprendizaje (todos los staff lo consumen)
    if has_permission(user_role, 'consume_learning'):
        menu.append({
            'id': 'learning',
            'label': 'Aprendizaje',
            'path': '/admin/learning',
            'show': True
        })

    # Gestión de Aprendizaje (solo roles que administran contenido)
    if has_permission(user_role, 'manage_learning'):
        menu.append({
            'id': 'learning-admin',
            'label': 'Gestión de Aprendizaje',
            'path': '/admin/learning-admin',
            'show': True
        })

    return menu

def filter_data_by_permissions(user_role: str, user_department: str, user_id: str, data: list, data_type: str) -> list:
    """
    Filtra datos según permisos del usuario
    data_type: 'staff', 'users', 'metrics', etc.
    """
    if data_type == 'staff':
        if has_permission(user_role, 'view_all_staff'):
            return data
        elif has_permission(user_role, 'view_department_staff'):
            return [item for item in data if item.get('department') == user_department]
        elif has_permission(user_role, 'view_team_staff'):
            # Implementar lógica de equipo
            return [item for item in data if item.get('department') == user_department]
        else:
            return []
    
    elif data_type == 'users':
        if has_permission(user_role, 'view_all_users'):
            return data
        elif has_permission(user_role, 'view_assigned_users'):
            return [item for item in data if user_id in item.get('assigned_staff', [])]
        else:
            return []
    
    return data
