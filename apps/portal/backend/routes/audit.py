"""Case audit log endpoints."""
from fastapi import APIRouter, HTTPException, Header
from typing import Annotated, Optional
from datetime import datetime, timezone
from config import db, logger
from utils.auth_helpers import verify_staff_token_impl
from bson import ObjectId

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
    """
    Log an audit entry for a case action.
    
    Args:
        case_id: ID of the case
        action: Human-readable description of the action
        action_type: Type of action (create, update, delete, upload, download, status_change, etc.)
        performed_by_id: ID of the user who performed the action
        performed_by_name: Name of the user who performed the action
        performed_by_role: Role of the user (admin, coordinator, client, etc.)
        details: Additional details about the action
        old_values: Previous values (for updates)
        new_values: New values (for updates)
    """
    try:
        audit_entry = {
            "caseId": case_id,
            "action": action,
            "actionType": action_type,
            "performedBy": {
                "id": performed_by_id,
                "name": performed_by_name,
                "role": performed_by_role
            },
            "details": details or {},
            "oldValues": old_values,
            "newValues": new_values,
            "timestamp": datetime.now(timezone.utc)
        }
        
        await db.case_audit_logs.insert_one(audit_entry)
        logger.info(f"📝 Audit log created for case {case_id}: {action}")
        return True
    except Exception as e:
        logger.error(f"Error creating audit log: {e}")
        return False


@router.get("/case/{case_id}")
async def get_case_audit_logs(
    case_id: str,
    authorization: Annotated[str, Header()],
    page: int = 1,
    limit: int = 50,
    action_type: Optional[str] = None
):
    """Get audit logs for a specific case."""
    try:
        staff_payload = verify_staff_token_impl(authorization)
        staff_id = staff_payload['id']
        user_role = staff_payload.get('role', 'advisor')
        
        # Verify access to case
        case = await db.visa_cases.find_one({'_id': case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        
        # Check access for coordinator/advisor roles
        if user_role in ['coordinator', 'advisor']:
            is_coordinator = case.get('coordinatorId') == staff_id
            is_seller = case.get('sellerId') == staff_id
            if not is_coordinator and not is_seller:
                raise HTTPException(status_code=403, detail="No tienes acceso a este caso")
        
        # Build query
        query = {"caseId": case_id}
        if action_type:
            query["actionType"] = action_type
        
        # Count total
        total = await db.case_audit_logs.count_documents(query)
        
        # Get paginated logs
        skip = (page - 1) * limit
        logs_cursor = db.case_audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        logs = await logs_cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for log in logs:
            if '_id' in log:
                log['id'] = str(log['_id'])
                del log['_id']
            if 'timestamp' in log and isinstance(log['timestamp'], datetime):
                log['timestamp'] = log['timestamp'].isoformat()
        
        return {
            "logs": logs,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit if total > 0 else 1
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting audit logs: {e}")
        raise HTTPException(status_code=500, detail="Error obteniendo historial de auditoría")


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
