"""
USCIS Case Tracker Endpoints
Admin: register/manage receipt numbers
Client: view case status
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
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
    router = APIRouter()

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
        existing = await db.uscis_tracker_cases.find_one({"receiptNumber": receipt})
        if existing:
            raise HTTPException(status_code=400, detail=f"El numero de recibo {receipt} ya esta registrado")

        # Fetch initial status from USCIS
        from services.uscis_scraper import fetch_uscis_status
        uscis_data = await fetch_uscis_status(receipt)

        doc = {
            "_id": str(uuid.uuid4()),
            "receiptNumber": receipt,
            "formType": uscis_data.get("formType") or data.formType,
            "clientName": data.clientName or "",
            "serviceCenter": data.serviceCenter,
            "countryOfOrigin": data.countryOfOrigin,
            "status": uscis_data.get("status", "processing") if uscis_data.get("success") else "unknown",
            "statusTitle": uscis_data.get("statusTitle", ""),
            "statusDescription": uscis_data.get("statusDescription", ""),
            "statusDate": uscis_data.get("statusDate"),
            "visaCaseId": case_id,
            "history": [],
            "lastCheckedAt": datetime.now(timezone.utc).isoformat(),
            "lastStatusChangeAt": datetime.now(timezone.utc).isoformat(),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "createdBy": staff_payload.get("id"),
        }

        # Add initial history entry
        if uscis_data.get("success"):
            doc["history"].append({
                "date": uscis_data.get("statusDate") or datetime.now(timezone.utc).isoformat(),
                "status": uscis_data.get("status", "processing"),
                "statusTitle": uscis_data.get("statusTitle", ""),
                "description": uscis_data.get("statusDescription", ""),
            })

        await db.uscis_tracker_cases.insert_one(doc)
        doc.pop("_id", None)

        return {"success": True, "message": "Caso USCIS registrado", "case": doc}

    @router.get("/admin/uscis-cases")
    async def list_all_uscis_cases(staff_payload: dict = Depends(verify_staff_token)):
        """Admin: list all tracked USCIS cases."""
        cases = await db.uscis_tracker_cases.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)
        return {"success": True, "cases": cases}

    @router.get("/admin/uscis-cases/by-visa-case/{visa_case_id}")
    async def get_uscis_cases_for_visa_case(visa_case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: get USCIS cases linked to a specific visa case."""
        cases = await db.uscis_tracker_cases.find({"visaCaseId": visa_case_id}, {"_id": 0}).to_list(50)
        return {"success": True, "cases": cases}

    @router.post("/admin/uscis-cases/{receipt_number}/link/{visa_case_id}")
    async def link_uscis_to_visa_case(receipt_number: str, visa_case_id: str, staff_payload: dict = Depends(verify_staff_token)):
        """Link a USCIS case to a visa case."""
        result = await db.uscis_tracker_cases.update_one(
            {"receiptNumber": receipt_number.upper()},
            {"$set": {"visaCaseId": visa_case_id, "updatedAt": datetime.now(timezone.utc).isoformat()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Caso USCIS no encontrado")
        return {"success": True, "message": "Caso vinculado"}

    @router.put("/admin/uscis-cases/{receipt_number}")
    async def update_uscis_case(receipt_number: str, data: USCISCaseUpdate, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: update case details (service center, country, etc)."""
        update = {"updatedAt": datetime.now(timezone.utc).isoformat()}
        if data.formType: update["formType"] = data.formType
        if data.serviceCenter is not None: update["serviceCenter"] = data.serviceCenter
        if data.countryOfOrigin is not None: update["countryOfOrigin"] = data.countryOfOrigin
        if data.clientName is not None: update["clientName"] = data.clientName

        result = await db.uscis_tracker_cases.update_one({"receiptNumber": receipt_number.upper()}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        return {"success": True, "message": "Caso actualizado"}

    @router.delete("/admin/uscis-cases/{receipt_number}")
    async def delete_uscis_case(receipt_number: str, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: remove a tracked USCIS case."""
        result = await db.uscis_tracker_cases.delete_one({"receiptNumber": receipt_number.upper()})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        return {"success": True, "message": "Caso eliminado"}

    class ManualStatusUpdate(BaseModel):
        statusTitle: str
        statusDescription: Optional[str] = None
        status: Optional[str] = None  # approved, processing, rfe, denied
        statusDate: Optional[str] = None

    @router.post("/admin/uscis-cases/{receipt_number}/manual-update")
    async def manual_status_update(receipt_number: str, data: ManualStatusUpdate, staff_payload: dict = Depends(verify_staff_token)):
        """Admin: manually update case status (when scraping fails)."""
        receipt = receipt_number.upper()
        case = await db.uscis_tracker_cases.find_one({"receiptNumber": receipt})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        from services.uscis_scraper import _classify_status
        status = data.status or _classify_status(data.statusTitle)

        update = {
            "status": status,
            "statusTitle": data.statusTitle,
            "statusDescription": data.statusDescription or data.statusTitle,
            "statusDate": data.statusDate,
            "lastCheckedAt": datetime.now(timezone.utc).isoformat(),
            "lastStatusChangeAt": datetime.now(timezone.utc).isoformat(),
        }

        history_entry = {
            "date": data.statusDate or datetime.now(timezone.utc).isoformat(),
            "status": status,
            "statusTitle": data.statusTitle,
            "description": data.statusDescription or data.statusTitle,
            "manual": True,
        }
        await db.uscis_tracker_cases.update_one(
            {"receiptNumber": receipt},
            {"$set": update, "$push": {"history": {"$each": [history_entry], "$position": 0}}}
        )

        updated = await db.uscis_tracker_cases.find_one({"receiptNumber": receipt}, {"_id": 0})
        return {"success": True, "message": "Estado actualizado manualmente", "case": updated}

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
        case = await db.uscis_tracker_cases.find_one({"receiptNumber": receipt_number})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")

        from services.uscis_scraper import fetch_uscis_status
        result = await fetch_uscis_status(receipt_number)

        if not result.get("success"):
            return {"success": False, "error": result.get("error", "Error al consultar USCIS")}

        old_status = case.get("statusTitle", "")
        new_status = result.get("statusTitle", "")
        status_changed = old_status != new_status and new_status

        update = {
            "status": result["status"],
            "statusTitle": result["statusTitle"],
            "statusDescription": result["statusDescription"],
            "statusDate": result.get("statusDate"),
            "lastCheckedAt": datetime.now(timezone.utc).isoformat(),
        }

        if result.get("formType"):
            update["formType"] = result["formType"]

        if status_changed:
            update["lastStatusChangeAt"] = datetime.now(timezone.utc).isoformat()
            # Add to history
            history_entry = {
                "date": result.get("statusDate") or datetime.now(timezone.utc).isoformat(),
                "status": result["status"],
                "statusTitle": result["statusTitle"],
                "description": result["statusDescription"],
            }
            await db.uscis_tracker_cases.update_one(
                {"receiptNumber": receipt_number},
                {"$push": {"history": {"$each": [history_entry], "$position": 0}}}
            )

        await db.uscis_tracker_cases.update_one({"receiptNumber": receipt_number}, {"$set": update})

        updated = await db.uscis_tracker_cases.find_one({"receiptNumber": receipt_number}, {"_id": 0})
        return {"success": True, "case": updated, "statusChanged": status_changed}

    # ========== CLIENT ENDPOINTS ==========

    @router.get("/uscis/cases")
    async def get_my_uscis_cases(client_payload: dict = Depends(verify_client_token)):
        """Client: get all USCIS cases linked to their visa case."""
        user_id = client_payload.get("id")
        # Find visa case for this user
        visa_case = await db.visa_cases.find_one({"userId": user_id}, {"_id": 1, "id": 1})
        if not visa_case:
            return {"success": True, "cases": []}
        case_id = visa_case.get("id") or str(visa_case.get("_id"))
        cases = await db.uscis_tracker_cases.find({"visaCaseId": case_id}, {"_id": 0}).sort("createdAt", -1).to_list(50)
        return {"success": True, "cases": cases}

    @router.get("/uscis/cases/{receipt_number}")
    async def get_uscis_case_detail(receipt_number: str, client_payload: dict = Depends(verify_client_token)):
        """Client: get detail of a specific USCIS case."""
        case = await db.uscis_tracker_cases.find_one({"receiptNumber": receipt_number.upper()}, {"_id": 0})
        if not case:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        return {"success": True, "case": case}

    return router
