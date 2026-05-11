"""
Leads endpoints for capturing potential clients from landing page.
Backed by Supabase (Postgres). The legacy `country_code`, `phone_number`,
`notes`, and `contacted_*` fields live in the `metadata` JSONB column since
the `leads` table only has flat `name`, `email`, `phone`, `status`, etc.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone

from db.supabase_client import get_supabase

router = APIRouter(prefix="/api/leads", tags=["leads"])

VALID_STATUSES = ["new", "contacted", "converted", "rejected"]


class LeadCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    country_code: str = Field(..., min_length=1, max_length=5)
    phone_number: str = Field(..., min_length=6, max_length=15)


def _row_to_response(row: dict) -> dict:
    """Flatten a leads row + its metadata JSONB to the shape the frontend expects."""
    md = row.get("metadata") or {}
    if not isinstance(md, dict):
        md = {}
    created = row.get("created_at")
    if isinstance(created, datetime):
        created = created.isoformat()
    contacted_at = md.get("contacted_at")
    if isinstance(contacted_at, datetime):
        contacted_at = contacted_at.isoformat()
    return {
        "id": row.get("id"),
        "name": row.get("name") or "",
        "email": row.get("email") or "",
        "country_code": md.get("country_code", "+1"),
        "phone_number": md.get("phone_number") or row.get("phone") or "",
        "created_at": created,
        "status": row.get("status") or "new",
        "notes": md.get("notes", ""),
        "contacted_by": md.get("contacted_by"),
        "contacted_at": contacted_at,
    }


@router.post("")
async def create_lead(lead: LeadCreate):
    """Create a new lead from the landing page form."""
    try:
        sb = get_supabase()
        full_phone = f"{lead.country_code}{lead.phone_number}"
        new_row = {
            "name": lead.name,
            "email": lead.email.lower(),
            "phone": full_phone,
            "status": "new",
            "source": "web",
            "metadata": {
                "country_code": lead.country_code,
                "phone_number": lead.phone_number,
                "notes": "",
            },
        }
        result = sb.table("leads").insert(new_row).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create lead")
        return _row_to_response(result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating lead: {str(e)}")


@router.get("")
async def get_leads(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Get paginated leads. Stats are computed across all matching leads
    (ignoring status filter so the dashboard counters stay stable)."""
    try:
        sb = get_supabase()
        page = max(1, int(page))
        limit = max(1, min(int(limit), 200))

        # Build the filtered query for the page
        q = sb.table("leads").select("*", count="exact")
        if status and status != "all":
            q = q.eq("status", status)
        if search:
            # ilike with OR across name/email/phone
            term = f"%{search}%"
            q = q.or_(f"name.ilike.{term},email.ilike.{term},phone.ilike.{term}")
        if date_from:
            q = q.gte("created_at", date_from)
        if date_to:
            from datetime import timedelta
            try:
                dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            except ValueError:
                dt_to = datetime.fromisoformat(date_to)
            end = (dt_to + timedelta(days=1)).isoformat()
            q = q.lt("created_at", end)

        offset = (page - 1) * limit
        q = q.order("created_at", desc=True).range(offset, offset + limit - 1)
        page_result = q.execute()
        rows = page_result.data or []
        total = page_result.count or 0
        total_pages = (total + limit - 1) // limit if limit else 1

        # Stats: counts per status across all leads matching search/date but
        # ignoring the status filter so the totals stay consistent as the user
        # filters by status.
        def status_count(s: Optional[str]) -> int:
            cq = sb.table("leads").select("id", count="exact")
            if s:
                cq = cq.eq("status", s)
            if search:
                term = f"%{search}%"
                cq = cq.or_(f"name.ilike.{term},email.ilike.{term},phone.ilike.{term}")
            if date_from:
                cq = cq.gte("created_at", date_from)
            if date_to:
                from datetime import timedelta
                try:
                    dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                except ValueError:
                    dt_to = datetime.fromisoformat(date_to)
                end = (dt_to + timedelta(days=1)).isoformat()
                cq = cq.lt("created_at", end)
            return cq.execute().count or 0

        stats = {
            "total": status_count(None),
            "new": status_count("new"),
            "contacted": status_count("contacted"),
            "converted": status_count("converted"),
            "rejected": status_count("rejected"),
        }

        return {
            "leads": [_row_to_response(r) for r in rows],
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "hasNextPage": page < total_pages,
            "hasPrevPage": page > 1,
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching leads: {str(e)}")


@router.patch("/{lead_id}/status")
async def update_lead_status(lead_id: str, status: str, notes: Optional[str] = None):
    """Update lead status (admin only)."""
    try:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")

        sb = get_supabase()
        existing = sb.table("leads").select("metadata").eq("id", lead_id).limit(1).execute().data
        if not existing:
            raise HTTPException(status_code=404, detail="Lead not found")

        md = existing[0].get("metadata") or {}
        if not isinstance(md, dict):
            md = {}
        if notes is not None:
            md["notes"] = notes
        if status == "contacted":
            md["contacted_at"] = datetime.now(timezone.utc).isoformat()

        sb.table("leads").update({"status": status, "metadata": md}).eq("id", lead_id).execute()
        return {"success": True, "message": "Lead status updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating lead: {str(e)}")


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead (admin only)."""
    try:
        sb = get_supabase()
        result = sb.table("leads").delete().eq("id", lead_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"success": True, "message": "Lead deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting lead: {str(e)}")
