"""
Leads endpoints for capturing potential clients from landing page
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
import os
from bson import ObjectId

router = APIRouter(prefix="/api/leads", tags=["leads"])

# MongoDB connection
from pymongo import MongoClient
MONGO_URL = os.environ.get("MONGO_URL")
client = MongoClient(MONGO_URL)
db = client[os.environ.get("DB_NAME", "urpe_db")]

# Pydantic models
class LeadCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    country_code: str = Field(..., min_length=1, max_length=5)
    phone_number: str = Field(..., min_length=6, max_length=15)

class LeadResponse(BaseModel):
    id: str
    name: str
    email: str
    country_code: str
    phone_number: str
    created_at: str
    status: str

@router.post("", response_model=LeadResponse)
async def create_lead(lead: LeadCreate):
    """Create a new lead from landing page form"""
    try:
        # Create the lead document
        lead_doc = {
            "name": lead.name,
            "email": lead.email.lower(),
            "country_code": lead.country_code,
            "phone_number": lead.phone_number,
            "created_at": datetime.now(timezone.utc),
            "status": "new",  # new, contacted, converted, rejected
            "notes": "",
            "contacted_by": None,
            "contacted_at": None
        }
        
        # Insert into MongoDB
        result = db.leads.insert_one(lead_doc)
        
        return LeadResponse(
            id=str(result.inserted_id),
            name=lead_doc["name"],
            email=lead_doc["email"],
            country_code=lead_doc["country_code"],
            phone_number=lead_doc["phone_number"],
            created_at=lead_doc["created_at"].isoformat(),
            status=lead_doc["status"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating lead: {str(e)}")

@router.get("")
async def get_leads(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None
):
    """Get all leads (admin only) - Note: Add admin auth middleware in production"""
    try:
        query = {}
        if status:
            query["status"] = status
            
        leads = list(db.leads.find(query).sort("created_at", -1).skip(skip).limit(limit))
        total = db.leads.count_documents(query)
        
        # Convert ObjectId and datetime to strings
        leads_response = []
        for lead in leads:
            leads_response.append({
                "id": str(lead["_id"]),
                "name": lead["name"],
                "email": lead["email"],
                "country_code": lead.get("country_code", "+1"),
                "phone_number": lead.get("phone_number", ""),
                "created_at": lead["created_at"].isoformat() if isinstance(lead["created_at"], datetime) else lead["created_at"],
                "status": lead.get("status", "new"),
                "notes": lead.get("notes", ""),
                "contacted_by": lead.get("contacted_by"),
                "contacted_at": lead["contacted_at"].isoformat() if lead.get("contacted_at") and isinstance(lead["contacted_at"], datetime) else lead.get("contacted_at")
            })
        
        return {
            "leads": leads_response,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching leads: {str(e)}")

@router.patch("/{lead_id}/status")
async def update_lead_status(lead_id: str, status: str, notes: Optional[str] = None):
    """Update lead status (admin only)"""
    try:
        valid_statuses = ["new", "contacted", "converted", "rejected"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        update_doc = {"status": status}
        if notes:
            update_doc["notes"] = notes
        if status == "contacted":
            update_doc["contacted_at"] = datetime.now(timezone.utc)
            
        result = db.leads.update_one(
            {"_id": ObjectId(lead_id)},
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
            
        return {"success": True, "message": "Lead status updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating lead: {str(e)}")

@router.delete("/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead (admin only)"""
    try:
        result = db.leads.delete_one({"_id": ObjectId(lead_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
            
        return {"success": True, "message": "Lead deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting lead: {str(e)}")
