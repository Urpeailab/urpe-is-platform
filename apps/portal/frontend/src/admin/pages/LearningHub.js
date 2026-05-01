import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { GraduationCap, MessageCircle, Play } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MODE_LABEL = { free: "Libre", guided: "Guiado" };

export const LearningHub = () => {
	const navigate = useNavigate();
	const [modules, setModules] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				const token = localStorage.getItem("admin_token");
				const { data } = await axios.get(`${API}/learning/modules`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				setModules(data.modules || []);
			} catch {
				toast.error("Error cargando módulos");
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	return (
		<div className="space-y-6 bg-white min-h-screen p-6">
			<div>
				<h1
					className="text-3xl font-bold text-gray-900"
					style={{ fontFamily: "Manrope, sans-serif" }}
				>
					Aprendizaje
				</h1>
				<p className="text-gray-600 mt-2">
					Aprende y resuelve dudas con tu tutor virtual. Selecciona un módulo o
					inicia una conversación libre.
				</p>
			</div>

			<Card className="border-yellow-300 bg-yellow-50">
				<CardContent className="py-6 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<MessageCircle className="h-8 w-8 text-yellow-600" />
						<div>
							<div className="font-semibold text-gray-900">Conversación libre</div>
							<div className="text-sm text-gray-600">
								Pregunta cualquier cosa. El avatar usará todo el conocimiento
								disponible.
							</div>
						</div>
					</div>
					<Button
						onClick={() => navigate("/admin/learning/session")}
						className="bg-yellow-500 hover:bg-yellow-600 text-black"
					>
						<Play className="mr-2 h-4 w-4" />
						Empezar
					</Button>
				</CardContent>
			</Card>

			<div>
				<h2 className="text-xl font-semibold mb-4 text-gray-900">Módulos disponibles</h2>
				{loading ? (
					<p className="text-gray-500">Cargando…</p>
				) : modules.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center text-gray-500">
							<GraduationCap className="h-12 w-12 mx-auto mb-2 text-gray-300" />
							Aún no hay módulos publicados.
						</CardContent>
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{modules.map((m) => (
							<Card key={m.id} className="hover:shadow-md transition-shadow">
								<CardHeader>
									<div className="flex items-start justify-between gap-2">
										<CardTitle className="text-lg text-gray-900">{m.title}</CardTitle>
										<Badge variant="outline">
											{MODE_LABEL[m.mode] || m.mode}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-gray-600 mb-4 line-clamp-3 min-h-[3rem]">
										{m.description || (
											<span className="italic text-gray-400">
												Sin descripción
											</span>
										)}
									</p>
									<Button
										onClick={() =>
											navigate(`/admin/learning/session?module=${m.id}`)
										}
										className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
									>
										<Play className="mr-2 h-4 w-4" />
										Iniciar sesión
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default LearningHub;
