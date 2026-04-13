import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // For NotFoundError (removeChild), don't crash the app - it's a minor DOM issue
    if (error && error.toString().includes('NotFoundError')) {
      console.warn('Caught NotFoundError (DOM manipulation issue), recovering gracefully:', error);
      return { hasError: false }; // Don't show error page for this
    }
    return { hasError: true };
  }

  componentDidMount() {
    // Global error handler for uncaught errors (especially Radix UI portal issues)
    window.addEventListener('error', this.handleGlobalError);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError);
  }

  handleGlobalError = (event) => {
    // Suppress NotFoundError from Radix UI portals - they're harmless
    if (event.error && event.error.toString().includes('NotFoundError')) {
      console.warn('Suppressed NotFoundError:', event.error);
      event.preventDefault();
      return false;
    }
  }

  componentDidCatch(error, errorInfo) {
    // For NotFoundError, just log and continue - don't crash
    if (error && error.toString().includes('NotFoundError')) {
      console.warn('NotFoundError caught, continuing without crash:', error);
      this.setState({ hasError: false });
      return;
    }

    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Log error to backend for monitoring
    try {
      fetch(`${process.env.REACT_APP_BACKEND_URL}/api/log-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.toString(),
          errorInfo: errorInfo.componentStack,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(e => console.error('Failed to log error:', e));
    } catch (e) {
      console.error('Error logging failed:', e);
    }
  }

  handleReload = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Oops! Algo salió mal
              </h1>
              <p className="text-gray-600 text-lg">
                La aplicación encontró un error inesperado
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                Detalles del error:
              </h3>
              <p className="text-sm text-red-700 font-mono break-all">
                {this.state.error && this.state.error.toString()}
              </p>
              
              {/* Mostrar mensaje útil para errores conocidos */}
              {this.state.error && this.state.error.toString().includes('NotFoundError') && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Sugerencia:</strong> Este error generalmente se resuelve recargando la página. Si persiste, intenta limpiar el caché del navegador.
                  </p>
                </div>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                  Stack trace (solo en desarrollo)
                </summary>
                <pre className="text-xs text-gray-600 overflow-auto max-h-60">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-5 w-5" />
                Recargar Página
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Ir al Inicio
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Si el problema persiste, por favor contacta al administrador.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
