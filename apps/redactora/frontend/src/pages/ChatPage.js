import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { FileText, Book, Loader2, ArrowLeft, Send, User, MessageSquare, Plus, Trash2, Edit, Paperclip, File, Key, List, Monitor, Search, Star, Target, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API, BACKEND_URL } from '../utils/constants';
import { FindReplaceBlocks } from '../components/FindReplaceBlocks';

const ChatPage = () => {
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setConversations(response.data.conversations);
        
        // Auto-select first conversation if exists
        if (response.data.conversations.length > 0) {
          selectConversation(response.data.conversations[0]);
        } else {
          // Si no hay conversaciones, crear una automáticamente (sin toast)
          await createNewConversation(false);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Error al cargar las conversaciones');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const createNewConversation = async (showToast = true) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/chat/conversations`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const newConv = response.data.conversation;
        setConversations(prev => [newConv, ...prev]);
        selectConversation(newConv);
        if (showToast) {
          toast.success('Nueva conversación creada');
        }
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Error al crear conversación');
    }
  };

  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setIsLoadingMessages(true);
    setMessages([]);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/chat/conversations/${conversation.id}/messages`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Error al cargar mensajes');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/chat/conversations/${conversationId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      
      toast.success('Conversación eliminada');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Error al eliminar conversación');
    }
  };

  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.pdf', '.docx', '.doc'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(fileExt)) {
        toast.error('Tipo de archivo no soportado. Solo PDF y Word (.docx, .doc)');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo es muy grande. Máximo 10MB');
        return;
      }
      
      setAttachedFile(file);
      toast.success(`Archivo adjunto: ${file.name}`);
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && !attachedFile) || isLoading) return;
    if (!selectedConversation) {
      toast.error('Selecciona o crea una conversación primero');
      return;
    }

    const userMessage = inputMessage.trim() || (attachedFile ? '📎 Documento adjunto' : '');
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage + (attachedFile ? ` - ${attachedFile.name}` : ''),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const token = localStorage.getItem('token');
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('message', userMessage);
      if (attachedFile) {
        formData.append('file', attachedFile);
      }
      
      const response = await axios.post(
        `${API}/chat/conversations/${selectedConversation.id}/messages`,
        formData,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      if (response.data.success) {
        // Replace temp message with real one and add assistant response
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMsg.id),
          response.data.user_message,
          response.data.assistant_message
        ]);
        
        // Clear attachment
        removeAttachment();
        
        // Update conversation title in sidebar if it was updated
        if (messages.length === 0) {
          await loadConversations();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar el mensaje');
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMsg.id));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw',
      display: 'flex',
      background: '#f9fafb',
      overflow: 'hidden'
    }}>
      {/* Sidebar - Conversaciones */}
      <div style={{
        width: '300px',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
        }}>
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')} 
            style={{ 
              padding: '8px 12px',
              color: 'white',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            <ArrowLeft size={20} />
            Volver
          </Button>
          <Button
            onClick={createNewConversation}
            style={{
              background: 'white',
              color: '#ec4899',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: '600',
              padding: '10px'
            }}
          >
            <Plus size={20} />
            Nueva conversación
          </Button>
        </div>

        {/* Conversations List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px'
        }}>
          {isLoadingConversations ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <Loader2 className="animate-spin" size={24} style={{ color: '#ec4899' }} />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#6b7280',
              fontSize: '0.875rem'
            }}>
              <MessageSquare size={32} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
              <p style={{ margin: 0 }}>No hay conversaciones aún.</p>
              <p style={{ margin: '8px 0 0 0' }}>Crea una nueva para comenzar.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedConversation?.id === conv.id 
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
                    : 'transparent',
                  border: selectedConversation?.id === conv.id 
                    ? '1px solid #ec4899'
                    : '1px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
                onMouseEnter={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.background = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {conv.title}
                  </p>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    {new Date(conv.updated_at).toLocaleDateString('es', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  style={{
                    padding: '4px',
                    minWidth: 'auto',
                    height: 'auto',
                    color: '#9ca3af'
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        overflow: 'hidden'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              💬
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                {selectedConversation ? selectedConversation.title : 'Chat con Mónica'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                Tu asistente personal con IA
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px',
          background: '#f9fafb'
        }}>
          {!selectedConversation ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <MessageSquare size={64} style={{ marginBottom: '24px', color: '#d1d5db' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: '600', color: '#374151' }}>
                Selecciona una conversación
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', maxWidth: '500px' }}>
                Elige una conversación existente del sidebar o crea una nueva para comenzar a chatear con Mónica.
              </p>
            </div>
          ) : isLoadingMessages ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Loader2 className="animate-spin" size={40} style={{ color: '#ec4899' }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <MessageSquare size={64} style={{ marginBottom: '24px', color: '#d1d5db' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: '600', color: '#374151' }}>
                ¡Hola! Soy Mónica
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', maxWidth: '500px' }}>
                Estoy aquí para ayudarte con lo que necesites. Puedo responder preguntas, ayudarte con tareas y adaptarme al idioma que prefieras usar.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  style={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '20px'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      background: message.role === 'user'
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#ffffff',
                      color: message.role === 'user' ? 'white' : '#1f2937',
                      boxShadow: message.role === 'user'
                        ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
                        : '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                      border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                      fontSize: '1rem',
                      lineHeight: '1.6'
                    }}
                  >
                    {message.role === 'assistant' ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Estilos para elementos markdown
                          h1: ({node, ...props}) => <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem', marginBottom: '0.5rem' }} {...props} />,
                          h2: ({node, ...props}) => <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '0.8rem', marginBottom: '0.4rem' }} {...props} />,
                          h3: ({node, ...props}) => <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '0.6rem', marginBottom: '0.3rem' }} {...props} />,
                          strong: ({node, ...props}) => <strong style={{ fontWeight: '700' }} {...props} />,
                          em: ({node, ...props}) => <em style={{ fontStyle: 'italic' }} {...props} />,
                          ul: ({node, ...props}) => <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }} {...props} />,
                          ol: ({node, ...props}) => <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }} {...props} />,
                          li: ({node, ...props}) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                          p: ({node, ...props}) => <p style={{ marginBottom: '0.75rem' }} {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline 
                              ? <code style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' }} {...props} />
                              : <code style={{ display: 'block', backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px', marginTop: '0.5rem', marginBottom: '0.5rem', overflowX: 'auto' }} {...props} />,
                          a: ({node, ...props}) => <a style={{ color: '#3b82f6', textDecoration: 'underline' }} {...props} target="_blank" rel="noopener noreferrer" />
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {message.content}
                      </div>
                    )}
                    {/* Plan B: surface BUSCAR/REEMPLAZAR patches as one-click copy cards */}
                    {message.role === 'assistant' && (
                      <FindReplaceBlocks content={message.content} />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '16px',
                    background: '#ffffff',
                    boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <div className="typing-dot" style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'typing 1.4s infinite'
                    }}></div>
                    <div className="typing-dot" style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'typing 1.4s infinite 0.2s'
                    }}></div>
                    <div className="typing-dot" style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'typing 1.4s infinite 0.4s'
                    }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: '24px 32px',
          borderTop: '1px solid #e5e7eb',
          background: 'white'
        }}>
          {/* Attached file preview */}
          {attachedFile && (
            <div style={{
              marginBottom: '12px',
              padding: '12px 16px',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '500' }}>
                  {attachedFile.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  ({(attachedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={removeAttachment}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#dc2626'
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            {/* Attach file button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !selectedConversation || attachedFile}
              style={{
                background: attachedFile ? '#d1d5db' : 'white',
                color: attachedFile ? '#9ca3af' : '#6b7280',
                padding: '14px',
                borderRadius: '12px',
                height: '56px',
                minWidth: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #e5e7eb',
                cursor: attachedFile ? 'not-allowed' : 'pointer'
              }}
              title="Adjuntar archivo (PDF o Word)"
            >
              <Paperclip size={20} />
            </Button>
            
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedConversation ? "Escribe tu mensaje..." : "Selecciona una conversación primero..."}
              disabled={isLoading || !selectedConversation}
              style={{
                flex: 1,
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '1rem',
                resize: 'none',
                minHeight: '56px',
                maxHeight: '150px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s',
                background: !selectedConversation ? '#f9fafb' : 'white'
              }}
              onFocus={(e) => {
                if (selectedConversation) {
                  e.target.style.borderColor = '#ec4899';
                }
              }}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={(!inputMessage.trim() && !attachedFile) || isLoading || !selectedConversation}
              style={{
                background: (!selectedConversation || (!inputMessage.trim() && !attachedFile)) 
                  ? '#d1d5db' 
                  : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                color: 'white',
                padding: '14px 24px',
                borderRadius: '12px',
                height: '56px',
                minWidth: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <Send size={24} />
              )}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

const NIW_SECTION_TITLES = [
  "I. Cover Page",
  "II. Executive Summary",
  "III. Statement of Substantial Merit & National Importance (Prong 1)",
  "IV. Problem & National Context",
  "IV-B. Petitioner's Qualifications & Demonstrated Capacity (Prong 2)",
  "V. Objectives",
  "VI. Indicators & Metrics",
  "VII. Scope & Deliverables",
  "VIII. Execution Plan by Phases",
  "IX. Capital-Free Start Strategy",
  "X. Methodology",
  "XI. Risk Management & Assumptions",
  "XII. Expected Results & Impact",
  "XIII. Governance, Ethics & Compliance",
  "XIV. Monitoring & Evaluation",
  "XV. Empirical Basis & References",
  "XVI. Annexes",
  "XVII. Balance of Factors & Waiver Justification (Prong 3)"
];

// Client Dashboard Component

export default ChatPage;
