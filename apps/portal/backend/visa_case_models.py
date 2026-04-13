"""
Modelos para el sistema Pay As You Advance Visa
Sistema de gestión de casos de visa con pagos progresivos
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from enum import Enum

# ============= ENUMS =============

class VisaType(str, Enum):
    EB2_NIW = "EB-2 NIW"
    EB1 = "EB-1"
    EB1A = "EB-1A"
    EB1B = "EB-1B"
    EB1C = "EB-1C"
    O1 = "O-1"
    L1A = "L-1A"
    E2 = "E-2"

class CaseStatus(str, Enum):
    PROCESO_VENTA = "proceso_venta"                # En proceso de venta (default)
    ELIGIBILITY_APPROVED = "elegibility_approved"  # Elegibilidad aprobada
    ACTIVE = "active"                              # Caso activo
    IN_PROGRESS = "in_progress"                    # En progreso
    READY_TO_FILE = "ready_to_file"               # Listo para radicar
    FILED = "filed"                                # Radicado
    APPROVED = "approved"                          # Aprobado
    DENIED = "denied"                              # Denegado
    ON_HOLD = "on_hold"                           # En espera
    EN_PROCESO = "en_proceso"                      # En proceso
    FINALIZADO = "finalizado"                      # Finalizado
    ANALIZANDO = "analizando"                      # Analizando
    IMPRESO = "impreso"                            # Impreso
    ENVIADO = "enviado"                            # Enviado
    IOE = "ioe"                                    # IOE
    DEVUELTO = "devuelto"                          # Devuelto

class StageStatus(str, Enum):
    LOCKED = "locked"                 # Bloqueada
    UNLOCKED = "unlocked"             # Desbloqueada
    IN_PROGRESS = "in_progress"       # En progreso
    PAYMENT_PENDING = "payment_pending"  # Pago pendiente
    COMPLETED = "completed"           # Completada

class DeliverableStatus(str, Enum):
    PENDING = "pending"               # Pendiente
    DRAFT = "draft"                   # Borrador (con marca de agua)
    UNLOCKED = "unlocked"             # Desbloqueado (cliente pagó)
    VALIDATED = "validated"           # Validado
    NEEDS_REVISION = "needs_revision" # Necesita revisión

class DocumentStatus(str, Enum):
    PENDING = "pending"               # Pendiente de subir
    UPLOADED = "uploaded"             # Subido
    IN_REVIEW = "in_review"           # En revisión
    VALIDATED = "validated"           # Validado
    REJECTED = "rejected"             # Rechazado
    NEEDS_TRANSLATION = "needs_translation"  # Necesita traducción

class PaymentStatus(str, Enum):
    PENDING = "pending"               # Pendiente
    PROCESSING = "processing"         # Procesando
    COMPLETED = "completed"           # Completado
    FAILED = "failed"                 # Fallido
    REFUNDED = "refunded"             # Reembolsado

class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"           # Agendada
    COMPLETED = "completed"           # Completada
    CANCELLED = "cancelled"           # Cancelada
    NO_SHOW = "no_show"              # No asistió

# ============= STAGE CONFIGURATION =============

STAGE_DELIVERABLES = {
    1: [
        {"name": "Business Plan", "description": "Plan de negocios completo y detallado"},
        {"name": "Estudio Econométrico", "description": "Análisis econométrico del impacto"},
        {"name": "White Paper Técnico", "description": "Documento técnico especializado"}
    ],
    2: [
        {"name": "Patente Registrada", "description": "Patente con uso real documentado"},
        {"name": "Libro Técnico con ISBN", "description": "Publicación técnica con ISBN"},
        {"name": "3 Artículos Q1/Q2", "description": "Artículos científicos aceptados con DOI"}
    ],
    3: [
        {"name": "Casos de Estudio Empresariales", "description": "Casos de estudio documentados"},
        {"name": "Reporte de Impacto Social", "description": "Policy Paper de impacto"},
        {"name": "Carta de Innovación URPE AI Lab", "description": "Carta de validación del laboratorio"}
    ],
    4: [
        {"name": "Web App Profesional", "description": "Aplicación web + redes + branding"},
        {"name": "Cartas de Recomendación", "description": "Cartas de expertos en el campo"},
        {"name": "Cartas de Experto", "description": "Cartas de opinion de expertos"},
        {"name": "Carta de Autopetición", "description": "Carta de autopetición completa"}
    ]
}

STAGE_DOCUMENTS_REQUIRED = {
    1: [
        {"type": "diploma", "name": "Diploma Universitario", "required": True, "physical": False},
        {"type": "transcript", "name": "Transcripciones Académicas", "required": True, "physical": False},
        {"type": "passport", "name": "Pasaporte", "required": True, "physical": False}
    ],
    2: [
        {"type": "work_certificate", "name": "Certificados de Trabajo", "required": True, "physical": False},
        {"type": "recommendation_letter", "name": "Cartas de Recomendación", "required": True, "physical": True},
        {"type": "publications", "name": "Publicaciones Científicas", "required": False, "physical": False}
    ],
    3: [
        {"type": "expert_letter", "name": "Cartas de Experto", "required": True, "physical": True},
        {"type": "awards", "name": "Premios y Reconocimientos", "required": False, "physical": False}
    ],
    4: [
        {"type": "i140_form", "name": "Formulario I-140 Firmado", "required": True, "physical": True},
        {"type": "birth_certificate", "name": "Acta de Nacimiento", "required": True, "physical": False},
        {"type": "marriage_certificate", "name": "Acta de Matrimonio", "required": False, "physical": False}
    ]
}

# ============= MODELS =============

class VisaCase(BaseModel):
    """Modelo principal para un caso de visa"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Información básica
    userId: str  # Usuario/cliente asociado
    coordinatorId: Optional[str] = None  # Staff coordinadora asignada
    salesRepId: Optional[str] = None  # Staff vendedor asignado
    visaType: VisaType = VisaType.EB2_NIW
    
    # Estado del caso
    status: CaseStatus = CaseStatus.PROCESO_VENTA
    currentStage: int = 1  # 1, 2, 3, 4
    overallProgress: int = 0  # 0-100%
    
    # Fechas importantes
    eligibilityDate: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    filedAt: Optional[datetime] = None
    approvedAt: Optional[datetime] = None
    
    # Financiero
    totalFee: float = 6240.00  # $6,240 USD inicial
    paidAmount: float = 0.00
    remainingBalance: float = 10760.00  # Saldo después de inicial
    
    # Metadata
    notes: Optional[str] = None
    tags: List[str] = []
    customFields: Dict[str, Any] = {}


