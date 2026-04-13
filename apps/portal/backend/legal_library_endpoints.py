"""
Legal Library Endpoints
Handles legal documents, laws, manuals, glossary terms, and case law
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class LawCreate(BaseModel):
    title: str
    category: str
    description: str
    reference: str
    year: str
    popular: bool = False


class ManualCreate(BaseModel):
    title: str
    category: str
    description: str
    chapters: int
    lastUpdated: str
    url: str
    popular: bool = False


class GlossaryCreate(BaseModel):
    term: str
    definition: str
    relatedLaw: str
    category: str


class CaseLawCreate(BaseModel):
    title: str
    citation: str
    court: str
    year: str
    category: str
    summary: str
    impact: str
    landmark: bool = False


def setup_legal_library_router(db, verify_staff_token):
    """Setup legal library router with dependencies"""
    legal_router = APIRouter()

    # ===== LAWS ENDPOINTS =====
    @legal_router.get("/admin/legal/laws")
    async def get_laws(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get all laws"""
        try:
            cursor = db.legal_laws.find({}, {'_id': 0})
            laws = await cursor.to_list(length=1000)
            
            return {
                "success": True,
                "laws": laws,
                "total": len(laws)
            }
        except Exception as e:
            logger.error(f"Error fetching laws: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch laws")

    @legal_router.post("/admin/legal/laws")
    async def create_law(
        request: LawCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Create a new law"""
        try:
            law_id = str(uuid4())
            law = {
                "id": law_id,
                "title": request.title,
                "category": request.category,
                "description": request.description,
                "reference": request.reference,
                "year": request.year,
                "popular": request.popular,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "createdBy": staff_payload['id']
            }
            
            await db.legal_laws.insert_one(law)
            return {"success": True, "law": law}
        except Exception as e:
            logger.error(f"Error creating law: {e}")
            raise HTTPException(status_code=500, detail="Failed to create law")

    @legal_router.delete("/admin/legal/laws/{law_id}")
    async def delete_law(
        law_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a law"""
        try:
            await db.legal_laws.delete_one({'id': law_id})
            return {"success": True, "message": "Law deleted"}
        except Exception as e:
            logger.error(f"Error deleting law: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete law")

    # ===== MANUALS ENDPOINTS =====
    @legal_router.get("/admin/legal/manuals")
    async def get_manuals(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get all manuals"""
        try:
            cursor = db.legal_manuals.find({}, {'_id': 0})
            manuals = await cursor.to_list(length=1000)
            
            return {
                "success": True,
                "manuals": manuals,
                "total": len(manuals)
            }
        except Exception as e:
            logger.error(f"Error fetching manuals: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch manuals")

    @legal_router.post("/admin/legal/manuals")
    async def create_manual(
        request: ManualCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Create a new manual"""
        try:
            manual_id = str(uuid4())
            manual = {
                "id": manual_id,
                "title": request.title,
                "category": request.category,
                "description": request.description,
                "chapters": request.chapters,
                "lastUpdated": request.lastUpdated,
                "url": request.url,
                "popular": request.popular,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "createdBy": staff_payload['id']
            }
            
            await db.legal_manuals.insert_one(manual)
            return {"success": True, "manual": manual}
        except Exception as e:
            logger.error(f"Error creating manual: {e}")
            raise HTTPException(status_code=500, detail="Failed to create manual")

    @legal_router.delete("/admin/legal/manuals/{manual_id}")
    async def delete_manual(
        manual_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a manual"""
        try:
            await db.legal_manuals.delete_one({'id': manual_id})
            return {"success": True, "message": "Manual deleted"}
        except Exception as e:
            logger.error(f"Error deleting manual: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete manual")

    # ===== GLOSSARY ENDPOINTS =====
    @legal_router.get("/admin/legal/glossary")
    async def get_glossary(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get all glossary terms"""
        try:
            cursor = db.legal_glossary.find({}, {'_id': 0})
            terms = await cursor.to_list(length=1000)
            
            return {
                "success": True,
                "terms": terms,
                "total": len(terms)
            }
        except Exception as e:
            logger.error(f"Error fetching glossary: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch glossary")

    @legal_router.post("/admin/legal/glossary")
    async def create_glossary_term(
        request: GlossaryCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Create a new glossary term"""
        try:
            term_id = str(uuid4())
            term = {
                "id": term_id,
                "term": request.term,
                "definition": request.definition,
                "relatedLaw": request.relatedLaw,
                "category": request.category,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "createdBy": staff_payload['id']
            }
            
            await db.legal_glossary.insert_one(term)
            return {"success": True, "term": term}
        except Exception as e:
            logger.error(f"Error creating glossary term: {e}")
            raise HTTPException(status_code=500, detail="Failed to create glossary term")

    @legal_router.delete("/admin/legal/glossary/{term_id}")
    async def delete_glossary_term(
        term_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a glossary term"""
        try:
            await db.legal_glossary.delete_one({'id': term_id})
            return {"success": True, "message": "Glossary term deleted"}
        except Exception as e:
            logger.error(f"Error deleting glossary term: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete glossary term")

    # ===== CASE LAW ENDPOINTS =====
    @legal_router.get("/admin/legal/caselaw")
    async def get_case_law(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get all case law"""
        try:
            cursor = db.legal_caselaw.find({}, {'_id': 0})
            cases = await cursor.to_list(length=1000)
            
            return {
                "success": True,
                "cases": cases,
                "total": len(cases)
            }
        except Exception as e:
            logger.error(f"Error fetching case law: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch case law")

    @legal_router.post("/admin/legal/caselaw")
    async def create_case_law(
        request: CaseLawCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Create a new case law"""
        try:
            case_id = str(uuid4())
            case = {
                "id": case_id,
                "title": request.title,
                "citation": request.citation,
                "court": request.court,
                "year": request.year,
                "category": request.category,
                "summary": request.summary,
                "impact": request.impact,
                "landmark": request.landmark,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "createdBy": staff_payload['id']
            }
            
            await db.legal_caselaw.insert_one(case)
            return {"success": True, "case": case}
        except Exception as e:
            logger.error(f"Error creating case law: {e}")
            raise HTTPException(status_code=500, detail="Failed to create case law")

    @legal_router.delete("/admin/legal/caselaw/{case_id}")
    async def delete_case_law(
        case_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a case law"""
        try:
            await db.legal_caselaw.delete_one({'id': case_id})
            return {"success": True, "message": "Case law deleted"}
        except Exception as e:
            logger.error(f"Error deleting case law: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete case law")

    return legal_router
