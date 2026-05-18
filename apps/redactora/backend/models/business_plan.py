"""
Models for NIW Business Plans
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class ProjectNameSelection(BaseModel):
    selected_name: str
    applicant_cv: str
    patent_info: Optional[str] = ""


class BusinessPlanInput(BaseModel):
    project_title: str
    applicant_name: str
    applicant_cv: str  # CV/Resume content
    project_idea: str  # Technical description
    patent_info: Optional[str] = ""  # Patent details if applicable
    language: str = "en"  # en, es - NIW typically in English
    apply_graphic_design: bool = False
    design_description: Optional[str] = ""
    client_id: Optional[str] = None


class NIWSection(BaseModel):
    """Model for a single NIW section"""
    model_config = ConfigDict(extra="ignore")
    
    number: int
    title: str
    content: str = ""
    content_en: str = ""
    content_es: str = ""
    approved: bool = False
    auto_generated: bool = False


class NIWInProgress(BaseModel):
    """Model for NIW documents in progress"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    client_id: Optional[str] = None
    
    project_title: str = ""
    applicant_name: str = ""
    applicant_cv: str = ""
    project_idea: str = ""
    patent_info: str = ""
    
    sections: List[NIWSection] = []
    current_section: int = 0
    status: str = "in_progress"  # in_progress, generating, completed, review_needed, error
    language: str = "en"
    
    # Generation tracking
    generation_progress: int = 0  # 0-100
    last_successful_group: int = 0
    resume_from_group: int = 1
    error_message: Optional[str] = None
    
    # Evaluation
    quality_score: Optional[float] = None
    evaluation_feedback: Optional[str] = None
    coherence_evaluation: Optional[dict] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BusinessPlan(BaseModel):
    """Model for completed NIW Business Plans"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    client_id: Optional[str] = None
    
    # EB-2 NIW fields
    project_title: Optional[str] = ""
    applicant_name: Optional[str] = ""
    applicant_cv: Optional[str] = ""
    project_idea: Optional[str] = ""
    patent_info: Optional[str] = ""
    
    # Old business plan fields (for backwards compatibility)
    business_name: Optional[str] = ""
    industry: Optional[str] = ""
    description: Optional[str] = ""
    target_market: Optional[str] = ""
    funding_needed: Optional[str] = ""
    
    # Content fields
    content: Optional[str] = ""  # Deprecated - kept for old documents
    content_es: Optional[str] = ""  # Contenido en español
    content_en: Optional[str] = ""  # Contenido en inglés
    sections: Optional[List[dict]] = []  # Secciones con ambos idiomas
    language: str = "en"
    
    # Design fields
    has_graphic_design: bool = False
    design_description: Optional[str] = ""
    gamma_url: Optional[str] = None
    gamma_pdf_url: Optional[str] = None
    
    # Status and evaluation
    status: str = "completed"  # draft, evaluating, completed, review_needed
    quality_score: Optional[float] = None
    evaluation_feedback: Optional[str] = None
    evaluation_report: Optional[dict] = None
    coherence_evaluation: Optional[dict] = None
    problematic_sections: Optional[List[int]] = []
    auto_generated: Optional[bool] = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None


class EditSectionRequest(BaseModel):
    """Request model for editing a section"""
    content: str
    language: str = "en"


class AIEditRequest(BaseModel):
    """Request model for AI-powered editing"""
    section_number: int
    edit_instruction: str
    language: str = "en"


class AIEditResponse(BaseModel):
    """Response model for AI editing"""
    success: bool
    original_content: str
    edited_content: str
    changes_summary: str
