"""
Appointment Management Endpoints
Client requests → Pending approval → Coordinator/Sales approves → Email to client
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from uuid import uuid4
import logging

from appointments_models import AppointmentCreate, AppointmentUpdate

logger = logging.getLogger(__name__)

# Business hours are defined in Georgia (Atlanta) local time — same zone as
# America/New_York (handles DST automatically).
_GEORGIA_TZ = ZoneInfo("America/New_York")
_BIZ_HOUR_START = 9   # 9:00 AM Atlanta
_BIZ_HOUR_END = 17    # 5:00 PM Atlanta (slots must START before this)
_MIN_LEAD_HOURS = 4


def setup_appointments_router(db, verify_client_token, verify_staff_token):
    appointments_router = APIRouter()

    def _validate_business_hours(date_str: str, time_str: str):
        """Validate proposed date/time.
        - Input is interpreted as Georgia (America/New_York) local time.
        - Must be at least 4h from now.
        - Must be Mon-Fri, hour in [9, 17) Atlanta time.
        Returns the UTC ISO timestamp for persistence.
        """
        try:
            dt_local = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            dt_local = dt_local.replace(tzinfo=_GEORGIA_TZ)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha/hora invalido. Use YYYY-MM-DD y HH:MM")

        now_utc = datetime.now(timezone.utc)
        min_time = now_utc + timedelta(hours=_MIN_LEAD_HOURS)

        if dt_local < min_time:
            raise HTTPException(status_code=400, detail=f"La cita debe ser al menos {_MIN_LEAD_HOURS} horas a partir de ahora")

        if dt_local.hour < _BIZ_HOUR_START or dt_local.hour >= _BIZ_HOUR_END:
            raise HTTPException(status_code=400, detail=f"La cita debe ser en horario laboral ({_BIZ_HOUR_START}:00 - {_BIZ_HOUR_END}:00 hora Georgia)")

        if dt_local.weekday() >= 5:
            raise HTTPException(status_code=400, detail="La cita debe ser de lunes a viernes")

        # Store as UTC ISO
        return dt_local.astimezone(timezone.utc).isoformat()

    @appointments_router.post("/appointments/create")
    async def create_appointment(
        request: AppointmentCreate,
        client_payload: dict = Depends(verify_client_token)
    ):
        """Client creates an appointment request (Supabase)."""
        from db.supabase_client import get_supabase
        sb = get_supabase()
        try:
            user_id = client_payload['id']

            if not request.reason or len(request.reason.strip()) < 5:
                raise HTTPException(status_code=400, detail="Debes indicar el motivo de la cita (minimo 5 caracteres)")

            proposed_iso = _validate_business_hours(request.proposedDate, request.proposedTime)

            # Verify case ownership
            case_res = sb.table("visa_cases").select("id,client_id,coordinator_id,advisor_id").eq("id", request.caseId).limit(1).execute()
            if not case_res.data:
                raise HTTPException(status_code=404, detail="Caso no encontrado")
            case = case_res.data[0]
            if str(case.get("client_id")) != str(user_id):
                raise HTTPException(status_code=403, detail="Este caso no te pertenece")

            # Client info
            client_res = sb.table("clients").select("name,email,phone").eq("id", user_id).limit(1).execute()
            client = client_res.data[0] if client_res.data else {}
            client_name = client.get("name") or "Cliente"
            client_email = client.get("email") or ""
            client_phone = client.get("phone") or ""

            # Resolve the staff member the client wants to meet with
            if request.withRole == "salesRep":
                staff_id = case.get("advisor_id")
                staff_role_label = "Vendedor"
            else:
                staff_id = case.get("coordinator_id")
                staff_role_label = "Coordinador"

            if not staff_id:
                raise HTTPException(status_code=400, detail=f"Tu caso no tiene un {staff_role_label.lower()} asignado")

            staff_res = sb.table("staff").select("name,email").eq("id", staff_id).limit(1).execute()
            staff_info = staff_res.data[0] if staff_res.data else {}

            # Block duplicate pending/approved appointments for this case
            existing_res = (
                sb.table("appointments")
                .select("id")
                .eq("case_id", request.caseId)
                .eq("client_id", user_id)
                .in_("status", ["pending", "approved", "scheduled"])
                .limit(1)
                .execute()
            )
            if existing_res.data:
                raise HTTPException(status_code=400, detail="Ya tienes una cita pendiente o aprobada para este caso")

            appointment_id = str(uuid4())
            now_iso = datetime.now(timezone.utc).isoformat()
            row = {
                "id": appointment_id,
                "case_id": request.caseId,
                "client_id": user_id,
                "staff_id": staff_id,
                "title": f"Cita con {client_name}",
                "scheduled_at": proposed_iso,
                "duration_minutes": 30,
                "status": "pending",
                "notes": request.reason.strip(),
                "created_at": now_iso,
            }
            sb.table("appointments").insert(row).execute()

            # Send email to the assigned staff
            if staff_info.get("email"):
                try:
                    from services.case_notifications import _send_email, _email_wrapper
                    subject = f"Nueva solicitud de cita: {client_name}"
                    body = (
                        f"<p>El cliente <strong>{client_name}</strong> ha solicitado una cita contigo.</p>"
                        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;width:140px;'>Fecha propuesta:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;font-weight:600;'>{request.proposedDate} a las {request.proposedTime} (Georgia)</td></tr>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;'>Motivo:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;'>{request.reason}</td></tr>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;'>Email cliente:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;'>{client_email or 'No disponible'}</td></tr>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;'>Telefono:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;'>{client_phone or 'No disponible'}</td></tr>"
                        f"</table>"
                        f"<p style='color:#64748B;font-size:13px;'>Para aprobar o rechazar esta cita, ve a <strong>Panel Admin → Citas</strong></p>"
                    )
                    html = _email_wrapper(staff_info.get("name", ""), "Solicitud de cita", body)
                    _send_email(staff_info["email"], subject, html)
                except Exception as e:
                    logger.error(f"Email notification error: {e}")

            appointment = {
                **row,
                "caseId": row["case_id"], "clientId": row["client_id"], "staffId": row["staff_id"],
                "withStaffName": staff_info.get("name", ""), "withStaffEmail": staff_info.get("email", ""),
                "withRole": request.withRole or "coordinator", "withRoleLabel": staff_role_label,
                "proposedDate": request.proposedDate, "proposedTime": request.proposedTime,
                "proposedDatetime": proposed_iso, "reason": request.reason.strip(),
            }
            return {"success": True, "message": "Cita solicitada. Pendiente de aprobacion.", "appointment": appointment}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating appointment: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @appointments_router.get("/appointments/my-appointments")
    async def get_my_appointments(client_payload: dict = Depends(verify_client_token)):
        """Get client's appointments."""
        try:
            user_id = client_payload['id']
            appointments = await db.appointments.find(
                {"userId": user_id}, {"_id": 0}
            ).sort("createdAt", -1).to_list(50)
            return {"success": True, "appointments": appointments}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @appointments_router.get("/admin/appointments")
    async def get_all_appointments(
        status: str = None,
        caseId: str = None,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin: Get all appointments (Supabase)."""
        try:
            from db.supabase_client import get_supabase, _add_camel_aliases
            sb = get_supabase()
            q = sb.table("appointments").select("*")
            if status and status != "all":
                q = q.eq("status", status)
            if caseId:
                q = q.eq("case_id", caseId)
            q = q.order("created_at", desc=True).limit(500)
            res = q.execute()
            appointments = [_add_camel_aliases(a) for a in (res.data or [])]
            return {"success": True, "appointments": appointments}
        except Exception as e:
            logger.error(f"admin/appointments error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @appointments_router.patch("/admin/appointments/{appointment_id}")
    async def update_appointment(
        appointment_id: str,
        request: AppointmentUpdate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin: Approve/reject/update appointment."""
        try:
            appointment = await db.appointments.find_one({"id": appointment_id})
            if not appointment:
                raise HTTPException(status_code=404, detail="Cita no encontrada")

            update_data = {"updatedAt": datetime.now(timezone.utc).isoformat(), "updatedBy": staff_payload["id"]}

            if request.status:
                update_data["status"] = request.status
            if request.confirmedDate:
                update_data["confirmedDate"] = request.confirmedDate
            if request.meetingLink:
                update_data["meetingLink"] = request.meetingLink
            if request.adminNotes is not None:
                update_data["adminNotes"] = request.adminNotes

            await db.appointments.update_one({"id": appointment_id}, {"$set": update_data})

            # If approved, send email to client
            if request.status == "approved" and appointment.get("clientEmail"):
                try:
                    from services.case_notifications import _send_email, _email_wrapper, get_case_team, FRONTEND_URL
                    _, _, client = await get_case_team(db, appointment["caseId"])
                    access_url = client.get("accessUrl") or f"{FRONTEND_URL}/dashboard/appointments" if client else f"{FRONTEND_URL}/dashboard/appointments"

                    date_display = request.confirmedDate or f"{appointment.get('proposedDate')} {appointment.get('proposedTime')}"
                    meeting_html = f"<p><strong>Link de reunion:</strong> <a href='{request.meetingLink}'>{request.meetingLink}</a></p>" if request.meetingLink else ""
                    notes_html = f"<p><strong>Nota:</strong> {request.adminNotes}</p>" if request.adminNotes else ""

                    body = (
                        f"<p>Tu cita ha sido <strong style='color:#22C55E;'>aprobada</strong>.</p>"
                        f"<p><strong>Fecha:</strong> {date_display}</p>"
                        f"<p><strong>Con:</strong> {appointment.get('withStaffName', 'Tu coordinador')}</p>"
                        f"<p><strong>Motivo:</strong> {appointment.get('reason', '')}</p>"
                        f"{meeting_html}{notes_html}"
                    )
                    html = _email_wrapper(appointment.get("clientName", "Cliente"), "Cita aprobada", body, "Ver mi caso", access_url)
                    _send_email(appointment["clientEmail"], "Tu cita ha sido aprobada", html)
                except Exception as e:
                    logger.error(f"Email notification error: {e}")

            updated = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
            return {"success": True, "message": "Cita actualizada", "appointment": updated}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return appointments_router
