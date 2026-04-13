import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Send, Paperclip, X, Bot, User, Image as ImageIcon, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ChatAssistant = ({ templateId, templateName, formCode, onDataExtracted, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    startChat();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cleanMessage = (message) => {
    // Remover la sección [DATOS_EXTRAIDOS] del mensaje antes de mostrarlo al usuario
    return message.replace(/\[DATOS_EXTRAIDOS\][\s\S]*?(?=\n\n|\n$|$)/g, '').trim();
  };

  const startChat = async () => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/uscis-forms/chat/start`,
        { template_id: templateId },
        { headers }
      );
      setMessages([{ role: 'assistant', content: cleanMessage(response.data.greeting) }]);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Error al iniciar el chat');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleccione una imagen');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text && !selectedFile) return;

    const userMessage = text || 'Adjunto foto de mi documento';
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputText('');
    setIsLoading(true);

    try {
      let imageBase64 = null;

      // Si hay archivo, convertir a base64
      if (selectedFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(selectedFile);
        });
        removeFile();
      }

      // Enviar mensaje al backend
      const response = await axios.post(
        `${BACKEND_URL}/api/uscis-forms/chat/message`,
        {
          template_id: templateId,
          message: text,
          conversation_history: messages,
          current_answers: extractedData,
          image_base64: imageBase64
        },
        { headers }
      );

      // Agregar respuesta del asistente (limpiando la sección de datos extraídos)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: cleanMessage(response.data.message) }
      ]);

      // Si hay datos extraídos, actualizar estado y notificar al padre
      if (response.data.extracted_data && Object.keys(response.data.extracted_data).length > 0) {
        const newData = { ...extractedData, ...response.data.extracted_data };
        setExtractedData(newData);
        onDataExtracted(newData);
        toast.success('Información extraída y guardada');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="bg-navy-secondary border-navy-light h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-navy-light flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-white">Mónica - Asistente Virtual</h3>
            <p className="text-xs text-white/80">{formCode} - {templateName}</p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant'
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                : 'bg-gold-primary'
            }`}>
              {msg.role === 'assistant' ? (
                <Bot className="h-5 w-5 text-white" />
              ) : (
                <User className="h-5 w-5 text-navy-primary" />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'assistant'
                  ? 'bg-navy-light text-gray-200'
                  : 'bg-gold-primary/20 text-white border border-gold-primary/30'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="bg-navy-light rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span className="text-sm text-gray-400">Mónica está escribiendo...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input Area */}
      <div className="p-4 border-t border-navy-light space-y-2">
        {/* File Preview */}
        {previewUrl && (
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="Preview"
              className="h-20 w-20 object-cover rounded-lg border-2 border-indigo-500"
            />
            <button
              onClick={removeFile}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="border-indigo-500 text-indigo-400 hover:bg-indigo-500/20"
            disabled={isLoading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            className="bg-navy-light border-navy-light text-white placeholder:text-gray-500 flex-1"
            disabled={isLoading}
          />

          <Button
            onClick={sendMessage}
            disabled={isLoading || (!inputText.trim() && !selectedFile)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          Puedes subir fotos de tu pasaporte, ID o licencia para extraer información automáticamente
        </p>
      </div>
    </Card>
  );
};

export default ChatAssistant;
