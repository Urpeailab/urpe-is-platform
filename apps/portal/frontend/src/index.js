import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Global error handler for uncaught errors (especially DOM manipulation errors from Radix UI)
window.addEventListener('error', (event) => {
  // Check for NotFoundError (common with Radix UI portals)
  const errorMessage = event.error?.message || event.message || '';
  const errorName = event.error?.name || '';
  
  if (
    errorName === 'NotFoundError' ||
    errorMessage.includes('NotFoundError') ||
    errorMessage.includes('removeChild') ||
    errorMessage.includes('insertBefore') ||
    errorMessage.includes('The node to be removed is not a child') ||
    errorMessage.includes('El nodo que se va a eliminar no es un hijo')
  ) {
    console.warn('🔇 Suppressed DOM manipulation error:', errorMessage);
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true); // Use capture phase to catch errors early

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || String(event.reason) || '';
  const errorName = event.reason?.name || '';
  
  if (
    errorName === 'NotFoundError' ||
    errorMessage.includes('NotFoundError') ||
    errorMessage.includes('removeChild') ||
    errorMessage.includes('insertBefore')
  ) {
    console.warn('🔇 Suppressed unhandled NotFoundError:', errorMessage);
    event.preventDefault();
    return;
  }
});

// Patch the native removeChild to prevent crashes
const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function(child) {
  if (child && child.parentNode === this) {
    return originalRemoveChild.call(this, child);
  }
  console.warn('🔇 Prevented removeChild error - node is not a child');
  return child;
};

// Patch the native insertBefore to prevent crashes  
const originalInsertBefore = Node.prototype.insertBefore;
Node.prototype.insertBefore = function(newNode, referenceNode) {
  if (referenceNode === null || referenceNode.parentNode === this) {
    return originalInsertBefore.call(this, newNode, referenceNode);
  }
  console.warn('🔇 Prevented insertBefore error - reference node is not a child');
  return newNode;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
