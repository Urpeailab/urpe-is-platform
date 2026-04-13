"""
Classic Visa Case Management - Checklist-based case tracking
Unlike the stage-based system, this uses a flat checklist with dual verification (coordinator + armador).
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import os
import httpx

logger = logging.getLogger(__name__)

CLASSIC_N8N_WEBHOOK_URL = os.environ.get("CLASSIC_N8N_WEBHOOK_URL", "")

# Default EB-2 NIW deliverable template
DEFAULT_EB2_NIW_TEMPLATE = [
    {
        "category": "1. Photocopy Certification",
        "items": [
            {"item": "Table of Content", "sub_items": [
                {"text": "Verificar que este firmada a mano por el beneficiario"},
                {"text": "Usar boligrafo negro"},
            ]},
        ]
    },
    {
        "category": "2. Forms and Fee",
        "items": [
            {"item": "Formulario I-140 (Petition for Alien Worker)", "sub_items": []},
            {"item": "Formulario I-907 (Request for Premium Processing Service)", "sub_items": []},
            {"item": "Formulario G-1450 (Authorization for Credit Card Transactions)", "sub_items": []},
            {"item": "Formulario G-1145 (E-Notification)", "sub_items": []},
        ]
    },
    {
        "category": "3. Historical Immigration Documents",
        "items": [
            {"item": "I-94", "sub_items": []},
            {"item": "Passport (bio page + visas relevantes)", "sub_items": []},
            {"item": "Visa actual/anterior", "sub_items": []},
        ]
    },
    {
        "category": "4. Petition for National Interest Waiver",
        "items": [
            {"item": "Carta autopeticion NIW completa", "sub_items": []},
        ]
    },
    {
        "category": "5. List of Exhibits",
        "items": [
            {"item": "Exhibit 1 - Project: Documentation", "sub_items": [
                {"text": "Policy Paper"},
                {"text": "White Paper"},
                {"text": "Econometric Study"},
                {"text": "MVP"},
                {"text": "Patent Documentation"},
                {"text": "Libro"},
            ]},
            {"item": "Exhibit 2 - Curriculum Vitae", "sub_items": []},
            {"item": "Exhibit 3 - Certificates of Study", "sub_items": []},
            {"item": "Exhibit 4 - Expert Evaluation Letter", "sub_items": []},
            {"item": "Exhibit 5 - Recommendation Letters", "sub_items": []},
            {"item": "Exhibit 6 - Employment Certificate Letters", "sub_items": []},
            {"item": "Exhibit 7 - Letter of Intent", "sub_items": []},
            {"item": "Exhibit 8 - Documents of My Family", "sub_items": []},
        ]
    },
]

# Valid states and transitions
VALID_STATES = ["en_proceso", "radicado", "recibido_uscis", "rfe_recibido", "rfe_respondido", "devuelto", "aprobado"]
STATE_LABELS = {
    "en_proceso": "En Proceso",
    "radicado": "Enviado",
    "recibido_uscis": "Recibido USCIS",
    "rfe_recibido": "RFE Recibido",
    "rfe_respondido": "RFE Respondido",
    "devuelto": "Devuelto",
    "aprobado": "Aprobado",
}
WORK_STATUSES = ["working", "paused", "waiting_uscis", "desisted"]


class ClassicCaseCreate(BaseModel):
    userId: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    coordinatorId: Optional[str] = None
    processingType: str = "normal"  # normal | premium
    visaType: str = "EB-2 NIW"
    driveFolderUrl: Optional[str] = None
    seniorityDate: Optional[str] = None


class ClassicCaseUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    coordinatorId: Optional[str] = None
    processingType: Optional[str] = None
    driveFolderUrl: Optional[str] = None
    seniorityDate: Optional[str] = None
    ioeNumber: Optional[str] = None
    trackingNumber: Optional[str] = None
    shippingCompany: Optional[str] = None


class StatusChangeRequest(BaseModel):
    newStatus: str
    trackingNumber: Optional[str] = None
    shippingCompany: Optional[str] = None
    ioeNumber: Optional[str] = None
    documentUrl: Optional[str] = None
    summary: Optional[str] = None
    rfeDeadline: Optional[str] = None
    rfeAnalysis: Optional[str] = None
    notes: Optional[str] = None


def setup_classic_cases_router(db, verify_staff_token):
    router = APIRouter(prefix="/classic-cases", tags=["Classic Cases"])

    # Fixed email recipients for internal notifications
    DIRECTOR_EMAIL = "dau@urpeintegralservices.co"
    OPERATIONS_EMAIL = "ap@urpeintegralservices.co"

    async def _log_notification(case_id, event_type, recipient, subject, details=None):
        """Log every notification sent for audit/dedup."""
        await db.classic_case_notifications_log.insert_one({
            "caseId": case_id,
            "event_type": event_type,
            "recipient": recipient,
            "subject": subject,
            "details": details or {},
            "sentAt": datetime.now(timezone.utc).isoformat(),
        })

    async def _get_coordinator_email(case):
        """Resolve coordinator email from case."""
        coord_id = case.get("coordinatorId")
        if coord_id:
            coord = await db.staff.find_one({"_id": coord_id}, {"name": 1, "email": 1})
            if coord:
                return coord.get("email"), coord.get("name", "")
        return None, None

    async def _notify_coordinator_status(case, case_id, status_label, body_html, extra_recipients=None):
        """Send status notification to coordinator + optional extra recipients."""
        try:
            from services.case_notifications import _send_email, _email_wrapper
            coord_email, coord_name = await _get_coordinator_email(case)
            recipients = []
            if coord_email:
                recipients.append((coord_email, coord_name))
            for email in (extra_recipients or []):
                if email and email not in [r[0] for r in recipients]:
                    recipients.append((email, email.split("@")[0]))

            for email, name in recipients:
                html = _email_wrapper(name, f"Caso {status_label} - {case.get('name', '')}", body_html)
                _send_email(email, f"Caso {status_label} - {case.get('name', '')}", html)
                await _log_notification(case_id, f"internal_{status_label.lower().replace(' ', '_')}", email, f"Caso {status_label}")
        except Exception as e:
            logger.error(f"Coordinator notification error: {e}")

    async def _fire_n8n_webhook(case, event_type, subject, body_html, processed_by=""):
        """Send notification payload to N8N webhook."""
        if not CLASSIC_N8N_WEBHOOK_URL:
            return
        try:
            payload = {
                "client_id": case.get("id", ""),
                "client_name": case.get("name", ""),
                "client_email": case.get("email", ""),
                "event_type": event_type,
                "processed_by": processed_by,
                "client_email_subject": subject,
                "client_email_body": body_html,
            }
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(CLASSIC_N8N_WEBHOOK_URL, json=payload)
                logger.info(f"N8N webhook fired: {event_type} → {resp.status_code}")
        except Exception as e:
            logger.error(f"N8N webhook error ({event_type}): {e}")

    def _init_deliverables(template):
        """Initialize deliverables from template with empty checks."""
        categories = []
        for cat in template:
            items = []
            for item in cat.get("items", []):
                sub_items = []
                for si in item.get("sub_items", []):
                    sub_items.append({
                        "id": str(uuid.uuid4()),
                        "text": si.get("text", ""),
                        "completed": False,
                        "completed_coordinator": False,
                        "completed_armador": False,
                    })
                items.append({
                    "id": str(uuid.uuid4()),
                    "item": item["item"],
                    "completed": False,
                    "completed_coordinator": False,
                    "completed_armador": False,
                    "status": None,
                    "status_date": None,
                    "notes": [],
                    "sub_items": sub_items,
                })
            categories.append({
                "category": cat["category"],
                "items": items,
            })
        return categories

    def _calc_progress(deliverables):
        """Calculate progress percentages."""
        total = 0
        coord_done = 0
        armador_done = 0
        for cat in deliverables:
            for item in cat.get("items", []):
                total += 1
                if item.get("completed_coordinator"):
                    coord_done += 1
                if item.get("completed_armador"):
                    armador_done += 1
                for si in item.get("sub_items", []):
                    total += 1
                    if si.get("completed_coordinator"):
                        coord_done += 1
                    if si.get("completed_armador"):
                        armador_done += 1
        if total == 0:
            return 0, 0, 0
        p_coord = round((coord_done / total) * 100, 1)
        p_armador = round((armador_done / total) * 100, 1)
        p_total = round((p_coord + p_armador) / 2, 1)
        return p_coord, p_armador, p_total

    async def _log_timeline(case_id, action, performed_by, details=None):
        entry = {
            "caseId": case_id,
            "action": action,
            "performedBy": performed_by,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.classic_case_timeline.insert_one(entry)
        # Don't return the entry with _id to avoid serialization issues

    # ========== CRUD ==========

    @router.post("/admin")
    async def create_classic_case(data: ClassicCaseCreate, staff_payload: dict = Depends(verify_staff_token)):
        """Create a new classic (checklist-based) visa case."""
        # Verify user exists
        user = await db.users.find_one({"$or": [{"_id": data.userId}, {"id": data.userId}]})
        if not user:
            from bson import ObjectId
            try:
                user = await db.users.find_one({"_id": ObjectId(data.userId)})
            except:
                pass
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        case_id = str(uuid.uuid4())
        deliverables = _init_deliverables(DEFAULT_EB2_NIW_TEMPLATE)
        now = datetime.now(timezone.utc).isoformat()

        case = {
            "_id": case_id,
            "id": case_id,
            "userId": data.userId,
            "name": data.name.strip(),
            "email": data.email or user.get("email", ""),
            "phone": data.phone or user.get("phone", ""),
            "coordinatorId": data.coordinatorId,
            "processingType": data.processingType,
            "visaType": data.visaType,
            "driveFolderUrl": data.driveFolderUrl,
            "seniorityDate": data.seniorityDate,
            "status": "en_proceso",
            "workStatus": "working",
            "workStatusChangedBy": staff_payload.get("email"),
            "workStatusChangedAt": now,
            "deliverables": deliverables,
            "progress": 0,
            "progressCoordinator": 0,
            "progressArmador": 0,
            "lastProgressChangeAt": now,
            # Filing
            "filingDate": None,
            "trackingNumber": None,
            "trackingDocumentUrl": None,
            "shippingCompany": None,
            # IOE
            "ioeNumber": None,
            "ioeDocumentUrl": None,
            # Devolucion
            "devolucionSummary": None,
            "devolucionDocumentUrl": None,
            # RFE
            "rfeReceivedDate": None,
            "rfeDeadline": None,
            "rfeDocumentUrl": None,
            "rfeAnalysis": None,
            "rfeStrategy": None,
            "rfeStrategySource": None,
            "rfeClientNotified": False,
            "rfeClientNotifiedDate": None,
            # Approval
            "approvalDate": None,
            "approvalDocumentUrl": None,
            # Tracking
            "lastContactAt": None,
            "lastContactBy": None,
            "createdBy": staff_payload.get("id"),
            "createdAt": now,
            "updatedAt": now,
        }

        await db.classic_cases.insert_one(case)

        # Refetch without _id for clean response
        clean_case = await db.classic_cases.find_one({"id": case_id}, {"_id": 0})

        await _log_timeline(case_id, "Caso creado", {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")})

        return {"success": True, "message": "Caso clasico creado", "case": clean_case}

    @router.get("/admin")
    async def list_classic_cases(
        staff_payload: dict = Depends(verify_staff_token),
        page: int = 1, limit: int = 50,
        status: str = None, search: str = None,
        coordinatorId: str = None, workStatus: str = None,
        userId: str = None
    ):
        """List all classic cases with filters."""
        query = {}
        if status and status != "all":
            query["status"] = status
        if workStatus and workStatus != "all":
            query["workStatus"] = workStatus
        if coordinatorId:
            query["coordinatorId"] = coordinatorId
        if userId:
            query["userId"] = userId
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"ioeNumber": {"$regex": search, "$options": "i"}},
            ]

        skip = (page - 1) * limit
        total = await db.classic_cases.count_documents(query)
        cases = await db.classic_cases.find(query, {"_id": 0, "deliverables": 0}).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

        # Add coordinator names
        for case in cases:
            if case.get("coordinatorId"):
                coord = await db.staff.find_one({"_id": case["coordinatorId"]}, {"name": 1})
                case["coordinatorName"] = coord.get("name", "") if coord else ""

        return {
            "success": True,
            "cases": cases,
            "pagination": {"page": page, "limit": limit, "total": total, "pages": max(1, (total + limit - 1) // limit)}
        }

    @router.get("/admin/{case_id}")
    async def get_classic_case(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Get full classic case detail including deliverables."""
        case = await db.classic_cases.find_one({"id": case_id}, {"_id": 0})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        # Add coordinator name
        if case.get("coordinatorId"):
            coord = await db.staff.find_one({"_id": case["coordinatorId"]}, {"name": 1})
            case["coordinatorName"] = coord.get("name", "") if coord else ""

        # Get timeline
        timeline = await db.classic_case_timeline.find({"caseId": case_id}, {"_id": 0}).sort("timestamp", -1).limit(50).to_list(50)
        case["timeline"] = timeline

        return {"success": True, "case": case}

    @router.put("/admin/{case_id}")
    async def update_classic_case(case_id: str, data: ClassicCaseUpdate, staff_payload: dict = Depends(verify_staff_token)):
        """Update case basic info."""
        update = {"updatedAt": datetime.now(timezone.utc).isoformat()}
        for field in ["name", "email", "phone", "coordinatorId", "processingType", "driveFolderUrl", "seniorityDate", "ioeNumber", "trackingNumber", "shippingCompany"]:
            val = getattr(data, field, None)
            if val is not None:
                update[field] = val

        await db.classic_cases.update_one({"id": case_id}, {"$set": update})
        return {"success": True, "message": "Caso actualizado"}

    @router.delete("/admin/{case_id}")
    async def delete_classic_case(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Delete a classic case (admin only)."""
        role = staff_payload.get("role", "")
        if role not in ("admin", "super_admin"):
            raise HTTPException(status_code=403, detail="Solo admin puede eliminar casos")
        result = await db.classic_cases.delete_one({"id": case_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        await db.classic_case_timeline.delete_many({"caseId": case_id})
        return {"success": True, "message": "Caso eliminado"}

    # ========== DOCUMENT SCANNING (AI extraction without status change) ==========

    # ========== DOCUMENT SCANNING (AI extraction without status change) ==========

    @router.post("/admin/{case_id}/upload-document")
    async def upload_case_document(
        case_id: str,
        documentType: str = Form(...),
        file: UploadFile = File(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Upload/re-upload a document for tracking, IOE, RFE, etc."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        valid_types = ["tracking", "ioe", "devolucion", "rfe", "rfe_response", "approval"]
        if documentType not in valid_types:
            raise HTTPException(status_code=400, detail="Tipo invalido")

        content = await file.read()
        doc_url = None
        try:
            from supabase import create_client
            supa_url = os.environ.get("SUPABASE_STORAGE_URL")
            supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
            bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
            if supa_url and supa_key:
                supa = create_client(supa_url, supa_key)
                path = f"classic-cases/{case_id}/{documentType}_{file.filename}"
                supa.storage.from_(bucket).upload(path, content, file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
                doc_url = supa.storage.from_(bucket).get_public_url(path)
        except Exception as e:
            logger.error(f"Upload error: {e}")
            raise HTTPException(status_code=500, detail="Error al subir documento")

        field_map = {
            "tracking": "trackingDocumentUrl",
            "ioe": "ioeDocumentUrl",
            "devolucion": "devolucionDocumentUrl",
            "rfe": "rfeDocumentUrl",
            "rfe_response": "rfeResponseDocumentUrl",
            "approval": "approvalDocumentUrl",
        }

        await db.classic_cases.update_one({"id": case_id}, {"$set": {field_map[documentType]: doc_url, "updatedAt": datetime.now(timezone.utc).isoformat()}})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"Documento {documentType} subido/actualizado", performer)

        return {"success": True, "url": doc_url}

    @router.post("/admin/{case_id}/scan-tracking")
    async def scan_tracking_document(
        case_id: str,
        file: UploadFile = File(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Scan a shipping receipt to extract tracking number via AI."""
        content = await file.read()
        from services.classic_case_ai import extract_tracking_from_document
        result = await extract_tracking_from_document(content, file.filename)
        return result

    @router.post("/admin/{case_id}/scan-ioe")
    async def scan_ioe_document(
        case_id: str,
        file: UploadFile = File(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Scan I-797C to extract IOE number via AI."""
        content = await file.read()
        from services.classic_case_ai import extract_ioe_from_document
        result = await extract_ioe_from_document(content, file.filename)
        return result

    @router.post("/admin/{case_id}/scan-rfe")
    async def scan_rfe_document(
        case_id: str,
        file: UploadFile = File(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Scan RFE document to extract deadline and analysis via AI."""
        content = await file.read()
        from services.classic_case_ai import analyze_rfe_document
        result = await analyze_rfe_document(content, file.filename)
        return result

    # ========== STATUS CHANGES WITH FILE UPLOAD ==========

    @router.post("/admin/{case_id}/filing")
    async def file_case(
        case_id: str,
        trackingNumber: str = Form(...),
        shippingCompany: str = Form("FedEx"),
        notifyClient: bool = Form(True),
        file: UploadFile = File(None),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Radicar caso: tracking + empresa + documento opcional."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        doc_url = None
        if file:
            content = await file.read()
            try:
                from supabase import create_client
                supa_url = os.environ.get("SUPABASE_STORAGE_URL")
                supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
                bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
                if supa_url and supa_key:
                    supa = create_client(supa_url, supa_key)
                    path = f"classic-cases/{case_id}/tracking_{file.filename}"
                    supa.storage.from_(bucket).upload(path, content, file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
                    doc_url = supa.storage.from_(bucket).get_public_url(path)
            except Exception as e:
                logger.error(f"Upload error: {e}")

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "status": "radicado", "filingDate": now, "trackingNumber": trackingNumber,
            "shippingCompany": shippingCompany, "trackingDocumentUrl": doc_url, "updatedAt": now,
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"Caso enviado via {shippingCompany}: {trackingNumber}", performer)

        # Email + BCC to coordinators
        coord_email = None
        if case.get("coordinatorId"):
            coord = await db.staff.find_one({"_id": case["coordinatorId"]}, {"email": 1})
            if coord:
                coord_email = coord.get("email")

        bcc_list = [e for e in FILING_BCC_EMAILS]
        if coord_email and coord_email not in bcc_list:
            bcc_list.append(coord_email)

        # Tracking URLs by company
        tracking_urls = {
            "FedEx": f"https://www.fedex.com/fedextrack/?trknbr={trackingNumber}",
            "USPS": f"https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}",
            "UPS": f"https://www.ups.com/track?tracknum={trackingNumber}",
            "DHL": f"https://www.dhl.com/us-en/home/tracking.html?tracking-id={trackingNumber}",
        }
        tracking_url = tracking_urls.get(shippingCompany, "#")
        filing_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        body = (
            f"<p>El caso del cliente <strong>{case.get('name', '')}</strong> ha sido enviado exitosamente. "
            f"Cada dia esta mas cerca de lograr su objetivo migratorio.</p>"
            f"<div style='background:#F9FAFB;border-left:4px solid #C9A96A;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;'>"
            f"<p style='margin:0 0 4px;color:#6B7280;font-size:13px;'>Numero de Tracking ({shippingCompany}):</p>"
            f"<p style='margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;'>{trackingNumber}</p>"
            f"<a href='{tracking_url}' style='color:#007AFF;font-size:13px;'>Rastrear envio en {shippingCompany}</a>"
            f"</div>"
            f"<p><strong>Fecha de radicacion:</strong> {filing_date}</p>"
            f"<p style='margin-top:16px;color:#6B7280;font-size:13px;'>El siguiente paso es esperar la confirmacion de recepcion por parte de USCIS. "
            f"Le mantendremos informado sobre cada avance.</p>"
        )

        if notifyClient:
            _send_status_email(case, "Caso Enviado", body, bcc=bcc_list)
            await _log_notification(case_id, "radicado", case.get("email", ""), "Caso Enviado")
            await _fire_n8n_webhook(case, "radicado", f"Tu caso ha sido enviado a USCIS", body, staff_payload.get("email", ""))
        else:
            # Internal only
            _send_status_email({"name": case.get("name", ""), "email": bcc_list[0] if bcc_list else None}, "Caso Enviado (interno)", body, bcc=bcc_list[1:] if len(bcc_list) > 1 else None)
            await _log_notification(case_id, "radicado", "internal", "Caso Enviado (interno)")

        return {"success": True, "message": "Caso enviado"}

    @router.post("/admin/{case_id}/ioe")
    async def register_ioe(
        case_id: str,
        ioeNumber: str = Form(""),
        notifyClient: bool = Form(True),
        file: UploadFile = File(None),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Registrar IOE: subir carta I-797C, IA extrae IOE automáticamente."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        doc_url = None
        ai_result = None

        if file:
            content = await file.read()
            # Upload
            try:
                from supabase import create_client
                supa_url = os.environ.get("SUPABASE_STORAGE_URL")
                supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
                bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
                if supa_url and supa_key:
                    supa = create_client(supa_url, supa_key)
                    path = f"classic-cases/{case_id}/ioe_{file.filename}"
                    supa.storage.from_(bucket).upload(path, content, file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
                    doc_url = supa.storage.from_(bucket).get_public_url(path)
            except Exception as e:
                logger.error(f"Upload error: {e}")

            # AI extraction
            if not ioeNumber:
                from services.classic_case_ai import extract_ioe_from_document
                ai_result = await extract_ioe_from_document(content, file.filename)
                if ai_result.get("success") and ai_result.get("receiptNumber"):
                    ioeNumber = ai_result["receiptNumber"]

        if not ioeNumber:
            raise HTTPException(status_code=400, detail="No se pudo determinar el IOE. Ingresalo manualmente.")

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "status": "recibido_uscis", "ioeNumber": ioeNumber, "ioeDocumentUrl": doc_url, "updatedAt": now,
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"IOE registrado: {ioeNumber}", performer, {"aiExtracted": ai_result is not None})

        if notifyClient:
            body_ioe = (
                f"<p>Nos complace informarle que USCIS ha confirmado la recepcion de su caso. "
                f"Este es un paso importante en su proceso migratorio.</p>"
                f"<div style='background:#F9FAFB;border-left:4px solid #C9A96A;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;'>"
                f"<p style='margin:0 0 4px;color:#6B7280;font-size:13px;'>Su numero de caso USCIS:</p>"
                f"<p style='margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;'>{ioeNumber}</p>"
                f"<a href='https://egov.uscis.gov/casestatus/mycasestatus.do' style='color:#007AFF;font-size:13px;'>Consultar estado en USCIS.gov</a>"
                f"</div>"
                f"<p style='color:#6B7280;font-size:13px;'>Con este numero podra consultar el estado de su caso directamente en el sitio web de USCIS. "
                f"Nuestro equipo seguira monitoreando su caso y le informaremos de cualquier novedad.</p>"
            )
            _send_status_email(case, "Caso Recibido por USCIS", body_ioe)
            await _log_notification(case_id, "ioe_recibido", case.get("email", ""), "Caso Recibido por USCIS")
            await _fire_n8n_webhook(case, "ioe_recibido", f"USCIS ha recibido tu caso", body_ioe, staff_payload.get("email", ""))

        # Notify coordinator
        coord_body = (
            f"<p>USCIS confirmo la recepcion del caso de <strong>{case.get('name', '')}</strong>.</p>"
            f"<p><strong>IOE:</strong> {ioeNumber}</p>"
            f"<p>Procesado por: {staff_payload.get('name', staff_payload.get('email', ''))}</p>"
        )
        await _notify_coordinator_status(case, case_id, "IOE Recibido", coord_body)

        updated = await db.classic_cases.find_one({"id": case_id}, {"_id": 0, "deliverables": 0})
        return {"success": True, "message": f"IOE registrado: {ioeNumber}", "case": updated, "aiResult": ai_result}

    @router.post("/admin/{case_id}/devolucion")
    async def register_devolucion(
        case_id: str,
        summary: str = Form(""),
        notifyClient: bool = Form(True),
        file: UploadFile = File(None),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Registrar devolución: subir documento, IA analiza motivo."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        doc_url = None
        ai_result = None

        if file:
            content = await file.read()
            try:
                from supabase import create_client
                supa_url = os.environ.get("SUPABASE_STORAGE_URL")
                supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
                bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
                if supa_url and supa_key:
                    supa = create_client(supa_url, supa_key)
                    path = f"classic-cases/{case_id}/devolucion_{file.filename}"
                    supa.storage.from_(bucket).upload(path, content, file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
                    doc_url = supa.storage.from_(bucket).get_public_url(path)
            except Exception as e:
                logger.error(f"Upload error: {e}")

            if not summary:
                from services.classic_case_ai import analyze_devolucion_document
                ai_result = await analyze_devolucion_document(content, file.filename)
                if ai_result.get("success") and ai_result.get("reason"):
                    summary = ai_result["reason"]

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "status": "devuelto", "devolucionSummary": summary, "devolucionDocumentUrl": doc_url, "updatedAt": now,
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, "Caso devuelto por USCIS", performer, {"summary": summary[:100] if summary else ""})

        if notifyClient:
            body_dev = (
                f"<p>Le informamos que USCIS ha devuelto su expediente. "
                f"Esto no significa que su caso haya sido negado; simplemente necesita ajustes antes de ser reenviado.</p>"
                f"<div style='background:#FEF2F2;border-left:4px solid #EF4444;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;'>"
                f"<p style='margin:0 0 4px;color:#991B1B;font-size:13px;font-weight:600;'>Motivo de la devolucion:</p>"
                f"<p style='margin:0;color:#7F1D1D;font-size:14px;'>{summary or 'Su coordinador le brindara los detalles.'}</p>"
                f"</div>"
                f"<p style='color:#6B7280;font-size:13px;'>Nuestro equipo ya esta trabajando en las correcciones necesarias para reenviar su caso lo antes posible. "
                f"Su coordinador se pondra en contacto con usted para informarle los proximos pasos.</p>"
            )
            _send_status_email(case, "Caso Devuelto", body_dev)
            await _log_notification(case_id, "devolucion", case.get("email", ""), "Caso Devuelto")
            await _fire_n8n_webhook(case, "devolucion", f"Actualizacion importante sobre tu caso", body_dev, staff_payload.get("email", ""))

        # Notify coordinator
        coord_body = (
            f"<p>USCIS devolvio el caso de <strong>{case.get('name', '')}</strong>.</p>"
            f"<p><strong>Motivo:</strong> {summary[:200] if summary else 'Sin detalle'}</p>"
            f"<p>Procesado por: {staff_payload.get('name', staff_payload.get('email', ''))}</p>"
        )
        await _notify_coordinator_status(case, case_id, "Devuelto", coord_body)

        return {"success": True, "message": "Devolucion registrada", "aiResult": ai_result}

    @router.post("/admin/{case_id}/rfe")
    async def register_rfe(
        case_id: str,
        deadline: str = Form(""),
        file: UploadFile = File(None),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Registrar RFE: subir documento, IA analiza contenido y extrae deadline."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        doc_url = None
        ai_result = None
        rfe_analysis = ""

        if file:
            content = await file.read()
            try:
                from supabase import create_client
                supa_url = os.environ.get("SUPABASE_STORAGE_URL")
                supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
                bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
                if supa_url and supa_key:
                    supa = create_client(supa_url, supa_key)
                    path = f"classic-cases/{case_id}/rfe_{file.filename}"
                    supa.storage.from_(bucket).upload(path, content, file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
                    doc_url = supa.storage.from_(bucket).get_public_url(path)
            except Exception as e:
                logger.error(f"Upload error: {e}")

            from services.classic_case_ai import analyze_rfe_document
            ai_result = await analyze_rfe_document(content, file.filename)
            if ai_result.get("success"):
                if ai_result.get("deadline") and not deadline:
                    deadline = ai_result["deadline"]
                rfe_analysis = ai_result.get("summary", "")
                if ai_result.get("evidenceRequested"):
                    rfe_analysis += "\n\nEvidencia solicitada:\n" + "\n".join(f"- {e}" for e in ai_result["evidenceRequested"])

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "status": "rfe_recibido", "rfeReceivedDate": now, "rfeDeadline": deadline,
            "rfeDocumentUrl": doc_url, "rfeAnalysis": rfe_analysis,
            "rfeClientNotified": False, "updatedAt": now,
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"RFE recibido (deadline: {deadline or 'por definir'})", performer)

        # Notify coordinator AND director, NOT client yet
        try:
            from services.case_notifications import _send_email, _email_wrapper
            rfe_recipients = []
            if case.get("coordinatorId"):
                coord = await db.staff.find_one({"_id": case["coordinatorId"]}, {"name": 1, "email": 1})
                if coord and coord.get("email"):
                    rfe_recipients.append((coord["email"], coord.get("name", "")))
            # Always notify director
            if DIRECTOR_EMAIL not in [r[0] for r in rfe_recipients]:
                rfe_recipients.append((DIRECTOR_EMAIL, "Director"))

            for email, name in rfe_recipients:
                body = f"<p>Se recibio un RFE para <strong>{case.get('name', '')}</strong>.</p><p>Deadline: <strong>{deadline or 'Por definir'}</strong></p>"
                if rfe_analysis:
                    body += f"<p><strong>Analisis IA:</strong></p><p>{rfe_analysis[:300]}...</p>"
                html = _email_wrapper(name, "RFE Recibido", body)
                _send_email(email, f"RFE: {case.get('name', '')}", html)
                await _log_notification(case_id, "rfe_recibido", email, f"RFE: {case.get('name', '')}")
            # N8N webhook for RFE received (internal)
            await _fire_n8n_webhook(case, "rfe_recibido", f"RFE Recibido - {case.get('name', '')}", body, staff_payload.get("email", ""))
        except Exception as e:
            logger.error(f"Email error: {e}")

        return {"success": True, "message": "RFE registrado", "aiResult": ai_result, "analysis": rfe_analysis}

    @router.post("/admin/{case_id}/rfe-strategy")
    async def generate_rfe_strategy_endpoint(
        case_id: str,
        strategy: str = Form(""),
        source: str = Form("manual"),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Save or generate RFE strategy."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        if source == "ai":
            from services.classic_case_ai import generate_rfe_strategy
            case_info = f"Cliente: {case.get('name', '')}, Visa: {case.get('visaType', '')}"
            rfe_analysis = case.get("rfeAnalysis", "")
            result = await generate_rfe_strategy(rfe_analysis, case_info)
            if result.get("success"):
                strategy = result["strategy"]
            else:
                raise HTTPException(status_code=500, detail=result.get("error", "Error al generar estrategia"))

        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "rfeStrategy": strategy, "rfeStrategySource": source, "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"Estrategia RFE {'generada con IA' if source == 'ai' else 'escrita manualmente'}", performer)

        return {"success": True, "strategy": strategy}

    @router.post("/admin/{case_id}/rfe-notify-client")
    async def notify_client_rfe(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Notify client about the RFE."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        if not case.get("rfeStrategy"):
            raise HTTPException(status_code=400, detail="Primero define la estrategia del RFE")

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {"rfeClientNotified": True, "rfeClientNotifiedDate": now, "updatedAt": now}})

        _send_status_email(case, "RFE Recibido",
            f"USCIS solicito evidencia adicional para tu caso.<br>"
            f"<strong>Fecha limite:</strong> {case.get('rfeDeadline', 'Por confirmar')}<br>"
            f"<strong>Estrategia:</strong><br>{case.get('rfeStrategy', '')[:500]}")
        await _log_notification(case_id, "rfe_notificacion_cliente", case.get("email", ""), "RFE Recibido")
        await _fire_n8n_webhook(case, "rfe_notificacion_cliente",
            f"Informacion importante sobre tu caso de visa - RFE",
            f"USCIS solicito evidencia adicional para tu caso.<br>Fecha limite: {case.get('rfeDeadline', 'Por confirmar')}<br>Estrategia: {case.get('rfeStrategy', '')[:500]}",
            staff_payload.get("email", ""))

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, "Cliente notificado del RFE", performer)

        return {"success": True, "message": "Cliente notificado"}

    @router.post("/admin/{case_id}/rfe-responded")
    async def mark_rfe_responded(
        case_id: str,
        trackingNumber: str = Form(""),
        shippingCompany: str = Form("FedEx"),
        notifyClient: bool = Form(True),
        file: UploadFile = File(None),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Mark RFE as responded — with tracking, document upload, same flow as filing."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        doc_url = None
        if file:
            content = await file.read()
            try:
                from supabase import create_client
                supa_url = os.environ.get("SUPABASE_STORAGE_URL")
                supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
                bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
                if supa_url and supa_key:
                    supa = create_client(supa_url, supa_key)
                    path = f"classic-cases/{case_id}/rfe_response_{file.filename}"
                    supa.storage.from_(bucket).upload(path, content, file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
                    doc_url = supa.storage.from_(bucket).get_public_url(path)
            except Exception as e:
                logger.error(f"Upload error: {e}")

            # AI scan for tracking if not provided
            if not trackingNumber and file:
                try:
                    from services.classic_case_ai import extract_tracking_from_document
                    ai_result = await extract_tracking_from_document(content, file.filename)
                    if ai_result.get("success") and ai_result.get("trackingNumber"):
                        trackingNumber = ai_result["trackingNumber"]
                        if ai_result.get("shippingCompany"):
                            shippingCompany = ai_result["shippingCompany"]
                except:
                    pass

        now = datetime.now(timezone.utc).isoformat()
        update = {
            "status": "rfe_respondido",
            "rfeRespondedDate": now,
            "updatedAt": now,
        }
        if trackingNumber:
            update["rfeResponseTrackingNumber"] = trackingNumber
            update["rfeResponseShippingCompany"] = shippingCompany
        if doc_url:
            update["rfeResponseDocumentUrl"] = doc_url

        await db.classic_cases.update_one({"id": case_id}, {"$set": update})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        tracking_info = f" (Tracking: {trackingNumber} via {shippingCompany})" if trackingNumber else ""
        await _log_timeline(case_id, f"RFE respondido{tracking_info}", performer)

        if notifyClient:
            body = (
                f"<p>Le informamos que la respuesta a la solicitud de evidencia adicional (RFE) de USCIS ha sido enviada exitosamente.</p>"
            )
            if trackingNumber:
                tracking_urls = {
                    "FedEx": f"https://www.fedex.com/fedextrack/?trknbr={trackingNumber}",
                    "USPS": f"https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}",
                    "UPS": f"https://www.ups.com/track?tracknum={trackingNumber}",
                    "DHL": f"https://www.dhl.com/us-en/home/tracking.html?tracking-id={trackingNumber}",
                }
                tracking_url = tracking_urls.get(shippingCompany, "#")
                body += (
                    f"<div style='background:#F9FAFB;border-left:4px solid #C9A96A;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;'>"
                    f"<p style='margin:0 0 4px;color:#6B7280;font-size:13px;'>Numero de Tracking ({shippingCompany}):</p>"
                    f"<p style='margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;'>{trackingNumber}</p>"
                    f"<a href='{tracking_url}' style='color:#007AFF;font-size:13px;'>Rastrear envio en {shippingCompany}</a>"
                    f"</div>"
                )
            body += f"<p style='color:#6B7280;font-size:13px;'>Ahora estamos a la espera de la decision de USCIS. Nuestro equipo seguira monitoreando su caso.</p>"
            _send_status_email(case, "RFE Respondido", body)
            await _log_notification(case_id, "rfe_respondido", case.get("email", ""), "RFE Respondido")
            await _fire_n8n_webhook(case, "rfe_respondido", f"Tu respuesta al RFE ha sido enviada a USCIS", body, staff_payload.get("email", ""))

        # Notify coordinator
        coord_body = (
            f"<p>La respuesta al RFE de <strong>{case.get('name', '')}</strong> ha sido enviada.</p>"
            f"{'<p><strong>Tracking:</strong> ' + trackingNumber + ' (' + shippingCompany + ')</p>' if trackingNumber else ''}"
            f"<p>Procesado por: {staff_payload.get('name', staff_payload.get('email', ''))}</p>"
        )
        await _notify_coordinator_status(case, case_id, "RFE Respondido", coord_body)

        return {"success": True, "message": "RFE respondido"}

    @router.post("/admin/{case_id}/approve")
    async def approve_case(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Approve case."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {"status": "aprobado", "approvalDate": now, "updatedAt": now}})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, "Caso APROBADO", performer)

        _send_status_email(case, "APROBADO", 
            f"<p>Es un honor comunicarle que su caso ha sido <strong style='color:#10B981;font-size:18px;'>APROBADO</strong> por USCIS.</p>"
            f"<p>Este logro es el resultado de su esfuerzo, dedicacion y confianza en nuestro equipo. "
            f"Hoy se abre un nuevo capitulo en su vida profesional en Estados Unidos.</p>"
            f"<div style='background:#ECFDF5;border-left:4px solid #10B981;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;text-align:center;'>"
            f"<p style='margin:0;font-size:24px;'>🎉</p>"
            f"<p style='margin:8px 0 0;font-size:16px;font-weight:700;color:#065F46;'>Felicidades, su caso ha sido aprobado</p>"
            f"</div>"
            f"<p style='color:#6B7280;font-size:13px;'>Su coordinador se comunicara con usted para guiarle en los siguientes pasos. "
            f"Gracias por confiar en URPE Integral Services.</p>"
        )
        await _log_notification(case_id, "aprobado", case.get("email", ""), "Caso Aprobado")
        await _fire_n8n_webhook(case, "aprobado", f"Felicidades! Tu caso ha sido aprobado",
            f"<p>Su caso ha sido <strong style='color:#10B981;'>APROBADO</strong> por USCIS.</p>",
            staff_payload.get("email", ""))

        # Notify coordinator
        coord_body = (
            f"<p>El caso de <strong>{case.get('name', '')}</strong> ha sido <strong style='color:#10B981;'>APROBADO</strong>.</p>"
            f"<p>Procesado por: {staff_payload.get('name', staff_payload.get('email', ''))}</p>"
        )
        await _notify_coordinator_status(case, case_id, "Aprobado", coord_body)

        return {"success": True, "message": "Caso aprobado"}

    FILING_BCC_EMAILS = [
        "vl@urpeailab.com",
        "av@urpeintegralservices.co",
        "dau@urpeintegralservices.co",
        "ap@urpeintegralservices.co",
        "finanzas@urpeintegralservices.co",
    ]

    def _send_status_email(case, status_label, body_html, bcc=None):
        """Send email to client on status change, with optional BCC."""
        try:
            from services.case_notifications import _email_wrapper, EMAIL_FROM
            import resend as _resend
            _resend.api_key = os.environ.get("RESEND_API_KEY", "")

            email = case.get("email")
            if not email:
                return

            html = _email_wrapper(case.get("name", "Cliente"), f"Estado: {status_label}", body_html)

            send_params = {
                "from": f"URPE Integral Services <{EMAIL_FROM}>",
                "to": [email],
                "subject": f"Tu caso: {status_label}",
                "html": html,
            }
            if bcc:
                send_params["bcc"] = bcc

            _resend.Emails.send(send_params)
            logger.info(f"Status email sent to {email}" + (f" (BCC: {len(bcc)})" if bcc else ""))
        except Exception as e:
            logger.error(f"Status email error: {e}")

    # ========== WORK STATUS ==========

    @router.post("/admin/{case_id}/work-status")
    async def change_work_status(case_id: str, workStatus: str = Form(...), staff_payload: dict = Depends(verify_staff_token)):
        """Change work status."""
        if workStatus not in WORK_STATUSES:
            raise HTTPException(status_code=400, detail="Estado de trabajo invalido")

        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        now = datetime.now(timezone.utc).isoformat()
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "workStatus": workStatus,
            "workStatusChangedBy": staff_payload.get("email"),
            "workStatusChangedAt": now,
            "updatedAt": now,
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"Estado de trabajo: {workStatus}", performer)

        # Desisted notification → Coordinator + Director + Operations
        if workStatus == "desisted":
            try:
                from services.case_notifications import _send_email, _email_wrapper
                body = (
                    f"<p><strong>{case.get('name', '')}</strong> ha sido marcado como <strong style='color:#EF4444;'>DESISTIO</strong>.</p>"
                    f"<p>Procesado por: {staff_payload.get('name', staff_payload.get('email', ''))}</p>"
                )
                coord_email, coord_name = await _get_coordinator_email(case)
                desist_recipients = []
                if coord_email:
                    desist_recipients.append((coord_email, coord_name))
                for email, name in [(DIRECTOR_EMAIL, "Director"), (OPERATIONS_EMAIL, "Operaciones")]:
                    if email not in [r[0] for r in desist_recipients]:
                        desist_recipients.append((email, name))

                for email, name in desist_recipients:
                    html = _email_wrapper(name, f"Cliente Desistio - {case.get('name', '')}", body)
                    _send_email(email, f"Cliente Desistio - {case.get('name', '')}", html)
                    await _log_notification(case_id, "client_desisted", email, f"Cliente Desistio - {case.get('name', '')}")
                # N8N webhook for desisted
                await _fire_n8n_webhook(case, "client_desisted", f"Cliente Desistio - {case.get('name', '')}", body, staff_payload.get("email", ""))
            except Exception as e:
                logger.error(f"Desisted notification error: {e}")

        return {"success": True, "message": "Estado de trabajo actualizado"}

    # ========== DELIVERABLES ==========

    @router.put("/admin/{case_id}/deliverables/{item_id}/check")
    async def toggle_deliverable_check(
        case_id: str, item_id: str,
        role: str = Form(...),  # "coordinator" or "armador"
        checked: bool = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Toggle a deliverable check for coordinator or armador."""
        if role not in ("coordinator", "armador"):
            raise HTTPException(status_code=400, detail="Role must be coordinator or armador")

        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        field = f"completed_{role}"
        found = False
        deliverables = case.get("deliverables", [])

        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    item[field] = checked
                    item["completed"] = item.get("completed_coordinator", False) and item.get("completed_armador", False)
                    found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Entregable no encontrado")

        p_coord, p_armador, p_total = _calc_progress(deliverables)

        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "deliverables": deliverables,
            "progressCoordinator": p_coord,
            "progressArmador": p_armador,
            "progress": p_total,
            "lastProgressChangeAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})

        return {"success": True, "progressCoordinator": p_coord, "progressArmador": p_armador, "progress": p_total}

    @router.post("/admin/{case_id}/deliverables/mass-check")
    async def mass_check_deliverables(
        case_id: str,
        role: str = Form(...),
        action: str = Form(...),  # "check" or "uncheck"
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Mass check/uncheck all deliverables for a role."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        field = f"completed_{role}"
        val = action == "check"
        deliverables = case.get("deliverables", [])

        for cat in deliverables:
            for item in cat.get("items", []):
                item[field] = val
                item["completed"] = item.get("completed_coordinator", False) and item.get("completed_armador", False)
                for si in item.get("sub_items", []):
                    si[field] = val
                    si["completed"] = si.get("completed_coordinator", False) and si.get("completed_armador", False)

        p_coord, p_armador, p_total = _calc_progress(deliverables)

        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "deliverables": deliverables,
            "progressCoordinator": p_coord,
            "progressArmador": p_armador,
            "progress": p_total,
            "lastProgressChangeAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        label = "Completar" if val else "Desmarcar"
        await _log_timeline(case_id, f"{label} {role}: todos los entregables", performer)

        return {"success": True, "progressCoordinator": p_coord, "progressArmador": p_armador, "progress": p_total}

    @router.post("/admin/{case_id}/deliverables/add-item")
    async def add_deliverable_item(
        case_id: str,
        categoryIndex: int = Form(...),
        itemName: str = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Add a new item to a category."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        deliverables = case.get("deliverables", [])
        if categoryIndex < 0 or categoryIndex >= len(deliverables):
            raise HTTPException(status_code=400, detail="Categoria invalida")

        new_item = {
            "id": str(uuid.uuid4()),
            "item": itemName.strip(),
            "completed": False,
            "completed_coordinator": False,
            "completed_armador": False,
            "status": None,
            "status_date": None,
            "notes": [],
            "sub_items": [],
        }
        deliverables[categoryIndex]["items"].append(new_item)

        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "deliverables": deliverables,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})

        return {"success": True, "item": new_item}

    @router.delete("/admin/{case_id}/deliverables/{item_id}")
    async def delete_deliverable_item(case_id: str, item_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Delete a deliverable item."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        deliverables = case.get("deliverables", [])
        found = False
        for cat in deliverables:
            original_len = len(cat.get("items", []))
            cat["items"] = [i for i in cat.get("items", []) if i.get("id") != item_id]
            if len(cat["items"]) < original_len:
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail="Item no encontrado")

        p_coord, p_armador, p_total = _calc_progress(deliverables)

        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "deliverables": deliverables,
            "progressCoordinator": p_coord,
            "progressArmador": p_armador,
            "progress": p_total,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})

        return {"success": True, "message": "Item eliminado"}

    # ========== SUB-ITEMS ==========

    @router.put("/admin/{case_id}/deliverables/{item_id}/sub-items/{sub_item_id}/check")
    async def toggle_sub_item_check(
        case_id: str, item_id: str, sub_item_id: str,
        role: str = Form(...),
        checked: bool = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Toggle a sub-item check."""
        if role not in ("coordinator", "armador"):
            raise HTTPException(status_code=400, detail="Role must be coordinator or armador")

        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        field = f"completed_{role}"
        found = False
        deliverables = case.get("deliverables", [])

        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    for si in item.get("sub_items", []):
                        if si.get("id") == sub_item_id:
                            si[field] = checked
                            si["completed"] = si.get("completed_coordinator", False) and si.get("completed_armador", False)
                            found = True
                            break
                if found:
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Sub-item no encontrado")

        p_coord, p_armador, p_total = _calc_progress(deliverables)
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "deliverables": deliverables,
            "progressCoordinator": p_coord, "progressArmador": p_armador, "progress": p_total,
            "lastProgressChangeAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})
        return {"success": True, "progressCoordinator": p_coord, "progressArmador": p_armador, "progress": p_total}

    @router.post("/admin/{case_id}/deliverables/{item_id}/sub-items")
    async def add_sub_item(
        case_id: str, item_id: str,
        text: str = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Add a sub-item to a deliverable item."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        new_sub = {"id": str(uuid.uuid4()), "text": text.strip(), "completed": False, "completed_coordinator": False, "completed_armador": False}
        found = False
        deliverables = case.get("deliverables", [])

        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    item["sub_items"].append(new_sub)
                    found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Item no encontrado")

        await db.classic_cases.update_one({"id": case_id}, {"$set": {"deliverables": deliverables, "updatedAt": datetime.now(timezone.utc).isoformat()}})
        return {"success": True, "subItem": new_sub}

    @router.delete("/admin/{case_id}/deliverables/{item_id}/sub-items/{sub_item_id}")
    async def delete_sub_item(
        case_id: str, item_id: str, sub_item_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a sub-item."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        found = False
        deliverables = case.get("deliverables", [])
        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    orig = len(item.get("sub_items", []))
                    item["sub_items"] = [s for s in item.get("sub_items", []) if s.get("id") != sub_item_id]
                    if len(item["sub_items"]) < orig:
                        found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Sub-item no encontrado")

        p_coord, p_armador, p_total = _calc_progress(deliverables)
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "deliverables": deliverables, "progressCoordinator": p_coord, "progressArmador": p_armador, "progress": p_total,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }})
        return {"success": True, "message": "Sub-item eliminado"}

    # ========== ITEM STATUS ==========

    @router.put("/admin/{case_id}/deliverables/{item_id}/status")
    async def update_item_status(
        case_id: str, item_id: str,
        status: str = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Set item status: 'pedido', 'en_revision', or null (sin estado)."""
        valid = ["pedido", "en_revision", ""]
        if status not in valid:
            raise HTTPException(status_code=400, detail="Estado invalido")

        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        found = False
        deliverables = case.get("deliverables", [])
        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    item["status"] = status if status else None
                    item["status_date"] = datetime.now(timezone.utc).isoformat() if status else None
                    found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Item no encontrado")

        await db.classic_cases.update_one({"id": case_id}, {"$set": {"deliverables": deliverables, "updatedAt": datetime.now(timezone.utc).isoformat()}})
        return {"success": True}

    # ========== ITEM NOTES ==========

    @router.post("/admin/{case_id}/deliverables/{item_id}/notes")
    async def add_item_note(
        case_id: str, item_id: str,
        text: str = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Add a note to a deliverable item."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        note = {
            "id": str(uuid.uuid4()),
            "text": text.strip(),
            "author": staff_payload.get("name", staff_payload.get("email", "")),
            "authorId": staff_payload.get("id"),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

        found = False
        item_found_name = ""
        deliverables = case.get("deliverables", [])
        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    item_found_name = item.get("item", "")
                    item["notes"].append(note)
                    found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Item no encontrado")

        await db.classic_cases.update_one({"id": case_id}, {"$set": {"deliverables": deliverables, "updatedAt": datetime.now(timezone.utc).isoformat()}})
        
        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"Nota agregada en: {item_found_name}", performer, {"note": text.strip()})
        
        return {"success": True, "note": note}

    @router.delete("/admin/{case_id}/deliverables/{item_id}/notes/{note_id}")
    async def delete_item_note(
        case_id: str, item_id: str, note_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a note from a deliverable item."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        found = False
        deleted_text = ""
        item_found_name = ""
        deliverables = case.get("deliverables", [])
        for cat in deliverables:
            for item in cat.get("items", []):
                if item.get("id") == item_id:
                    item_found_name = item.get("item", "")
                    for n in item.get("notes", []):
                        if n.get("id") == note_id:
                            deleted_text = n.get("text", "")
                    item["notes"] = [n for n in item.get("notes", []) if n.get("id") != note_id]
                    found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(status_code=404, detail="Item no encontrado")

        await db.classic_cases.update_one({"id": case_id}, {"$set": {"deliverables": deliverables, "updatedAt": datetime.now(timezone.utc).isoformat()}})
        
        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, f"Nota eliminada de: {item_found_name}", performer, {"deletedNote": deleted_text})
        
        return {"success": True}

    # ========== TIMELINE ==========

    @router.get("/admin/{case_id}/timeline")
    async def get_timeline(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Get case timeline."""
        entries = await db.classic_case_timeline.find({"caseId": case_id}, {"_id": 0}).sort("timestamp", -1).to_list(200)
        return {"success": True, "timeline": entries}

    # ========== COLLABORATIVE NOTES ==========

    @router.get("/admin/{case_id}/notes")
    async def get_case_notes(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Get all notes for a case."""
        notes = await db.classic_case_notes.find({"caseId": case_id}, {"_id": 0}).sort("createdAt", -1).to_list(200)
        return {"success": True, "notes": notes}

    @router.post("/admin/{case_id}/notes")
    async def add_case_note(
        case_id: str,
        text: str = Form(...),
        requiresAttention: bool = Form(False),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Add a note to a case. Supports @mentions (email) — notifies mentioned users."""
        import re

        note_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        note = {
            "id": note_id,
            "caseId": case_id,
            "text": text.strip(),
            "authorId": staff_payload.get("id"),
            "authorName": staff_payload.get("name", ""),
            "authorEmail": staff_payload.get("email", ""),
            "requiresAttention": requiresAttention,
            "edited": False,
            "readBy": [staff_payload.get("id")],
            "createdAt": now,
            "updatedAt": now,
        }

        await db.classic_case_notes.insert_one(note)

        # Actualizar updatedAt del caso para reflejar actividad reciente (afecta días de inactividad)
        await db.classic_cases.update_one({"id": case_id}, {"$set": {"updatedAt": now}})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        await _log_timeline(case_id, "Nota agregada", performer, {"preview": text[:80]})

        # Process @mentions
        mentions = re.findall(r'@([\w.+-]+@[\w-]+\.[\w.]+)', text)
        if mentions:
            case = await db.classic_cases.find_one({"id": case_id}, {"name": 1})
            client_name = case.get("name", "") if case else ""
            try:
                from services.case_notifications import _send_email, _email_wrapper
                for email in set(mentions):
                    staff_member = await db.staff.find_one({"email": email}, {"name": 1})
                    name = staff_member.get("name", email) if staff_member else email
                    body = (
                        f"<p><strong>{staff_payload.get('name', 'Alguien')}</strong> te menciono en una nota del caso <strong>{client_name}</strong>:</p>"
                        f"<div style='background:#F3F4F6;border-left:4px solid #C9A96A;padding:12px 16px;border-radius:8px;margin:12px 0;'>"
                        f"<p style='margin:0;color:#374151;font-size:14px;'>{text}</p></div>"
                    )
                    html = _email_wrapper(name, "Te mencionaron en una nota", body)
                    _send_email(email, f"Mencion en caso: {client_name}", html)
            except Exception as e:
                logger.error(f"Mention email error: {e}")

        note.pop("_id", None)
        return {"success": True, "note": note}

    @router.put("/admin/{case_id}/notes/{note_id}")
    async def edit_case_note(
        case_id: str, note_id: str,
        text: str = Form(...),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Edit a note. Author can edit (marked as edited). Admin/president edit without mark."""
        note = await db.classic_case_notes.find_one({"id": note_id, "caseId": case_id})
        if not note:
            raise HTTPException(status_code=404, detail="Nota no encontrada")

        role = staff_payload.get("role", "")
        is_author = note.get("authorId") == staff_payload.get("id")
        is_admin = role in ("admin", "super_admin")

        if not is_author and not is_admin:
            raise HTTPException(status_code=403, detail="Solo el autor o admin puede editar")

        update = {"text": text.strip(), "updatedAt": datetime.now(timezone.utc).isoformat()}
        if is_author and not is_admin:
            update["edited"] = True

        await db.classic_case_notes.update_one({"id": note_id}, {"$set": update})
        return {"success": True}

    @router.delete("/admin/{case_id}/notes/{note_id}")
    async def delete_case_note(case_id: str, note_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Delete a note."""
        role = staff_payload.get("role", "")
        if role not in ("admin", "super_admin"):
            note = await db.classic_case_notes.find_one({"id": note_id})
            if not note or note.get("authorId") != staff_payload.get("id"):
                raise HTTPException(status_code=403, detail="Solo el autor o admin puede eliminar")

        await db.classic_case_notes.delete_one({"id": note_id, "caseId": case_id})
        return {"success": True}

    # ========== CLIENT CONTACT LOG ==========

    class ContactLogEntry(BaseModel):
        medium: str  # whatsapp, call, email, presencial
        summary: str
        emotionalState: str  # satisfied, with_doubts, worried, frustrated
        needsFollowUp: bool = False
        followUpNote: Optional[str] = None

    @router.get("/admin/{case_id}/contacts")
    async def get_contact_log(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Get contact history for a case."""
        contacts = await db.classic_case_contacts.find({"caseId": case_id}, {"_id": 0}).sort("createdAt", -1).to_list(200)
        return {"success": True, "contacts": contacts}

    @router.post("/admin/{case_id}/contacts")
    async def add_contact_log(case_id: str, data: ContactLogEntry, staff_payload: dict = Depends(verify_staff_token)):
        """Register a client contact."""
        if len(data.summary.strip()) < 20:
            raise HTTPException(status_code=400, detail="El resumen debe tener al menos 20 caracteres")

        valid_mediums = ["whatsapp", "call", "email", "presencial"]
        if data.medium not in valid_mediums:
            raise HTTPException(status_code=400, detail="Medio invalido")

        valid_emotions = ["satisfied", "with_doubts", "worried", "frustrated"]
        if data.emotionalState not in valid_emotions:
            raise HTTPException(status_code=400, detail="Estado emocional invalido")

        now = datetime.now(timezone.utc).isoformat()
        contact = {
            "id": str(uuid.uuid4()),
            "caseId": case_id,
            "medium": data.medium,
            "summary": data.summary.strip(),
            "emotionalState": data.emotionalState,
            "needsFollowUp": data.needsFollowUp,
            "followUpNote": data.followUpNote,
            "registeredBy": staff_payload.get("name", ""),
            "registeredById": staff_payload.get("id"),
            "createdAt": now,
        }

        await db.classic_case_contacts.insert_one(contact)

        # Update last contact on case
        await db.classic_cases.update_one({"id": case_id}, {"$set": {
            "lastContactAt": now,
            "lastContactBy": staff_payload.get("email", ""),
            "updatedAt": now,
        }})

        performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
        medium_label = {"whatsapp": "WhatsApp", "call": "Llamada", "email": "Email", "presencial": "Presencial"}.get(data.medium, data.medium)
        await _log_timeline(case_id, f"Contacto registrado via {medium_label}", performer, {"emotionalState": data.emotionalState})

        contact.pop("_id", None)
        return {"success": True, "contact": contact}

    # ========== RESEND NOTIFICATIONS ==========

    @router.post("/admin/{case_id}/resend-notification")
    async def resend_notification(
        case_id: str,
        notificationType: str = Form(...),
        sendToClient: str = Form("true"),
        sendToCoordinator: str = Form("false"),
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Resend a notification email to the client and/or coordinator."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        client_email = case.get("email")
        send_client = sendToClient.lower() == "true"
        send_coord = sendToCoordinator.lower() == "true"

        if send_client and not client_email:
            raise HTTPException(status_code=400, detail="Cliente sin email")

        valid_types = ["radicado", "ioe", "devolucion", "rfe", "aprobado"]
        if notificationType not in valid_types:
            raise HTTPException(status_code=400, detail="Tipo invalido")

        try:
            from services.case_notifications import _send_email, _email_wrapper

            subject = ""
            body = ""
            if notificationType == "radicado" and case.get("trackingNumber"):
                subject = "Recordatorio: Tu caso fue enviado"
                body = f"Tu caso fue enviado via <strong>{case.get('shippingCompany', '')}</strong>.<br>Tracking: <strong>{case['trackingNumber']}</strong>"
            elif notificationType == "ioe" and case.get("ioeNumber"):
                subject = f"Recordatorio: Tu IOE es {case['ioeNumber']}"
                body = f"USCIS recibio tu caso.<br>IOE: <strong>{case['ioeNumber']}</strong><br><a href='https://egov.uscis.gov/casestatus/mycasestatus.do'>Consultar en USCIS</a>"
            elif notificationType == "devolucion" and case.get("devolucionSummary"):
                subject = "Recordatorio: Caso devuelto"
                body = f"USCIS devolvio tu caso.<br><strong>Motivo:</strong> {case['devolucionSummary']}"
            elif notificationType == "rfe" and case.get("rfeAnalysis"):
                subject = "Recordatorio: RFE pendiente"
                body = f"USCIS solicito evidencia adicional.<br><strong>Deadline:</strong> {case.get('rfeDeadline', 'Por confirmar')}"
            elif notificationType == "aprobado" and case.get("approvalDate"):
                subject = "Recordatorio: Caso aprobado"
                body = "Felicidades! Tu caso ha sido <strong>APROBADO</strong> por USCIS."
            else:
                raise HTTPException(status_code=400, detail="No hay datos suficientes para reenviar esta notificacion")

            sent_to = []
            if send_client and client_email:
                html = _email_wrapper(case["name"], subject, body)
                _send_email(client_email, subject, html)
                sent_to.append(client_email)
                await _log_notification(case_id, f"resend_{notificationType}", client_email, subject)

            if send_coord:
                coord_email, coord_name = await _get_coordinator_email(case)
                if coord_email:
                    html = _email_wrapper(coord_name or "Coordinador", f"[Reenvio] {subject}", body)
                    _send_email(coord_email, f"[Reenvio] {subject}", html)
                    sent_to.append(coord_email)
                    await _log_notification(case_id, f"resend_{notificationType}", coord_email, f"[Reenvio] {subject}")

            await _fire_n8n_webhook(case, f"resend_{notificationType}", subject, body, staff_payload.get("email", ""))

            performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
            await _log_timeline(case_id, f"Notificacion reenviada: {notificationType}", performer)

            await db.classic_case_resend_history.insert_one({
                "caseId": case_id, "type": notificationType, "sentTo": ", ".join(sent_to),
                "sentBy": staff_payload.get("email", ""), "sentAt": datetime.now(timezone.utc).isoformat(), "isResend": True
            })

            return {"success": True, "message": f"Notificacion reenviada a {', '.join(sent_to)}"}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/admin/{case_id}/resend-history")
    async def get_resend_history(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Get notification resend history."""
        history = await db.classic_case_resend_history.find({"caseId": case_id}, {"_id": 0}).sort("sentAt", -1).to_list(50)
        return {"success": True, "history": history}

    # ========== REPORTS ==========

    @router.get("/admin/reports/filings")
    async def get_filings_report(
        dateFrom: str = None, dateTo: str = None,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Report: cases filed (enviados) and RFEs responded in a date range."""
        now = datetime.now(timezone.utc)

        # Default: current month
        if not dateFrom:
            dateFrom = now.replace(day=1).strftime("%Y-%m-%d")
        if not dateTo:
            dateTo = now.strftime("%Y-%m-%d")

        # Filed cases (filingDate in range)
        filing_query = {"filingDate": {"$gte": dateFrom, "$lte": dateTo + "T23:59:59"}, "status": {"$ne": "en_proceso"}}
        filed = await db.classic_cases.find(filing_query, {"_id": 0, "deliverables": 0}).sort("filingDate", -1).to_list(1000)

        # RFE responded (by rfeRespondedDate in range)
        rfe_query = {"rfeRespondedDate": {"$gte": dateFrom, "$lte": dateTo + "T23:59:59"}}
        rfes = await db.classic_cases.find(rfe_query, {"_id": 0, "deliverables": 0}).sort("rfeRespondedDate", -1).to_list(1000)

        # Add coordinator names
        for case_list in [filed, rfes]:
            for c in case_list:
                if c.get("coordinatorId"):
                    coord = await db.staff.find_one({"_id": c["coordinatorId"]}, {"name": 1})
                    c["coordinatorName"] = coord.get("name", "") if coord else ""

        # Monthly breakdown for chart
        from collections import defaultdict
        monthly_filings = defaultdict(int)
        monthly_rfes = defaultdict(int)

        all_filed = await db.classic_cases.find({"filingDate": {"$ne": None}}, {"filingDate": 1}).to_list(5000)
        for c in all_filed:
            fd = c.get("filingDate", "")
            if fd:
                month_key = fd[:7]  # YYYY-MM
                monthly_filings[month_key] += 1

        all_rfes = await db.classic_cases.find({"rfeRespondedDate": {"$ne": None}}, {"rfeRespondedDate": 1}).to_list(5000)
        for c in all_rfes:
            rd = c.get("rfeRespondedDate", "")
            if rd:
                month_key = rd[:7]
                monthly_rfes[month_key] += 1

        # Build monthly chart data (last 12 months)
        chart_data = []
        for i in range(11, -1, -1):
            m = now.month - i
            y = now.year
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y}-{m:02d}"
            chart_data.append({"month": key, "filings": monthly_filings.get(key, 0), "rfes": monthly_rfes.get(key, 0)})

        return {
            "success": True,
            "dateFrom": dateFrom,
            "dateTo": dateTo,
            "filedCases": filed,
            "filedCount": len(filed),
            "rfeCases": rfes,
            "rfeCount": len(rfes),
            "chartData": chart_data,
        }

    # ========== DAILY ALERTS CRON ==========

    @router.post("/cron/daily-alerts")
    async def trigger_daily_alerts(staff_payload: dict = Depends(verify_staff_token)):
        """Manually trigger the daily alert system."""
        role = staff_payload.get("role", "")
        if role not in ("admin", "super_admin"):
            raise HTTPException(status_code=403, detail="Solo admin puede ejecutar alertas")
        from services.classic_case_alerts import run_classic_case_alerts
        result = await run_classic_case_alerts(db)
        return {"success": True, "message": f"Alertas ejecutadas: {result['emailsSent']} emails, {result['totalAlerts']} alertas", **result}

    # ========== MIGRATION IMPORT ==========

    @router.post("/admin/import")
    async def import_classic_cases(
        data: dict,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """
        Import classic cases from external system.
        Expects: { "clients": [ { name, email, phone, deliverables, ... } ] }
        Maps coordinator_email to coordinatorId, adds IDs to items/sub-items,
        migrates notes to classic_case_notes collection.
        """
        role = staff_payload.get("role", "")
        if role not in ("admin", "super_admin"):
            raise HTTPException(status_code=403, detail="Solo admin puede importar")

        clients = data.get("clients", [])
        if not clients:
            raise HTTPException(status_code=400, detail="No hay clientes para importar")

        # Pre-load staff for coordinator mapping
        all_staff = await db.staff.find({}, {"_id": 1, "email": 1}).to_list(500)
        staff_by_email = {s.get("email", "").lower(): str(s["_id"]) for s in all_staff}

        imported = 0
        skipped = 0
        errors = []

        for client in clients:
            try:
                name = (client.get("name") or "").strip()
                email = (client.get("email") or "").strip()
                phone = (client.get("phone") or "").strip()

                if not name:
                    skipped += 1
                    continue

                # Check if already exists (by email or name+phone)
                existing = None
                if email:
                    existing = await db.classic_cases.find_one({"email": email})
                if not existing and phone:
                    existing = await db.classic_cases.find_one({"name": name, "phone": phone})
                if existing:
                    skipped += 1
                    continue

                # Map coordinator email to ID
                coord_email = (client.get("coordinator_email") or "").strip().lower()
                coord_id = staff_by_email.get(coord_email)

                # Map status
                status_map = {
                    "en proceso": "en_proceso",
                    "en_proceso": "en_proceso",
                    "radicado": "radicado",
                    "recibido uscis": "recibido_uscis",
                    "recibido_uscis": "recibido_uscis",
                    "rfe recibido": "rfe_recibido",
                    "rfe_recibido": "rfe_recibido",
                    "rfe respondido": "rfe_respondido",
                    "rfe_respondido": "rfe_respondido",
                    "devuelto": "devuelto",
                    "aprobado": "aprobado",
                }
                status = status_map.get((client.get("status") or "en proceso").lower().strip(), "en_proceso")

                # Map work status
                ws_map = {"working": "working", "paused": "paused", "waiting_uscis": "waiting_uscis", "desisted": "desisted"}
                work_status = ws_map.get(client.get("work_status")) if client.get("work_status") else "working"

                # Process deliverables — add IDs and collect notes
                deliverables = []
                notes_to_create = []
                case_id = str(uuid.uuid4())

                for cat in client.get("deliverables", []):
                    items = []
                    for item in cat.get("items", []):
                        item_id = item.get("id") or str(uuid.uuid4())

                        # Process sub-items — add IDs
                        sub_items = []
                        for si in item.get("sub_items", []):
                            sub_items.append({
                                "id": si.get("id") or str(uuid.uuid4()),
                                "text": si.get("text", ""),
                                "completed": si.get("completed", False),
                                "completed_coordinator": si.get("completed_coordinator", False),
                                "completed_armador": si.get("completed_armador", False),
                            })

                        # Extract notes from item to separate collection
                        item_notes = item.get("notes", [])
                        for note in item_notes:
                            notes_to_create.append({
                                "id": note.get("id") or str(uuid.uuid4()),
                                "caseId": case_id,
                                "text": note.get("content") or note.get("text", ""),
                                "authorId": note.get("created_by", ""),
                                "authorName": "",
                                "authorEmail": note.get("created_by_email", ""),
                                "requiresAttention": False,
                                "edited": False,
                                "readBy": [],
                                "createdAt": note.get("created_at") or datetime.now(timezone.utc).isoformat(),
                                "updatedAt": note.get("created_at") or datetime.now(timezone.utc).isoformat(),
                                "migratedFrom": "external",
                                "originalItemName": item.get("item", ""),
                            })

                        items.append({
                            "id": item_id,
                            "item": item.get("item", ""),
                            "completed": item.get("completed", False),
                            "completed_coordinator": item.get("completed_coordinator", False),
                            "completed_armador": item.get("completed_armador", False),
                            "status": item.get("status"),
                            "status_date": item.get("status_date"),
                            "notes": [],  # Notes go to separate collection
                            "sub_items": sub_items,
                        })

                    deliverables.append({"category": cat.get("category", ""), "items": items})

                # Calculate progress
                p_coord, p_armador, p_total = _calc_progress(deliverables)

                now = datetime.now(timezone.utc).isoformat()
                case = {
                    "_id": case_id,
                    "id": case_id,
                    "userId": None,  # Not linked to app user yet
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "coordinatorId": coord_id,
                    "processingType": client.get("processing_type", "normal"),
                    "visaType": "EB-2 NIW",
                    "driveFolderUrl": client.get("drive_folder_url"),
                    "seniorityDate": client.get("seniority_date"),
                    "status": status,
                    "workStatus": work_status,
                    "workStatusChangedBy": None,
                    "workStatusChangedAt": now,
                    "deliverables": deliverables,
                    "progress": client.get("progress") or p_total,
                    "progressCoordinator": client.get("progress_coordinator") or p_coord,
                    "progressArmador": client.get("progress_armador") or p_armador,
                    "lastProgressChangeAt": now,
                    "filingDate": client.get("filing_date") or None,
                    "trackingNumber": client.get("tracking_number"),
                    "trackingDocumentUrl": None,
                    "shippingCompany": client.get("shipping_company"),
                    "ioeNumber": client.get("ioe_number"),
                    "ioeDocumentUrl": None,
                    "devolucionSummary": client.get("devolucion_summary"),
                    "devolucionDocumentUrl": None,
                    "rfeReceivedDate": None,
                    "rfeDeadline": client.get("rfe_deadline") or None,
                    "rfeDocumentUrl": None,
                    "rfeAnalysis": client.get("rfe_analysis"),
                    "rfeStrategy": client.get("rfe_strategy"),
                    "rfeStrategySource": None,
                    "rfeClientNotified": False,
                    "rfeClientNotifiedDate": None,
                    "approvalDate": None,
                    "approvalDocumentUrl": None,
                    "lastContactAt": client.get("last_contact_at"),
                    "lastContactBy": None,
                    "createdBy": staff_payload.get("id"),
                    "createdAt": client.get("created_at") or now,
                    "updatedAt": now,
                    "migratedFrom": "external",
                }

                await db.classic_cases.insert_one(case)

                # Insert migrated notes
                if notes_to_create:
                    await db.classic_case_notes.insert_many(notes_to_create)

                # Timeline entry
                await _log_timeline(case_id, "Caso importado desde sistema externo", {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")})

                imported += 1

            except Exception as e:
                errors.append(f"{client.get('name', '?')}: {str(e)[:80]}")

        return {
            "success": True,
            "message": f"Importacion completada: {imported} importados, {skipped} omitidos, {len(errors)} errores",
            "imported": imported,
            "skipped": skipped,
            "errors": errors[:20],
            "total": len(clients),
        }

    # ========== NOTIFY CLIENT STATUS (Manual) ==========

    @router.post("/admin/{case_id}/notify-client-status")
    async def notify_client_status(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Send predefined status update email to client based on current case state."""
        case = await db.classic_cases.find_one({"id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        email = case.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Cliente sin email")

        status = case.get("status", "en_proceso")
        ioe = case.get("ioeNumber", "")
        ioe_html = ""
        if ioe:
            ioe_html = (
                f"<p>Tu numero de caso: <strong>{ioe}</strong></p>"
                f"<p><a href='https://egov.uscis.gov/casestatus/mycasestatus.do' style='color:#007AFF;'>Consultar en USCIS.gov</a></p>"
            )

        # Predefined messages by status
        if status in ("radicado", "recibido_uscis", "rfe_respondido"):
            subject = f"Actualizacion de tu caso - {case.get('name', '')}"
            body = (
                f"<p>Tu caso fue enviado y estamos esperando respuesta de USCIS.</p>"
                f"{ioe_html}"
                f"<p style='color:#6B7280;font-size:13px;'>Puedes consultar el estado de tu caso en egov.uscis.gov. "
                f"Te notificaremos inmediatamente cuando haya una actualizacion.</p>"
            )
        else:
            subject = f"Actualizacion de tu caso - {case.get('name', '')}"
            body = (
                f"<p>Estamos preparando tu expediente. Nuestro equipo esta trabajando activamente en tu caso.</p>"
                f"{ioe_html}"
                f"<p style='color:#6B7280;font-size:13px;'>Si tienes dudas, contacta a tu coordinador.</p>"
            )

        try:
            from services.case_notifications import _send_email, _email_wrapper
            html = _email_wrapper(case.get("name", "Cliente"), "Actualizacion de tu caso", body)
            _send_email(email, subject, html)
            await _log_notification(case_id, "client_status_update", email, subject)
            await _fire_n8n_webhook(case, "client_status_update", subject, body, staff_payload.get("email", ""))

            performer = {"name": staff_payload.get("name", ""), "email": staff_payload.get("email", "")}
            await _log_timeline(case_id, "Informar al cliente: email enviado", performer)

            return {"success": True, "message": f"Email enviado a {email}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ========== BULK EMAIL ==========

    @router.post("/admin/bulk-email")
    async def send_bulk_email(
        data: dict,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Send bulk email to multiple classic case clients."""
        role = staff_payload.get("role", "")
        if role not in ("admin", "super_admin", "president", "director"):
            raise HTTPException(status_code=403, detail="No tienes permisos para enviar emails masivos")

        subject_template = data.get("subject", "")
        body_template = data.get("body", "")
        case_ids = data.get("caseIds", [])

        if not subject_template or not body_template:
            raise HTTPException(status_code=400, detail="Asunto y cuerpo son obligatorios")
        if not case_ids:
            raise HTTPException(status_code=400, detail="Selecciona al menos un caso")

        cases = await db.classic_cases.find(
            {"id": {"$in": case_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).to_list(len(case_ids))

        sent = 0
        failed = 0
        try:
            from services.case_notifications import _send_email, _email_wrapper
            for case in cases:
                email = case.get("email")
                name = case.get("name", "Cliente")
                if not email:
                    failed += 1
                    continue
                # Replace {nombre} placeholder
                personalized_subject = subject_template.replace("{nombre}", name)
                personalized_body = body_template.replace("{nombre}", name)
                html = _email_wrapper(name, personalized_subject, f"<div>{personalized_body}</div>")
                _send_email(email, personalized_subject, html)
                await _log_notification(case.get("id", ""), "bulk_email", email, personalized_subject, {"sentBy": staff_payload.get("email", "")})
                await _fire_n8n_webhook(case, "bulk_email", personalized_subject, personalized_body, staff_payload.get("email", ""))
                sent += 1
        except Exception as e:
            logger.error(f"Bulk email error: {e}")

        return {
            "success": True,
            "message": f"{sent} emails enviados, {failed} fallidos",
            "sent": sent,
            "failed": failed,
            "total": len(cases),
        }

    # ========== NOTIFICATION LOG ==========

    @router.get("/admin/{case_id}/notification-log")
    async def get_notification_log(case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Get all notification log entries for a case."""
        logs = await db.classic_case_notifications_log.find(
            {"caseId": case_id}, {"_id": 0}
        ).sort("sentAt", -1).to_list(100)
        return {"success": True, "logs": logs}

    return router
