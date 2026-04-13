/**
 * Utility functions for user data handling
 */

/**
 * Get display name for user, handling None/null/undefined/empty values
 * @param {Object} user - User object
 * @returns {string} - Clean display name
 */
export const getDisplayName = (user) => {
  if (!user) return 'Cliente';
  
  const name = user.name || '';
  
  // Handle "None None", "None", or empty strings
  if (!name || name.trim() === '' || name.toLowerCase().includes('none')) {
    return 'Cliente';
  }
  
  // Clean up any remaining "None" text
  const cleanName = name.replace(/\bNone\b/gi, '').trim();
  
  return cleanName || 'Cliente';
};

/**
 * Get user initials for avatar
 * @param {Object} user - User object
 * @returns {string} - User initials or default
 */
export const getUserInitials = (user) => {
  const displayName = getDisplayName(user);
  
  if (displayName === 'Cliente') {
    return 'C';
  }
  
  const parts = displayName.split(' ').filter(p => p.length > 0);
  
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
