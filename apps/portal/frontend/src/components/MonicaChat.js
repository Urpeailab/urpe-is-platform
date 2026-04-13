import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { MessageCircle, Send, X } from 'lucide-react';

const MOCK_RESPONSES = {
  en: {
    status: "Your case is currently in the 'Document Review' stage. We're reviewing the documents you submitted and will reach out if we need any additional information.",
    documents: "Based on your case type, you'll need: 1) Valid passport, 2) Birth certificate, 3) Marriage certificate (if applicable), 4) Employment verification letters, 5) Educational credentials. You can upload these in the Documents section.",
    appointment: "I can help you schedule an appointment! Please visit the Appointments section where you can select a convenient time slot for a consultation with our team.",
    payment: "We offer flexible payment plans. Your case has a payment due of $500. You can make payments through our secure payment portal in the Payments section. We accept credit cards, debit cards, and ACH transfers.",
    default: "I'm here to help! You can ask me about your case status, required documents, scheduling appointments, or payment options. What would you like to know?"
  },
  es: {
    status: "Tu caso está actualmente en la etapa de 'Revisión de Documentos'. Estamos revisando los documentos que enviaste y te contactaremos si necesitamos información adicional.",
    documents: "Según el tipo de tu caso, necesitarás: 1) Pasaporte válido, 2) Acta de nacimiento, 3) Acta de matrimonio (si aplica), 4) Cartas de verificación de empleo, 5) Credenciales educativas. Puedes subirlos en la sección de Documentos.",
    appointment: "¡Puedo ayudarte a agendar una cita! Por favor visita la sección de Citas donde podrás seleccionar un horario conveniente para una consulta con nuestro equipo.",
    payment: "Ofrecemos planes de pago flexibles. Tu caso tiene un pago pendiente de $500. Puedes realizar pagos a través de nuestro portal seguro en la sección de Pagos. Aceptamos tarjetas de crédito, débito y transferencias ACH.",
    default: "¡Estoy aquí para ayudarte! Puedes preguntarme sobre el estado de tu caso, documentos requeridos, agendar citas, u opciones de pago. ¿Qué te gustaría saber?"
  }
};

export const MonicaChat = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // Get advisor info from user data or use default
  const advisor = user?.advisor || {
    name: t('monica.defaultAdvisor'),
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Advisor&backgroundColor=ffc700',
    title: t('monica.advisorTitle')
  };
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'monica',
      text: user?.advisor ? t('monica.greeting', { name: advisor.name }) : t('monica.greetingGeneric'),
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getMonicaResponse = (userMessage) => {
    const msg = userMessage.toLowerCase();
    const lang = i18n.language;
    const responses = MOCK_RESPONSES[lang] || MOCK_RESPONSES.en;

    if (msg.includes('status') || msg.includes('estado') || msg.includes('case') || msg.includes('caso')) {
      return responses.status;
    }
    if (msg.includes('document') || msg.includes('documento') || msg.includes('need') || msg.includes('necesito')) {
      return responses.documents;
    }
    if (msg.includes('appointment') || msg.includes('cita') || msg.includes('schedule') || msg.includes('agendar')) {
      return responses.appointment;
    }
    if (msg.includes('payment') || msg.includes('pago') || msg.includes('pay') || msg.includes('pagar')) {
      return responses.payment;
    }
    return responses.default;
  };

  const handleSend = () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMsg = {
      id: messages.length + 1,
      sender: 'user',
      text: inputMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    // Simulate advisor's response
    setTimeout(() => {
      const advisorMsg = {
        id: messages.length + 2,
        sender: 'monica',
        text: getMonicaResponse(inputMessage),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, advisorMsg]);
    }, 800);

    setInputMessage('');
  };

  const handleSuggestion = (suggestion) => {
    setInputMessage(suggestion);
    handleSend();
  };

  return (
    <>
      {/* Chat Bubble Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg z-50"
          data-testid="monica-chat-button"
        >
          <MessageCircle className="h-8 w-8" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-black border-2 border-yellow-500 rounded-lg shadow-2xl z-50 flex flex-col" data-testid="monica-chat-window">
          {/* Header */}
          <div className="bg-yellow-500 text-black p-4 rounded-t-lg flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full border-2 border-black overflow-hidden">
                <img 
                  src={advisor.photo}
                  alt={advisor.name}
                  className="h-full w-full"
                />
              </div>
              <div>
                <h3 className="font-bold text-lg">{advisor.name}</h3>
                <p className="text-xs">{advisor.title || (i18n.language === 'es' ? 'Tu Asesora' : 'Your Advisor')}</p>
              </div>
            </div>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="icon"
              className="text-black hover:bg-black/10"
              data-testid="monica-close-button"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${msg.sender}-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Suggestions */}
          {messages.length === 1 && (
            <div className="p-3 border-t border-yellow-500/20">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleSuggestion(t('monica.suggestions.status'))}
                  variant="outline"
                  size="sm"
                  className="text-xs border-yellow-500/50 text-white hover:bg-yellow-500/10"
                  data-testid="suggestion-status"
                >
                  {t('monica.suggestions.status')}
                </Button>
                <Button
                  onClick={() => handleSuggestion(t('monica.suggestions.documents'))}
                  variant="outline"
                  size="sm"
                  className="text-xs border-yellow-500/50 text-white hover:bg-yellow-500/10"
                  data-testid="suggestion-documents"
                >
                  {t('monica.suggestions.documents')}
                </Button>
                <Button
                  onClick={() => handleSuggestion(t('monica.suggestions.appointment'))}
                  variant="outline"
                  size="sm"
                  className="text-xs border-yellow-500/50 text-white hover:bg-yellow-500/10"
                  data-testid="suggestion-appointment"
                >
                  {t('monica.suggestions.appointment')}
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-yellow-500/20">
            <div className="flex space-x-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('monica.placeholder')}
                className="flex-1 bg-white/10 border-yellow-500/50 text-white placeholder:text-gray-400"
                data-testid="monica-input"
              />
              <Button
                onClick={handleSend}
                className="bg-yellow-500 hover:bg-yellow-400 text-black"
                data-testid="monica-send-button"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
