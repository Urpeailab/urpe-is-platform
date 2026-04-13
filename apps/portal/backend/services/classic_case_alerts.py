"""
Classic Cases - Daily Alert System with Escalation
Cron that runs daily detecting: RFE deadlines, stale cases, missing IOE, no contact, etc.
Sends ONE consolidated email per person with all their priority cases.
"""
import logging
import asyncio
import httpx
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List

logger = logging.getLogger(__name__)

CLASSIC_N8N_WEBHOOK_URL = os.environ.get("CLASSIC_N8N_WEBHOOK_URL", "")

# Escalation chains (days -> list of roles to notify)
ESCALATION_RFE = [
    (30, ["coordinator"]),
    (15, ["coordinator", "director"]),
    (7, ["coordinator", "director", "operations"]),
    (3, ["coordinator", "director", "operations", "assistant"]),
    (0, ["coordinator", "director", "operations", "assistant", "president"]),
]

ESCALATION_NO_WORK_STATUS = [
    (3, ["coordinator"]),
    (7, ["coordinator", "director"]),
    (14, ["coordinator", "operations"]),
    (30, ["coordinator", "operations", "president"]),
]

ESCALATION_WORKING_NO_PROGRESS = [
    (7, ["coordinator"]),
    (14, ["coordinator", "director"]),
    (21, ["coordinator", "operations"]),
    (30, ["coordinator", "operations", "president"]),
]

ESCALATION_PAUSED = [
    (5, ["coordinator"]),
    (10, ["coordinator", "director"]),
    (20, ["coordinator", "operations"]),
    (30, ["coordinator", "operations", "assistant"]),
    (45, ["coordinator", "operations", "assistant", "president"]),
]

ESCALATION_NO_CONTACT = [
    (5, ["coordinator"]),
    (7, ["coordinator", "director"]),
    (14, ["coordinator", "operations"]),
    (21, ["coordinator", "operations", "assistant"]),
    (30, ["coordinator", "operations", "assistant", "president"]),
]

# Role to email mapping (configured per deployment)
ROLE_EMAILS = {
    "coordinator": None,  # Uses case.coordinatorId → staff email
    "director": "dau@urpeintegralservices.co",
    "operations": "ap@urpeintegralservices.co",
    "assistant": "asistente@urpeintegralservices.co",
    "president": "presidente@urpeintegralservices.co",
}

# Client follow-up notifications by wait percentage — differentiated content
WAIT_MILESTONES = [
    (0.30, "30pct"),
    (0.50, "50pct"),
    (0.70, "70pct"),
    (1.00, "100pct"),
]

def _milestone_body(key, case, ioe, processing_type):
    """Generate differentiated email body per milestone."""
    ioe_html = f"<p>Tu IOE: <strong>{ioe}</strong> — <a href='https://egov.uscis.gov/casestatus/mycasestatus.do'>Consultar en USCIS</a></p>" if ioe else ""
    if key == "30pct":
        return (
            f"<p>Tu caso sigue en proceso. Todo va segun los tiempos esperados de USCIS.</p>"
            f"{ioe_html}"
            f"<p style='color:#6B7280;font-size:13px;'>Nuestro equipo revisa tu caso diariamente. "
            f"Te mantendremos informado sobre cada avance.</p>"
        )
    elif key == "50pct":
        time_info = "45 dias" if processing_type == "premium" else "18 a 24 meses"
        return (
            f"<p>Estamos a mitad del tiempo estimado de procesamiento.</p>"
            f"<p style='color:#6B7280;font-size:13px;'>El tiempo estimado para tu tipo de caso ({processing_type}) es de aproximadamente <strong>{time_info}</strong>. "
            f"Todo sigue su curso normal.</p>"
            f"{ioe_html}"
        )
    elif key == "70pct":
        return (
            f"<p>Nos acercamos al tiempo estimado de respuesta de USCIS.</p>"
            f"{ioe_html}"
            f"<p style='color:#6B7280;font-size:13px;'>Te notificaremos inmediatamente cuando haya una actualizacion. "
            f"Nuestro equipo esta atento a cualquier novedad.</p>"
        )
    elif key == "100pct":
        extra = (
            "Si USCIS no ha respondido en los proximos dias, nuestro equipo evaluara opciones como una consulta de servicio (e-Request)."
            if processing_type == "premium" else
            "A veces USCIS demora mas de lo habitual, pero estamos monitoreando activamente tu caso."
        )
        return (
            f"<p>Se ha cumplido el tiempo estandar de procesamiento de USCIS.</p>"
            f"<p style='color:#6B7280;font-size:13px;'>{extra}</p>"
            f"{ioe_html}"
        )
    return f"<p>Seguimiento de tu caso.</p>{ioe_html}"


