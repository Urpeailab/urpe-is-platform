// Shared constants for the application
// Use current page origin for API calls to avoid CORS issues in iframe embeds.
// In production, frontend and backend share the same domain (behind Kubernetes ingress).
// Falls back to REACT_APP_BACKEND_URL only if window is not available (SSR/tests).
export const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : '';
export const API = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL ? BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:') : '';
export const LOGO_URL = process.env.REACT_APP_LOGO_URL || 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';
