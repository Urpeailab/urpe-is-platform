"""
Appointment Models - Updated for approval workflow
"""
from pydantic import BaseModel
from typing import Optional, Literal


class AppointmentCreate(BaseModel):
    """Client requests an appointment"""
    caseId: str
    proposedDate: str
    proposedTime: str
    reason: str
    withRole: Optional[Literal["coordinator", "salesRep"]] = "coordinator"


class AppointmentUpdate(BaseModel):
    """Admin approves/rejects appointment"""
    status: Optional[Literal["pending", "approved", "rejected", "completed", "cancelled"]] = None
    confirmedDate: Optional[str] = None
    adminNotes: Optional[str] = None
    meetingLink: Optional[str] = None