def _days_between(date_str, now):
    """Calculate days between a date string and now."""
    if not date_str:
        return None
    try:
        if isinstance(date_str, str):
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            dt = date_str
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (now - dt).days
    except:
        return None


def _get_escalation_roles(days, chain):
    """Get which roles should be notified based on days and escalation chain."""
    roles = set()
    for threshold, role_list in chain:
        if days >= threshold:
            roles.update(role_list)
    return roles


async def _get_role_email(db, role, case):
    """Resolve role to actual email address."""
    if role == "coordinator":
        coord_id = case.get("coordinatorId")
        if coord_id:
            staff = await db.staff.find_one({"_id": coord_id}, {"email": 1})
            return staff.get("email") if staff else None
        return None
    return ROLE_EMAILS.get(role)


async def run_classic_case_alerts(db):
    """Main alert function — detects issues and builds consolidated emails."""
    now = datetime.now(timezone.utc)
    alerts_by_email: Dict[str, List[dict]] = {}

    cases = await db.classic_cases.find(
        {"status": {"$nin": ["aprobado"]}},
        {"deliverables": 0}
    ).to_list(5000)

    logger.info(f"Classic alerts: checking {len(cases)} active cases")

    for case in cases:
        case_id = case.get("id", "")
        name = case.get("name", "Unknown")
        status = case.get("status", "")

        # 1. RFE deadline approaching
        if status == "rfe_recibido" and case.get("rfeDeadline"):
            deadline_days = _days_between(case["rfeDeadline"], now)
            if deadline_days is not None:
                days_remaining = -deadline_days  # negative = past deadline
                if days_remaining <= 30:
                    roles = _get_escalation_roles(30 - days_remaining, ESCALATION_RFE)
                    for role in roles:
                        email = await _get_role_email(db, role, case)
                        if email:
                            alerts_by_email.setdefault(email, []).append({
                                "type": "rfe_deadline",
                                "priority": "critical" if days_remaining <= 7 else "high",
                                "client": name,
                                "message": f"RFE vence en {days_remaining} dias" if days_remaining > 0 else f"RFE VENCIDO hace {abs(days_remaining)} dias",
                                "caseId": case_id,
                            })

        # 2. Radicado without IOE > 30 days
        if status == "radicado":
            filing_days = _days_between(case.get("filingDate"), now)
            if filing_days and filing_days > 30:
                coord_email = await _get_role_email(db, "coordinator", case)
                if coord_email:
                    alerts_by_email.setdefault(coord_email, []).append({
                        "type": "no_ioe",
                        "priority": "medium",
                        "client": name,
                        "message": f"Radicado hace {filing_days} dias sin IOE",
                        "caseId": case_id,
                    })

        # 3. No work status or stale work status
        work_status = case.get("workStatus")
        ws_days = _days_between(case.get("workStatusChangedAt"), now)

        if not work_status and ws_days:
            roles = _get_escalation_roles(ws_days, ESCALATION_NO_WORK_STATUS)
            for role in roles:
                email = await _get_role_email(db, role, case)
                if email:
                    alerts_by_email.setdefault(email, []).append({
                        "type": "no_work_status",
                        "priority": "medium",
                        "client": name,
                        "message": f"Sin estado de trabajo asignado ({ws_days} dias)",
                        "caseId": case_id,
                    })

        # 4. Working but no progress
        if work_status == "working":
            progress_days = _days_between(case.get("lastProgressChangeAt"), now)
            if progress_days and progress_days >= 7:
                roles = _get_escalation_roles(progress_days, ESCALATION_WORKING_NO_PROGRESS)
                for role in roles:
                    email = await _get_role_email(db, role, case)
                    if email:
                        alerts_by_email.setdefault(email, []).append({
                            "type": "stale_progress",
                            "priority": "medium" if progress_days < 21 else "high",
                            "client": name,
                            "message": f"Trabajando pero sin progreso ({progress_days} dias)",
                            "caseId": case_id,
                        })

        # 5. Paused too long
        if work_status == "paused" and ws_days:
            roles = _get_escalation_roles(ws_days, ESCALATION_PAUSED)
            for role in roles:
                email = await _get_role_email(db, role, case)
                if email:
                    alerts_by_email.setdefault(email, []).append({
                        "type": "paused_too_long",
                        "priority": "low" if ws_days < 20 else "medium",
                        "client": name,
                        "message": f"Pausado hace {ws_days} dias",
                        "caseId": case_id,
                    })

        # 6. No client contact
        contact_days = _days_between(case.get("lastContactAt"), now)
        if contact_days is None:
            contact_days = _days_between(case.get("createdAt"), now) or 0

        if contact_days >= 5:
            roles = _get_escalation_roles(contact_days, ESCALATION_NO_CONTACT)
            for role in roles:
                email = await _get_role_email(db, role, case)
                if email:
                    alerts_by_email.setdefault(email, []).append({
                        "type": "no_contact",
                        "priority": "medium" if contact_days < 14 else "high",
                        "client": name,
                        "message": f"Sin contactar al cliente ({contact_days} dias)",
                        "caseId": case_id,
                    })

    # 7. Client follow-up notifications (wait time percentage)
    waiting_cases = await db.classic_cases.find(
        {"status": {"$in": ["recibido_uscis", "rfe_respondido"]}},
        {"deliverables": 0}
    ).to_list(5000)

    for case in waiting_cases:
        filing_date = case.get("filingDate")
        if not filing_date:
            continue

        processing_type = case.get("processingType", "normal")
        expected_days = 45 if processing_type == "premium" else 700
        elapsed_days = _days_between(filing_date, now)
        if elapsed_days is None:
            continue

        pct = elapsed_days / expected_days
        client_email = case.get("email")
        if not client_email:
            continue

        milestone_key = f"wait_milestone_{case.get('id')}"
        last_milestone = await db.classic_case_milestones.find_one({"key": milestone_key})
        last_pct = last_milestone.get("lastPct", 0) if last_milestone else 0

        for threshold, milestone_id in WAIT_MILESTONES:
            if pct >= threshold > last_pct:
                try:
                    from services.case_notifications import _send_email, _email_wrapper
                    ioe = case.get("ioeNumber", "")
                    body = _milestone_body(milestone_id, case, ioe, processing_type)
                    html = _email_wrapper(case.get("name", "Cliente"), "Seguimiento de tu caso", body)
                    _send_email(client_email, "Seguimiento de tu caso", html)
                    # N8N webhook for milestone
                    if CLASSIC_N8N_WEBHOOK_URL:
                        try:
                            async with httpx.AsyncClient(timeout=10) as hc:
                                await hc.post(CLASSIC_N8N_WEBHOOK_URL, json={
                                    "client_id": case.get("id", ""),
                                    "client_name": case.get("name", ""),
                                    "client_email": client_email,
                                    "event_type": f"client_followup_{milestone_id}",
                                    "processed_by": "cron_system",
                                    "client_email_subject": "Seguimiento de tu caso",
                                    "client_email_body": body,
                                })
                        except Exception:
                            pass
                except Exception as e:
                    logger.error(f"Milestone email error: {e}")

                await db.classic_case_milestones.update_one(
                    {"key": milestone_key},
                    {"$set": {"lastPct": threshold, "updatedAt": now.isoformat()}},
                    upsert=True
                )
                break

        # Weekly email after 100%
        if pct > 1.0:
            last_weekly = await db.classic_case_milestones.find_one({"key": f"weekly_{case.get('id')}"})
            last_sent = _days_between(last_weekly.get("lastSent"), now) if last_weekly else 999
            if last_sent and last_sent >= 7:
                try:
                    from services.case_notifications import _send_email, _email_wrapper
                    ioe = case.get("ioeNumber", "")
                    body = (
                        f"<p>Seguimos monitoreando tu caso diariamente. A veces USCIS toma mas tiempo de lo habitual.</p>"
                    )
                    if ioe:
                        body += f"<p>Tu IOE: <strong>{ioe}</strong> — <a href='https://egov.uscis.gov/casestatus/mycasestatus.do'>Consultar</a></p>"
                    body += f"<p style='color:#6B7280;font-size:13px;'>Si tienes preguntas, no dudes en contactar a tu coordinador.</p>"
                    html = _email_wrapper(case.get("name", "Cliente"), "Seguimiento semanal", body)
                    _send_email(client_email, "Seguimiento semanal de tu caso", html)
                    await db.classic_case_milestones.update_one(
                        {"key": f"weekly_{case.get('id')}"},
                        {"$set": {"lastSent": now.isoformat()}},
                        upsert=True
                    )
                    # N8N webhook for weekly followup
                    if CLASSIC_N8N_WEBHOOK_URL:
                        try:
                            async with httpx.AsyncClient(timeout=10) as hc:
                                await hc.post(CLASSIC_N8N_WEBHOOK_URL, json={
                                    "client_id": case.get("id", ""),
                                    "client_name": case.get("name", ""),
                                    "client_email": client_email,
                                    "event_type": "client_followup_weekly",
                                    "processed_by": "cron_system",
                                    "client_email_subject": "Seguimiento semanal de tu caso",
                                    "client_email_body": body,
                                })
                        except Exception:
                            pass
                except Exception as e:
                    logger.error(f"Weekly email error: {e}")

    # Send consolidated emails with anti-duplicate
    sent_count = 0
    today_key = now.strftime("%Y-%m-%d")
    for email, alerts in alerts_by_email.items():
        if not alerts:
            continue

        # Anti-duplicate: check if we already sent this exact set of alerts today
        dedup_key = f"daily_alert_{email}_{today_key}"
        existing = await db.classic_case_notifications_log.find_one({"dedup_key": dedup_key})
        if existing:
            logger.info(f"Skipping duplicate daily alert for {email}")
            continue

        # Sort by priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        alerts.sort(key=lambda a: priority_order.get(a["priority"], 99))

        # Build email body
        rows = ""
        for a in alerts:
            color = {"critical": "#EF4444", "high": "#F97316", "medium": "#F59E0B", "low": "#6B7280"}.get(a["priority"], "#6B7280")
            icon = {"rfe_deadline": "⏰", "no_ioe": "📋", "no_work_status": "⚠️", "stale_progress": "📊", "paused_too_long": "⏸️", "no_contact": "📞"}.get(a["type"], "📌")
            rows += (
                f"<tr><td style='padding:8px;border-bottom:1px solid #E5E7EB;'>"
                f"<span style='color:{color};font-weight:700;'>{icon} {a['priority'].upper()}</span></td>"
                f"<td style='padding:8px;border-bottom:1px solid #E5E7EB;font-weight:600;'>{a['client']}</td>"
                f"<td style='padding:8px;border-bottom:1px solid #E5E7EB;'>{a['message']}</td></tr>"
            )

        body = (
            f"<p>Tienes <strong>{len(alerts)}</strong> caso(s) que requieren atencion:</p>"
            f"<table style='width:100%;border-collapse:collapse;font-size:13px;'>"
            f"<tr style='background:#F9FAFB;'><th style='padding:8px;text-align:left;'>Prioridad</th>"
            f"<th style='padding:8px;text-align:left;'>Cliente</th>"
            f"<th style='padding:8px;text-align:left;'>Situacion</th></tr>"
            f"{rows}</table>"
        )

        try:
            from services.case_notifications import _send_email, _email_wrapper
            html = _email_wrapper(email.split("@")[0], f"Alerta diaria: {len(alerts)} caso(s)", body)
            _send_email(email, f"Alerta diaria: {len(alerts)} caso(s) requieren atencion", html)
            sent_count += 1

            # Log for anti-duplicate
            await db.classic_case_notifications_log.insert_one({
                "dedup_key": dedup_key,
                "event_type": "daily_alert_escalated",
                "recipient": email,
                "alertCount": len(alerts),
                "sentAt": now.isoformat(),
            })
            # N8N webhook for daily alert
            if CLASSIC_N8N_WEBHOOK_URL:
                try:
                    async with httpx.AsyncClient(timeout=10) as hc:
                        await hc.post(CLASSIC_N8N_WEBHOOK_URL, json={
                            "client_id": "",
                            "client_name": "",
                            "client_email": email,
                            "event_type": "daily_alert_escalated",
                            "processed_by": "cron_system",
                            "client_email_subject": f"Alerta diaria: {len(alerts)} caso(s) requieren atencion",
                            "client_email_body": body,
                        })
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"Consolidated email error for {email}: {e}")

    logger.info(f"Classic alerts: {sent_count} consolidated emails sent, {sum(len(a) for a in alerts_by_email.values())} total alerts")
    return {"emailsSent": sent_count, "totalAlerts": sum(len(a) for a in alerts_by_email.values())}
