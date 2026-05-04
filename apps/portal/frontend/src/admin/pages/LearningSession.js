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
import { ArrowLeft, Mic, MicOff, Send, X, Loader2, AlertCircle, MessageSquare, Pause, Play, BookOpen, Search } from 'lucide-react';
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
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
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
        mediaRecorderRef.current?.stop();
      } catch {}
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
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
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          sources: Array.isArray(data.retrieved_chunks) ? data.retrieved_chunks : [],
          ragSkipped: !!data.rag_skipped,
        },
      ]);
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

  // Graba audio con MediaRecorder y al detener lo manda a Whisper (backend)
  // para transcribir. Más confiable que Web Speech API en español, no depende
  // del navegador y silencia el avatar para que su voz no entre al micrófono.
  const startListening = async () => {
    if (!sessionId) {
      toast.error('La sesión no está lista todavía.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Tu navegador no soporta grabación de audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Elegimos el mejor mime que soporte el navegador
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mime =
        candidates.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onerror = (e) => {
        console.error('[recorder] error', e);
        toast.error('Error grabando el audio.');
        cleanupRecording();
      };

      recorder.onstop = async () => {
        const tracks = mediaStreamRef.current?.getTracks() || [];
        tracks.forEach((t) => t.stop());
        mediaStreamRef.current = null;
        muteAvatar(false);
        setListening(false);

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];

        if (blob.size < 1000) {
          toast.info('No detecté audio. Probá hablar un poco más cerca del micrófono.');
          return;
        }

        setSending(true);
        try {
          const ext = (recorder.mimeType || '').includes('mp4')
            ? 'mp4'
            : (recorder.mimeType || '').includes('ogg')
            ? 'ogg'
            : 'webm';
          const form = new FormData();
          form.append('audio', blob, `nota.${ext}`);

          const { data } = await axios.post(
            `${API}/learning/sessions/${sessionId}/transcribe`,
            form,
            {
              headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
            },
          );
          const text = (data?.text || '').trim();
          if (!text) {
            toast.info('No pude transcribir nada del audio.');
            setSending(false);
            return;
          }
          setSending(false);
          await sendMessage(text);
        } catch (err) {
          setSending(false);
          const detail = err.response?.data?.detail || err.message || 'Error transcribiendo el audio';
          toast.error(detail);
        }
      };

      muteAvatar(true);
      recorder.start();
      setListening(true);
    } catch (err) {
      console.error('[recorder] getUserMedia failed', err);
      cleanupRecording();
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        toast.error('Permiso de micrófono denegado. Habilitalo en el candado del navegador.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        toast.error('No hay micrófono disponible.');
      } else {
        toast.error('No se pudo iniciar la grabación.');
      }
    }
  };

  const stopListening = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch (e) {
        console.warn('[recorder] stop failed', e);
        cleanupRecording();
      }
    } else {
      cleanupRecording();
    }
  };

  const cleanupRecording = () => {
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
    muteAvatar(false);
    setListening(false);
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
    // -m-6 anula el padding del <main> del AdminLayout para que la vista use todo el ancho
    // h-[calc(100vh-4rem)] respeta el top bar fixed (h-16 = 4rem)
    <div className="-m-6 h-[calc(100vh-4rem)] flex bg-gray-950 text-white overflow-hidden">
      <audio ref={audioRef} autoPlay />

      {/* ============ LEFT: Chat panel ============ */}
      {chatOpen && (
        <aside className="w-[42%] min-w-[360px] max-w-[560px] flex flex-col bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-800">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white">Tutor Virtual URPE</h1>
                <p className="text-sm text-gray-400 mt-1 leading-snug">
                  Tu asistente de aprendizaje está listo para responder tus consultas.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${status.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {moduleData?.title || (moduleData?.mode === 'guided' ? 'Modo guiado' : 'Sesión libre')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-md bg-gray-800/60 hover:bg-gray-800 text-gray-300 hover:text-yellow-500 border border-gray-700 transition-colors flex-shrink-0"
                title="Ocultar chat"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 text-sm italic py-12">
                Empieza a chatear con el avatar.
              </p>
            ) : (
              messages.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={i}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${
                        isUser
                          ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-black font-medium shadow-gold'
                          : 'bg-gray-800/70 text-gray-100 border border-gray-700/60'
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                      {isUser ? 'Tú' : 'Tutor URPE'}
                    </span>
                    {!isUser && !m.ragSkipped && Array.isArray(m.sources) && (
                      m.sources.length > 0 ? (
                        <details className="mt-1 text-[11px] text-gray-400 max-w-[88%]">
                          <summary className="cursor-pointer hover:text-yellow-500 inline-flex items-center gap-1 transition-colors">
                            <BookOpen className="h-3 w-3" />
                            {m.sources.length} fuente{m.sources.length > 1 ? 's' : ''} RAG
                          </summary>
                          <ul className="mt-1.5 space-y-1.5 pl-3 border-l-2 border-yellow-500/40">
                            {m.sources.map((s, j) => (
                              <li key={s.id || j} className="text-gray-300">
                                <div className="flex items-center gap-1.5 text-yellow-500">
                                  <span className="font-mono">
                                    {(s.similarity != null ? (s.similarity * 100).toFixed(0) : '?')}%
                                  </span>
                                  <span className="truncate">{s.source || 'documento'}</span>
                                </div>
                                <div className="text-gray-400 text-[10px] line-clamp-3 mt-0.5">
                                  {s.content}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <div className="mt-1 text-[11px] text-gray-500 italic flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          Sin coincidencias en RAG
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}
            {sending && (
              <div className="text-[11px] text-yellow-500 italic flex items-center gap-1.5">
                <Search className="h-3 w-3 animate-pulse" />
                Buscando en la base de conocimiento…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 pt-3 pb-5 border-t border-gray-800 space-y-3">
            <div className="bg-gray-800/60 rounded-full px-5 py-2.5 flex items-center gap-3 border border-gray-700 focus-within:border-yellow-500/60 focus-within:bg-gray-800/80 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={listening ? 'Escuchando…' : 'Escribí tu mensaje...'}
                disabled={sending || listening}
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={sending || !input.trim()}
                title="Enviar"
                className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={sending}
                title={listening ? 'Detener micrófono' : 'Hablar'}
                className={`h-10 w-10 flex items-center justify-center rounded-full transition-all shadow-lg ${
                  listening
                    ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/40'
                    : 'bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black ring-2 ring-yellow-500/30 hover:ring-yellow-500/60'
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">
                Sesión privada · URPE
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ============ RIGHT: Avatar video ============ */}
      <div className="flex-1 relative bg-gray-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Status overlays sobre el video */}
        {avatarStatus === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/85 text-white z-10">
            <Loader2 className="h-12 w-12 animate-spin mb-3 text-yellow-500" />
            <div className="text-base font-medium">Conectando con el avatar…</div>
            <div className="text-sm text-gray-400 mt-1">Esto puede tomar unos segundos</div>
          </div>
        )}
        {avatarStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 text-white text-center p-8 z-10">
            <AlertCircle className="h-16 w-16 mb-4 text-red-500" />
            <div className="text-lg font-semibold">No se pudo conectar el avatar</div>
            <div className="text-sm text-gray-400 mt-2 max-w-md">
              Continúa la conversación por texto en el chat.
            </div>
          </div>
        )}
        {avatarStatus === 'idle' && !avatarError && !paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 text-gray-300 z-10">
            <div className="text-sm">Avatar inactivo</div>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 text-white z-30 p-6 text-center">
            <Pause className="h-14 w-14 text-yellow-500 mb-3" />
            <div className="text-lg font-semibold">Tu tutor está en pausa</div>
            <div className="text-sm text-gray-400 mt-1 max-w-md">
              Pausamos al tutor tras un rato sin interacción para mantener la sesión liviana.
              Podés seguir consultando por chat y reactivar la conversación con voz cuando
              quieras retomarla.
            </div>
            <button
              onClick={resumeAvatar}
              disabled={resuming}
              className="mt-5 h-10 px-5 rounded-md bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold flex items-center gap-2 disabled:opacity-60 shadow-gold"
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
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-yellow-500 text-black rounded-lg px-4 py-2.5 shadow-gold flex items-center gap-2 text-sm font-medium">
            <Pause className="h-4 w-4" />
            <span>
              Pausando el avatar en <strong>{idleWarning}s</strong> por inactividad. Mové el mouse o
              escribí para mantenerlo activo.
            </span>
          </div>
        )}

        {/* Top-right controls (Terminar + Mostrar chat cuando está oculto) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="h-10 px-4 rounded-md bg-gray-900/80 hover:bg-gray-900 text-white text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm border border-gray-700 hover:border-yellow-500/40"
              title="Mostrar chat"
            >
              <MessageSquare className="h-4 w-4 text-yellow-500" />
              Chat
            </button>
          )}
          <button
            onClick={endSession}
            disabled={ending}
            className="h-10 px-4 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 shadow-lg"
          >
            <X className="h-4 w-4" />
            Terminar
          </button>
        </div>

        {/* Error banner */}
        {avatarError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] bg-red-950/95 border border-red-800 rounded-lg px-4 py-3 flex items-start gap-2 backdrop-blur-sm shadow-xl">
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
      </div>
    </div>
  );
};

export default LearningSession;
