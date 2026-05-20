import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
	ArrowLeft,
	Mic,
	MicOff,
	Send,
	X,
	Loader2,
	AlertCircle,
	MessageSquare,
	Pause,
	Play,
	BookOpen,
	Search,
	RotateCcw,
	Settings,
} from "lucide-react";
import { toast } from "sonner";
import LearningSessionConnector from "./LearningSessionConnector";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Idle / pause-to-save-credits config
const IDLE_BEFORE_WARNING_MS = 90 * 1000; // 1:30 sin interacción → warning
const WARNING_COUNTDOWN_SEC = 30; // 30s para responder antes de pausar

const STATUS_BADGE = {
	connecting: {
		label: "Conectando",
		cls: "bg-blue-500/20 text-blue-300 border-blue-500/40",
		dot: "bg-blue-400 animate-pulse",
	},
	ready: {
		label: "EN VIVO",
		cls: "bg-red-500/20 text-red-300 border-red-500/40",
		dot: "bg-red-500 animate-pulse",
	},
	speaking: {
		label: "Hablando",
		cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
		dot: "bg-yellow-400 animate-pulse",
	},
	idle: {
		label: "Inactivo",
		cls: "bg-gray-500/20 text-gray-300 border-gray-500/40",
		dot: "bg-gray-400",
	},
	error: {
		label: "Error",
		cls: "bg-red-500/30 text-red-200 border-red-500/60",
		dot: "bg-red-500",
	},
};

