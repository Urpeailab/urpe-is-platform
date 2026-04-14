"""
Appointment Management Endpoints
Client requests → Pending approval → Coordinator/Sales approves → Email to client
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import logging

from appointments_models import AppointmentCreate, AppointmentUpdate

logger = logging.getLogger(__name__)


def setup_appointments_router(db, verify_client_token, verify_staff_token):
    appointments_router = APIRouter()

    def _validate_business_hours(date_str: str, time_str: str):
        """Validate proposed date/time: min 3h from now, business hours 8-17."""
        try:
            dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            dt = dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha/hora invalido. Use YYYY-MM-DD y HH:MM")

        now = datetime.now(timezone.utc)
        min_time = now + timedelta(hours=3)

        if dt < min_time:
            raise HTTPException(status_code=400, detail="La cita debe ser al menos 3 horas a partir de ahora")

        hour = int(time_str.split(":")[0])
        if hour < 8 or hour >= 17:
            raise HTTPException(status_code=400, detail="La cita debe ser en horario laboral (8:00 - 17:00)")

        if dt.weekday() >= 5:
            raise HTTPException(status_code=400, detail="La cita debe ser de lunes a viernes")

        return dt.isoformat()

    @appointments_router.post("/appointments/create")
    async def create_appointment(
        request: AppointmentCreate,
        client_payload: dict = Depends(verify_client_token)
    ):
        """Client creates an appointment request."""
        try:
            user_id = client_payload['id']

            if not request.reason or len(request.reason.strip()) < 5:
                raise HTTPException(status_code=400, detail="Debes indicar el motivo de la cita (minimo 5 caracteres)")

            proposed_iso = _validate_business_hours(request.proposedDate, request.proposedTime)

            # Get case and verify ownership
            case = await db.visa_cases.find_one(
                {"$or": [{"id": request.caseId, "userId": user_id}, {"_id": request.caseId, "userId": user_id}]}
            )
            if not case:
                raise HTTPException(status_code=404, detail="Caso no encontrado")

            # Get user info
            user = await db.users.find_one({"$or": [{"_id": user_id}, {"id": user_id}]})
            if not user:
                try:
                    from bson import ObjectId
                    user = await db.users.find_one({"_id": ObjectId(user_id)})
                except:
                    pass
            client_name = user.get("name", "Cliente") if user else "Cliente"

            # Determine who the appointment is with
            staff_id = None
            staff_role_label = "Coordinador"
            if request.withRole == "salesRep" and case.get("salesRepId"):
                staff_id = case["salesRepId"]
                staff_role_label = "Vendedor"
            else:
                staff_id = case.get("coordinatorId")

            staff_info = None
            if staff_id:
                staff_info = await db.staff.find_one({"_id": staff_id}, {"name": 1, "email": 1})

            # Check for existing pending appointment
            existing = await db.appointments.find_one({
                "caseId": request.caseId,
                "userId": user_id,
                "status": {"$in": ["pending", "approved"]}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Ya tienes una cita pendiente o aprobada")

            appointment_id = str(uuid4())
            appointment = {
                "_id": appointment_id,
                "id": appointment_id,
                "caseId": request.caseId,
                "userId": user_id,
                "clientName": client_name,
                "clientEmail": user.get("email", "") if user else "",
                "withStaffId": staff_id,
                "withStaffName": staff_info.get("name", "") if staff_info else "",
                "withStaffEmail": staff_info.get("email", "") if staff_info else "",
                "withRole": request.withRole or "coordinator",
                "withRoleLabel": staff_role_label,
                "status": "pending",
                "proposedDate": request.proposedDate,
                "proposedTime": request.proposedTime,
                "proposedDatetime": proposed_iso,
                "reason": request.reason.strip(),
                "confirmedDate": None,
                "meetingLink": None,
                "adminNotes": None,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }

            await db.appointments.insert_one(appointment)
            appointment.pop("_id", None)

            # Send email to coordinator/sales rep
            if staff_info and staff_info.get("email"):
                try:
                    from services.case_notifications import _send_email, _email_wrapper, FRONTEND_URL
                    client_email = user.get("email", "") if user else ""
                    client_phone = user.get("phone", "") if user else ""
                    
                    subject = f"Nueva solicitud de cita: {client_name}"
                    body = (
                        f"<p>El cliente <strong>{client_name}</strong> ha solicitado una cita contigo.</p>"
                        f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;width:120px;'>Fecha propuesta:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;font-weight:600;'>{request.proposedDate} a las {request.proposedTime}</td></tr>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;'>Motivo:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;'>{request.reason}</td></tr>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;'>Email cliente:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;'>{client_email or 'No disponible'}</td></tr>"
                        f"<tr><td style='padding:8px 0;color:#64748B;font-size:13px;'>Telefono:</td>"
                        f"<td style='padding:8px 0;color:#0F172A;'>{client_phone or 'No disponible'}</td></tr>"
                        f"</table>"
                        f"<p style='color:#64748B;font-size:13px;'>Para aprobar o rechazar esta cita, ve a <strong>Panel Admin → Citas</strong></p>"
                    )
                    html = _email_wrapper(staff_info["name"], "Solicitud de cita", body)
                    _send_email(staff_info["email"], subject, html)
                except Exception as e:
                    logger.error(f"Email notification error: {e}")

            return {"success": True, "message": "Cita solicitada. Pendiente de aprobacion.", "appointment": appointment}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
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
