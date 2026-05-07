import React, { useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { X, Upload, Loader2, File, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const DeliverableUploadModal = ({
	isOpen,
	onClose,
	deliverable,
	caseId,
	onUploadComplete,
}) => {
	const [uploading, setUploading] = useState(false);
	const [file, setFile] = useState(null);
	const [fileUrl, setFileUrl] = useState("");
	const [notes, setNotes] = useState("");
	const [noteVisibleToClient, setNoteVisibleToClient] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const [notifyClient, setNotifyClient] = useState(true);

	// Helper function to extract text from bilingual objects
	const getText = (field) => {
		if (!field) return "";
		if (typeof field === "string") return field;
		if (typeof field === "object") return field.es || field.en || "";
		return "";
	};

	const handleDrag = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	};

	const handleDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFileSelect(e.dataTransfer.files[0]);
		}
	};

	const handleFileSelect = (selectedFile) => {
		if (selectedFile) {
			setFile(selectedFile);
			// No establecemos fileUrl aquí - se subirá cuando se envíe el formulario
			setFileUrl("");
		}
	};

	const handleFileInput = (e) => {
		if (e.target.files && e.target.files[0]) {
			handleFileSelect(e.target.files[0]);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!file && !fileUrl) {
			toast.error("Por favor selecciona un archivo");
			return;
		}

		try {
			setUploading(true);
			const token = localStorage.getItem("admin_token");

			let finalFileUrl = fileUrl;
			let fileName = file?.name || "document.pdf";
			let fileSize = file?.size || 0;

			// Si hay un archivo, primero subirlo al servidor
			if (file) {
				const formData = new FormData();
				formData.append("file", file);

				const uploadResponse = await axios.post(
					`${BACKEND_URL}/api/admin/deliverables/upload-file`,
					formData,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "multipart/form-data",
						},
					},
				);

				finalFileUrl = uploadResponse.data.fileUrl;
				fileName = uploadResponse.data.fileName;
				fileSize = uploadResponse.data.fileSize;
			}

			// Ahora guardar la información del entregable
			const requestData = {
				caseId: caseId,
				stageNumber: deliverable.stageNumber,
				deliverableId: deliverable._id || deliverable.id,
				fileName: fileName,
				fileUrl: finalFileUrl,
				fileSize: fileSize,
				notes: notes,
				noteVisibleToClient: noteVisibleToClient,
				notifyClient: notifyClient,
			};

			await axios.post(
				`${BACKEND_URL}/api/admin/deliverables/upload`,
				requestData,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);

			toast.success("Entregable subido exitosamente");
			onUploadComplete();
			resetForm();
		} catch (error) {
			console.error("Error uploading deliverable:", error);
			toast.error(
				error.response?.data?.detail || "Error al subir el entregable",
			);
		} finally {
			setUploading(false);
		}
	};

	const resetForm = () => {
		setFile(null);
		setFileUrl("");
		setNotes("");
		setNoteVisibleToClient(false);
		setNotifyClient(true);
	};

	if (!isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
			<div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
				{/* Header */}
				<div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-5 py-3 flex items-center justify-between flex-shrink-0">
					<div className="min-w-0">
						<h2 className="text-lg font-bold text-white">Subir Entregable</h2>
						<p className="text-yellow-100 text-xs mt-0.5 truncate">
							{deliverable?.deliverableName ||
								getText(deliverable?.name) ||
								"Sin nombre"}
						</p>
					</div>
					<button
						onClick={onClose}
						className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
					<div className="p-5 overflow-y-auto flex-1">
						{/* Description */}
						{(deliverable?.description?.es ||
							deliverable?.description?.en ||
							deliverable?.description) && (
							<div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
								<p className="text-xs text-blue-900">
									<strong>Descripción:</strong>{" "}
									{getText(deliverable?.description)}
								</p>
							</div>
						)}

						{/* File Upload Area */}
						<div className="space-y-3">
							<Label>Archivo del Entregable *</Label>

							{/* Drag & Drop Area */}
							<div
								className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
									dragActive
										? "border-yellow-500 bg-yellow-50"
										: "border-gray-300 hover:border-yellow-400 bg-gray-50"
								}`}
								onDragEnter={handleDrag}
								onDragLeave={handleDrag}
								onDragOver={handleDrag}
								onDrop={handleDrop}
							>
								{file ? (
									<div className="space-y-1">
										<File className="h-8 w-8 mx-auto text-success" />
										<p className="text-xs font-medium text-success">
											✓ Archivo seleccionado:
										</p>
										<p className="text-sm font-semibold text-gray-900">
											{file.name}
										</p>
										<p className="text-xs text-gray-500">
											{(file.size / 1024 / 1024).toFixed(2)} MB
										</p>
										<Button
											type="button"
											size="sm"
											onClick={() => setFile(null)}
											className="mt-1 bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300"
										>
											Cambiar archivo
										</Button>
									</div>
								) : (
									<div>
										<Upload
											className={`h-8 w-8 mx-auto mb-2 ${dragActive ? "text-yellow-500" : "text-gray-400"}`}
										/>
										<p className="text-sm text-gray-600 mb-1">
											Arrastra y suelta tu archivo aquí
										</p>
										<p className="text-xs text-gray-500 mb-2">o</p>
										<label className="inline-block">
											<input
												type="file"
												accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.mkv,.webm"
												onChange={handleFileInput}
												className="hidden"
											/>
											<span className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors font-medium text-sm">
												<Upload className="h-4 w-4" />
												<span>Seleccionar Archivo</span>
											</span>
										</label>
										<p className="text-[11px] text-gray-500 mt-2">
											PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX · JPG, PNG, GIF, WEBP
											· MP4, MOV, AVI, MKV
										</p>
									</div>
								)}
							</div>

							{/* Notes */}
							<div className="space-y-1.5">
								<Label htmlFor="notes">Notas (Opcional)</Label>
								<Textarea
									id="notes"
									placeholder="Agrega notas sobre este entregable..."
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									rows={2}
								/>
								{notes.trim() && (
									<div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-1">
										<div>
											<p className="text-sm font-semibold text-blue-900">
												Cliente puede ver esta nota
											</p>
											<p className="text-xs text-blue-600">
												Si esta apagado, solo el equipo interno la vera
											</p>
										</div>
										<button
											type="button"
											role="switch"
											aria-checked={noteVisibleToClient}
											onClick={() =>
												setNoteVisibleToClient(!noteVisibleToClient)
											}
											className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
												noteVisibleToClient ? "bg-blue-600" : "bg-gray-300"
											}`}
										>
											<span
												className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
													noteVisibleToClient
														? "translate-x-6"
														: "translate-x-1"
												}`}
											/>
										</button>
									</div>
								)}
							</div>

							{/* Notify Client Toggle */}
							<div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
								<div className="flex items-center gap-2">
									<div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-3.5 w-3.5 text-purple-600"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
											<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
										</svg>
									</div>
									<div>
										<p className="text-sm font-semibold text-purple-900">
											Notificar al cliente por correo
										</p>
										<p className="text-[11px] text-purple-600">
											Email avisando del nuevo entregable
										</p>
									</div>
								</div>
								<button
									type="button"
									role="switch"
									aria-checked={notifyClient}
									onClick={() => setNotifyClient(!notifyClient)}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
										notifyClient ? "bg-purple-600" : "bg-gray-300"
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
											notifyClient ? "translate-x-6" : "translate-x-1"
										}`}
									/>
								</button>
							</div>

							{/* Warning Box */}
							<div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
								<div className="flex items-start gap-2">
									<AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
									<div className="text-xs text-yellow-800">
										<p className="font-semibold">
											BORRADOR hasta que el cliente pague la etapa. Una vez
											pagado, descargará la versión final sin marca de agua.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Actions (sticky footer) */}
					<div className="flex items-center justify-end space-x-3 px-6 py-4 border-t bg-white flex-shrink-0">
						<Button
							type="button"
							onClick={onClose}
							disabled={uploading}
							className="bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300 font-medium"
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold shadow-sm"
							disabled={uploading || (!file && !fileUrl)}
						>
							{uploading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Subiendo...
								</>
							) : (
								<>
									<Upload className="mr-2 h-4 w-4" />
									Subir Entregable
								</>
							)}
						</Button>
					</div>
				</form>
			</div>
		</div>,
		document.body,
	);
};

export default DeliverableUploadModal;
