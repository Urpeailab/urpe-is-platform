import React from 'react';
import { useTranslation } from 'react-i18next';
import { MonicaChat } from '../components/MonicaChat';

export const Messages = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="messages-title">
          {t('nav.messages')}
        </h1>
        
        <div className="bg-black border-2 border-yellow-500/50 rounded-lg p-8 text-center">
          <p className="text-gray-300 mb-4">
            {t('messages.description')}
          </p>
          <p className="text-sm text-gray-400">
            {t('messages.availability')}
          </p>
        </div>
      </div>
      
      <MonicaChat />
    </div>
  );
};
