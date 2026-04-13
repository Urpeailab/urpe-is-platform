"""
Manual Payment Models and Schemas
Manages manual payment registration by admin staff
"""

from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class ManualPaymentCreate(BaseModel):
    """Request to register a manual payment"""
    caseId: str
    stageId: str
    stageNumber: int
    amount: float
    paymentDate: str  # ISO format date
    paymentMethod: Literal["cash", "transfer", "zelle", "wire", "check", "other"]
    reference: Optional[str] = None  # Transaction reference/ID
    receiptUrl: Optional[str] = None  # URL to receipt/proof file in Supabase
    notes: Optional[str] = None


class ManualPaymentUpdate(BaseModel):
    """Update payment details"""
    amount: Optional[float] = None
    paymentDate: Optional[str] = None
    paymentMethod: Optional[Literal["cash", "transfer", "zelle", "wire", "check", "other"]] = None
    reference: Optional[str] = None
    receiptUrl: Optional[str] = None
    notes: Optional[str] = None


class ManualPayment(BaseModel):
    """Full manual payment data structure"""
    id: str
    caseId: str
    userId: str
    stageId: str
    stageNumber: int
    stageName: str
    amount: float
    paymentDate: str
    paymentMethod: Literal["cash", "transfer", "zelle", "wire", "check", "other"]
    reference: Optional[str] = None
    receiptUrl: Optional[str] = None
    receiptFileName: Optional[str] = None
    notes: Optional[str] = None
    registeredBy: str  # Staff member ID who registered the payment
    registeredByName: str  # Staff member name
    createdAt: str
    updatedAt: str
