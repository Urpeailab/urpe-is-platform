"""
Case Template Models for URPE Multi-Type Case System
Supports: EB-2 NIW, L-1A, E-2, and future case types
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

# =============================================================================
# DELIVERABLE TEMPLATE
# =============================================================================

class DeliverableTemplate(BaseModel):
    """Template for a deliverable in a stage"""
    name: Dict[str, str]  # {"es": "Business Plan", "en": "Business Plan"}
    description: Dict[str, str]
    required: bool = True
    fileTypes: List[str] = ["pdf", "docx"]
    estimatedDays: Optional[int] = None

# =============================================================================
# REQUIRED DOCUMENT TEMPLATE
# =============================================================================

class RequiredDocumentTemplate(BaseModel):
    """Template for a required document from client"""
    name: Dict[str, str]
    description: Dict[str, str]
    required: bool = True
    requiresPhysicalCopy: bool = False
    acceptedFormats: List[str] = ["pdf", "jpg", "png"]

# =============================================================================
# STAGE TEMPLATE
# =============================================================================

class StageTemplate(BaseModel):
    """Template for a stage in a case"""
    stageNumber: int
    name: Dict[str, str]  # {"es": "Documentación", "en": "Documentation"}
    description: Dict[str, str]
    percentage: int  # 25, 50, 75, 100
    amount: float  # USD
    defaultUnlocked: bool = False
    deliverables: List[DeliverableTemplate] = []
    requiredDocuments: List[RequiredDocumentTemplate] = []

# =============================================================================
# CASE TEMPLATE (Main Model)
# =============================================================================

class CaseTemplate(BaseModel):
    """Complete template for a case type"""
    templateId: str  # "eb2-niw", "l1a", "e2"
    name: Dict[str, str]  # {"es": "EB-2 NIW", "en": "EB-2 NIW"}
    description: Dict[str, str]
    category: str  # "immigrant_visa", "non_immigrant_visa", "asylum", "other"
    visaType: str  # "EB-2 NIW", "L-1A", "E-2"
    
    # Stage configuration
    stages: List[StageTemplate]
    
    # Timeline
    estimatedDurationMonths: int = 18
    minDurationMonths: int = 15
    maxDurationMonths: int = 24
    
    # Pricing
    totalAmount: float
    paymentModel: str = "pay_as_you_advance"  # or "upfront", "custom"
    stagePayments: bool = True
    
    # Metadata
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: Optional[datetime] = None
    createdBy: Optional[str] = None  # staff_id

# =============================================================================
# PREDEFINED TEMPLATES
# =============================================================================

def get_eb2_niw_template() -> dict:
    """Returns EB-2 NIW template configuration"""
    return {
        "templateId": "eb2-niw",
        "name": {
            "es": "EB-2 NIW - Interés Nacional",
            "en": "EB-2 NIW - National Interest Waiver"
        },
        "description": {
            "es": "Visa de inmigrante para profesionales con habilidades excepcionales que benefician el interés nacional de EE.UU.",
            "en": "Immigrant visa for professionals with exceptional abilities that benefit the national interest of the U.S."
        },
        "category": "immigrant_visa",
        "visaType": "EB-2 NIW",
        "stages": [
            {
                "stageNumber": 1,
                "name": {
                    "es": "Etapa 1 - Análisis y Formulario I-140",
                    "en": "Stage 1 - Analysis and Form I-140"
                },
                "description": {
                    "es": "Análisis de elegibilidad y preparación del formulario I-140. GRATIS como oferta Black Friday.",
                    "en": "Eligibility analysis and I-140 form preparation. FREE as Black Friday offer."
                },
                "percentage": 25,
                "amount": 0.0,
                "defaultUnlocked": True,
                "deliverables": [
                    {
                        "name": {"es": "Reporte de Elegibilidad Completo", "en": "Complete Eligibility Report"},
                        "description": {"es": "Análisis detallado de tu elegibilidad para EB-2 NIW", "en": "Detailed analysis of your EB-2 NIW eligibility"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 3
                    },
                    {
                        "name": {"es": "Ruta Personalizada", "en": "Personalized Roadmap"},
                        "description": {"es": "Plan estratégico personalizado para tu caso", "en": "Personalized strategic plan for your case"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 3
                    },
                    {
                        "name": {"es": "Formulario I-140 Completado", "en": "Completed I-140 Form"},
                        "description": {"es": "Formulario I-140 completamente llenado según tus datos", "en": "I-140 form completely filled with your information"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 5
                    },
                    {
                        "name": {"es": "Manual DIY Completo", "en": "Complete DIY Manual"},
                        "description": {"es": "Guía completa paso a paso para tu proceso EB-2 NIW", "en": "Complete step-by-step guide for your EB-2 NIW process"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 1
                    }
                ],
                "requiredDocuments": [
                    {
                        "name": {"es": "Formulario de Intake", "en": "Intake Form"},
                        "description": {"es": "Formulario completo con información personal, familiar, educación y experiencia. Tiempo estimado: 45 minutos", "en": "Complete form with personal, family, education and experience information. Estimated time: 45 minutes"},
                        "required": True,
                        "requiresPhysicalCopy": False,
                        "acceptedFormats": ["pdf", "json"]
                    }
                ]
            },
            {
                "stageNumber": 2,
                "name": {
                    "es": "Etapa 2 - Evidencia Técnica",
                    "en": "Stage 2 - Technical Evidence"
                },
                "description": {
                    "es": "Desarrollo de evidencia técnica y científica",
                    "en": "Development of technical and scientific evidence"
                },
                "percentage": 50,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Patent Filing", "en": "Patent Filing"},
                        "description": {"es": "Solicitud de patente USPTO", "en": "USPTO patent application"},
                        "required": False,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 30
                    },
                    {
                        "name": {"es": "Published Articles", "en": "Published Articles"},
                        "description": {"es": "Artículos en revistas Q3/Q4", "en": "Articles in Q3/Q4 journals"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 60
                    },
                    {
                        "name": {"es": "White Paper", "en": "White Paper"},
                        "description": {"es": "Documento técnico de investigación", "en": "Technical research document"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 15
                    }
                ],
                "requiredDocuments": [
                    {
                        "name": {"es": "Cartas de Recomendación", "en": "Recommendation Letters"},
                        "description": {"es": "Mínimo 5 cartas de expertos", "en": "Minimum 5 letters from experts"},
                        "required": True,
                        "requiresPhysicalCopy": False,
                        "acceptedFormats": ["pdf"]
                    }
                ]
            },
            {
                "stageNumber": 3,
                "name": {
                    "es": "Etapa 3 - Preparación Legal",
                    "en": "Stage 3 - Legal Preparation"
                },
                "description": {
                    "es": "Preparación de formularios y documentación legal",
                    "en": "Preparation of forms and legal documentation"
                },
                "percentage": 75,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Formulario I-140", "en": "Form I-140"},
                        "description": {"es": "Petición de trabajador inmigrante", "en": "Immigrant worker petition"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 5
                    },
                    {
                        "name": {"es": "Self-Petition Letter", "en": "Self-Petition Letter"},
                        "description": {"es": "Carta de auto-petición", "en": "Self-petition letter"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 10
                    },
                    {
                        "name": {"es": "Supporting Evidence Package", "en": "Supporting Evidence Package"},
                        "description": {"es": "Paquete completo de evidencia", "en": "Complete evidence package"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 15
                    }
                ],
                "requiredDocuments": []
            },
            {
                "stageNumber": 4,
                "name": {
                    "es": "Etapa 4 - Radicación Final",
                    "en": "Stage 4 - Final Filing"
                },
                "description": {
                    "es": "Revisión final y radicación ante USCIS",
                    "en": "Final review and filing with USCIS"
                },
                "percentage": 100,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Filing Package", "en": "Filing Package"},
                        "description": {"es": "Paquete completo para radicación", "en": "Complete package for filing"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 3
                    },
                    {
                        "name": {"es": "USCIS Receipt Notice", "en": "USCIS Receipt Notice"},
                        "description": {"es": "Comprobante de recepción USCIS", "en": "USCIS receipt notice"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 1
                    },
                    {
                        "name": {"es": "Case Number", "en": "Case Number"},
                        "description": {"es": "Número de caso asignado", "en": "Assigned case number"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 1
                    }
                ],
                "requiredDocuments": []
            }
        ],
        "estimatedDurationMonths": 18,
        "minDurationMonths": 15,
        "maxDurationMonths": 24,
        "totalAmount": 4680.0,  # $0 (Stage 1) + $1560 (Stage 2) + $1560 (Stage 3) + $1560 (Stage 4)
        "paymentModel": "pay_as_you_advance",
        "stagePayments": True,
        "isActive": True
    }

def get_l1a_template() -> dict:
    """Returns L-1A template configuration (same stages as EB-2 NIW)"""
    return {
        "templateId": "l1a",
        "name": {
            "es": "L-1A - Transferencia Ejecutiva",
            "en": "L-1A - Executive Transfer"
        },
        "description": {
            "es": "Visa de no inmigrante para transferencia de ejecutivos y gerentes de empresas multinacionales",
            "en": "Non-immigrant visa for transfer of executives and managers from multinational companies"
        },
        "category": "non_immigrant_visa",
        "visaType": "L-1A",
        "stages": [
            {
                "stageNumber": 1,
                "name": {
                    "es": "Etapa 1 - Documentación Corporativa",
                    "en": "Stage 1 - Corporate Documentation"
                },
                "description": {
                    "es": "Preparación de documentación empresarial y ejecutiva",
                    "en": "Preparation of corporate and executive documentation"
                },
                "percentage": 25,
                "amount": 1560.0,
                "defaultUnlocked": True,
                "deliverables": [
                    {
                        "name": {"es": "Organizational Chart", "en": "Organizational Chart"},
                        "description": {"es": "Organigrama de la empresa", "en": "Company organizational chart"},
                        "required": True,
                        "fileTypes": ["pdf", "png"],
                        "estimatedDays": 5
                    },
                    {
                        "name": {"es": "Financial Reports", "en": "Financial Reports"},
                        "description": {"es": "Reportes financieros de la empresa", "en": "Company financial reports"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 10
                    },
                    {
                        "name": {"es": "Job Description", "en": "Job Description"},
                        "description": {"es": "Descripción detallada del puesto", "en": "Detailed job description"},
                        "required": True,
                        "fileTypes": ["pdf", "docx"],
                        "estimatedDays": 3
                    }
                ],
                "requiredDocuments": [
                    {
                        "name": {"es": "Pasaporte", "en": "Passport"},
                        "description": {"es": "Copia vigente de pasaporte", "en": "Valid passport copy"},
                        "required": True,
                        "requiresPhysicalCopy": True,
                        "acceptedFormats": ["pdf", "jpg", "png"]
                    },
                    {
                        "name": {"es": "CV Ejecutivo", "en": "Executive Resume"},
                        "description": {"es": "Curriculum vitae ejecutivo", "en": "Executive curriculum vitae"},
                        "required": True,
                        "requiresPhysicalCopy": False,
                        "acceptedFormats": ["pdf", "docx"]
                    }
                ]
            },
            {
                "stageNumber": 2,
                "name": {
                    "es": "Etapa 2 - Evidencia de Relación",
                    "en": "Stage 2 - Relationship Evidence"
                },
                "description": {
                    "es": "Documentación de relación entre empresas",
                    "en": "Documentation of company relationship"
                },
                "percentage": 50,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Qualifying Relationship Letter", "en": "Qualifying Relationship Letter"},
                        "description": {"es": "Carta de relación calificante", "en": "Qualifying relationship letter"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 7
                    },
                    {
                        "name": {"es": "Corporate Documents", "en": "Corporate Documents"},
                        "description": {"es": "Documentos corporativos de ambas entidades", "en": "Corporate documents of both entities"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 10
                    }
                ],
                "requiredDocuments": []
            },
            {
                "stageNumber": 3,
                "name": {
                    "es": "Etapa 3 - Preparación de Formularios",
                    "en": "Stage 3 - Forms Preparation"
                },
                "description": {
                    "es": "Preparación de formularios I-129",
                    "en": "Preparation of I-129 forms"
                },
                "percentage": 75,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Formulario I-129", "en": "Form I-129"},
                        "description": {"es": "Petición de trabajador no inmigrante", "en": "Non-immigrant worker petition"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 5
                    },
                    {
                        "name": {"es": "Support Letter", "en": "Support Letter"},
                        "description": {"es": "Carta de soporte detallada", "en": "Detailed support letter"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 10
                    }
                ],
                "requiredDocuments": []
            },
            {
                "stageNumber": 4,
                "name": {
                    "es": "Etapa 4 - Radicación",
                    "en": "Stage 4 - Filing"
                },
                "description": {
                    "es": "Radicación ante USCIS",
                    "en": "Filing with USCIS"
                },
                "percentage": 100,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Filing Package", "en": "Filing Package"},
                        "description": {"es": "Paquete completo de radicación", "en": "Complete filing package"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 2
                    },
                    {
                        "name": {"es": "Receipt Notice", "en": "Receipt Notice"},
                        "description": {"es": "Comprobante de recepción", "en": "Receipt notice"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 1
                    }
                ],
                "requiredDocuments": []
            }
        ],
        "estimatedDurationMonths": 6,
        "minDurationMonths": 4,
        "maxDurationMonths": 8,
        "totalAmount": 6240.0,
        "paymentModel": "pay_as_you_advance",
        "stagePayments": True,
        "isActive": True
    }

def get_e2_template() -> dict:
    """Returns E-2 template configuration (same stages as EB-2 NIW)"""
    return {
        "templateId": "e2",
        "name": {
            "es": "E-2 - Inversionista por Tratado",
            "en": "E-2 - Treaty Investor"
        },
        "description": {
            "es": "Visa de no inmigrante para inversionistas de países con tratado comercial con EE.UU.",
            "en": "Non-immigrant visa for investors from countries with commercial treaty with the U.S."
        },
        "category": "non_immigrant_visa",
        "visaType": "E-2",
        "stages": [
            {
                "stageNumber": 1,
                "name": {
                    "es": "Etapa 1 - Plan de Negocios",
                    "en": "Stage 1 - Business Plan"
                },
                "description": {
                    "es": "Desarrollo del plan de negocios completo",
                    "en": "Development of complete business plan"
                },
                "percentage": 25,
                "amount": 1560.0,
                "defaultUnlocked": True,
                "deliverables": [
                    {
                        "name": {"es": "Business Plan E-2", "en": "Business Plan E-2"},
                        "description": {"es": "Plan de negocios específico para E-2", "en": "E-2 specific business plan"},
                        "required": True,
                        "fileTypes": ["pdf", "docx"],
                        "estimatedDays": 25
                    },
                    {
                        "name": {"es": "Financial Projections", "en": "Financial Projections"},
                        "description": {"es": "Proyecciones financieras 5 años", "en": "5-year financial projections"},
                        "required": True,
                        "fileTypes": ["pdf", "xlsx"],
                        "estimatedDays": 15
                    },
                    {
                        "name": {"es": "Market Analysis", "en": "Market Analysis"},
                        "description": {"es": "Análisis de mercado detallado", "en": "Detailed market analysis"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 10
                    }
                ],
                "requiredDocuments": [
                    {
                        "name": {"es": "Pasaporte", "en": "Passport"},
                        "description": {"es": "Copia vigente de pasaporte del país con tratado", "en": "Valid passport copy from treaty country"},
                        "required": True,
                        "requiresPhysicalCopy": True,
                        "acceptedFormats": ["pdf", "jpg", "png"]
                    },
                    {
                        "name": {"es": "CV del Inversionista", "en": "Investor Resume"},
                        "description": {"es": "Curriculum vitae del inversionista", "en": "Investor curriculum vitae"},
                        "required": True,
                        "requiresPhysicalCopy": False,
                        "acceptedFormats": ["pdf", "docx"]
                    }
                ]
            },
            {
                "stageNumber": 2,
                "name": {
                    "es": "Etapa 2 - Documentación Financiera",
                    "en": "Stage 2 - Financial Documentation"
                },
                "description": {
                    "es": "Preparación de evidencia de inversión",
                    "en": "Preparation of investment evidence"
                },
                "percentage": 50,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Source of Funds Report", "en": "Source of Funds Report"},
                        "description": {"es": "Reporte de origen de fondos", "en": "Source of funds report"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 15
                    },
                    {
                        "name": {"es": "Investment Evidence", "en": "Investment Evidence"},
                        "description": {"es": "Evidencia de inversión sustancial", "en": "Substantial investment evidence"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 10
                    }
                ],
                "requiredDocuments": [
                    {
                        "name": {"es": "Estados Bancarios", "en": "Bank Statements"},
                        "description": {"es": "Estados bancarios últimos 6 meses", "en": "Bank statements last 6 months"},
                        "required": True,
                        "requiresPhysicalCopy": False,
                        "acceptedFormats": ["pdf"]
                    }
                ]
            },
            {
                "stageNumber": 3,
                "name": {
                    "es": "Etapa 3 - Formularios Consulares",
                    "en": "Stage 3 - Consular Forms"
                },
                "description": {
                    "es": "Preparación de formularios DS-160 y DS-156E",
                    "en": "Preparation of DS-160 and DS-156E forms"
                },
                "percentage": 75,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Formulario DS-160", "en": "Form DS-160"},
                        "description": {"es": "Solicitud de visa de no inmigrante", "en": "Non-immigrant visa application"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 3
                    },
                    {
                        "name": {"es": "Formulario DS-156E", "en": "Form DS-156E"},
                        "description": {"es": "Suplemento para visa E", "en": "Supplement for E visa"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 3
                    }
                ],
                "requiredDocuments": []
            },
            {
                "stageNumber": 4,
                "name": {
                    "es": "Etapa 4 - Entrevista Consular",
                    "en": "Stage 4 - Consular Interview"
                },
                "description": {
                    "es": "Preparación para entrevista consular",
                    "en": "Preparation for consular interview"
                },
                "percentage": 100,
                "amount": 1560.0,
                "defaultUnlocked": False,
                "deliverables": [
                    {
                        "name": {"es": "Interview Preparation Guide", "en": "Interview Preparation Guide"},
                        "description": {"es": "Guía de preparación para entrevista", "en": "Interview preparation guide"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 5
                    },
                    {
                        "name": {"es": "Document Checklist", "en": "Document Checklist"},
                        "description": {"es": "Lista de documentos para entrevista", "en": "Document checklist for interview"},
                        "required": True,
                        "fileTypes": ["pdf"],
                        "estimatedDays": 2
                    }
                ],
                "requiredDocuments": []
            }
        ],
        "estimatedDurationMonths": 8,
        "minDurationMonths": 6,
        "maxDurationMonths": 12,
        "totalAmount": 6240.0,
        "paymentModel": "pay_as_you_advance",
        "stagePayments": True,
        "isActive": True
    }

# =============================================================================
# TEMPLATE INITIALIZATION
# =============================================================================

PREDEFINED_TEMPLATES = {
    "eb2-niw": get_eb2_niw_template(),
    "l1a": get_l1a_template(),
    "e2": get_e2_template()
}

def get_all_templates() -> List[dict]:
    """Returns all predefined templates"""
    return list(PREDEFINED_TEMPLATES.values())

def get_template_by_id(template_id: str) -> Optional[dict]:
    """Get a specific template by ID"""
    return PREDEFINED_TEMPLATES.get(template_id)
