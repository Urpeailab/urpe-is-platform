import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('urpe_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/signin`, { email, password });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('urpe_user', JSON.stringify(userData));
      return { success: true, data: userData };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Sign in failed' };
    }
  };

  const signUp = async (name, email, phone, password) => {
    try {
      const response = await axios.post(`${API}/auth/signup`, { name, email, phone, password });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('urpe_user', JSON.stringify(userData));
      return { success: true, data: userData };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Sign up failed' };
    }
  };

  const signInPhone = async (phone) => {
    try {
      const response = await axios.post(`${API}/auth/signin-phone`, { phone });
      const userData = response.data.user;
      setUser(userData);
      localStorage.setItem('urpe_user', JSON.stringify(userData));
      return { success: true, data: userData };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Phone login failed' };
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('urpe_user');
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('urpe_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInPhone, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
