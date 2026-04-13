import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TermsContent } from './TermsContent';

export const TermsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-all"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
          <CardTitle className="text-3xl font-bold text-white flex items-center gap-3">
            📋 TÉRMINOS Y CONDICIONES
          </CardTitle>
          <div className="w-full h-1 bg-white/30 mt-3"></div>
        </CardHeader>

        {/* Scrollable Content */}
        <CardContent className="overflow-y-auto flex-1 p-6">
          <TermsContent />
        </CardContent>

        {/* Footer Button */}
        <div className="p-6 bg-gray-50 border-t flex-shrink-0">
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:to-amber-700 text-black font-bold py-3 text-lg"
          >
            Aceptar y cerrar
          </Button>
        </div>
      </Card>
    </div>
  );
};
