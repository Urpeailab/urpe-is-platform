"""
Models for Self-Petition V2 module
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid


class SelfPetitionV2Session(BaseModel):
    """Session for V2 self-petition letter generation"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    client_id: Optional[str] = None
    applicant_name: str = ""
    status: str = "uploading"  # uploading, classifying, reviewing, extracting, synthesizing, drafting, translating, completed, error
    progress: int = 0
    progress_message: str = ""
    
    # Uploaded files info
    total_files: int = 0
    processed_files: int = 0
    files: List[dict] = []  # List of {file_id, filename, size, upload_status, file_path}
    
    # Classification results
    classifications: List[dict] = []
    classification_reviewed: bool = False
    
    # Extracted data synthesis
    applicant_profile: Optional[dict] = None
    prong1_evidence: Optional[dict] = None
    prong2_evidence: Optional[dict] = None
    prong3_evidence: Optional[dict] = None
    
    # Generated content
    content_en: str = ""
    content_es: str = ""
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error_message: Optional[str] = None


class SelfPetitionV2Letter(BaseModel):
    """Final V2 self-petition letter"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    client_id: Optional[str] = None
    session_id: str  # Reference to the V2 session
    applicant_name: str
    
    # Document inventory
    total_documents: int = 0
    document_summary: List[dict] = []  # Brief summary of each document used
    
    # Content
    content_en: str = ""
    content_es: str = ""
    
    # Status
    status: str = "completed"
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