export const LearningSession = () => {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const moduleId = searchParams.get("module");

	const videoRef = useRef(null);
	const audioRef = useRef(null);
	const roomRef = useRef(null);
	const mediaRecorderRef = useRef(null);
	const mediaStreamRef = useRef(null);
	const audioChunksRef = useRef([]);
	const recognitionRef = useRef(null);
	const liveTranscriptRef = useRef(""); // texto del browser STT (para usarlo en lugar de Whisper)
	const messagesEndRef = useRef(null);
	const avatarSessionRef = useRef(null);
	// VAD (Voice Activity Detection) refs — modo conversación natural
	const vadStreamRef = useRef(null);
	const vadCtxRef = useRef(null);
	const vadAnalyserRef = useRef(null);
	const vadBufRef = useRef(null);
	const vadRafRef = useRef(null);
	const vadSpeechStartRef = useRef(0);
	const vadSilenceTimerRef = useRef(null);
	const vadStartingRef = useRef(false);
	const usingVadStreamRef = useRef(false);
	const avatarStatusRef = useRef("idle");
	const listeningRef = useRef(false);
	const sendingRef = useRef(false);
	const autoModeRef = useRef(false);

	// Si el backend devuelve provider="elevenlabs_connector" en avatar_session,
	// el flujo cambia radicalmente (no hay Whisper, ni VAD, ni sendMessage manual
	// — ElevenLabs maneja todo). En ese caso renderizamos el componente
	// LearningSessionConnector y salimos antes de tocar el resto del flujo legacy.
	const [connectorSession, setConnectorSession] = useState(null);

	const [sessionId, setSessionId] = useState(null);
	const [moduleData, setModuleData] = useState(null);
	const [avatarStatus, setAvatarStatus] = useState("idle");
	const [avatarError, setAvatarError] = useState(null);
	const [chatOpen, setChatOpen] = useState(false);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [listening, setListening] = useState(false);
	const [liveTranscript, setLiveTranscript] = useState("");
	const [ending, setEnding] = useState(false);
	const [evaluation, setEvaluation] = useState(null);
	const [idleWarning, setIdleWarning] = useState(0); // segundos restantes; 0 = sin warning
	const [paused, setPaused] = useState(false);
	const [resuming, setResuming] = useState(false);
	// Default a MANUAL: push-to-talk es más predecible y evita falsos disparos
	// del VAD. El usuario puede pasar a Auto desde el toggle si lo prefiere,
	// y la elección queda persistida en localStorage.
	const [autoMode, setAutoMode] = useState(() => {
		try {
			return localStorage.getItem("learning_auto_mode") === "1";
		} catch {
			return false;
		}
	});
	const [voiceLevel, setVoiceLevel] = useState(0);
	const [showHeadphonesTip, setShowHeadphonesTip] = useState(
		() => !localStorage.getItem("learning_headphones_tip_dismissed"),
	);
	const idleTimerRef = useRef(null);
	const countdownIntervalRef = useRef(null);
	const pausedRef = useRef(false);

	// UX additions:
	// - pendingTranscript: muestra lo que Whisper/STT entendió para confirmar/editar
	//   antes de mandarlo al LLM (~3s countdown auto-send)
	// - showSettings: panel lateral con sliders del VAD + velocidad TTS
	// - ttsSpeed: playbackRate del <audio> que renderiza al avatar (0.8 a 1.4)
	const [pendingTranscript, setPendingTranscript] = useState(null); // {text, expiresAt}
	const [showSettings, setShowSettings] = useState(false);
	const [ttsSpeed, setTtsSpeed] = useState(() => {
		const stored = parseFloat(localStorage.getItem("learning_tts_speed") || "1");
		return isNaN(stored) ? 1 : Math.max(0.7, Math.min(1.5, stored));
	});
	const lastAssistantTextRef = useRef("");

	// Aplicamos la velocidad al elemento <audio> en cada cambio. LiveAvatar
	// renderiza audio del avatar a través de ese elemento, así que cambiar
	// `playbackRate` afecta la velocidad percibida del TTS sin tocar la API
	// del backend.
	useEffect(() => {
		if (audioRef.current) audioRef.current.playbackRate = ttsSpeed;
		try { localStorage.setItem("learning_tts_speed", String(ttsSpeed)); } catch { /* ignore */ }
	}, [ttsSpeed]);

	// Auto-send del pendingTranscript después de PENDING_SEND_DELAY_MS si el
	// usuario no lo edita ni lo cancela. Solo aparece para el fallback de Whisper
	// (donde el usuario no tuvo preview), así que bajamos el delay para no
	// agregar latencia perceptible al turno.
	const PENDING_SEND_DELAY_MS = 1200;
	useEffect(() => {
		if (!pendingTranscript?.text) return;
		const t = setTimeout(() => {
			const txt = pendingTranscript.text;
			setPendingTranscript(null);
			if (txt && txt.trim()) sendMessage(txt.trim());
		}, PENDING_SEND_DELAY_MS);
		return () => clearTimeout(t);
	}, [pendingTranscript?.text, pendingTranscript?.nonce]);

	// confirmAndSend: si la transcripción vino del browser STT, el usuario ya
	// la vio en vivo en el overlay inferior — mandamos directo sin confirmar
	// para que el avatar responda apenas el usuario termina de hablar. El
	// confirmador solo aparece para el fallback de Whisper (donde no hubo
	// preview en vivo) y para textos largos donde una corrección puede importar.
	const confirmAndSend = (text, source = "whisper") => {
		const t = (text || "").trim();
		if (!t) return;
		if (source === "browser") {
			sendMessage(t);
			return;
		}
		if (t.length < 6) {
			sendMessage(t);
			return;
		}
		setPendingTranscript({ text: t, nonce: Date.now() });
	};

	const headers = () => ({
		Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
	});

	// Sincronizar refs con states para que el VAD loop (RAF) lea valores frescos
	// sin tener que re-suscribir el closure cada render.
	useEffect(() => {
		avatarStatusRef.current = avatarStatus;
	}, [avatarStatus]);
	useEffect(() => {
		listeningRef.current = listening;
	}, [listening]);
	useEffect(() => {
		sendingRef.current = sending;
	}, [sending]);
	useEffect(() => {
		autoModeRef.current = autoMode;
		try {
			localStorage.setItem("learning_auto_mode", autoMode ? "1" : "0");
		} catch {
			/* ignore */
		}
	}, [autoMode]);

	const _newEventId = () =>
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

	const _publishAgentControl = async (room, payload) => {
		if (!room) return;
		try {
			const data = new TextEncoder().encode(JSON.stringify(payload));
			await room.localParticipant.publishData(data, {
				reliable: true,
				topic: "agent-control",
			});
		} catch (e) {
			console.warn("[liveavatar] publishData failed", e);
		}
	};

	// Envía el comando avatar.speak_text al topic agent-control para que el avatar
	// hable un texto custom (generado por nuestro LLM con RAG).
	const speakViaAvatar = async (room, avatarSessionId, text) => {
		if (!room || !text || !avatarSessionId) return;
		// Garantizar que el audio esté desmuteado y reproduciendo justo antes de
		// que el avatar hable. Cubre el caso en que la grabación previa lo dejó
		// muteado o pausado y muteAvatar(false) no llegó a ejecutarse a tiempo.
		muteAvatar(false);
		await _publishAgentControl(room, {
			event_id: _newEventId(),
			event_type: "avatar.speak_text",
			session_id: avatarSessionId,
			source_event_id: null,
			text,
		});
	};

	// Barge-in: corta inmediatamente lo que el avatar esté diciendo. Lo usamos
	// cuando el usuario presiona el mic para que pueda preguntar de nuevo sin
	// esperar que termine la respuesta anterior. Manda dos eventos por compatibilidad
	// Repite la última respuesta del avatar (sin pasar por el LLM otra vez).
	// El texto está guardado en lastAssistantTextRef y se manda al canal de TTS.
	const repeatLastAvatarMessage = async () => {
		const text = lastAssistantTextRef.current?.trim();
		if (!text) {
			toast.info("Todavía no hay respuesta para repetir.");
			return;
		}
		const room = roomRef.current;
		const avatarSessionId = avatarSessionRef.current?.session_id;
		if (!room || !avatarSessionId) {
			toast.error("El avatar no está conectado.");
			return;
		}
		await speakViaAvatar(room, avatarSessionId, text);
	};

	// entre versiones de LiveAvatar (algunas usan 'avatar.interrupt', otras 'avatar.stop').
	const interruptAvatar = async () => {
		const room = roomRef.current;
		const avatarSessionId = avatarSessionRef.current?.session_id;
		if (!room || !avatarSessionId) return;
		const base = {
			session_id: avatarSessionId,
			source_event_id: null,
		};
		await _publishAgentControl(room, {
			...base,
			event_id: _newEventId(),
			event_type: "avatar.interrupt",
		});
		await _publishAgentControl(room, {
			...base,
			event_id: _newEventId(),
			event_type: "avatar.stop_speaking",
		});
	};

	// ============ VAD (Voice Activity Detection) — modo conversación natural ============
	// Detecta cuándo el usuario empieza y termina de hablar, sin botón. Cubre:
	// - inicio de turno: energía RMS > umbral por al menos VAD_SPEECH_START_MS
	// - fin de turno: energía < umbral por al menos VAD_SILENCE_END_MS
	// - barge-in: si el avatar está hablando, igual detecta voz del usuario y corta
	//   la respuesta (con umbral más alto para ignorar el eco residual)

	// Sensibilidad del VAD ajustable por el usuario (persistida en localStorage).
	// Defaults pensados para minimizar latencia percibida sin sacrificar precisión:
	//   - speechStartMs 250: balance entre responsividad y tolerar tos/ruido.
	//   - silenceEndMs 450: cierra el turno apenas el usuario hace una pausa
	//     natural (antes 700ms agregaba ~250ms muertos por turno).
	// VAD_SETTINGS_VERSION sube cuando los defaults cambian, así invalidamos
	// los valores cacheados en localStorage de usuarios que ya tenían settings
	// viejos. Sin esto, los usuarios existentes seguirían con 700ms.
	const VAD_DEFAULTS = { speechStartMs: 250, silenceEndMs: 450, thresholdBase: 0.022, thresholdTts: 0.06 };
	const VAD_SETTINGS_VERSION = 2;
	const [vadSettings, setVadSettings] = useState(() => {
		try {
			const raw = localStorage.getItem('learning_vad_settings');
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed && parsed._v === VAD_SETTINGS_VERSION) {
					const { _v, ...rest } = parsed;
					return { ...VAD_DEFAULTS, ...rest };
				}
			}
		} catch { /* ignore */ }
		return VAD_DEFAULTS;
	});
	const vadSettingsRef = useRef(vadSettings);
	useEffect(() => {
		vadSettingsRef.current = vadSettings;
		try {
			localStorage.setItem(
				'learning_vad_settings',
				JSON.stringify({ ...vadSettings, _v: VAD_SETTINGS_VERSION }),
			);
		} catch { /* ignore */ }
	}, [vadSettings]);

	// Helpers que LEEN siempre desde el ref para que el cambio sea instantáneo
	// dentro del loop rAF (el closure original quedaría con valores stale).
	const getVadSpeechStartMs = () => vadSettingsRef.current.speechStartMs;
	const getVadSilenceEndMs = () => vadSettingsRef.current.silenceEndMs;
	const getVadThresholdBase = () => vadSettingsRef.current.thresholdBase;
	const getVadThresholdDuringTts = () => vadSettingsRef.current.thresholdTts;

	const _computeRms = (buf) => {
		let sum = 0;
		for (let i = 0; i < buf.length; i++) {
			const v = (buf[i] - 128) / 128; // Uint8 → -1..1
			sum += v * v;
		}
		return Math.sqrt(sum / buf.length);
	};

	const vadTick = () => {
		const analyser = vadAnalyserRef.current;
		const buf = vadBufRef.current;
		if (!analyser || !buf) return;

		analyser.getByteTimeDomainData(buf);
		const rms = _computeRms(buf);
		setVoiceLevel(Math.min(rms * 5, 1));

		if (autoModeRef.current && !pausedRef.current) {
			const isAvatarTTS = avatarStatusRef.current === "speaking";
			const threshold = isAvatarTTS
				? getVadThresholdDuringTts()
				: getVadThresholdBase();
			const isSpeech = rms > threshold;

			if (
				!listeningRef.current &&
				!sendingRef.current &&
				!vadStartingRef.current
			) {
				// En espera — buscamos onset de voz
				if (isSpeech) {
					if (!vadSpeechStartRef.current)
						vadSpeechStartRef.current = performance.now();
					if (
						performance.now() - vadSpeechStartRef.current >
						getVadSpeechStartMs()
					) {
						vadSpeechStartRef.current = 0;
						vadStartingRef.current = true;
						startListening().finally(() => {
							vadStartingRef.current = false;
						});
					}
				} else {
					vadSpeechStartRef.current = 0;
				}
			} else if (listeningRef.current) {
				// Grabando — buscamos silencio sostenido para terminar el turno
				if (!isSpeech) {
					if (!vadSilenceTimerRef.current) {
						vadSilenceTimerRef.current = setTimeout(() => {
							vadSilenceTimerRef.current = null;
							if (listeningRef.current) stopListening();
						}, getVadSilenceEndMs());
					}
				} else if (vadSilenceTimerRef.current) {
					clearTimeout(vadSilenceTimerRef.current);
					vadSilenceTimerRef.current = null;
				}
			}
		}

		vadRafRef.current = requestAnimationFrame(vadTick);
	};

	const enableAutoMode = async () => {
		if (vadStreamRef.current) return; // ya activo
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			vadStreamRef.current = stream;

			const Ctx = window.AudioContext || window.webkitAudioContext;
			const ctx = new Ctx();
			// Si el AudioContext está suspended (autoplay policy), reanudamos
			if (ctx.state === "suspended") {
				try {
					await ctx.resume();
				} catch {}
			}
			const source = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 1024;
			analyser.smoothingTimeConstant = 0.4;
			source.connect(analyser);
			vadCtxRef.current = ctx;
			vadAnalyserRef.current = analyser;
			vadBufRef.current = new Uint8Array(analyser.fftSize);

			console.info("[vad] auto mode enabled");
			vadRafRef.current = requestAnimationFrame(vadTick);
		} catch (err) {
			console.warn("[vad] enableAutoMode failed", err);
			setAutoMode(false);
			vadStreamRef.current = null;
			if (err?.name === "NotAllowedError") {
				toast.error("Permitime usar el micrófono para conversar con el tutor.");
			} else {
				toast.error(
					"No pude activar el modo conversación. Usá el botón manual.",
				);
			}
		}
	};

	const disableAutoMode = () => {
		if (vadRafRef.current) {
			cancelAnimationFrame(vadRafRef.current);
			vadRafRef.current = null;
		}
		if (vadSilenceTimerRef.current) {
			clearTimeout(vadSilenceTimerRef.current);
			vadSilenceTimerRef.current = null;
		}
		vadSpeechStartRef.current = 0;
		vadStartingRef.current = false;
		setVoiceLevel(0);
		try {
			vadAnalyserRef.current?.disconnect();
		} catch {}
		vadAnalyserRef.current = null;
		vadBufRef.current = null;
		try {
			vadCtxRef.current?.close();
		} catch {}
		vadCtxRef.current = null;
		// Si una grabación está usando este stream (vad), no la cortamos acá:
		// se cerrará en recorder.onstop. Si no hay grabación activa, liberamos ya.
		if (!usingVadStreamRef.current) {
			try {
				vadStreamRef.current?.getTracks().forEach((t) => t.stop());
			} catch {}
			vadStreamRef.current = null;
		}
		console.info("[vad] auto mode disabled");
	};

	// Encender/apagar VAD según toggle de autoMode + estado de la sesión
	useEffect(() => {
		const ready =
			!!sessionId && (avatarStatus === "ready" || avatarStatus === "speaking");
		if (autoMode && ready && !paused) {
			enableAutoMode();
		} else if (!autoMode || paused) {
			disableAutoMode();
		}
	}, [autoMode, sessionId, avatarStatus, paused]);

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
		setAvatarStatus("idle");
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
		const events = ["mousemove", "mousedown", "keydown", "touchstart"];
		const handler = () => resetIdleTimer();
		events.forEach((ev) =>
			window.addEventListener(ev, handler, { passive: true }),
		);
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
				throw new Error(data.avatar_error || "No se obtuvo sesión de avatar");
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
				const otherSpeaking = speakers.some(
					(p) => p.identity !== room.localParticipant?.identity,
				);
				setAvatarStatus(otherSpeaking ? "speaking" : "ready");
			});
			room.on(RoomEvent.Disconnected, () => setAvatarStatus("idle"));

			setAvatarStatus("connecting");
			await room.connect(livekit_url, livekit_token);
			setAvatarStatus("ready");
			pausedRef.current = false;
			setPaused(false);
			resetIdleTimer();
			toast.success("Avatar reactivado");
		} catch (err) {
			const detail =
				err.response?.data?.detail ||
				err.message ||
				"Error reactivando el avatar";
			toast.error(detail);
			setAvatarError(detail);
			setAvatarStatus("error");
		} finally {
			setResuming(false);
		}
	};

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				setAvatarStatus("connecting");
				const { data } = await axios.post(
					`${API}/learning/sessions`,
					{ module_id: moduleId || null },
					{ headers: headers() },
				);
				if (cancelled) return;

				// Si el backend está en modo Connector (LEARNING_USE_ELEVENLABS=true),
				// el response trae avatar_session.provider="elevenlabs_connector".
				// Cambiamos a un componente totalmente distinto y salimos de este
				// useEffect ANTES de inicializar el pipeline legacy (mic recorder,
				// VAD, Whisper, etc.).
				if (data?.avatar_session?.provider === "elevenlabs_connector") {
					setConnectorSession(data);
					return;
				}

				setSessionId(data.session_id);
				setModuleData(data.module);
				if (data.opening_text) {
					setMessages([{ role: "assistant", content: data.opening_text }]);
				}

				if (!data.avatar_session) {
					const errMsg = data.avatar_error || "No se obtuvo sesión de avatar";
					setAvatarError(errMsg);
					setAvatarStatus("error");
					toast.error("Avatar no disponible: continúa en modo solo texto");
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
					const otherSpeaking = speakers.some(
						(p) => p.identity !== room.localParticipant?.identity,
					);
					setAvatarStatus(otherSpeaking ? "speaking" : "ready");
				});
				room.on(RoomEvent.Disconnected, () => {
					setAvatarStatus("idle");
				});
				room.on(RoomEvent.ConnectionStateChanged, (state) => {
					console.log("[livekit] connection state:", state);
				});

				try {
					await room.connect(livekit_url, livekit_token);
					setAvatarStatus("ready");
					resetIdleTimer();
					if (data.opening_text) {
						await speakViaAvatar(
							room,
							data.avatar_session.session_id,
							data.opening_text,
						);
					}
				} catch (connErr) {
					const detail = connErr?.message || String(connErr);
					setAvatarError(`LiveKit no pudo conectar: ${detail}`);
					setAvatarStatus("error");
					console.error("[livekit.connect]", connErr);
				}
			} catch (err) {
				const detail =
					err.response?.data?.detail ||
					err.message ||
					"Error iniciando la sesión";
				setAvatarError(detail);
				setAvatarStatus("error");
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
			try {
				recognitionRef.current?.stop();
			} catch {}
			// VAD cleanup
			if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
			if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
			try {
				vadCtxRef.current?.close();
			} catch {}
			try {
				vadStreamRef.current?.getTracks().forEach((t) => t.stop());
			} catch {}
			vadCtxRef.current = null;
			vadStreamRef.current = null;
		};
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Manda el mensaje vía streaming SSE: cada oración que va llegando del LLM
	// se le envía al avatar para TTS apenas se completa, en vez de esperar el
	// mensaje entero. Reduce el delay percibido de ~3s a ~600ms.
	const sendMessage = async (text) => {
		const clean = (text || "").trim();
		if (!clean || sending || !sessionId) return;
		resetIdleTimer();

		// Capturamos el historial reciente ANTES de agregar el mensaje del usuario,
		// así el backend recibe el contexto previo y no necesita consultar la BD.
		// Esto ahorra ~150-300ms por turno.
		const priorHistory = messages
			.filter((m) => m.role === "user" || m.role === "assistant")
			.slice(-9)
			.map((m) => ({ role: m.role, content: m.content }));

		setMessages((prev) => [...prev, { role: "user", content: clean }]);
		setInput("");
		setSending(true);

		const room = roomRef.current;
		const avatarSessionId = avatarSessionRef.current?.session_id;

		let buffer = ""; // texto pendiente de mandar al avatar
		let fullText = ""; // todo lo que llevamos generado
		let firstChunkSent = false; // ¿ya mandamos el primer chunk al avatar?
		let assistantPushed = false;
		let metaSources = [];
		let metaRagSkipped = false;

		// Manda al avatar oraciones completas (corta en . ! ? \n). Para el PRIMER
		// chunk somos más agresivos: cortamos también en coma/punto-y-coma si el
		// buffer ya tiene >= 25 chars, para que el avatar arranque a hablar antes.
		// Tras el primer chunk volvemos al modo conservador (oraciones completas).
		const flushBuffer = (force = false) => {
			while (buffer.length > 0) {
				// 1) Corte fuerte: punto / pregunta / exclamación / nueva línea
				let m = buffer.match(/^([\s\S]+?[.!?\n])(\s|$)/);
				if (m) {
					const piece = m[1].trim();
					buffer = buffer.slice(m[0].length);
					if (piece && room && room.state === "connected" && avatarSessionId) {
						speakViaAvatar(room, avatarSessionId, piece);
						firstChunkSent = true;
					}
					continue;
				}
				// 2) Para el primer chunk, corte suave en coma/punto-y-coma si ya
				//    hay material razonable. Acelera el time-to-first-audio del avatar.
				if (!firstChunkSent && buffer.length > 25) {
					m = buffer.match(/^([\s\S]+?[,;:])(\s)/);
					if (m) {
						const piece = m[1].trim();
						buffer = buffer.slice(m[0].length);
						if (
							piece &&
							room &&
							room.state === "connected" &&
							avatarSessionId
						) {
							speakViaAvatar(room, avatarSessionId, piece);
							firstChunkSent = true;
						}
						continue;
					}
				}
				// 3) Force al final del stream: mandamos lo que quede
				if (force) {
					const tail = buffer.trim();
					buffer = "";
					if (tail && room && room.state === "connected" && avatarSessionId) {
						speakViaAvatar(room, avatarSessionId, tail);
						firstChunkSent = true;
					}
					continue;
				}
				// 4) Hard cut a los 180 chars sin puntuación
				if (buffer.length > 180) {
					const cut = buffer.slice(0, 180);
					buffer = buffer.slice(180);
					if (
						cut.trim() &&
						room &&
						room.state === "connected" &&
						avatarSessionId
					) {
						speakViaAvatar(room, avatarSessionId, cut.trim());
						firstChunkSent = true;
					}
					continue;
				}
				break;
			}
		};

		// Crea/actualiza el último mensaje del avatar con el texto acumulado
		const upsertAssistantMessage = () => {
			setMessages((prev) => {
				const next = [...prev];
				if (
					assistantPushed &&
					next.length > 0 &&
					next[next.length - 1].role === "assistant" &&
					next[next.length - 1]._streaming
				) {
					next[next.length - 1] = {
						...next[next.length - 1],
						content: fullText,
						sources: metaSources,
						ragSkipped: metaRagSkipped,
					};
				} else {
					next.push({
						role: "assistant",
						content: fullText,
						sources: metaSources,
						ragSkipped: metaRagSkipped,
						_streaming: true,
					});
					assistantPushed = true;
				}
				return next;
			});
		};

		try {
			const resp = await fetch(
				`${API}/learning/sessions/${sessionId}/message_stream`,
				{
					method: "POST",
					headers: { ...headers(), "Content-Type": "application/json" },
					body: JSON.stringify({ text: clean, recent_messages: priorHistory }),
				},
			);
			if (!resp.ok) {
				const errBody = await resp.text();
				throw new Error(errBody || `HTTP ${resp.status}`);
			}
			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			let leftover = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				const lines = (leftover + chunk).split("\n");
				leftover = lines.pop() || "";
				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const json = line.slice(6).trim();
					if (!json) continue;
					let evt;
					try {
						evt = JSON.parse(json);
					} catch {
						continue;
					}

					if (evt.type === "meta") {
						metaSources = Array.isArray(evt.retrieved_chunks)
							? evt.retrieved_chunks
							: [];
						metaRagSkipped = !!evt.rag_skipped;
					} else if (evt.type === "token") {
						const t = evt.text || "";
						fullText += t;
						buffer += t;
						upsertAssistantMessage();
						flushBuffer(false);
					} else if (evt.type === "error") {
						toast.error(evt.detail || "Error generando respuesta");
					} else if (evt.type === "done") {
						if (evt.text) fullText = evt.text;
						flushBuffer(true);
						upsertAssistantMessage();
					}
				}
			}
			// Marcar el mensaje como no-streaming al final + recordar el texto
			// para el botón "Repetir" del avatar.
			setMessages((prev) => {
				const next = [...prev];
				if (
					next.length > 0 &&
					next[next.length - 1].role === "assistant" &&
					next[next.length - 1]._streaming
				) {
					const { _streaming, ...rest } = next[next.length - 1];
					next[next.length - 1] = rest;
					lastAssistantTextRef.current = rest.content || "";
				}
				return next;
			});
		} catch (err) {
			console.error("[sendMessage] stream error", err);
			toast.error(err.message || "Error enviando mensaje");
		} finally {
			setSending(false);
		}
	};

	const muteAvatar = (muted) => {
		if (audioRef.current) {
			audioRef.current.muted = muted;
			// Al desmutear, reanudar reproducción si quedó pausado tras la grabación.
			// Sin esto, el navegador a veces deja el <audio> en estado paused y los
			// siguientes turnos del avatar muestran labios moviéndose sin sonido.
			if (!muted && audioRef.current.paused) {
				audioRef.current
					.play()
					.catch((e) => console.warn("[muteAvatar] audio resume failed", e));
			}
		}
		if (videoRef.current) {
			videoRef.current.muted = muted;
			if (!muted && videoRef.current.paused) {
				videoRef.current.play().catch(() => {});
			}
		}
	};

	// Preview en vivo de la transcripción usando Web Speech API del navegador.
	// SOLO sirve para mostrar texto mientras el usuario habla — el texto final
	// que va al LLM viene de Whisper (más preciso). Si el navegador no soporta
	// SpeechRecognition, simplemente no hay preview pero la grabación sigue.
	//
	// IMPORTANTE: hay que arrancar esto ANTES de que MediaRecorder pida el
	// stream con getUserMedia. Si MediaRecorder toma el micrófono primero,
	// Chrome no logra inicializar la sesión de SpeechRecognition (queda silenciosa
	// sin disparar onresult).
	const startLivePreview = () => {
		const Recognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!Recognition) {
			console.info(
				"[live-preview] navegador sin SpeechRecognition; preview deshabilitado",
			);
			return;
		}
		// Limpiar instancia previa para evitar dobles handlers
		if (recognitionRef.current) {
			try {
				recognitionRef.current.stop();
			} catch {}
			recognitionRef.current = null;
		}
		try {
			const rec = new Recognition();
			rec.lang = "es-ES";
			rec.continuous = true;
			rec.interimResults = true;
			rec.maxAlternatives = 1;
			let finalSoFar = "";
			rec.onstart = () => console.info("[live-preview] started");
			rec.onaudiostart = () =>
				console.info("[live-preview] audio capture started");
			rec.onspeechstart = () => console.info("[live-preview] speech detected");
			rec.onresult = (e) => {
				let interim = "";
				for (let i = e.resultIndex; i < e.results.length; i++) {
					const r = e.results[i];
					if (r.isFinal) finalSoFar += r[0].transcript + " ";
					else interim += r[0].transcript;
				}
				const merged = (finalSoFar + interim).trim();
				liveTranscriptRef.current = merged; // accesible desde recorder.onstop
				setLiveTranscript(merged);
			};
			rec.onerror = (e) => {
				// 'no-speech' y 'aborted' son normales y no críticos.
				if (e.error !== "no-speech" && e.error !== "aborted") {
					console.warn("[live-preview] recognition error:", e.error, e);
				}
			};
			rec.onend = () => console.info("[live-preview] ended");
			rec.start();
			recognitionRef.current = rec;
		} catch (err) {
			console.warn("[live-preview] failed to start:", err);
			recognitionRef.current = null;
		}
	};

	const stopLivePreview = () => {
		const rec = recognitionRef.current;
		recognitionRef.current = null;
		if (!rec) return;
		try {
			rec.onresult = null;
			rec.onerror = null;
			rec.onend = null;
			rec.stop();
		} catch {}
	};

	// Graba audio con MediaRecorder y al detener lo manda a Whisper (backend)
	// para transcribir. Más confiable que Web Speech API en español, no depende
	// del navegador y silencia el avatar para que su voz no entre al micrófono.
	// En paralelo arranca un preview con Web Speech API solo para mostrar texto
	// mientras el usuario habla.
	const startListening = async () => {
		if (!sessionId) {
			toast.error("La sesión no está lista todavía.");
			return;
		}
		if (!navigator.mediaDevices?.getUserMedia) {
			toast.error("Tu navegador no soporta grabación de audio.");
			return;
		}

		// Barge-in: si el avatar está hablando, lo cortamos antes de empezar a
		// grabar para que el usuario pueda hacer su nueva pregunta sin esperar.
		interruptAvatar();

		// Arrancamos el preview ANTES de getUserMedia para que Chrome no bloquee
		// la sesión de SpeechRecognition cuando MediaRecorder ya tomó el mic.
		setLiveTranscript("");
		startLivePreview();

		try {
			// Si VAD está activo, reusamos su stream — abrir un segundo getUserMedia
			// mientras hay uno activo es flaky en Chrome.
			let stream;
			if (vadStreamRef.current) {
				stream = vadStreamRef.current;
				usingVadStreamRef.current = true;
			} else {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
					},
				});
				mediaStreamRef.current = stream;
				usingVadStreamRef.current = false;
			}

			// Elegimos el mejor mime que soporte el navegador
			const candidates = [
				"audio/webm;codecs=opus",
				"audio/webm",
				"audio/ogg;codecs=opus",
				"audio/mp4",
			];
			const mime =
				candidates.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ||
				"";

			const recorder = mime
				? new MediaRecorder(stream, { mimeType: mime })
				: new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;
			audioChunksRef.current = [];

			recorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
			};

			recorder.onerror = (e) => {
				console.error("[recorder] error", e);
				toast.error("Error grabando el audio.");
				cleanupRecording();
			};

			recorder.onstop = async () => {
				// Solo cerramos el stream si era propio (modo manual). Si estábamos
				// reusando el stream del VAD, lo dejamos vivo para seguir escuchando.
				if (!usingVadStreamRef.current) {
					const tracks = mediaStreamRef.current?.getTracks() || [];
					tracks.forEach((t) => t.stop());
					mediaStreamRef.current = null;
				}
				usingVadStreamRef.current = false;
				muteAvatar(false);
				setListening(false);

				// Esperamos brevemente a que SpeechRecognition emita los resultados
				// finales pendientes (palabras del final del turno). 100ms es un
				// balance — la mayoría de las veces el final ya llegó.
				await new Promise((r) => setTimeout(r, 100));

				// Capturamos lo que el browser STT alcanzó a transcribir ANTES de
				// limpiar el preview, así no se pierde si el ref se reinicia.
				const browserText = (liveTranscriptRef.current || "").trim();
				liveTranscriptRef.current = "";
				stopLivePreview();
				setLiveTranscript("");

				const blob = new Blob(audioChunksRef.current, {
					type: recorder.mimeType || "audio/webm",
				});
				audioChunksRef.current = [];

				// Atajo de latencia: si el browser ya transcribió algo razonable,
				// usamos eso directamente y nos saltamos el upload + Whisper. Ahorra
				// ~700-1500ms por turno. Whisper queda como fallback si:
				//   - El navegador no soporta Web Speech API (Firefox, Safari)
				//   - El usuario habló demasiado bajo y SpeechRecognition no captó nada
				//   - El texto es muy corto (probablemente un falso positivo)
				if (browserText && browserText.length >= 4) {
					console.info(
						"[transcribe] using browser STT (skipping Whisper):",
						browserText,
					);
					confirmAndSend(browserText, "browser");
					return;
				}

				// Fallback: si no hay audio grabado tampoco podemos hacer Whisper
				if (blob.size < 1000) {
					toast.info(
						"No detecté audio. Probá hablar un poco más cerca del micrófono.",
					);
					return;
				}

				console.info("[transcribe] browser STT empty, falling back to Whisper");
				setSending(true);
				try {
					const ext = (recorder.mimeType || "").includes("mp4")
						? "mp4"
						: (recorder.mimeType || "").includes("ogg")
							? "ogg"
							: "webm";
					const form = new FormData();
					form.append("audio", blob, `nota.${ext}`);

					const { data } = await axios.post(
						`${API}/learning/sessions/${sessionId}/transcribe`,
						form,
						{
							headers: { ...headers(), "Content-Type": "multipart/form-data" },
						},
					);
					const text = (data?.text || "").trim();
					if (!text) {
						toast.info("No pude transcribir nada del audio.");
						setSending(false);
						return;
					}
					setSending(false);
					confirmAndSend(text);
				} catch (err) {
					setSending(false);
					const detail =
						err.response?.data?.detail ||
						err.message ||
						"Error transcribiendo el audio";
					toast.error(detail);
				}
			};

			muteAvatar(true);
			recorder.start();
			setListening(true);
		} catch (err) {
			console.error("[recorder] getUserMedia failed", err);
			cleanupRecording();
			if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
				toast.error(
					"Permiso de micrófono denegado. Habilitalo en el candado del navegador.",
				);
			} else if (
				err?.name === "NotFoundError" ||
				err?.name === "OverconstrainedError"
			) {
				toast.error("No hay micrófono disponible.");
			} else {
				toast.error("No se pudo iniciar la grabación.");
			}
		}
	};

	const stopListening = () => {
		const rec = mediaRecorderRef.current;
		if (rec && rec.state !== "inactive") {
			try {
				rec.stop();
			} catch (e) {
				console.warn("[recorder] stop failed", e);
				cleanupRecording();
			}
		} else {
			cleanupRecording();
		}
	};

	const cleanupRecording = () => {
		if (!usingVadStreamRef.current) {
			try {
				mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
			} catch {}
			mediaStreamRef.current = null;
		}
		usingVadStreamRef.current = false;
		audioChunksRef.current = [];
		muteAvatar(false);
		setListening(false);
		stopLivePreview();
		setLiveTranscript("");
		liveTranscriptRef.current = "";
	};

	const endSession = async () => {
		if (!sessionId) return navigate("/admin/learning");
		if (!window.confirm("¿Terminar la sesión?")) return;
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
				navigate("/admin/learning");
			}
		} catch {
			toast.error("Error terminando la sesión");
		} finally {
			setEnding(false);
		}
	};

	// Flujo Connector: si el backend devolvió ese provider, delegamos todo a
	// LearningSessionConnector — el componente legacy no monta su pipeline.
	if (connectorSession) {
		return (
			<LearningSessionConnector
				sessionData={connectorSession}
				onEnd={() => navigate("/admin/learning")}
			/>
		);
	}

	if (evaluation) {
		return (
			<div className="bg-white min-h-screen p-6">
				<Card className="max-w-2xl mx-auto">
					<CardContent className="pt-6 space-y-6">
						<h2 className="text-2xl font-bold">Resultado de tu sesión</h2>
						<div className="text-center py-6 bg-gray-50 rounded-lg">
							<div className="text-6xl font-bold text-yellow-500">
								{evaluation.score ?? "—"}
							</div>
							<div className="text-sm text-gray-500 mt-1">de 100</div>
						</div>
						<div>
							<h3 className="font-semibold mb-2">Retroalimentación</h3>
							<p className="text-sm text-gray-700">{evaluation.feedback}</p>
						</div>
						{Array.isArray(evaluation.objectives_covered) &&
							evaluation.objectives_covered.length > 0 && (
								<div>
									<h3 className="font-semibold mb-2">Objetivos</h3>
									<ul className="space-y-1 text-sm">
										{evaluation.objectives_covered.map((o, i) => (
											<li key={i} className="flex items-start gap-2">
												<span
													className={
														o.covered ? "text-green-600" : "text-gray-400"
													}
												>
													{o.covered ? "✓" : "○"}
												</span>
												<span className="text-gray-700">
													{o.evidence || `Objetivo ${i + 1}`}
												</span>
											</li>
										))}
									</ul>
								</div>
							)}
						<div className="flex justify-end pt-2">
							<Button
								onClick={() => navigate("/admin/learning")}
								className="bg-yellow-500 hover:bg-yellow-600 text-black"
							>
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
								<h1 className="text-xl font-bold text-white">
									Tutor Virtual URPE
								</h1>
								<p className="text-sm text-gray-400 mt-1 leading-snug">
									Tu asistente de aprendizaje está listo para responder tus
									consultas.
								</p>
								<div className="mt-3 flex items-center gap-2">
									<span
										className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${status.cls}`}
									>
										<span
											className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
										/>
										{status.label}
									</span>
									<span className="text-xs text-gray-400 truncate">
										{moduleData?.title ||
											(moduleData?.mode === "guided"
												? "Modo guiado"
												: "Sesión libre")}
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
								const isUser = m.role === "user";
								return (
									<div
										key={i}
										className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
									>
										<div
											className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${
												isUser
													? "bg-gradient-to-br from-yellow-500 to-yellow-600 text-black font-medium shadow-gold"
													: "bg-gray-800/70 text-gray-100 border border-gray-700/60"
											}`}
										>
											{m.content}
										</div>
										<span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
											{isUser ? "Tú" : "Tutor URPE"}
										</span>
										{!isUser &&
											!m.ragSkipped &&
											Array.isArray(m.sources) &&
											(m.sources.length > 0 ? (
												<details className="mt-1 text-[11px] text-gray-400 max-w-[88%]">
													<summary className="cursor-pointer hover:text-yellow-500 inline-flex items-center gap-1 transition-colors">
														<BookOpen className="h-3 w-3" />
														{m.sources.length} fuente
														{m.sources.length > 1 ? "s" : ""} RAG
													</summary>
													<ul className="mt-1.5 space-y-1.5 pl-3 border-l-2 border-yellow-500/40">
														{m.sources.map((s, j) => (
															<li key={s.id || j} className="text-gray-300">
																<div className="flex items-center gap-1.5 text-yellow-500">
																	<span className="font-mono">
																		{s.similarity != null
																			? (s.similarity * 100).toFixed(0)
																			: "?"}
																		%
																	</span>
																	<span className="truncate">
																		{s.source || "documento"}
																	</span>
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
											))}
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
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										sendMessage(input);
									}
								}}
								placeholder={
									listening ? "Escuchando…" : "Escribí tu mensaje..."
								}
								disabled={sending || listening}
								className="flex-1 min-w-0 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none disabled:opacity-50"
							/>
							<button
								onClick={() => sendMessage(input)}
								disabled={sending || !input.trim()}
								title="Enviar"
								className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
							>
								{sending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-4 w-4" />
								)}
							</button>
						</div>
						<div className="flex items-center justify-between">
							<button
								type="button"
								onClick={listening ? stopListening : startListening}
								disabled={sending}
								title={listening ? "Detener micrófono" : "Hablar"}
								className={`h-10 w-10 flex items-center justify-center rounded-full transition-all shadow-lg ${
									listening
										? "bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/40"
										: "bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black ring-2 ring-yellow-500/30 hover:ring-yellow-500/60"
								}`}
							>
								{listening ? (
									<MicOff className="h-4 w-4" />
								) : (
									<Mic className="h-4 w-4" />
								)}
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
				{avatarStatus === "connecting" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/85 text-white z-10">
						<Loader2 className="h-12 w-12 animate-spin mb-3 text-yellow-500" />
						<div className="text-base font-medium">
							Conectando con el avatar…
						</div>
						<div className="text-sm text-gray-400 mt-1">
							Esto puede tomar unos segundos
						</div>
					</div>
				)}
				{avatarStatus === "error" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 text-white text-center p-8 z-10">
						<AlertCircle className="h-16 w-16 mb-4 text-red-500" />
						<div className="text-lg font-semibold">
							No se pudo conectar el avatar
						</div>
						<div className="text-sm text-gray-400 mt-2 max-w-md">
							Continúa la conversación por texto en el chat.
						</div>
					</div>
				)}
				{avatarStatus === "idle" && !avatarError && !paused && (
					<div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 text-gray-300 z-10">
						<div className="text-sm">Avatar inactivo</div>
					</div>
				)}
				{paused && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 text-white z-30 p-6 text-center">
						<Pause className="h-14 w-14 text-yellow-500 mb-3" />
						<div className="text-lg font-semibold">Tu tutor está en pausa</div>
						<div className="text-sm text-gray-400 mt-1 max-w-md">
							Pausamos al tutor tras un rato sin interacción para mantener la
							sesión liviana. Podés seguir consultando por chat y reactivar la
							conversación con voz cuando quieras retomarla.
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
							Pausando el avatar en <strong>{idleWarning}s</strong> por
							inactividad. Mové el mouse o escribí para mantenerlo activo.
						</span>
					</div>
				)}

				{/* ============ Confirmador de transcripción ============ */}
				{/* Aparece después de Whisper / browser STT con countdown a auto-enviar.
				    Permite editar el texto antes de mandarlo al LLM (Whisper se equivoca
				    con nombres propios, jerga técnica, acentos). */}
				{pendingTranscript && (
					<div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 w-[min(560px,92%)] bg-gray-900/95 border border-yellow-500/40 rounded-xl shadow-2xl backdrop-blur-md p-4">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">
								Confirmá lo que dijiste
							</span>
							<span className="text-[10px] text-gray-500 ml-auto">Auto-envío en 1.2s</span>
						</div>
						<textarea
							value={pendingTranscript.text}
							onChange={(e) =>
								setPendingTranscript({
									text: e.target.value,
									nonce: Date.now(), // reinicia el timer al editar
								})
							}
							autoFocus
							rows={2}
							className="w-full bg-gray-950 border border-gray-700 focus:border-yellow-500 text-white text-sm rounded-md px-3 py-2 resize-none outline-none"
						/>
						<div className="flex justify-end gap-2 mt-3">
							<button
								onClick={() => setPendingTranscript(null)}
								className="px-3 py-1.5 rounded-md text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
							>
								Cancelar
							</button>
							<button
								onClick={() => {
									const t = pendingTranscript.text.trim();
									setPendingTranscript(null);
									if (t) sendMessage(t);
								}}
								className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-br from-yellow-500 to-yellow-600 text-black hover:from-yellow-400 hover:to-yellow-500"
							>
								Enviar ahora
							</button>
						</div>
					</div>
				)}

				{/* ============ Settings panel (slide-in) ============ */}
				{showSettings && (
					<div className="absolute top-16 right-4 z-40 w-80 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-md p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider">
								Ajustes de voz
							</h3>
							<button
								onClick={() => setShowSettings(false)}
								className="text-gray-400 hover:text-white"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div>
							<label className="text-xs text-gray-300 flex justify-between mb-1">
								<span>Tiempo para activar el micrófono</span>
								<span className="text-yellow-500 font-mono">{vadSettings.speechStartMs}ms</span>
							</label>
							<input
								type="range"
								min="100"
								max="500"
								step="50"
								value={vadSettings.speechStartMs}
								onChange={(e) => setVadSettings({ ...vadSettings, speechStartMs: parseInt(e.target.value, 10) })}
								className="w-full accent-yellow-500"
							/>
							<p className="text-[10px] text-gray-500">Más alto = menos falsos positivos por tos/ruido. Más bajo = más responsivo.</p>
						</div>

						<div>
							<label className="text-xs text-gray-300 flex justify-between mb-1">
								<span>Silencio antes de enviar</span>
								<span className="text-yellow-500 font-mono">{vadSettings.silenceEndMs}ms</span>
							</label>
							<input
								type="range"
								min="400"
								max="1500"
								step="100"
								value={vadSettings.silenceEndMs}
								onChange={(e) => setVadSettings({ ...vadSettings, silenceEndMs: parseInt(e.target.value, 10) })}
								className="w-full accent-yellow-500"
							/>
							<p className="text-[10px] text-gray-500">Cuánto silencio espera el sistema antes de cerrar tu turno.</p>
						</div>

						<div>
							<label className="text-xs text-gray-300 flex justify-between mb-1">
								<span>Sensibilidad del micrófono</span>
								<span className="text-yellow-500 font-mono">{vadSettings.thresholdBase.toFixed(3)}</span>
							</label>
							<input
								type="range"
								min="0.008"
								max="0.05"
								step="0.002"
								value={vadSettings.thresholdBase}
								onChange={(e) => setVadSettings({ ...vadSettings, thresholdBase: parseFloat(e.target.value) })}
								className="w-full accent-yellow-500"
							/>
							<p className="text-[10px] text-gray-500">Más alto = ignora ruidos ambiente más fuertes.</p>
						</div>

						<div>
							<label className="text-xs text-gray-300 flex justify-between mb-1">
								<span>Velocidad del tutor</span>
								<span className="text-yellow-500 font-mono">{ttsSpeed.toFixed(2)}x</span>
							</label>
							<input
								type="range"
								min="0.7"
								max="1.5"
								step="0.05"
								value={ttsSpeed}
								onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
								className="w-full accent-yellow-500"
							/>
							<p className="text-[10px] text-gray-500">Velocidad de reproducción del avatar (0.7x más lento, 1.5x más rápido).</p>
						</div>

						<button
							onClick={() => {
								setVadSettings({ ...VAD_DEFAULTS });
								setTtsSpeed(1);
							}}
							className="w-full text-xs text-gray-400 hover:text-yellow-500 underline"
						>
							Restablecer defaults
						</button>
					</div>
				)}

				{/* Top-left: status header cuando el chat está oculto (modo voz) */}
				{!chatOpen && (
					<div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-gray-900/70 backdrop-blur-sm rounded-md px-3 py-2 border border-gray-700">
						<span
							className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${status.cls}`}
						>
							<span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
							{status.label}
						</span>
						<span className="text-xs text-gray-300 font-medium">
							{moduleData?.title ||
								(moduleData?.mode === "guided"
									? "Modo guiado"
									: "Tutor Virtual URPE")}
						</span>
					</div>
				)}

				{/* Top-right controls (Auto/Manual + Repetir + Settings + Historial + Terminar) */}
				<div className="absolute top-4 right-4 z-20 flex items-center gap-2">
					{!chatOpen && lastAssistantTextRef.current && avatarStatus !== "speaking" && (
						<button
							onClick={repeatLastAvatarMessage}
							className="h-10 px-3 rounded-md bg-gray-900/80 hover:bg-gray-900 text-white text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm border border-gray-700 hover:border-yellow-500/40"
							title="Repetir la última respuesta del avatar"
						>
							<RotateCcw className="h-4 w-4 text-yellow-500" />
							Repetir
						</button>
					)}
					<button
						onClick={() => setShowSettings((v) => !v)}
						className={`h-10 w-10 flex items-center justify-center rounded-md transition-colors backdrop-blur-sm border ${
							showSettings
								? "bg-yellow-500/15 text-yellow-400 border-yellow-500/40"
								: "bg-gray-900/80 hover:bg-gray-900 text-gray-300 border-gray-700 hover:border-yellow-500/40"
						}`}
						title="Ajustes de voz"
					>
						<Settings className="h-4 w-4" />
					</button>
					{!chatOpen && (
						<button
							onClick={() => setAutoMode((v) => !v)}
							className={`h-10 px-3 rounded-md text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm border ${
								autoMode
									? "bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border-yellow-500/40"
									: "bg-gray-900/80 hover:bg-gray-900 text-gray-300 border-gray-700"
							}`}
							title={
								autoMode
									? "Conversación automática activa — clic para pasar a manual"
									: "Modo manual — clic para activar conversación automática"
							}
						>
							<span
								className={`h-2 w-2 rounded-full ${autoMode ? "bg-yellow-400 animate-pulse" : "bg-gray-500"}`}
							/>
							{autoMode ? "Auto" : "Manual"}
						</button>
					)}
					{!chatOpen && (
						<button
							onClick={() => setChatOpen(true)}
							className="h-10 px-4 rounded-md bg-gray-900/80 hover:bg-gray-900 text-white text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm border border-gray-700 hover:border-yellow-500/40"
							title="Ver historial del chat"
						>
							<MessageSquare className="h-4 w-4 text-yellow-500" />
							Historial
							{messages.length > 0 && (
								<span className="ml-0.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-yellow-500 text-black text-[10px] font-bold">
									{messages.length}
								</span>
							)}
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

				{/* Tip de auriculares (primera vez) */}
				{!chatOpen && autoMode && showHeadphonesTip && (
					<div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-md bg-gray-900/85 backdrop-blur-md border border-yellow-500/30 rounded-lg px-4 py-2.5 flex items-start gap-2 shadow-xl">
						<span className="text-xl leading-none">🎧</span>
						<div className="flex-1 text-xs text-gray-200">
							Para una conversación más fluida, usá auriculares — así el tutor
							no se interrumpe a sí mismo.
						</div>
						<button
							onClick={() => {
								localStorage.setItem("learning_headphones_tip_dismissed", "1");
								setShowHeadphonesTip(false);
							}}
							className="text-gray-400 hover:text-white text-lg leading-none -mt-0.5"
							title="Ocultar"
						>
							×
						</button>
					</div>
				)}

				{/* Bottom overlay:
            - Si está escuchando → muestra el transcript en vivo (best-effort
              vía Web Speech API; el texto final lo da Whisper).
            - Si no → muestra la última pregunta y respuesta para seguir
              la conversación sin abrir el panel del chat. */}
				{!chatOpen &&
					!paused &&
					avatarStatus !== "connecting" &&
					avatarStatus !== "error" &&
					(() => {
						if (listening) {
							return (
								<div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 w-[min(720px,90%)]">
									<div className="flex justify-end">
										<div className="max-w-[90%] bg-yellow-500/95 text-black rounded-2xl px-4 py-2.5 text-sm font-medium shadow-gold backdrop-blur-sm min-h-[44px] flex items-center gap-2">
											{liveTranscript ? (
												<span className="break-words">{liveTranscript}</span>
											) : (
												<span className="italic opacity-70">Escuchando…</span>
											)}
										</div>
									</div>
								</div>
							);
						}
						const lastUser = [...messages]
							.reverse()
							.find((m) => m.role === "user");
						const lastAssistant = [...messages]
							.reverse()
							.find((m) => m.role === "assistant");
						if (!lastUser && !lastAssistant) return null;
						return (
							<div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 w-[min(720px,90%)] space-y-2">
								{lastUser && (
									<div className="flex justify-end">
										<div className="max-w-[85%] bg-yellow-500/95 text-black rounded-2xl px-4 py-2 text-sm font-medium shadow-gold backdrop-blur-sm">
											{lastUser.content}
										</div>
									</div>
								)}
								{lastAssistant && (
									<div className="flex justify-start">
										<div className="max-w-[85%] bg-gray-900/85 text-white rounded-2xl px-4 py-2.5 text-sm leading-relaxed border border-gray-700 backdrop-blur-md shadow-xl whitespace-pre-wrap">
											{lastAssistant.content}
										</div>
									</div>
								)}
							</div>
						);
					})()}

				{/* Acción primaria de voz — modo Auto: orbe que pulsa con la voz;
            modo Manual: botón push-to-talk clásico */}
				{!chatOpen &&
					avatarStatus !== "connecting" &&
					avatarStatus !== "error" &&
					!paused &&
					(autoMode ? (
						<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 select-none">
							{/* Orbe: el outer ring escala con el voiceLevel */}
							<div className="relative h-24 w-24 flex items-center justify-center">
								<div
									className={`absolute inset-0 rounded-full transition-all duration-100 ${
										listening
											? "bg-red-500/30"
											: avatarStatus === "speaking"
												? "bg-yellow-500/15"
												: "bg-yellow-500/20"
									}`}
									style={{
										transform: `scale(${1 + voiceLevel * 0.6})`,
										opacity: 0.4 + voiceLevel * 0.6,
									}}
								/>
								<div
									className={`relative h-20 w-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${
										listening
											? "bg-red-600 text-white ring-4 ring-red-500/50"
											: sending
												? "bg-gray-800 text-yellow-500 ring-4 ring-yellow-500/30"
												: avatarStatus === "speaking"
													? "bg-gradient-to-br from-yellow-500/70 to-yellow-600/70 text-black ring-4 ring-yellow-500/30"
													: "bg-gradient-to-br from-yellow-500 to-yellow-600 text-black ring-4 ring-yellow-500/30"
									}`}
								>
									{sending && !listening ? (
										<Loader2 className="h-8 w-8 animate-spin" />
									) : listening ? (
										<Mic className="h-8 w-8" />
									) : (
										<Mic className="h-8 w-8" />
									)}
								</div>
							</div>
							<div className="text-xs font-semibold uppercase tracking-widest text-white/90 bg-gray-900/70 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-700">
								{listening
									? "Te escucho — pausá para enviar"
									: sending
										? "Pensando…"
										: avatarStatus === "speaking"
											? "Hablando — podés interrumpir"
											: "Hablá cuando quieras"}
							</div>
						</div>
					) : (
						<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
							<button
								type="button"
								onClick={listening ? stopListening : startListening}
								disabled={sending && !listening}
								title={listening ? "Detener grabación" : "Hablar con el tutor"}
								className={`h-20 w-20 flex items-center justify-center rounded-full shadow-2xl transition-all ${
									listening
										? "bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-500/40 animate-pulse"
										: sending
											? "bg-gray-800 text-yellow-500 ring-4 ring-yellow-500/30 cursor-wait"
											: "bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black ring-4 ring-yellow-500/30 hover:ring-yellow-500/60 hover:scale-105"
								}`}
							>
								{sending && !listening ? (
									<Loader2 className="h-8 w-8 animate-spin" />
								) : listening ? (
									<MicOff className="h-8 w-8" />
								) : (
									<Mic className="h-8 w-8" />
								)}
							</button>
							<div className="text-xs font-semibold uppercase tracking-widest text-white/90 bg-gray-900/70 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-700">
								{listening
									? "Grabando — clic para enviar"
									: sending
										? "Procesando…"
										: "Hablá con tu tutor"}
							</div>
						</div>
					))}

				{/* Error banner */}
				{avatarError && (
					<div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] bg-red-950/95 border border-red-800 rounded-lg px-4 py-3 flex items-start gap-2 backdrop-blur-sm shadow-xl">
						<AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-red-200 text-sm">
								Error con el avatar
							</div>
							<div className="text-xs text-red-300 mt-1 break-words">
								{avatarError}
							</div>
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
