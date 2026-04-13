import { useAdminAuth } from '../contexts/AdminAuthContext';

/**
 * Custom hook for checking RBAC permissions
 * Returns permission checking functions based on the logged-in admin's role
 */
export const usePermissions = () => {
  const { admin } = useAdminAuth();

  // Get RBAC permissions from admin context
  const rbacPermissions = admin?.rbacPermissions || {};
  const role = admin?.role || 'advisor';
  const menuItems = admin?.menuItems || [];

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission key to check
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    return rbacPermissions[permission] === true;
  };

  /**
   * Check if user can view all data or only filtered data
   * @param {string} type - Data type (staff, users, metrics)
   * @returns {boolean}
   */
  const canViewAll = (type) => {
    if (type === 'staff') return hasPermission('view_all_staff');
    if (type === 'users') return hasPermission('view_all_users');
    if (type === 'metrics') return hasPermission('view_all_metrics');
    return false;
  };

  /**
   * Check if user can manage content (create/edit/delete)
   * @param {string} resource - Resource type (webinars, legal_library, etc.)
   * @returns {boolean}
   */
  const canManage = (resource) => {
    const permissionMap = {
      'webinars': 'manage_webinars',
      'legal_library': 'manage_legal_library',
      'comparator': 'manage_comparator',
      'timelines': 'manage_timelines',
      'staff': 'create_staff',
      'users': 'edit_all_users'
    };
    
    return hasPermission(permissionMap[resource]);
  };

  /**
   * Check if user can only view content (no edit)
   * @param {string} resource - Resource type
   * @returns {boolean}
   */
  const canView = (resource) => {
    const viewPermissionMap = {
      'webinars': 'view_webinars',
      'legal_library': 'view_legal_library',
      'comparator': 'view_comparator',
      'timelines': 'view_timelines'
    };
    
    return hasPermission(viewPermissionMap[resource]);
  };

  /**
   * Check if user has admin-level access
   * @returns {boolean}
   */
  const isAdmin = () => {
    return ['presidente', 'ceo', 'super_admin', 'admin'].includes(role);
  };

  /**
   * Check if user has top-level executive access
   * @returns {boolean}
   */
  const isExecutive = () => {
    return ['presidente', 'ceo', 'super_admin'].includes(role);
  };

  /**
   * Check if user is a manager or higher
   * @returns {boolean}
   */
  const isManager = () => {
    return ['presidente', 'ceo', 'super_admin', 'admin', 'manager'].includes(role);
  };

  /**
   * Get filtered menu items based on permissions
   * @returns {Array}
   */
  const getMenuItems = () => {
    return menuItems;
  };

  return {
    // Permission checks
    hasPermission,
    canViewAll,
    canManage,
    canView,
    
    // Role checks
    isAdmin,
    isExecutive,
    isManager,
    role,
    
    // Menu
    getMenuItems,
    
    // Raw permissions object
    permissions: rbacPermissions
  };
};

export default usePermissions;
