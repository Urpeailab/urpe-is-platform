import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Safe localStorage (fails silently in iframe with Tracking Prevention)
const safeGetItem = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSetItem = (key, val) => { try { localStorage.setItem(key, val); } catch {} };
const safeRemoveItem = (key) => { try { localStorage.removeItem(key); } catch {} };

// Extract ?token= from URL (panel iframe token) — checks current URL + original URL
const getIframeToken = () => {
  try {
    // Check current URL
    let t = new URLSearchParams(window.location.search).get('token');
    if (t) return t;
    // Check if we were redirected and the original URL had the token (stored in sessionStorage or memory)
    t = window.__IFRAME_TOKEN__;
    if (t) return t;
    return null;
  } catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(safeGetItem('token'));
  const ssoInProgress = useRef(false);
  // Last panel-iframe token we successfully exchanged for a redactora session.
  // When the panel user changes, the new `?token=` differs from this value
  // and we re-SSO instead of silently reusing the previous user's session.
  const lastSSOTokenRef = useRef(safeGetItem('redac_last_sso_token') || '');

  const API = `${window.location.origin}/api`;

  // Save iframe token globally so it persists across client-side navigations
  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      window.__IFRAME_TOKEN__ = urlToken;
    }
  }, []);

  // Main auth effect
  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');

    // If the panel iframe handed us a token that differs from the one we last
    // SSO'd with, the panel user changed — drop the stale local session and
    // re-SSO with the fresh iframe token. Without this, a leftover
    // localStorage['token'] from a previous panel user would silently win and
    // the redactora UI would keep showing that previous user's data.
    if (urlToken && urlToken !== lastSSOTokenRef.current && !ssoInProgress.current) {
      window.__IFRAME_TOKEN__ = urlToken;
      ssoInProgress.current = true;
      safeRemoveItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      autoSSOFromIframe(urlToken);
      return;
    }

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Only fetch user if we don't already have one
      if (!user) {
        fetchCurrentUser();
      } else {
        setLoading(false);
      }
    } else {
      // No token — try auto-SSO from iframe URL first
      const iframeToken = getIframeToken();
      if (iframeToken && !ssoInProgress.current) {
        ssoInProgress.current = true;
        autoSSOFromIframe(iframeToken);
      } else if (!ssoInProgress.current) {
        // No iframe token either — create a guest session so the app loads
        ssoInProgress.current = true;
        autoGuestSession();
      }
    }
  }, [token]);

  const autoGuestSession = async () => {
    try {
      const response = await axios.post(`${API}/auth/guest`);
      const { access_token, user: userData } = response.data;
      safeSetItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      setToken(access_token);
    } catch (error) {
      console.error('Guest session failed:', error);
    } finally {
      ssoInProgress.current = false;
      setLoading(false);
    }
  };

  const autoSSOFromIframe = async (externalToken) => {
    try {
      const response = await axios.post(`${API}/auth/sso`, { external_token: externalToken });
      const { access_token, user: userData } = response.data;

      safeSetItem('token', access_token);
      // Remember which panel-iframe token gave us this session so a later
      // arrival of a DIFFERENT iframe token triggers a fresh SSO (instead of
      // reusing this session for a different panel user).
      lastSSOTokenRef.current = externalToken;
      safeSetItem('redac_last_sso_token', externalToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      setToken(access_token);
      setLoading(false);
    } catch (error) {
      console.error('Auto-SSO failed:', error);
      // Reset so SSOHandler can try
      ssoInProgress.current = false;
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      // Token invalid — try re-SSO from iframe token
      const iframeToken = getIframeToken();
      if (iframeToken && !ssoInProgress.current) {
        ssoInProgress.current = true;
        safeRemoveItem('token');
        delete axios.defaults.headers.common['Authorization'];
        await autoSSOFromIframe(iframeToken);
        return;
      }
      safeRemoveItem('token');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const { access_token, user: u } = response.data;
      safeSetItem('token', access_token);
      setToken(access_token);
      setUser(u);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      toast.success('¡Registro exitoso!');
      return true;
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al registrarse';
      toast.error(message.includes('already') ? 'Este email ya está registrado.' : message);
      return false;
    }
  };

  const login = async (credentials) => {
    try {
      const response = await axios.post(`${API}/auth/login`, credentials);
      const { access_token, user: u } = response.data;
      safeSetItem('token', access_token);
      setToken(access_token);
      setUser(u);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      toast.success('¡Bienvenido!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar sesión');
      return false;
    }
  };

  const ssoLogin = async (externalToken) => {
    try {
      ssoInProgress.current = true;
      const response = await axios.post(`${API}/auth/sso`, { external_token: externalToken });
      const { access_token, user: u } = response.data;
      safeSetItem('token', access_token);
      lastSSOTokenRef.current = externalToken;
      safeSetItem('redac_last_sso_token', externalToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(u);
      setToken(access_token);
      setLoading(false);
      return { success: true, user: u };
    } catch (error) {
      ssoInProgress.current = false;
      return { success: false, error: error.response?.data?.detail || 'Error de autenticación SSO' };
    }
  };

  const logout = () => {
    safeRemoveItem('token');
    safeRemoveItem('redac_last_sso_token');
    lastSSOTokenRef.current = '';
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    window.__IFRAME_TOKEN__ = null;
    toast.success('Sesión cerrada');
  };

  const value = {
    user, loading,
    isAuthenticated: !!user,
    register, login, ssoLogin, logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
