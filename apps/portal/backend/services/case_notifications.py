"""
Case Activity & Email Notification Service
Logs all case actions and sends email notifications via Resend.
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import resend to avoid startup errors
_resend = None
def _get_resend():
    global _resend
    if _resend is None:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        _resend = resend
    return _resend

EMAIL_FROM = os.environ.get("EMAIL_FROM", "visa@urpeintegralservices.co")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://panel.urpeintegralservices.co")

# ===== Activity Types =====
class ActivityType:
    CLIENT_UPLOADED_DOC = "client_uploaded_doc"
    STAFF_UPLOADED_DELIVERABLE = "staff_uploaded_deliverable"
    DOC_VALIDATED = "doc_validated"
    DOC_REJECTED = "doc_rejected"
    PAYMENT_REGISTERED = "payment_registered"
    STAGE_UNLOCKED = "stage_unlocked"
    CASE_STATUS_CHANGED = "case_status_changed"
    COORDINATOR_ASSIGNED = "coordinator_assigned"

ACTIVITY_LABELS = {
    ActivityType.CLIENT_UPLOADED_DOC: "Documento subido por el cliente",
    ActivityType.STAFF_UPLOADED_DELIVERABLE: "Entregable subido",
    ActivityType.DOC_VALIDATED: "Documento validado",
    ActivityType.DOC_REJECTED: "Documento rechazado",
    ActivityType.PAYMENT_REGISTERED: "Pago registrado",
    ActivityType.STAGE_UNLOCKED: "Etapa desbloqueada",
    ActivityType.CASE_STATUS_CHANGED: "Estado del caso cambiado",
    ActivityType.COORDINATOR_ASSIGNED: "Coordinador asignado",
}

ACTIVITY_ICONS = {
    ActivityType.CLIENT_UPLOADED_DOC: "upload",
    ActivityType.STAFF_UPLOADED_DELIVERABLE: "file-plus",
    ActivityType.DOC_VALIDATED: "check-circle",
    ActivityType.DOC_REJECTED: "x-circle",
    ActivityType.PAYMENT_REGISTERED: "dollar-sign",
    ActivityType.STAGE_UNLOCKED: "unlock",
    ActivityType.CASE_STATUS_CHANGED: "refresh-cw",
    ActivityType.COORDINATOR_ASSIGNED: "user-plus",
}


async def log_activity(db, case_id: str, activity_type: str, performed_by: dict, details: dict = None):
    """Save an activity entry to the case_activities collection."""
    entry = {
        "caseId": case_id,
        "type": activity_type,
        "label": ACTIVITY_LABELS.get(activity_type, activity_type),
        "icon": ACTIVITY_ICONS.get(activity_type, "activity"),
        "performedBy": {
            "id": performed_by.get("id", ""),
            "name": performed_by.get("name", ""),
            "role": performed_by.get("role", ""),
        },
        "details": details or {},
        "timestamp": datetime.now(timezone.utc),
    }
    try:
        await db.case_activities.insert_one(entry)
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")


async def get_case_team(db, case_id: str):
    """Get coordinator and sales rep info for a case."""
    case = await db.visa_cases.find_one(
        {"$or": [{"_id": case_id}, {"id": case_id}]},
        {"coordinatorId": 1, "salesRepId": 1, "userId": 1}
    )
    if not case:
        return None, None, None

    coordinator = None
    sales_rep = None
    client = None

    coord_id = case.get("coordinatorId")
    if coord_id:
        staff = await db.staff.find_one({"_id": coord_id}, {"name": 1, "email": 1})
        if staff:
            coordinator = {"name": staff.get("name", ""), "email": staff.get("email", "")}

    sales_id = case.get("salesRepId")
    if sales_id:
        staff = await db.staff.find_one({"_id": sales_id}, {"name": 1, "email": 1})
        if staff:
            sales_rep = {"name": staff.get("name", ""), "email": staff.get("email", "")}

    user_id = case.get("userId")
    if user_id:
        user = await db.users.find_one(
            {"$or": [{"_id": user_id}, {"id": user_id}]},
            {"name": 1, "email": 1}
        )
        if not user:
            try:
                from bson import ObjectId
                user = await db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1, "email": 1})
            except:
                pass
        if user and user.get("email"):
            # Get magic link for client access URL
            user_id_str = str(user.get("id") or user.get("_id", ""))
            phone = user.get("phone")
            magic_link_url = None
            # Try by userId first, then by phone
            ml = await db.magic_links.find_one({"userId": user_id_str}, {"magicToken": 1})
            if not ml and phone:
                ml = await db.magic_links.find_one({"phone": phone}, {"magicToken": 1})
            if ml and ml.get("magicToken"):
                magic_link_url = f"{FRONTEND_URL}/welcome/{ml['magicToken']}"
            client = {"name": user.get("name", ""), "email": user.get("email", ""), "accessUrl": magic_link_url}

    return coordinator, sales_rep, client


def _send_email(to_email: str, subject: str, html: str):
    """Send an email via Resend. Non-blocking best-effort."""
    if not to_email or not os.environ.get("RESEND_API_KEY"):
        return
    try:
        r = _get_resend()
        r.Emails.send({
            "from": f"URPE Integral Services <{EMAIL_FROM}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent to {to_email}: {subject}")
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")


def _email_wrapper(client_name: str, title: str, body: str, cta_text: str = None, cta_url: str = None):
    """Generate a professional styled HTML email."""
    cta_html = ""
    if cta_text and cta_url:
        cta_html = f'''
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
          <tr>
            <td style="background:#C9A96A;border-radius:10px;padding:14px 36px;">
              <a href="{cta_url}" style="color:#0F172A;text-decoration:none;font-weight:700;font-size:15px;display:block;">{cta_text}</a>
            </td>
          </tr>
        </table>
        '''

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background:#0F172A;padding:28px 32px;text-align:center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td style="width:36px;height:36px;background:#C9A96A;border-radius:8px;text-align:center;vertical-align:middle;padding:6px;">
                        <span style="color:#0F172A;font-weight:900;font-size:16px;">U</span>
                      </td>
                      <td style="padding-left:12px;">
                        <span style="color:#F8FAFC;font-size:18px;font-weight:700;letter-spacing:-0.3px;">URPE Integral Services</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Gold accent line -->
              <tr><td style="background:#C9A96A;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
              
              <!-- Content -->
              <tr>
                <td style="padding:36px 32px 20px;">
                  <p style="margin:0 0 4px;color:#64748B;font-size:14px;">Hola <strong style="color:#334155;">{client_name}</strong>,</p>
                  <h1 style="margin:16px 0 20px;font-size:22px;color:#0F172A;line-height:1.3;">{title}</h1>
                  <div style="font-size:15px;line-height:1.7;color:#475569;">{body}</div>
                  {cta_html}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:20px 32px 28px;border-top:1px solid #E2E8F0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="text-align:center;">
                        <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">URPE Integral Services</p>
                        <p style="margin:0;font-size:11px;color:#CBD5E1;">3235 North Point Pkwy, Suite 101 &middot; Alpharetta, GA 30005</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


# ===== Notification functions (one per event type) =====

async def notify_client_uploaded_doc(db, case_id: str, client_name: str, doc_name: str, performed_by: dict):
    """Client uploaded a document → notify coordinator + sales rep."""
    await log_activity(db, case_id, ActivityType.CLIENT_UPLOADED_DOC, performed_by, {"documentName": doc_name, "clientName": client_name})

    coordinator, sales_rep, _ = await get_case_team(db, case_id)

    subject = f"Nuevo documento: {client_name} subio {doc_name}"
    body = f"<p>El cliente <strong>{client_name}</strong> ha subido el documento <strong>{doc_name}</strong> a su caso.</p><p>Revisa y valida el documento desde el panel de administracion.</p>"

    for person in [coordinator, sales_rep]:
        if person and person.get("email"):
            html = _email_wrapper(person["name"], "Nuevo documento del cliente", body, "Ver caso", f"{FRONTEND_URL}/admin/visa-cases/{case_id}")
            _send_email(person["email"], subject, html)


async def notify_deliverable_uploaded(db, case_id: str, deliverable_name: str, stage_number: int, performed_by: dict):
    """Staff uploaded a deliverable → notify client."""
    await log_activity(db, case_id, ActivityType.STAFF_UPLOADED_DELIVERABLE, performed_by, {"deliverableName": deliverable_name, "stageNumber": stage_number})

    _, _, client = await get_case_team(db, case_id)
    if client and client.get("email"):
        subject = "Nuevo documento disponible en tu caso"
        body = f"<p>Se ha subido un nuevo entregable a tu caso:</p><p><strong>{deliverable_name}</strong> (Etapa {stage_number})</p><p>Ingresa a tu panel para verlo.</p>"
        html = _email_wrapper(client["name"], "Nuevo entregable disponible", body, "Ver mi caso", client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/my-case")
        _send_email(client["email"], subject, html)


async def notify_doc_validated(db, case_id: str, doc_name: str, performed_by: dict):
    """Document validated → notify client."""
    await log_activity(db, case_id, ActivityType.DOC_VALIDATED, performed_by, {"documentName": doc_name})

    _, _, client = await get_case_team(db, case_id)
    if client and client.get("email"):
        subject = f"Documento aprobado: {doc_name}"
        body = f"<p>Tu documento <strong>{doc_name}</strong> ha sido revisado y <strong style='color:#22C55E;'>aprobado</strong>.</p>"
        html = _email_wrapper(client["name"], "Documento aprobado", body, "Ver mi caso", client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/my-case")
        _send_email(client["email"], subject, html)


async def notify_doc_rejected(db, case_id: str, doc_name: str, reason: str, performed_by: dict):
    """Document rejected → notify client."""
    await log_activity(db, case_id, ActivityType.DOC_REJECTED, performed_by, {"documentName": doc_name, "reason": reason})

    _, _, client = await get_case_team(db, case_id)
    if client and client.get("email"):
        subject = f"Documento requiere correccion: {doc_name}"
        reason_html = f"<p><strong>Motivo:</strong> {reason}</p>" if reason else ""
        body = f"<p>Tu documento <strong>{doc_name}</strong> necesita ser corregido.</p>{reason_html}<p>Por favor sube una nueva version.</p>"
        html = _email_wrapper(client["name"], "Documento necesita correccion", body, "Subir correccion", client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/my-case")
        _send_email(client["email"], subject, html)


async def notify_payment_registered(db, case_id: str, amount: float, stage_numbers: list, performed_by: dict):
    """Payment registered → notify client + admin."""
    stages_str = ", ".join([str(s) for s in stage_numbers])
    await log_activity(db, case_id, ActivityType.PAYMENT_REGISTERED, performed_by, {"amount": amount, "stageNumbers": stage_numbers})

    coordinator, _, client = await get_case_team(db, case_id)
    subject = f"Pago de ${amount:,.2f} registrado - Etapa(s) {stages_str}"
    body = f"<p>Se ha registrado un pago de <strong>${amount:,.2f}</strong> para la(s) etapa(s) <strong>{stages_str}</strong>.</p>"

    if client and client.get("email"):
        html = _email_wrapper(client["name"], "Pago registrado", body, "Ver mi caso", client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/my-case")
        _send_email(client["email"], subject, html)

    if coordinator and coordinator.get("email"):
        html = _email_wrapper(coordinator["name"], "Pago registrado", body, "Ver caso", f"{FRONTEND_URL}/admin/visa-cases/{case_id}")
        _send_email(coordinator["email"], subject, html)


async def notify_stage_unlocked(db, case_id: str, stage_number: int, stage_name: str, performed_by: dict):
    """Stage unlocked → notify client."""
    await log_activity(db, case_id, ActivityType.STAGE_UNLOCKED, performed_by, {"stageNumber": stage_number, "stageName": stage_name})

    _, _, client = await get_case_team(db, case_id)
    if client and client.get("email"):
        subject = f"Etapa {stage_number} desbloqueada"
        body = f"<p>La <strong>Etapa {stage_number}: {stage_name}</strong> de tu caso ha sido desbloqueada.</p><p>Ya puedes acceder a los entregables y documentos de esta etapa.</p>"
        html = _email_wrapper(client["name"], "Etapa desbloqueada", body, "Ver mi caso", client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/my-case")
        _send_email(client["email"], subject, html)


async def notify_case_status_changed(db, case_id: str, old_status: str, new_status: str, performed_by: dict):
    """Case status changed → notify client."""
    await log_activity(db, case_id, ActivityType.CASE_STATUS_CHANGED, performed_by, {"oldStatus": old_status, "newStatus": new_status})

    _, _, client = await get_case_team(db, case_id)
    if client and client.get("email"):
        subject = f"Estado de tu caso actualizado"
        body = f"<p>El estado de tu caso ha cambiado a: <strong>{new_status}</strong></p>"
        html = _email_wrapper(client["name"], "Estado actualizado", body, "Ver mi caso", client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/my-case")
        _send_email(client["email"], subject, html)


async def notify_coordinator_assigned(db, case_id: str, coordinator_name: str, coordinator_email: str, client_name: str, performed_by: dict):
    """Coordinator assigned → notify new coordinator."""
    await log_activity(db, case_id, ActivityType.COORDINATOR_ASSIGNED, performed_by, {"coordinatorName": coordinator_name, "clientName": client_name})

    if coordinator_email:
        subject = f"Nuevo caso asignado: {client_name}"
        body = f"<p>Se te ha asignado el caso del cliente <strong>{client_name}</strong>.</p><p>Revisa los detalles del caso en el panel de administracion.</p>"
        html = _email_wrapper(coordinator_name, "Caso asignado", body, "Ver caso", f"{FRONTEND_URL}/admin/visa-cases/{case_id}")
        _send_email(coordinator_email, subject, html)
