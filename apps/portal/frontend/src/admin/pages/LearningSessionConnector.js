/**
 * LearningSessionConnector — flujo Connector (ElevenLabs Agent + LiveAvatar LITE).
 *
 * ElevenLabs maneja STT + LLM + TTS y LiveAvatar renderiza el video.
 * Nosotros sólo:
 *   - Nos conectamos al LiveKit room
 *   - Publicamos el mic al room (el agent escucha de ahí)
 *   - Renderizamos el video/audio del avatar
 *   - Capturamos transcripciones del data channel y las POST-eamos al backend
 *     para persistirlas en learning_messages (auditoría + evaluación final)
 *
 * Cero Whisper, cero browser STT, cero VAD, cero sentence buffering, cero
 * sendMessage manual. Toda la latencia STT+LLM+TTS+VAD ocurre dentro de
 * ElevenLabs Conversational AI, que está optimizada para sub-segundo end-to-end.
 */

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "../../components/ui/button";
import {
	ArrowLeft,
	Mic,
	MicOff,
	X,
	Loader2,
	AlertCircle,
	MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

/**
 * Props:
 *  - sessionData: el response completo de POST /api/learning/sessions
 *      { session_id, module, avatar_session: {livekit_url, livekit_token, ...}, ... }
 *  - onEndSession(): callback para cerrar y volver al hub
 */
export const LearningSessionConnector = ({ sessionData, onEnd }) => {
	const navigate = useNavigate();

	const videoRef = useRef(null);
	const audioRef = useRef(null);
	const roomRef = useRef(null);
	const messagesEndRef = useRef(null);

	const sessionId = sessionData?.session_id;
	const moduleData = sessionData?.module;
	const avatarSession = sessionData?.avatar_session;

	const [avatarStatus, setAvatarStatus] = useState("connecting");
	const [avatarError, setAvatarError] = useState(null);
	const [chatOpen, setChatOpen] = useState(false);
	const [messages, setMessages] = useState([]);
	// Mic arranca DESHABILITADO. La habilitación dispara el prompt de permiso
	// del navegador, que solo se puede gatillar en respuesta a un gesto del
	// usuario (click en el botón) — si lo hacemos automático en el connect,
	// algunos navegadores (Safari, Chrome en iframes) lo bloquean silenciosamente
	// o lo loguean como "Permission dismissed".
	const [micEnabled, setMicEnabled] = useState(false);
	const [micPermissionNeeded, setMicPermissionNeeded] = useState(false);
	const [ending, setEnding] = useState(false);
	const [evaluation, setEvaluation] = useState(null);

	const headers = () => ({
		Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
	});

	// Postear un evento a /event para persistir transcripción / cierre.
	// Best-effort: si falla, logueamos pero NO rompemos la UI — la sesión
	// sigue funcionando para el usuario aunque la auditoría tenga huecos.
	const postEvent = async (kind, text, payload = null) => {
		if (!sessionId) return;
		try {
			await axios.post(
				`${API}/learning/sessions/${sessionId}/event`,
				{ kind, text, payload },
				{ headers: headers() },
			);
		} catch (err) {
			console.warn(`[connector] postEvent ${kind} failed`, err);
		}
	};

	// Parser de los eventos del data channel. ElevenLabs emite dos tipos:
	//   1) Eventos del wrapper LiveAvatar (user.transcription, avatar.transcription,
	//      avatar.speak_started/ended, session_stopped)
	//   2) Eventos passthrough de ElevenLabs envueltos en `elevenlabs_agent_event`
	//      con un campo `elevenlabs_event_type` y `data`.
	// Persistimos solo las transcripciones finales — los chunks parciales solo
	// los usamos para UI en vivo (overlay inferior).
	const handleDataChannel = (raw, topic) => {
		let msg;
		try {
			msg = JSON.parse(new TextDecoder().decode(raw));
		} catch {
			return;
		}

		const t = msg.event_type || msg.type;

		// === Eventos del wrapper LiveAvatar ===
		if (t === "user.transcription" && msg.text) {
			// Transcripción FINAL del usuario — la persistimos
			setMessages((prev) => [
				...prev,
				{ role: "user", content: msg.text },
			]);
			postEvent("user_transcript", msg.text, msg);
			return;
		}
		if (t === "avatar.transcription" && msg.text) {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: msg.text },
			]);
			postEvent("agent_response", msg.text, msg);
			return;
		}
		if (t === "avatar.speak_started") {
			setAvatarStatus("speaking");
			return;
		}
		if (t === "avatar.speak_ended") {
			setAvatarStatus("ready");
			return;
		}
		if (t === "session_stopped") {
			postEvent("session_stopped", null, msg);
			setAvatarStatus("idle");
			return;
		}

		// === Eventos passthrough de ElevenLabs ===
		if (t === "elevenlabs_agent_event") {
			const sub = msg.elevenlabs_event_type;
			const data = msg.data || {};
			if (sub === "user_transcript" && data.user_transcription_event?.user_transcript) {
				const text = data.user_transcription_event.user_transcript;
				setMessages((prev) => [...prev, { role: "user", content: text }]);
				postEvent("user_transcript", text, data);
			} else if (sub === "agent_response" && data.agent_response_event?.agent_response) {
				const text = data.agent_response_event.agent_response;
				setMessages((prev) => [...prev, { role: "assistant", content: text }]);
				postEvent("agent_response", text, data);
			}
			// interruption / vad_score / etc.: los ignoramos por ahora, solo log.
		}
	};

	// Conexión al room + publicación del mic.
	useEffect(() => {
		if (!avatarSession?.livekit_url || !avatarSession?.livekit_token) {
			setAvatarError("Sesión sin credenciales LiveKit");
			setAvatarStatus("error");
			return;
		}

		let cancelled = false;
		const { livekit_url, livekit_token } = avatarSession;
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
			// El estado real lo dictan los eventos speak_started/ended, pero como
			// fallback usamos active speakers (ElevenLabs no siempre emite ambos).
			setAvatarStatus((prev) => {
				if (prev === "connecting" || prev === "error") return prev;
				return otherSpeaking ? "speaking" : "ready";
			});
		});
		room.on(RoomEvent.Disconnected, () => setAvatarStatus("idle"));
		room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
			handleDataChannel(payload, topic);
		});

		(async () => {
			try {
				await room.connect(livekit_url, livekit_token);
				if (cancelled) {
					room.disconnect();
					return;
				}
				setAvatarStatus("ready");

				// UX natural: si el navegador YA tiene permiso de mic concedido
				// (de una sesión anterior), prendemos el mic automáticamente.
				// Eso permite barge-in (interrumpir al avatar hablando) desde el
				// primer segundo sin que el usuario tenga que clickear nada.
				// Si está "prompt" (primera vez) o "denied", no tocamos — esperamos
				// el clic en el botón para no disparar el prompt sin gesto.
				try {
					const status = await navigator.permissions?.query?.({
						name: "microphone",
					});
					if (status?.state === "granted" && !cancelled) {
						await room.localParticipant.setMicrophoneEnabled(true);
						setMicEnabled(true);
					}
				} catch {
					// navigator.permissions.query no soportado en Safari viejo o
					// algunos navegadores — silenciamos. El usuario igual puede
					// clickear el botón manualmente.
				}
			} catch (err) {
				console.error("[connector] connect failed", err);
				setAvatarError(err.message || String(err));
				setAvatarStatus("error");
			}
		})();

		return () => {
			cancelled = true;
			try {
				room.disconnect();
			} catch {
				/* ignore */
			}
		};
	}, [avatarSession?.livekit_url, avatarSession?.livekit_token]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const toggleMic = async () => {
		const room = roomRef.current;
		if (!room) return;
		const next = !micEnabled;
		try {
			await room.localParticipant.setMicrophoneEnabled(next);
			setMicEnabled(next);
			setMicPermissionNeeded(false);
		} catch (err) {
			console.error("[connector] toggleMic failed", err);
			// Errores típicos de permiso del navegador:
			//   - "Permission dismissed" (Chrome: usuario cerró el prompt)
			//   - "NotAllowedError: Permission denied" (usuario click "Block")
			//   - "NotAllowedError: Permission dismissed"
			// En todos los casos, el avatar sigue funcionando — sólo no podemos
			// publicar audio nuestro. Mostramos un banner explícito y no rompemos
			// el resto de la UI.
			const msg = String(err?.message || err);
			if (/permission|notallowed|denied|dismissed/i.test(msg)) {
				setMicPermissionNeeded(true);
				toast.error(
					"Permite el micrófono en el navegador (ícono de candado junto a la URL → Micrófono → Permitir), después recargá.",
					{ duration: 8000 },
				);
			} else {
				toast.error("No se pudo cambiar el micrófono: " + msg);
			}
		}
	};

	const endSession = async () => {
		if (!sessionId) {
			if (onEnd) onEnd();
			else navigate("/admin/learning");
			return;
		}
		if (!window.confirm("¿Terminar la sesión?")) return;
		setEnding(true);
		try {
			try {
				roomRef.current?.disconnect();
			} catch {
				/* ignore */
			}
			const { data } = await axios.post(
				`${API}/learning/sessions/${sessionId}/end`,
				{},
				{ headers: headers() },
			);
			if (data.evaluation) {
				setEvaluation(data.evaluation);
			} else if (onEnd) {
				onEnd();
			} else {
				navigate("/admin/learning");
			}
		} catch {
			toast.error("Error terminando la sesión");
		} finally {
			setEnding(false);
		}
	};

	if (evaluation) {
		return (
			<div className="bg-white min-h-screen p-6">
				<div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 space-y-6">
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
												{o.evidence || o.text || `Objetivo ${i + 1}`}
											</span>
										</li>
									))}
								</ul>
							</div>
						)}
					<div className="flex justify-end pt-2">
						<Button
							onClick={() => (onEnd ? onEnd() : navigate("/admin/learning"))}
							className="bg-yellow-500 hover:bg-yellow-600 text-black"
						>
							Volver al hub
						</Button>
					</div>
				</div>
			</div>
		);
	}

	const status = STATUS_BADGE[avatarStatus] || STATUS_BADGE.idle;
	const lastUser = [...messages].reverse().find((m) => m.role === "user");
	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

	return (
		<div className="-m-6 h-[calc(100vh-4rem)] flex bg-gray-950 text-white overflow-hidden">
			<audio ref={audioRef} autoPlay />

			{chatOpen && (
				<aside className="w-[42%] min-w-[360px] max-w-[560px] flex flex-col bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800">
					<div className="px-6 pt-6 pb-4 border-b border-gray-800">
						<div className="flex items-start gap-3">
							<div className="flex-1 min-w-0">
								<h1 className="text-xl font-bold text-white">
									Tutor Virtual URPE
								</h1>
								<p className="text-sm text-gray-400 mt-1 leading-snug">
									Habla naturalmente con el tutor. La conversación se transcribe
									automáticamente.
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
										{moduleData?.title || "Sesión libre"}
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

					<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">
						{messages.length === 0 ? (
							<p className="text-center text-gray-500 text-sm italic py-12">
								Esperando que el tutor empiece la conversación…
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
									</div>
								);
							})
						)}
						<div ref={messagesEndRef} />
					</div>
				</aside>
			)}

			<div className="flex-1 relative bg-gray-950">
				<video
					ref={videoRef}
					autoPlay
					playsInline
					className="absolute inset-0 w-full h-full object-cover"
				/>

				{avatarStatus === "connecting" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/85 text-white z-10">
						<Loader2 className="h-12 w-12 animate-spin mb-3 text-yellow-500" />
						<div className="text-base font-medium">
							Conectando con el tutor…
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
							{avatarError || "Volvé a intentar en unos segundos."}
						</div>
					</div>
				)}

				{/* Status header (cuando chat cerrado) */}
				{!chatOpen && (
					<div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-gray-900/70 backdrop-blur-sm rounded-md px-3 py-2 border border-gray-700">
						<span
							className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${status.cls}`}
						>
							<span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
							{status.label}
						</span>
						<span className="text-xs text-gray-300 font-medium">
							{moduleData?.title || "Tutor Virtual URPE"}
						</span>
					</div>
				)}

				{/* Top-right controls */}
				<div className="absolute top-4 right-4 z-20 flex items-center gap-2">
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

				{/* Bottom overlay con última pregunta/respuesta cuando chat está cerrado */}
				{!chatOpen &&
					avatarStatus !== "connecting" &&
					avatarStatus !== "error" &&
					(lastUser || lastAssistant) && (
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
					)}

				{/* Mic toggle (centro abajo) */}
				{avatarStatus !== "connecting" && avatarStatus !== "error" && (
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 select-none">
						<button
							type="button"
							onClick={toggleMic}
							title={
								micPermissionNeeded
									? "Necesitás permitir el micrófono en el navegador"
									: micEnabled
										? "Silenciar micrófono"
										: "Activar micrófono"
							}
							className={`h-20 w-20 flex items-center justify-center rounded-full shadow-2xl transition-all ${
								micPermissionNeeded
									? "bg-red-600 text-white ring-4 ring-red-500/50 animate-pulse"
									: micEnabled
										? "bg-gradient-to-br from-yellow-500 to-yellow-600 text-black ring-4 ring-yellow-500/30 hover:ring-yellow-500/60"
										: "bg-gray-800 text-yellow-500 ring-4 ring-yellow-500/30 hover:ring-yellow-500/60"
							}`}
						>
							{micEnabled ? (
								<Mic className="h-8 w-8" />
							) : (
								<MicOff className="h-8 w-8" />
							)}
						</button>
						<div className="text-xs font-semibold uppercase tracking-widest text-white/90 bg-gray-900/70 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-700">
							{micPermissionNeeded
								? "Permiso de micrófono requerido"
								: micEnabled
									? avatarStatus === "speaking"
										? "Hablando — podés interrumpir"
										: "Hablá cuando quieras"
									: "Clic para activar el micrófono"}
						</div>
					</div>
				)}

				{/* Banner cuando el navegador rechazó el permiso del micrófono.
				    No es un error del avatar (que sigue conectado), sino del browser. */}
				{micPermissionNeeded && (
					<div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] bg-yellow-950/95 border border-yellow-700 rounded-lg px-4 py-3 flex items-start gap-2 backdrop-blur-sm shadow-xl">
						<AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
						<div className="flex-1 min-w-0 text-sm">
							<div className="font-semibold text-yellow-200">
								Permití el micrófono para hablar con el avatar
							</div>
							<div className="text-yellow-100/80 text-xs mt-1 leading-relaxed">
								Clic en el ícono de candado (o "i") junto a la URL → buscá
								"Micrófono" → cambialo a <strong>Permitir</strong> → recargá la página
								con Cmd+Shift+R. El avatar sigue conectado mientras tanto.
							</div>
						</div>
					</div>
				)}

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
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default LearningSessionConnector;
