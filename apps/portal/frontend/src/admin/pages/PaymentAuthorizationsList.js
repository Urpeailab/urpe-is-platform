import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
	Search,
	Download,
	RefreshCw,
	Loader2,
	CreditCard,
	User,
	Calendar,
	ChevronDown,
	ChevronUp,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const ITEMS_PER_PAGE = 20;

const PaymentAuthorizationsList = () => {
	const [authorizations, setAuthorizations] = useState([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [expandedId, setExpandedId] = useState(null);
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [totalAmount, setTotalAmount] = useState(0);

	const token = localStorage.getItem("admin_token");

	// Debounce search so we don't refetch on every keystroke.
	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(t);
	}, [search]);

	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams({
				page: String(page),
				limit: String(ITEMS_PER_PAGE),
			});
			if (debouncedSearch) params.set("search", debouncedSearch);
			if (dateFrom) params.set("date_from", dateFrom);
			if (dateTo) params.set("date_to", dateTo);

			const { data } = await axios.get(
				`${API}/api/admin/payment-authorizations?${params.toString()}`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			setAuthorizations(data.authorizations || []);
			setTotalCount(data.total || 0);
			setTotalAmount(data.totalAmount || 0);
			setTotalPages(data.pagination?.totalPages || 1);
		} catch (e) {
			toast.error("Error al cargar autorizaciones");
		} finally {
			setLoading(false);
		}
	}, [token, page, debouncedSearch, dateFrom, dateTo]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Reset to page 1 when filters change.
	useEffect(() => {
		setPage(1);
	}, [debouncedSearch, dateFrom, dateTo]);

	const downloadPdf = async (auth) => {
		try {
			const response = await axios.get(
				`${API}/api/admin/payment-authorizations/${auth.id}/pdf`,
				{
					headers: { Authorization: `Bearer ${token}` },
					responseType: "blob",
				},
			);
			const blob = new Blob([response.data], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `payment-authorization-${auth.id}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (e) {
			toast.error("Error al descargar PDF");
		}
	};

	return (
		<div className="space-y-6" data-testid="payment-authorizations-page">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
						<CreditCard className="h-7 w-7 text-blue-600" />
						Autorizaciones de Pago
					</h1>
					<p className="text-gray-500 mt-1">
						{totalCount} autorizaciones registradas
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="text-right">
						<p className="text-xs text-gray-500">Total autorizado</p>
						<p className="text-lg font-bold text-emerald-600">
							${totalAmount.toLocaleString()} USD
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={fetchData}
						className="text-gray-500"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Search */}
			<Card>
				<CardContent className="p-4">
					<div className="flex flex-col sm:flex-row gap-3">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Buscar por pagador, beneficiario, ID o email..."
								className="pl-10 text-black"
							/>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1.5">
								<Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
								<input
									type="date"
									value={dateFrom}
									onChange={(e) => setDateFrom(e.target.value)}
									className="border border-gray-300 rounded-lg px-2.5 py-2 text-sm"
									style={{ color: "#333" }}
								/>
							</div>
							<span className="text-gray-400 text-sm">—</span>
							<input
								type="date"
								value={dateTo}
								onChange={(e) => setDateTo(e.target.value)}
								className="border border-gray-300 rounded-lg px-2.5 py-2 text-sm"
								style={{ color: "#333" }}
							/>
							{(dateFrom || dateTo) && (
								<button
									onClick={() => {
										setDateFrom("");
										setDateTo("");
									}}
									className="text-xs text-red-500 hover:underline whitespace-nowrap"
								>
									Limpiar
								</button>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* List */}
			{loading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-blue-600" />
				</div>
			) : authorizations.length === 0 ? (
				<Card>
					<CardContent className="p-12 text-center">
						<CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
						<h3 className="text-lg font-medium text-gray-900 mb-2">
							No hay autorizaciones
						</h3>
						<p className="text-gray-500 text-sm">
							Las autorizaciones de pago apareceran aqui cuando los clientes las
							completen.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{authorizations.map((auth) => {
						const isExpanded = expandedId === auth.id;
						const date = auth.submittedAt
							? new Date(auth.submittedAt).toLocaleDateString("es", {
									day: "numeric",
									month: "short",
									year: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})
							: "N/A";
						const cardLabel = auth.cardType === "credit" ? "Credito" : "Debito";

						return (
							<Card key={auth.id} className="hover:shadow-md transition-shadow">
								<CardContent className="p-0">
									{/* Summary row */}
									<button
										onClick={() => setExpandedId(isExpanded ? null : auth.id)}
										className="w-full text-left p-4 flex items-center gap-4"
									>
										<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
											<CreditCard className="h-5 w-5 text-blue-600" />
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="font-semibold text-gray-900">
													{auth.payerName}
												</span>
												{!auth.isSamePerson && (
													<>
														<span className="text-gray-400">→</span>
														<span className="font-medium text-gray-700">
															{auth.beneficiaryName}
														</span>
													</>
												)}
												{auth.isSamePerson && (
													<Badge className="bg-gray-100 text-gray-600 text-xs">
														Misma persona
													</Badge>
												)}
											</div>
											<div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
												<span className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													{date}
												</span>
												<span>
													****{auth.cardLastFour} ({cardLabel})
												</span>
												{auth.relationship && !auth.isSamePerson && (
													<Badge variant="outline" className="text-xs">
														{auth.relationship}
													</Badge>
												)}
											</div>
										</div>

										<div className="text-right flex-shrink-0">
											<p className="text-lg font-bold text-emerald-600">
												${(auth.amount || 0).toLocaleString()}
											</p>
											<p className="text-xs text-gray-400">{auth.currency}</p>
										</div>

										<div className="flex items-center gap-2 flex-shrink-0">
											<button
												onClick={(e) => {
													e.stopPropagation();
													downloadPdf(auth);
												}}
												className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
												title="Descargar PDF"
											>
												<Download className="h-4 w-4" />
											</button>
											{isExpanded ? (
												<ChevronUp className="h-4 w-4 text-gray-400" />
											) : (
												<ChevronDown className="h-4 w-4 text-gray-400" />
											)}
										</div>
									</button>

									{/* Expanded details */}
									{isExpanded && (
										<div
											className="px-4 pb-4 border-t border-gray-100 pt-4"
											style={{ color: "#333" }}
										>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												{/* Payer */}
												<div className="bg-gray-50 rounded-lg p-4">
													<h4
														className="text-xs font-semibold mb-2 flex items-center gap-1"
														style={{ color: "#6B7280" }}
													>
														<CreditCard className="h-3.5 w-3.5" />
														PAGADOR
													</h4>
													<div
														className="space-y-1.5 text-sm"
														style={{ color: "#111827" }}
													>
														<p>
															<span style={{ color: "#6B7280" }}>Nombre:</span>{" "}
															<strong>{auth.payerName}</strong>
														</p>
														<p>
															<span style={{ color: "#6B7280" }}>
																Direccion:
															</span>{" "}
															{auth.payerAddress}
															{auth.payerZip ? `, ${auth.payerZip}` : ""}
														</p>
														<p>
															<span style={{ color: "#6B7280" }}>
																Telefono:
															</span>{" "}
															{auth.payerPhone}
														</p>
														{auth.payerEmail && (
															<p>
																<span style={{ color: "#6B7280" }}>Email:</span>{" "}
																{auth.payerEmail}
															</p>
														)}
														<p>
															<span style={{ color: "#6B7280" }}>Tarjeta:</span>{" "}
															{cardLabel} ****{auth.cardLastFour}
														</p>
													</div>
												</div>

												{/* Beneficiary */}
												<div className="bg-gray-50 rounded-lg p-4">
													<h4
														className="text-xs font-semibold mb-2 flex items-center gap-1"
														style={{ color: "#6B7280" }}
													>
														<User className="h-3.5 w-3.5" />
														BENEFICIARIO
													</h4>
													<div
														className="space-y-1.5 text-sm"
														style={{ color: "#111827" }}
													>
														<p>
															<span style={{ color: "#6B7280" }}>Nombre:</span>{" "}
															<strong>{auth.beneficiaryName}</strong>
														</p>
														{auth.beneficiaryAddress && (
															<p>
																<span style={{ color: "#6B7280" }}>
																	Direccion:
																</span>{" "}
																{auth.beneficiaryAddress}
																{auth.beneficiaryZip
																	? `, ${auth.beneficiaryZip}`
																	: ""}
															</p>
														)}
														<p>
															<span style={{ color: "#6B7280" }}>
																Misma persona:
															</span>{" "}
															{auth.isSamePerson ? "Si" : "No"}
														</p>
														{!auth.isSamePerson && auth.relationship && (
															<p>
																<span style={{ color: "#6B7280" }}>
																	Relacion:
																</span>{" "}
																{auth.relationship}
															</p>
														)}
													</div>
												</div>
											</div>

											{/* Payment details */}
											<div className="mt-4 bg-emerald-50 rounded-lg p-4">
												<div className="flex items-center justify-between">
													<div>
														<p className="text-xs text-gray-500">
															Monto autorizado
														</p>
														<p className="text-xl font-bold text-emerald-600">
															${(auth.amount || 0).toLocaleString()}{" "}
															{auth.currency}
														</p>
													</div>
													<button
														onClick={() => downloadPdf(auth)}
														className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
													>
														<Download className="h-4 w-4" />
														Descargar PDF
													</button>
												</div>
											</div>

											<p className="text-xs text-gray-400 mt-3">
												ID: {auth.id} · IP: {auth.ipAddress || "N/A"}
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Pagination */}
			{!loading && totalPages > 1 && (
				<div className="flex items-center justify-between flex-wrap gap-3 pt-2">
					<p className="text-sm text-gray-500">
						Pagina {page} de {totalPages} · {totalCount} resultados
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page <= 1}
							className="flex items-center gap-1"
						>
							<ChevronLeft className="h-4 w-4" />
							Anterior
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							disabled={page >= totalPages}
							className="flex items-center gap-1"
						>
							Siguiente
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};

export default PaymentAuthorizationsList;
