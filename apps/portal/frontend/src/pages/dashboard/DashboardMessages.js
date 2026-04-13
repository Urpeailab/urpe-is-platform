import React from 'react';
import { MonicaChat } from '../../components/MonicaChat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { MessageSquare } from 'lucide-react';

export const DashboardMessages = () => {
  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto bg-navy-primary min-h-screen">
      <Card className="bg-navy-secondary border border-gold-dark/20 rounded-xl">
        <CardHeader className="p-4 sm:p-6 border-b border-navy-light/20">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gold-dark/10 border border-gold-dark/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-gold-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-display text-lg sm:text-2xl text-gold-subtle">
                Mensajes
              </CardTitle>
              <CardDescription className="text-slate text-xs sm:text-sm">
                Chatea con Mónica, tu asistente 24/7
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 min-h-[300px] sm:min-h-[500px] flex items-center justify-center">
          <div className="text-center text-slate px-4">
            <MessageSquare className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gold-dark/50 mb-4" />
            <p className="text-sm sm:text-base">Haz clic en el botón de Mónica en la esquina inferior derecha para chatear</p>
          </div>
        </CardContent>
      </Card>
      <MonicaChat />
    </div>
  );
};
