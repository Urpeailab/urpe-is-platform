import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Permission Guard Component
 * Conditionally renders children based on permissions
 * 
 * Usage:
 * <PermissionGuard permission="create_staff">
 *   <CreateButton />
 * </PermissionGuard>
 * 
 * <PermissionGuard role={['admin', 'super_admin']}>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export const PermissionGuard = ({ 
  children, 
  permission, 
  role, 
  fallback = null,
  requireAll = false  // For multiple permissions: AND vs OR
}) => {
  const { hasPermission, role: userRole } = usePermissions();

  // Check permission-based access
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    
    const hasAccess = requireAll
      ? permissions.every(p => hasPermission(p))
      : permissions.some(p => hasPermission(p));
    
    if (!hasAccess) {
      return fallback;
    }
  }

  // Check role-based access
  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];
    
    if (!allowedRoles.includes(userRole)) {
      return fallback;
    }
  }

  return <>{children}</>;
};

/**
 * Higher-order component to protect components with permissions
 * 
 * Usage:
 * export default withPermission(MyComponent, { permission: 'create_staff' });
 */
export const withPermission = (Component, options = {}) => {
  return (props) => (
    <PermissionGuard {...options}>
      <Component {...props} />
    </PermissionGuard>
  );
};

/**
 * Hook to conditionally render based on permissions
 * 
 * Usage:
 * const canCreate = usePermissionCheck('create_staff');
 * if (canCreate) { ... }
 */
export const usePermissionCheck = (permission) => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

export default PermissionGuard;
