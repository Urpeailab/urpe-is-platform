import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ArrowLeft, Mic, MicOff, Send, X, Loader2, AlertCircle, MessageSquare, ChevronLeft, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Idle / pause-to-save-credits config
const IDLE_BEFORE_WARNING_MS = 90 * 1000;   // 1:30 sin interacción → warning
const WARNING_COUNTDOWN_SEC = 30;            // 30s para responder antes de pausar

const STATUS_BADGE = {
  connecting: { label: 'Conectando', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40', dot: 'bg-blue-400 animate-pulse' },
  ready: { label: 'EN VIVO', cls: 'bg-red-500/20 text-red-300 border-red-500/40', dot: 'bg-red-500 animate-pulse' },
  speaking: { label: 'Hablando', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-400 animate-pulse' },
  idle: { label: 'Inactivo', cls: 'bg-gray-500/20 text-gray-300 border-gray-500/40', dot: 'bg-gray-400' },
  error: { label: 'Error', cls: 'bg-red-500/30 text-red-200 border-red-500/60', dot: 'bg-red-500' },
};

export const LearningSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const roomRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const avatarSessionRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [avatarStatus, setAvatarStatus] = useState('idle');
  const [avatarError, setAvatarError] = useState(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [ending, setEnding] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [idleWarning, setIdleWarning] = useState(0); // segundos restantes; 0 = sin warning
  const [paused, setPaused] = useState(false);
  const [resuming, setResuming] = useState(false);
  const idleTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const pausedRef = useRef(false);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` });

  // Envía el comando avatar.speak_text al topic agent-control para que el avatar
  // hable un texto custom (generado por nuestro LLM con RAG).
  const speakViaAvatar = async (room, avatarSessionId, text) => {
    if (!room || !text || !avatarSessionId) return;
    try {
      const eventId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const payload = {
        event_id: eventId,
        event_type: 'avatar.speak_text',
        session_id: avatarSessionId,
        source_event_id: null,
        text,
      };
      const data = new TextEncoder().encode(JSON.stringify(payload));
      await room.localParticipant.publishData(data, {
        reliable: true,
        topic: 'agent-control',
      });
    } catch (e) {
      console.warn('[liveavatar.speak_text] failed', e);
    }
  };

  const clearIdleTimers = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const pauseAvatar = () => {
    clearIdleTimers();
    setIdleWarning(0);
    try {
      roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
    avatarSessionRef.current = null;
    pausedRef.current = true;
    setPaused(true);
    setAvatarStatus('idle');
  };

  const startCountdown = () => {
    setIdleWarning(WARNING_COUNTDOWN_SEC);
    countdownIntervalRef.current = setInterval(() => {
      setIdleWarning((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          pauseAvatar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetIdleTimer = () => {
    if (pausedRef.current) return; // si está pausado, solo el botón reactiva
    clearIdleTimers();
    setIdleWarning(0);
    idleTimerRef.current = setTimeout(startCountdown, IDLE_BEFORE_WARNING_MS);
  };

  // Listeners de actividad: cualquier interacción real resetea el timer.
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
    const handler = () => resetIdleTimer();
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
      clearIdleTimers();
    };
  }, []);

  const resumeAvatar = async () => {
    if (!sessionId || resuming) return;
    setResuming(true);
    try {
      const { data } = await axios.post(
        `${API}/learning/sessions/${sessionId}/resume-avatar`,
        {},
        { headers: headers() },
      );
      if (!data.avatar_session) {
        throw new Error(data.avatar_error || 'No se obtuvo sesión de avatar');
      }
      const { livekit_url, livekit_token } = data.avatar_session;
      avatarSessionRef.current = data.avatar_session;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          videoRef.current.play().catch(() => {});
        }
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
          audioRef.current.play().catch(() => {});
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const otherSpeaking = speakers.some((p) => p.identity !== room.localParticipant?.identity);
        setAvatarStatus(otherSpeaking ? 'speaking' : 'ready');
      });
      room.on(RoomEvent.Disconnected, () => setAvatarStatus('idle'));

      setAvatarStatus('connecting');
      await room.connect(livekit_url, livekit_token);
      setAvatarStatus('ready');
      pausedRef.current = false;
      setPaused(false);
      resetIdleTimer();
      toast.success('Avatar reactivado');
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Error reactivando el avatar';
      toast.error(detail);
      setAvatarError(detail);
      setAvatarStatus('error');
    } finally {
      setResuming(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setAvatarStatus('connecting');
        const { data } = await axios.post(
          `${API}/learning/sessions`,
          { module_id: moduleId || null },
          { headers: headers() },
        );
        if (cancelled) return;

        setSessionId(data.session_id);
        setModuleData(data.module);
        if (data.opening_text) {
          setMessages([{ role: 'assistant', content: data.opening_text }]);
        }

        if (!data.avatar_session) {
          const errMsg = data.avatar_error || 'No se obtuvo sesión de avatar';
          setAvatarError(errMsg);
          setAvatarStatus('error');
          toast.error('Avatar no disponible: continúa en modo solo texto');
          return;
        }

        const { livekit_url, livekit_token } = data.avatar_session;
        avatarSessionRef.current = data.avatar_session;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
            videoRef.current.play().catch(() => {});
          }
          if (track.kind === Track.Kind.Audio && audioRef.current) {
            track.attach(audioRef.current);
            audioRef.current.play().catch(() => {});
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
        });
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          // Si hay alguien hablando que no soy yo, asumimos avatar
          const otherSpeaking = speakers.some((p) => p.identity !== room.localParticipant?.identity);
          setAvatarStatus(otherSpeaking ? 'speaking' : 'ready');
        });
        room.on(RoomEvent.Disconnected, () => {
          setAvatarStatus('idle');
        });
        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          console.log('[livekit] connection state:', state);
        });

        try {
          await room.connect(livekit_url, livekit_token);
          setAvatarStatus('ready');
          resetIdleTimer();
          if (data.opening_text) {
            await speakViaAvatar(room, data.avatar_session.session_id, data.opening_text);
          }
        } catch (connErr) {
          const detail = connErr?.message || String(connErr);
          setAvatarError(`LiveKit no pudo conectar: ${detail}`);
          setAvatarStatus('error');
          console.error('[livekit.connect]', connErr);
        }
      } catch (err) {
        const detail = err.response?.data?.detail || err.message || 'Error iniciando la sesión';
        setAvatarError(detail);
        setAvatarStatus('error');
        toast.error(detail);
      }
    })();

    return () => {
      cancelled = true;
      try {
        roomRef.current?.disconnect();
      } catch {}
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const clean = (text || '').trim();
    if (!clean || sending || !sessionId) return;
    resetIdleTimer();
    setMessages((prev) => [...prev, { role: 'user', content: clean }]);
    setInput('');
    setSending(true);
    try {
      const { data } = await axios.post(
        `${API}/learning/sessions/${sessionId}/message`,
        { text: clean },
        { headers: headers() },
      );
      const reply = data.assistant_text || '';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      const room = roomRef.current;
      const avatarSessionId = avatarSessionRef.current?.session_id;
      if (room && room.state === 'connected' && reply && avatarSessionId) {
        await speakViaAvatar(room, avatarSessionId, reply);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const muteAvatar = (muted) => {
    if (audioRef.current) audioRef.current.muted = muted;
    if (videoRef.current) videoRef.current.muted = muted;
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    // Silenciar el avatar para que el reconocedor no capte su voz como input
    muteAvatar(true);

    const rec = new Recognition();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;

    let finalTranscript = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      const preview = (finalTranscript + interim).trim();
      if (preview) setInput(preview);
    };

    rec.onerror = (e) => {
      console.warn('[stt] error', e.error, e);
      muteAvatar(false);
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Permiso de micrófono denegado. Habilítalo en el candado del navegador.');
      } else if (e.error === 'no-speech') {
        toast.info('No detecté audio. Intenta hablar más cerca del micrófono.');
      } else if (e.error === 'audio-capture') {
        toast.error('No hay micrófono disponible.');
      } else if (e.error !== 'aborted') {
        toast.error(`Error de reconocimiento: ${e.error}`);
      }
    };

    rec.onend = () => {
      muteAvatar(false);
      setListening(false);
      const text = finalTranscript.trim();
      if (text) {
        setInput('');
        sendMessage(text);
      }
    };

    try {
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err) {
      muteAvatar(false);
      console.error('[stt] start failed', err);
      toast.error('No se pudo iniciar el reconocimiento de voz.');
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    // setListening(false) se aplicará en onend, junto con el envío del texto.
  };

  const endSession = async () => {
    if (!sessionId) return navigate('/admin/learning');
    if (!window.confirm('¿Terminar la sesión?')) return;
    setEnding(true);
    clearIdleTimers();
    try {
      try {
        roomRef.current?.disconnect();
      } catch {}
      const { data } = await axios.post(
        `${API}/learning/sessions/${sessionId}/end`,
        {},
        { headers: headers() },
      );
      if (data.evaluation) {
        setEvaluation(data.evaluation);
      } else {
        navigate('/admin/learning');
      }
    } catch {
      toast.error('Error terminando la sesión');
    } finally {
      setEnding(false);
    }
  };

  if (evaluation) {
    return (
      <div className="bg-white min-h-screen p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6 space-y-6">
            <h2 className="text-2xl font-bold">Resultado de tu sesión</h2>
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <div className="text-6xl font-bold text-yellow-500">
                {evaluation.score ?? '—'}
              </div>
              <div className="text-sm text-gray-500 mt-1">de 100</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Retroalimentación</h3>
              <p className="text-sm text-gray-700">{evaluation.feedback}</p>
            </div>
            {Array.isArray(evaluation.objectives_covered) && evaluation.objectives_covered.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Objetivos</h3>
                <ul className="space-y-1 text-sm">
                  {evaluation.objectives_covered.map((o, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={o.covered ? 'text-green-600' : 'text-gray-400'}>
                        {o.covered ? '✓' : '○'}
                      </span>
                      <span className="text-gray-700">{o.evidence || `Objetivo ${i + 1}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={() => navigate('/admin/learning')} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                Volver al hub
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = STATUS_BADGE[avatarStatus] || STATUS_BADGE.idle;

  return (
    // -m-6 anula el padding del <main> del AdminLayout para que el avatar use todo el ancho
    // h-[calc(100vh-4rem)] respeta el top bar fixed (h-16 = 4rem)
    <div className="-m-6 h-[calc(100vh-4rem)] relative bg-black overflow-hidden text-white">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <audio ref={audioRef} autoPlay />

      {/* Status overlays sobre el video */}
      {avatarStatus === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10">
          <Loader2 className="h-12 w-12 animate-spin mb-3 text-purple-400" />
          <div className="text-base font-medium">Conectando con el avatar…</div>
          <div className="text-sm text-gray-400 mt-1">Esto puede tomar unos segundos</div>
        </div>
      )}
      {avatarStatus === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white text-center p-8 z-10">
          <AlertCircle className="h-16 w-16 mb-4 text-red-500" />
          <div className="text-lg font-semibold">No se pudo conectar el avatar</div>
          <div className="text-sm text-gray-400 mt-2 max-w-md">
            Continúa la conversación por texto en el chat.
          </div>
        </div>
      )}
      {avatarStatus === 'idle' && !avatarError && !paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-300 z-10">
          <div className="text-sm">Avatar inactivo</div>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-white z-30 p-6 text-center">
          <Pause className="h-14 w-14 text-yellow-400 mb-3" />
          <div className="text-lg font-semibold">Avatar en pausa</div>
          <div className="text-sm text-gray-400 mt-1 max-w-md">
            Pausamos el avatar por inactividad para ahorrar créditos. El chat por texto sigue
            funcionando. Reactivá el avatar cuando quieras seguir conversando con voz.
          </div>
          <button
            onClick={resumeAvatar}
            disabled={resuming}
            className="mt-5 h-10 px-5 rounded-md bg-yellow-500 hover:bg-yellow-600 text-black font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {resuming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reactivando…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Reactivar avatar
              </>
            )}
          </button>
        </div>
      )}

      {idleWarning > 0 && !paused && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-yellow-500/95 text-black rounded-lg px-4 py-2.5 shadow-xl flex items-center gap-2 text-sm font-medium">
          <Pause className="h-4 w-4" />
          <span>
            Pausando el avatar en <strong>{idleWarning}s</strong> por inactividad. Mové el mouse o
            escribí para mantenerlo activo.
          </span>
        </div>
      )}

      {/* Top overlay bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={endSession}
            className="h-9 w-9 flex items-center justify-center rounded-md bg-black/60 hover:bg-black/80 text-white transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate text-white">
              {moduleData?.title || 'Conversación libre'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${status.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              <span className="text-xs text-gray-400 truncate">
                {moduleData?.mode === 'guided' ? 'Modo guiado' : 'Sesión libre'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="h-9 px-3 rounded-md bg-black/60 hover:bg-black/80 text-white text-sm flex items-center gap-1.5 transition-colors"
              title="Mostrar chat"
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </button>
          )}
          <button
            onClick={endSession}
            disabled={ending}
            className="h-9 px-4 rounded-md bg-red-600/90 hover:bg-red-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Terminar
          </button>
        </div>
      </div>

      {/* Error banner overlay (centrado arriba) */}
      {avatarError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] bg-red-950/95 border border-red-700 rounded-lg px-4 py-3 flex items-start gap-2 backdrop-blur-sm shadow-xl">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-red-200 text-sm">Error con el avatar</div>
            <div className="text-xs text-red-300 mt-1 break-words">{avatarError}</div>
            <div className="text-xs text-red-400 mt-1">
              El chat por texto sigue funcionando.
            </div>
          </div>
        </div>
      )}

      {/* Chat flotante (panel a la izquierda) */}
      {chatOpen && (
        <aside className="absolute left-4 top-20 bottom-4 w-80 max-w-[90vw] z-20 flex flex-col bg-[#18181b]/40 backdrop-blur-xl rounded-lg shadow-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-bold uppercase tracking-wide text-gray-200">
                Chat
              </span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Ocultar chat"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scroll-smooth">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 text-sm italic py-6 px-2">
                Empieza a chatear con el avatar.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className="text-sm leading-relaxed hover:bg-white/5 rounded px-1 py-0.5 -mx-1"
                >
                  <span
                    className={`font-bold ${
                      m.role === 'user' ? 'text-yellow-400' : 'text-purple-400'
                    }`}
                  >
                    {m.role === 'user' ? 'Tú' : 'Avatar'}
                  </span>
                  <span className="text-gray-500">: </span>
                  <span className="text-gray-100 whitespace-pre-wrap break-words">
                    {m.content}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-white/10 p-3 space-y-2 bg-black/20">
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={sending}
                title={listening ? 'Detener micrófono' : 'Hablar'}
                className={`h-9 w-9 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${
                  listening
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20'
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={listening ? 'Escuchando…' : 'Escribe un mensaje'}
                disabled={sending || listening}
                className="flex-1 min-w-0 h-9 px-3 rounded-md bg-black/30 border border-white/15 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 focus:bg-black/40 disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className="w-full h-9 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </>
              )}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export default LearningSession;