class Stage(BaseModel):
    """Modelo para cada etapa del proceso (4 etapas)"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    caseId: str
    stageNumber: int  # 1, 2, 3, 4
    percentage: int  # 25, 50, 75, 100
    amount: float  # $1,560 por etapa
    
    status: StageStatus = StageStatus.LOCKED
    isPaid: bool = False
    paidAt: Optional[datetime] = None
    
    # Progreso de la etapa
    deliverablesCompleted: int = 0
    totalDeliverables: int = 0
    documentsReceived: int = 0
    totalDocuments: int = 0
    
    # Fechas
    unlockedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Deliverable(BaseModel):
    """Entregable de una etapa (Business Plan, Patente, etc.)"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    caseId: str
    stageId: str
    stageNumber: int
    
    # Información del entregable
    name: str
    description: str
    category: Optional[str] = None
    
    # Archivo
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None
    fileSize: Optional[int] = None
    mimeType: Optional[str] = None
    
    # Estado
    status: DeliverableStatus = DeliverableStatus.DRAFT
    isDraft: bool = True  # Marca de agua mientras no paguen
    
    # Metadata
    uploadedBy: Optional[str] = None  # Staff que lo subió
    uploadedAt: Optional[datetime] = None
    unlockedAt: Optional[datetime] = None
    
    notes: Optional[str] = None
    version: int = 1
    
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClientDocument(BaseModel):
    """Documento que el cliente debe subir"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    caseId: str
    stageNumber: Optional[int] = None  # A qué etapa pertenece
    
    # Tipo de documento
    documentType: str  # diploma, passport, work_certificate, etc.
    documentName: str
    isRequired: bool = True
    requiresPhysicalCopy: bool = False  # Si debe enviarse por correo
    
    # Archivo
    fileName: Optional[str] = None
    fileUrl: Optional[str] = None
    fileSize: Optional[int] = None
    mimeType: Optional[str] = None
    
    # Estado
    status: DocumentStatus = DocumentStatus.PENDING
    
    # Revisión
    reviewedBy: Optional[str] = None  # Staff que revisó
    reviewedAt: Optional[datetime] = None
    rejectionReason: Optional[str] = None
    validationNotes: Optional[str] = None
    
    # Traducción (si aplica)
    needsTranslation: bool = False
    originalLanguage: Optional[str] = None
    translatedFileUrl: Optional[str] = None
    
    # Fechas
    uploadedAt: Optional[datetime] = None
    validatedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Payment(BaseModel):
    """Pago de una etapa"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    caseId: str
    userId: str
    stageNumber: int
    
    # Información del pago
    amount: float
    currency: str = "USD"
    description: str
    
    # Stripe
    stripePaymentIntentId: Optional[str] = None
    stripePaymentMethodId: Optional[str] = None
    stripeChargeId: Optional[str] = None
    
    # Estado
    status: PaymentStatus = PaymentStatus.PENDING
    
    # Metadata
    paymentMethod: Optional[str] = None  # card, bank_transfer, etc.
    receiptUrl: Optional[str] = None
    invoiceUrl: Optional[str] = None
    
    # Fechas
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    paidAt: Optional[datetime] = None
    failedAt: Optional[datetime] = None
    refundedAt: Optional[datetime] = None
    
    # Error handling
    errorMessage: Optional[str] = None
    retryCount: int = 0


