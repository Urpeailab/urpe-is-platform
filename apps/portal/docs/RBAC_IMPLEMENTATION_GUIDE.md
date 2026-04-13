# RBAC (Role-Based Access Control) Implementation Guide

## Overview

A professional, enterprise-grade Role-Based Access Control (RBAC) system has been implemented for the URPE admin panel. This system provides granular permission management across 7 hierarchical roles with 40+ distinct permissions.

## Role Hierarchy

The system implements 7 roles in a hierarchical structure (0 = highest, 6 = lowest):

1. **Presidente** (Level 0) - Complete strategic access
2. **CEO** (Level 1) - Complete operational access
3. **Super Admin** (Level 2) - Full administrative access
4. **Admin** (Level 3) - General administrative access
5. **Manager** (Level 4) - Department-level management
6. **Coordinator** (Level 5) - Team coordination
7. **Advisor** (Level 6) - Client-focused operations

### Role Capabilities

#### Presidente & CEO
- Full access to all features and data
- View financial data and all metrics
- Manage all staff members and assign roles
- System settings and backup/restore access
- Full audit log visibility

#### Super Admin
- Full administrative access (except backup/restore)
- Manage staff below their level
- View all metrics and financial data
- System settings access
- Full content management

#### Admin
- General administrative tasks
- Cannot delete staff or change roles
- No financial data access
- Manage users and content
- View audit logs

#### Manager
- Department-level access only
- View and manage their department's staff
- View department metrics and users
- Manage webinars and legal library
- View-only access to comparator and timelines

#### Coordinator
- Team-level access
- View department and team staff (read-only)
- View and edit assigned users
- View-only access to all content
- View team-specific audit logs

#### Advisor
- Personal metrics only
- View only assigned clients
- Edit assigned client information
- View-only access to webinars, legal library, comparator
- No staff management access

## Permission Categories

### 1. Dashboard & Metrics
- `view_all_metrics` - View all business metrics
- `view_department_metrics` - View department-specific metrics
- `view_team_metrics` - View team-specific metrics
- `view_personal_metrics` - View personal metrics only
- `view_financial_data` - Access financial information
- `export_all_data` - Export all system data
- `export_department_data` - Export department data
- `export_team_data` - Export team data
- `export_personal_data` - Export personal data

### 2. Staff Management
- `view_all_staff` - View all staff members
- `view_department_staff` - View department staff
- `view_team_staff` - View team members
- `create_staff` - Create new staff members
- `edit_all_staff` - Edit all staff members
- `edit_department_staff` - Edit department staff
- `edit_team_staff` - Edit team members
- `delete_staff` - Delete staff members
- `change_roles` - Modify staff roles
- `view_all_departments` - View all departments

### 3. User/Client Management
- `view_all_users` - View all users/clients
- `view_assigned_users` - View assigned users
- `view_department_users` - View department users
- `view_team_users` - View team users
- `edit_all_users` - Edit all users
- `edit_assigned_users` - Edit assigned users
- `delete_users` - Delete users
- `assign_users` - Assign users to staff

### 4. Content Management
- `manage_webinars` - Full webinar management
- `view_webinars` - View webinars only
- `manage_legal_library` - Manage legal documents
- `view_legal_library` - View legal documents only
- `manage_comparator` - Manage comparator cases
- `view_comparator` - View comparator cases only
- `manage_timelines` - Manage timeline templates
- `view_timelines` - View timeline templates only
- `manage_eligibility` - Manage eligibility templates

### 5. System Administration
- `view_audit_logs` - View audit logs
- `system_settings` - Modify system settings
- `backup_restore` - Perform backup/restore operations

## Backend Implementation

### Files Created/Modified

1. **`/app/backend/permissions_system.py`** - Core RBAC logic
   - `ROLE_HIERARCHY` - Role levels dictionary
   - `ROLE_PERMISSIONS` - Complete permission mapping for each role
   - `has_permission(role, permission)` - Check if role has permission
   - `can_manage_role(manager_role, target_role)` - Hierarchy validation
   - `get_menu_items_for_role(role)` - Dynamic menu generation
   - `filter_data_by_permissions(role, department, data, type)` - Data filtering

2. **`/app/backend/server.py`** - API Integration
   - Updated `POST /api/admin/auth/login` to include RBAC data
   - Updated `GET /api/admin/auth/me` to return permissions
   - Added `GET /api/admin/permissions/{role}` for role queries

### API Endpoints

#### Login with RBAC Data
```bash
POST /api/admin/auth/login
{
  "email": "admin@urpe.com",
  "password": "password"
}

Response:
{
  "token": "jwt_token_here",
  "staff": {
    "id": "...",
    "name": "Admin User",
    "email": "admin@urpe.com",
    "role": "admin",
    "rbacPermissions": {
      "view_all_metrics": true,
      "create_staff": true,
      ...
    },
    "menuItems": [
      {
        "id": "dashboard",
        "label": "Panel de Control",
        "path": "/admin/dashboard",
        "show": true
      },
      ...
    ]
  }
}
```

#### Get Current Admin Info
```bash
GET /api/admin/auth/me
Authorization: Bearer <token>

Response: Same as login response staff object
```

