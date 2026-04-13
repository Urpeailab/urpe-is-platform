import React from 'react';
import { Button } from '../../components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

export const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, deliverableName, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-red-500 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Confirmar Eliminación
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-900 text-base mb-3">
              ¿Estás seguro de que deseas eliminar el archivo de este entregable?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium mb-2">
                <strong>Entregable:</strong> {deliverableName}
              </p>
              <p className="text-sm text-red-800">
                Esta acción <strong>no se puede deshacer</strong>. El archivo será eliminado permanentemente del servidor.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <Button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300 font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold shadow-sm"
            >
              {isDeleting ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Eliminando...
                </>
              ) : (
                'Sí, Eliminar'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