class Meeting(BaseModel):
    """Reunión con la coordinadora"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    caseId: str
    userId: str
    coordinatorId: str
    
    # Información de la reunión
    title: str
    description: Optional[str] = None
    stageNumber: Optional[int] = None  # Relacionada a qué etapa
    
    # Fecha y hora
    scheduledAt: datetime
    duration: int = 60  # Minutos
    endTime: Optional[datetime] = None
    
    # Links
    meetingLink: Optional[str] = None  # Zoom, Google Meet, etc.
    calendarEventId: Optional[str] = None
    
    # Estado
    status: MeetingStatus = MeetingStatus.SCHEDULED
    
    # Notas
    agendaItems: List[str] = []
    notes: Optional[str] = None
    actionItems: List[str] = []
    
    # Recordatorios
    reminderSent: bool = False
    reminderSentAt: Optional[datetime] = None
    
    # Fechas
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completedAt: Optional[datetime] = None
    cancelledAt: Optional[datetime] = None


# ============= HELPER FUNCTIONS =============

def create_stages_for_case(case_id: str) -> List[Dict]:
    """Crea las 4 etapas iniciales para un caso nuevo"""
    stages = []
    
    for stage_num in range(1, 5):
        stage_id = str(uuid.uuid4())
        stage = {
            "_id": stage_id,
            "id": stage_id,
            "caseId": case_id,
            "stageNumber": stage_num,
            "percentage": stage_num * 25,
            "amount": 1560.00,
            "status": StageStatus.UNLOCKED if stage_num == 1 else StageStatus.LOCKED,
            "isPaid": False,
            "deliverablesCompleted": 0,
            "totalDeliverables": len(STAGE_DELIVERABLES.get(stage_num, [])),
            "documentsReceived": 0,
            "totalDocuments": len(STAGE_DOCUMENTS_REQUIRED.get(stage_num, [])),
            "unlockedAt": datetime.now(timezone.utc).isoformat() if stage_num == 1 else None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        stages.append(stage)
    
    return stages


def create_deliverables_for_stage(case_id: str, stage_id: str, stage_number: int) -> List[Dict]:
    """Crea los entregables para una etapa específica"""
    deliverables = []
    stage_delivs = STAGE_DELIVERABLES.get(stage_number, [])
    
    for deliv in stage_delivs:
        deliv_id = str(uuid.uuid4())
        deliverable = {
            "_id": deliv_id,
            "id": deliv_id,
            "caseId": case_id,
            "stageId": stage_id,
            "stageNumber": stage_number,
            "name": deliv["name"],
            "description": deliv["description"],
            "status": DeliverableStatus.DRAFT,
            "isDraft": True,
            "version": 1,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        deliverables.append(deliverable)
    
    return deliverables


def create_document_checklist_for_stage(case_id: str, stage_number: int) -> List[Dict]:
    """Crea el checklist de documentos para una etapa"""
    documents = []
    stage_docs = STAGE_DOCUMENTS_REQUIRED.get(stage_number, [])
    
    for doc in stage_docs:
        doc_id = str(uuid.uuid4())
        document = {
            "_id": doc_id,
            "id": doc_id,
            "caseId": case_id,
            "stageNumber": stage_number,
            "documentType": doc["type"],
            "documentName": doc["name"],
            "isRequired": doc["required"],
            "requiresPhysicalCopy": doc["physical"],
            "status": DocumentStatus.PENDING,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        documents.append(document)
    
    return documents