#### Query Role Permissions (Admin only)
```bash
GET /api/admin/permissions/manager
Authorization: Bearer <token>

Response:
{
  "role": "manager",
  "permissions": { ... },
  "hierarchy_level": 4,
  "menu_items": [ ... ]
}
```

## Frontend Implementation

### Files Created

1. **`/app/frontend/src/hooks/usePermissions.js`** - Permission Hook
   ```javascript
   const { 
     hasPermission,
     canViewAll,
     canManage,
     canView,
     isAdmin,
     isExecutive,
     isManager,
     role,
     getMenuItems,
     permissions 
   } = usePermissions();
   ```

2. **`/app/frontend/src/components/PermissionGuard.js`** - Guard Component
   ```javascript
   // Permission-based rendering
   <PermissionGuard permission="create_staff">
     <CreateButton />
   </PermissionGuard>

   // Role-based rendering
   <PermissionGuard role={['admin', 'super_admin']}>
     <AdminPanel />
   </PermissionGuard>

   // Multiple permissions (AND logic)
   <PermissionGuard 
     permission={['edit_staff', 'create_staff']} 
     requireAll={true}
   >
     <StaffManager />
   </PermissionGuard>
   ```

### Files Modified

1. **`/app/frontend/src/admin/layouts/AdminLayout.js`**
   - Now uses `getMenuItems()` from usePermissions hook
   - Menu dynamically rendered based on backend RBAC configuration
   - Sidebar items automatically filtered by permissions

2. **`/app/frontend/src/contexts/AdminAuthContext.js`**
   - Stores `rbacPermissions` and `menuItems` from backend
   - Added `hasRBACPermission()` function
   - Enhanced `hasPermission()` to check both legacy and RBAC permissions

## Usage Examples

### In Components

```javascript
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionGuard } from '../../components/PermissionGuard';

function StaffManagementPage() {
  const { hasPermission, canManage, isAdmin } = usePermissions();

  return (
    <div>
      {/* Conditionally show create button */}
      <PermissionGuard permission="create_staff">
        <button onClick={handleCreate}>Create Staff</button>
      </PermissionGuard>

      {/* Check permission in logic */}
      {hasPermission('delete_staff') && (
        <DeleteButton />
      )}

      {/* Role-based rendering */}
      {isAdmin() && (
        <AdminOnlyPanel />
      )}

      {/* Check if can manage resource */}
      {canManage('webinars') ? (
        <WebinarEditor />
      ) : (
        <WebinarViewer />
      )}
    </div>
  );
}
```

### In API Calls (Backend)

```python
from permissions_system import has_permission, can_manage_role

@api_router.get("/admin/staff")
async def get_staff(staff_payload: dict = Depends(verify_staff_token)):
    user_role = staff_payload['role']
    
    # Check permission
    if not has_permission(user_role, 'view_all_staff'):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Filter data based on permissions
    if has_permission(user_role, 'view_all_staff'):
        staff_list = await db.staff.find().to_list(length=100)
    elif has_permission(user_role, 'view_department_staff'):
        staff_list = await db.staff.find({
            'department': staff_payload['department']
        }).to_list(length=100)
    
    return staff_list
```

## Testing Different Roles

To test the RBAC system, create admin accounts with different roles:

### Test Accounts Setup
```python
# Create test accounts with different roles
roles = ['presidente', 'ceo', 'super_admin', 'admin', 'manager', 'coordinator', 'advisor']

for role in roles:
    # Create staff member with specific role
    # Each will have different menu items and permissions
```

### Expected Behavior by Role

**Presidente/CEO**: See all menu items, can access everything
**Super Admin**: See all except backup/restore
**Admin**: No financial data, no staff deletion
**Manager**: Only see their department's data
**Coordinator**: Read-only for most features
**Advisor**: Only see assigned clients, basic features

## Security Considerations

1. **Hierarchical Validation**: Higher-level roles cannot be managed by lower-level roles
2. **Permission Inheritance**: Some permissions implicitly grant others (documented in code)
3. **Menu Filtering**: Users only see menu items they have access to
4. **API Protection**: All admin endpoints verify permissions via JWT token
5. **Client-Side + Server-Side**: Permissions checked on both frontend (UX) and backend (security)

## Future Enhancements

1. **Custom Permissions**: Allow super admins to create custom permission sets
2. **Department-Specific Roles**: Role assignments per department
3. **Time-Based Permissions**: Temporary permission grants
4. **Permission Audit Trail**: Log all permission-based actions
5. **Role Templates**: Pre-configured role templates for common use cases

## Troubleshooting

### User Cannot See Expected Menu Items
- Check `rbacPermissions` in admin context
- Verify role in database matches expected role
- Check backend logs for permission evaluation

### Permission Denied Errors
- Ensure JWT token is valid
- Check if user's role has required permission
- Verify API endpoint permission checks match frontend expectations

### Menu Items Not Updating After Role Change
- User needs to log out and log back in
- JWT token needs to be refreshed
- Clear localStorage if issues persist

## Maintenance

When adding new features:
1. Define required permissions in `permissions_system.py`
2. Add permissions to appropriate roles
3. Update `get_menu_items_for_role()` if adding menu items
4. Protect API endpoints with permission checks
5. Use `<PermissionGuard>` in frontend components
6. Document new permissions in this guide
