import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AdminAuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load admin info on mount
  useEffect(() => {
    const loadAdmin = async () => {
      if (token) {
        try {
          const { data } = await axios.get(`${API}/admin/auth/me`);
          // Store admin data with RBAC permissions and menu items
          setAdmin(data);
        } catch (error) {
          console.error('Failed to load admin:', error);
          // Token inválido, limpiar
          localStorage.removeItem('admin_token');
          setToken(null);
          setAdmin(null);
        }
      }
      setLoading(false);
    };

    loadAdmin();
  }, [token]);

  const signIn = async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/admin/auth/login`, {
        email,
        password
      });

      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      setAdmin(data.staff);

      return { success: true, message: data.message };
    } catch (error) {
      console.error('Admin sign in error:', error);
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Login failed. Please try again.' 
      };
    }
  };

  const requestMagicLink = async (email) => {
    try {
      const { data } = await axios.post(`${API}/admin/auth/magic-link`, {
        email
      });

      return { 
        success: true, 
        message: data.message,
        dev_link: data.dev_link // Solo en desarrollo
      };
    } catch (error) {
      console.error('Magic link error:', error);
      return { 
        success: false, 
        message: 'Failed to send magic link. Please try again.' 
      };
    }
  };

  const verifyMagicLink = async (token) => {
    try {
      const { data } = await axios.get(`${API}/admin/auth/verify-magic-link/${token}`);

      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      setAdmin(data.staff);

      return { success: true, message: data.message };
    } catch (error) {
      console.error('Magic link verification error:', error);
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Invalid or expired magic link.' 
      };
    }
  };

  const signOut = async () => {
    try {
      if (token) {
        await axios.post(`${API}/admin/auth/logout`);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('admin_token');
      setToken(null);
      setAdmin(null);
    }
  };

  const updateAdmin = (adminData) => {
    setAdmin(prev => ({ ...prev, ...adminData }));
  };

  const hasPermission = (permission) => {
    if (!admin) return false;
    
    // Check legacy permissions first
    if (admin.permissions && admin.permissions[permission] === true) {
      return true;
    }
    
    // Check RBAC permissions
    if (admin.rbacPermissions && admin.rbacPermissions[permission] === true) {
      return true;
    }
    
    return false;
  };
  
  const hasRBACPermission = (permission) => {
    if (!admin || !admin.rbacPermissions) return false;
    return admin.rbacPermissions[permission] === true;
  };

  const value = {
    admin,
    loading,
    signIn,
    signOut,
    requestMagicLink,
    verifyMagicLink,
    updateAdmin,
    hasPermission,
    hasRBACPermission,
    token
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
