"""Case audit log endpoints."""
from fastapi import APIRouter, HTTPException, Header
from typing import Annotated, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/audit", tags=["Audit Logs"])


async def log_case_audit(
    case_id: str,
    action: str,
    action_type: str,
    performed_by_id: str,
    performed_by_name: str,
    performed_by_role: str,
    details: dict = None,
    old_values: dict = None,
    new_values: dict = None
):
    """Log an audit entry for a case action using Supabase."""
    try:
        from db.supabase_client import insert
        audit_entry = {
            "case_id": case_id,
            "staff_id": performed_by_id,
            "action": action,
            "field_changed": action_type,
            "old_value": str(old_values) if old_values else None,
            "new_value": str(new_values) if new_values else None,
            "details": details or {},
        }
        insert("case_audit_logs", audit_entry)
        logger.info(f"📝 Audit log: {action}")
        return True
    except Exception as e:
        logger.error(f"Error creating audit log: {e}")
        return False


# Legacy GET endpoint removed — use /admin/cases/{case_id}/activities instead


# Action type constants for consistency
class AuditActionTypes:
    # Case actions
    CASE_CREATED = "case_created"
    CASE_UPDATED = "case_updated"
    CASE_STATUS_CHANGED = "case_status_changed"
    CASE_COORDINATOR_ASSIGNED = "coordinator_assigned"
    CASE_SELLER_ASSIGNED = "seller_assigned"
    
    # Stage actions
    STAGE_UNLOCKED = "stage_unlocked"
    STAGE_COMPLETED = "stage_completed"
    STAGE_AMOUNT_UPDATED = "stage_amount_updated"
    
    # Document actions
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_VALIDATED = "document_validated"
    DOCUMENT_REJECTED = "document_rejected"
    DOCUMENT_DELETED = "document_deleted"
    
    # Deliverable actions
    DELIVERABLE_ADDED = "deliverable_added"
    DELIVERABLE_UPDATED = "deliverable_updated"
    DELIVERABLE_DELETED = "deliverable_deleted"
    DELIVERABLE_FILE_UPLOADED = "deliverable_file_uploaded"
    DELIVERABLE_MOVED = "deliverable_moved"
    
    # Payment actions
    PAYMENT_REGISTERED = "payment_registered"
    PAYMENT_DELETED = "payment_deleted"
    
    # Form actions
    FORM_SUBMITTED = "form_submitted"
    FORM_SAVED = "form_saved"
    FORM_COMPLETED = "form_completed"
    
    # Other
    MAGIC_LINK_GENERATED = "magic_link_generated"
    ELIGIBILITY_REPORT_GENERATED = "eligibility_report_generated"


# Human-readable action labels (Spanish)
ACTION_LABELS = {
    AuditActionTypes.CASE_CREATED: "Caso creado",
    AuditActionTypes.CASE_UPDATED: "Caso actualizado",
    AuditActionTypes.CASE_STATUS_CHANGED: "Estado del caso cambiado",
    AuditActionTypes.CASE_COORDINATOR_ASSIGNED: "Coordinador asignado",
    AuditActionTypes.CASE_SELLER_ASSIGNED: "Vendedor asignado",
    AuditActionTypes.STAGE_UNLOCKED: "Etapa desbloqueada",
    AuditActionTypes.STAGE_COMPLETED: "Etapa completada",
    AuditActionTypes.STAGE_AMOUNT_UPDATED: "Monto de etapa actualizado",
    AuditActionTypes.DOCUMENT_UPLOADED: "Documento subido",
    AuditActionTypes.DOCUMENT_VALIDATED: "Documento validado",
    AuditActionTypes.DOCUMENT_REJECTED: "Documento rechazado",
    AuditActionTypes.DOCUMENT_DELETED: "Documento eliminado",
    AuditActionTypes.DELIVERABLE_ADDED: "Entregable agregado",
    AuditActionTypes.DELIVERABLE_UPDATED: "Entregable actualizado",
    AuditActionTypes.DELIVERABLE_DELETED: "Entregable eliminado",
    AuditActionTypes.DELIVERABLE_FILE_UPLOADED: "Archivo de entregable subido",
    AuditActionTypes.DELIVERABLE_MOVED: "Entregable movido",
    AuditActionTypes.PAYMENT_REGISTERED: "Pago registrado",
    AuditActionTypes.PAYMENT_DELETED: "Pago eliminado",
    AuditActionTypes.FORM_SUBMITTED: "Formulario enviado",
    AuditActionTypes.FORM_SAVED: "Formulario guardado",
    AuditActionTypes.FORM_COMPLETED: "Formulario completado",
    AuditActionTypes.MAGIC_LINK_GENERATED: "Link mágico generado",
    AuditActionTypes.ELIGIBILITY_REPORT_GENERATED: "Reporte de elegibilidad generado",
}
