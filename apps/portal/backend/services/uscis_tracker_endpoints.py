"""
USCIS Case Tracker Endpoints
Admin: register/manage receipt numbers
Client: view case status
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)


class USCISCaseCreate(BaseModel):
    receiptNumber: str
    formType: str = "I-140"
    clientName: Optional[str] = None
    serviceCenter: Optional[str] = None
    countryOfOrigin: Optional[str] = None


class USCISCaseUpdate(BaseModel):
    formType: Optional[str] = None
    serviceCenter: Optional[str] = None
    countryOfOrigin: Optional[str] = None
    clientName: Optional[str] = None


def setup_uscis_tracker_router(db, verify_staff_token, verify_client_token):
    from db.supabase_client import select, insert, update, delete

    router = APIRouter()

    def _fmt(row: dict) -> dict:
        """Normalize snake_case DB row to camelCase for frontend."""
        if not row:
            return row
        return {
            "receiptNumber": row.get("receipt_number"),
            "formType": row.get("form_type"),
            "clientName": row.get("client_name"),
            "serviceCenter": row.get("service_center"),
            "countryOfOrigin": row.get("country_of_origin"),
            "status": row.get("status"),
            "statusTitle": row.get("status_title"),
            "statusDescription": row.get("status_description"),
            "statusDate": row.get("status_date"),
            "visaCaseId": str(row["visa_case_id"]) if row.get("visa_case_id") else None,
            "history": row.get("history") or [],
            "lastCheckedAt": row.get("last_checked_at"),
            "lastStatusChangeAt": row.get("last_status_change_at"),
            "createdAt": row.get("created_at"),
            "createdBy": str(row["created_by"]) if row.get("created_by") else None,
        }

    # ========== ADMIN ENDPOINTS ==========

    @router.post("/admin/uscis-cases")
    async def register_uscis_case(
        data: USCISCaseCreate,
        case_id: str = None,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Admin registers a USCIS receipt number for a client's visa case."""
        receipt = data.receiptNumber.strip().upper()

        # Check duplicate
        existing = select("uscis_tracker_cases", filters={"receipt_number": receipt}, single=True)
        if existing:
            raise HTTPException(status_code=400, detail=f"El numero de recibo {receipt} ya esta registrado")

        # Fetch initial status from USCIS
        from services.uscis_scraper import fetch_uscis_status
        uscis_data = await fetch_uscis_status(receipt)

        now = datetime.now(timezone.utc).isoformat()
        history = []
        if uscis_data.get("success"):
            history.append({
                "date": uscis_data.get("statusDate") or now,
                "status": uscis_data.get("status", "processing"),
                "statusTitle": uscis_data.get("statusTitle", ""),
                "description": uscis_data.get("statusDescription", ""),
            })

        row = {
            "id": str(uuid.uuid4()),
            "receipt_number": receipt,
            "form_type": uscis_data.get("formType") or data.formType,
            "client_name": data.clientName or "",
            "service_center": data.serviceCenter,
            "country_of_origin": data.countryOfOrigin,
            "status": uscis_data.get("status", "processing") if uscis_data.get("success") else "unknown",
            "status_title": uscis_data.get("statusTitle", ""),
            "status_description": uscis_data.get("statusDescription", ""),
            "status_date": uscis_data.get("statusDate"),
            "visa_case_id": case_id or None,
            "history": history,
            "last_checked_at": now,
            "last_status_change_at": now,
            "created_at": now,
            "created_by": staff_payload.get("id"),
        }

        insert("uscis_tracker_cases", row)
        return {"success": True, "message": "Caso USCIS registrado", "case": _fmt(row)}

    @router.get("/admin/uscis-cases")
    async def list_all_uscis_cases(staff_payload: dict = Depends(verify_staff_token)):
        """Admin: list all tracked USCIS cases."""
        rows = select("uscis_tracker_cases", order="created_at", order_desc=True, limit=500)
        return {"success": True, "cases": [_fmt(r) for r in rows]}

    @router.get("/admin/uscis-cases/by-visa-case/{visa_case_id}")
    async def get_uscis_cases_for_visa_case(visa_case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: get USCIS cases linked to a specific visa case."""
        rows = select("uscis_tracker_cases", filters={"visa_case_id": visa_case_id}, order="created_at", order_desc=True, limit=50)
        return {"success": True, "cases": [_fmt(r) for r in rows]}

    @router.post("/admin/uscis-cases/{receipt_number}/link/{visa_case_id}")
    async def link_uscis_to_visa_case(receipt_number: str, visa_case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Link a USCIS case to a visa case."""
        existing = select("uscis_tracker_cases", filters={"receipt_number": receipt_number.upper()}, single=True)
        if not existing:
            raise HTTPException(status_code=404, detail="Caso USCIS no encontrado")
        update("uscis_tracker_cases", {"receipt_number": receipt_number.upper()}, {
            "visa_case_id": visa_case_id,
        })
        return {"success": True, "message": "Caso vinculado"}

    @router.put("/admin/uscis-cases/{receipt_number}")
    async def update_uscis_case(receipt_number: str, data: USCISCaseUpdate, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: update case details (service center, country, etc)."""
        existing = select("uscis_tracker_cases", filters={"receipt_number": receipt_number.upper()}, single=True)
        if not existing:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        patch = {}
        if data.formType is not None: patch["form_type"] = data.formType
        if data.serviceCenter is not None: patch["service_center"] = data.serviceCenter
        if data.countryOfOrigin is not None: patch["country_of_origin"] = data.countryOfOrigin
        if data.clientName is not None: patch["client_name"] = data.clientName

        if patch:
            update("uscis_tracker_cases", {"receipt_number": receipt_number.upper()}, patch)
        return {"success": True, "message": "Caso actualizado"}

    @router.delete("/admin/uscis-cases/{receipt_number}")
    async def delete_uscis_case(receipt_number: str, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: remove a tracked USCIS case."""
        existing = select("uscis_tracker_cases", filters={"receipt_number": receipt_number.upper()}, single=True)
        if not existing:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        delete("uscis_tracker_cases", {"receipt_number": receipt_number.upper()})
        return {"success": True, "message": "Caso eliminado"}

    class ManualStatusUpdate(BaseModel):
        statusTitle: str
        statusDescription: Optional[str] = None
        status: Optional[str] = None
        statusDate: Optional[str] = None

    @router.post("/admin/uscis-cases/{receipt_number}/manual-update")
    async def manual_status_update(receipt_number: str, data: ManualStatusUpdate, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: manually update case status (when scraping fails)."""
        receipt = receipt_number.upper()
        case = select("uscis_tracker_cases", filters={"receipt_number": receipt}, single=True)
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        from services.uscis_scraper import _classify_status
        status = data.status or _classify_status(data.statusTitle)
        now = datetime.now(timezone.utc).isoformat()

        history_entry = {
            "date": data.statusDate or now,
            "status": status,
            "statusTitle": data.statusTitle,
            "description": data.statusDescription or data.statusTitle,
            "manual": True,
        }
        current_history = case.get("history") or []
        new_history = [history_entry] + current_history

        update("uscis_tracker_cases", {"receipt_number": receipt}, {
            "status": status,
            "status_title": data.statusTitle,
            "status_description": data.statusDescription or data.statusTitle,
            "status_date": data.statusDate,
            "last_checked_at": now,
            "last_status_change_at": now,
            "history": new_history,
        })

        updated = select("uscis_tracker_cases", filters={"receipt_number": receipt}, single=True)
        return {"success": True, "message": "Estado actualizado manualmente", "case": _fmt(updated)}

    # ========== REFRESH (shared) ==========

    @router.post("/admin/uscis-cases/{receipt_number}/refresh")
    async def refresh_uscis_case_admin(receipt_number: str, staff_payload: dict = Depends(verify_staff_token)):
        """Refresh case status from USCIS (admin)."""
        return await _refresh_case(receipt_number.upper())

    @router.post("/uscis/cases/{receipt_number}/refresh")
    async def refresh_uscis_case_client(receipt_number: str, client_payload: dict = Depends(verify_client_token)):
        """Refresh case status from USCIS (client)."""
        return await _refresh_case(receipt_number.upper())

    async def _refresh_case(receipt_number: str):
        case = select("uscis_tracker_cases", filters={"receipt_number": receipt_number}, single=True)
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        from services.uscis_scraper import fetch_uscis_status
        result = await fetch_uscis_status(receipt_number)

        if not result.get("success"):
            return {"success": False, "error": result.get("error", "Error al consultar USCIS")}

        old_status = case.get("status_title", "")
        new_status = result.get("statusTitle", "")
        status_changed = old_status != new_status and new_status
        now = datetime.now(timezone.utc).isoformat()

        patch = {
            "status": result["status"],
            "status_title": result["statusTitle"],
            "status_description": result["statusDescription"],
            "status_date": result.get("statusDate"),
            "last_checked_at": now,
        }
        if result.get("formType"):
            patch["form_type"] = result["formType"]

        if status_changed:
            patch["last_status_change_at"] = now
            history_entry = {
                "date": result.get("statusDate") or now,
                "status": result["status"],
                "statusTitle": result["statusTitle"],
                "description": result["statusDescription"],
            }
            current_history = case.get("history") or []
            patch["history"] = [history_entry] + current_history

        update("uscis_tracker_cases", {"receipt_number": receipt_number}, patch)
        updated = select("uscis_tracker_cases", filters={"receipt_number": receipt_number}, single=True)
        return {"success": True, "case": _fmt(updated), "statusChanged": status_changed}

    # ========== CLIENT ENDPOINTS ==========

    @router.get("/uscis/cases")
    async def get_my_uscis_cases(client_payload: dict = Depends(verify_client_token)):
        """Client: get all USCIS cases linked to their visa case."""
        user_id = client_payload.get("id")
        visa_case = select("visa_cases", filters={"client_id": user_id}, single=True)
        if not visa_case:
            return {"success": True, "cases": []}
        case_id = str(visa_case.get("id"))
        rows = select("uscis_tracker_cases", filters={"visa_case_id": case_id}, order="created_at", order_desc=True, limit=50)
        return {"success": True, "cases": [_fmt(r) for r in rows]}

    @router.get("/uscis/cases/{receipt_number}")
    async def get_uscis_case_detail(receipt_number: str, client_payload: dict = Depends(verify_client_token)):
        """Client: get detail of a specific USCIS case."""
        case = select("uscis_tracker_cases", filters={"receipt_number": receipt_number.upper()}, single=True)
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        return {"success": True, "case": _fmt(case)}

    return router
