import React, { useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { X, Upload, Loader2, File, AlertCircle, Trash2 } from "lucide-react";
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
	const [files, setFiles] = useState([]); // multi-file: list of File objects
	const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
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

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			handleFilesSelect(e.dataTransfer.files);
		}
	};

	const handleFilesSelect = (selectedFiles) => {
		if (!selectedFiles || selectedFiles.length === 0) return;
		const arr = Array.from(selectedFiles);
		setFiles((prev) => [...prev, ...arr]);
	};

	const handleFileInput = (e) => {
		if (e.target.files && e.target.files.length > 0) {
			handleFilesSelect(e.target.files);
			// Reset input so re-selecting the same file triggers onChange
			e.target.value = "";
		}
	};

	const removeFileAt = (idx) => {
		setFiles((prev) => prev.filter((_, i) => i !== idx));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (files.length === 0) {
			toast.error("Por favor selecciona al menos un archivo");
			return;
		}

		const token = localStorage.getItem("admin_token");
		setUploading(true);
		setUploadProgress({ current: 0, total: files.length });

		let success = 0;
		const failures = [];

		for (let i = 0; i < files.length; i++) {
			const f = files[i];
			setUploadProgress({ current: i + 1, total: files.length });
			try {
				// 1) Upload binary
				const formData = new FormData();
				formData.append("file", f);
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

				// 2) Attach to deliverable. Notes apply to each file (server stores
				// per-file). Email notification fires ONLY on the last file to avoid spam.
				const isLast = i === files.length - 1;
				await axios.post(
					`${BACKEND_URL}/api/admin/deliverables/upload`,
					{
						caseId,
						stageNumber: deliverable.stageNumber,
						deliverableId: deliverable._id || deliverable.id,
						fileName: uploadResponse.data.fileName,
						fileUrl: uploadResponse.data.fileUrl,
						fileSize: uploadResponse.data.fileSize,
						notes,
						noteVisibleToClient,
						notifyClient: notifyClient && isLast,
					},
					{ headers: { Authorization: `Bearer ${token}` } },
				);

				success++;
			} catch (err) {
				console.error(`Error uploading ${f.name}:`, err);
				failures.push({
					name: f.name,
					detail: err?.response?.data?.detail || err?.message || "Error desconocido",
				});
			}
		}

		setUploading(false);
		setUploadProgress({ current: 0, total: 0 });

		if (failures.length === 0) {
			toast.success(
				files.length === 1
					? "Entregable subido exitosamente"
					: `${success} archivos subidos exitosamente`,
			);
			onUploadComplete();
			resetForm();
		} else if (success > 0) {
			toast.warning(
				`${success} subidos, ${failures.length} fallidos: ${failures.map((f) => f.name).join(", ")}`,
			);
			onUploadComplete();
			// Mantener en la UI solo los archivos que fallaron, para reintentar
			const failedNames = new Set(failures.map((f) => f.name));
			setFiles((prev) => prev.filter((f) => failedNames.has(f.name)));
		} else {
			toast.error(
				`No se pudo subir ningún archivo. Primer error: ${failures[0].detail}`,
			);
		}
	};

	const resetForm = () => {
		setFiles([]);
		setNotes("");
		setNoteVisibleToClient(false);
		setNotifyClient(true);
		setUploadProgress({ current: 0, total: 0 });
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
							<Label>
								Archivos del Entregable *
								{files.length > 0 && (
									<span className="ml-2 text-xs text-gray-500 font-normal">
										({files.length} seleccionado{files.length !== 1 ? "s" : ""})
									</span>
								)}
							</Label>

							{/* Drag & Drop Area (always shown — para añadir más archivos) */}
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
								<Upload
									className={`h-8 w-8 mx-auto mb-2 ${dragActive ? "text-yellow-500" : "text-gray-400"}`}
								/>
								<p className="text-sm text-gray-600 mb-1">
									{files.length === 0
										? "Arrastra y suelta tus archivos aquí"
										: "Arrastra más archivos para agregar"}
								</p>
								<p className="text-xs text-gray-500 mb-2">o</p>
								<label className="inline-block">
									<input
										type="file"
										multiple
										accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.mkv,.webm"
										onChange={handleFileInput}
										className="hidden"
									/>
									<span className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors font-medium text-sm">
										<Upload className="h-4 w-4" />
										<span>
											{files.length === 0
												? "Seleccionar Archivos"
												: "Agregar más"}
										</span>
									</span>
								</label>
								<p className="text-[11px] text-gray-500 mt-2">
									PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX · JPG, PNG, GIF, WEBP
									· MP4, MOV, AVI, MKV
								</p>
							</div>

							{/* Lista de archivos seleccionados */}
							{files.length > 0 && (
								<div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white max-h-56 overflow-y-auto">
									{files.map((f, idx) => (
										<div
											key={`${f.name}-${idx}`}
											className="flex items-center gap-3 px-3 py-2"
										>
											<File className="h-5 w-5 text-gray-400 flex-shrink-0" />
											<div className="min-w-0 flex-1">
												<p className="text-sm font-medium text-gray-900 truncate">
													{f.name}
												</p>
												<p className="text-[11px] text-gray-500">
													{(f.size / 1024 / 1024).toFixed(2)} MB
												</p>
											</div>
											<button
												type="button"
												onClick={() => removeFileAt(idx)}
												disabled={uploading}
												className="text-gray-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed p-1 rounded transition-colors flex-shrink-0"
												title="Quitar de la lista"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									))}
								</div>
							)}

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
							disabled={uploading || files.length === 0}
						>
							{uploading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Subiendo {uploadProgress.current}/{uploadProgress.total}...
								</>
							) : (
								<>
									<Upload className="mr-2 h-4 w-4" />
									{files.length > 1
										? `Subir ${files.length} archivos`
										: "Subir Entregable"}
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
