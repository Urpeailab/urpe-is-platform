"""
Success Stories Endpoints
CRUD operations for managing success stories that display on the user dashboard
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import asyncio
import os

logger = logging.getLogger(__name__)

# Pydantic models
class SuccessStoryCreate(BaseModel):
    name: str
    profession: str
    country: str
    visa: str = "EB-2 NIW"
    gender: Optional[str] = None
    age: Optional[int] = None
    previousStatus: Optional[str] = None
    projectName: Optional[str] = None
    photo: Optional[str] = None
    videoUrl: Optional[str] = None
    videoThumbnail: Optional[str] = None
    approvalDate: Optional[str] = None
    processingTime: Optional[str] = None
    score: int = 85
    quote: Optional[str] = None
    keyAdvice: List[str] = []
    featured: bool = False
    active: bool = True

class SuccessStoryUpdate(BaseModel):
    name: Optional[str] = None
    profession: Optional[str] = None
    country: Optional[str] = None
    visa: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    previousStatus: Optional[str] = None
    projectName: Optional[str] = None
    photo: Optional[str] = None
    videoUrl: Optional[str] = None
    videoThumbnail: Optional[str] = None
    approvalDate: Optional[str] = None
    processingTime: Optional[str] = None
    score: Optional[int] = None
    quote: Optional[str] = None
    keyAdvice: Optional[List[str]] = None
    featured: Optional[bool] = None
    active: Optional[bool] = None

def setup_success_stories_router(db, verify_staff_token):
    router = APIRouter(prefix="/success-stories", tags=["Success Stories"])
    
    # ============ PUBLIC ENDPOINTS (for user dashboard) ============
    
    @router.get("/public")
    async def get_public_success_stories(
        profession: str = None,
        country: str = None,
        visa: str = None,
        featured: bool = None,
        limit: int = 100
    ):
        """Get active success stories for public display on user dashboard"""
        try:
            query = {"active": True}
            
            if profession and profession != 'all':
                # Reverse map: neutral filter -> regex matching both gendered versions
                NEUTRAL_TO_REGEX = {
                    "Ingenieria de Software": "^Ingenier[oa] de Software",
                    "Ciencia de Datos": "^Cientific[oa] de Datos",
                    "Ingenieria Biomedica": "^Ingenier[oa] Biomedic[oa]",
                    "Ingenieria Civil": "^Ingenier[oa] Civil",
                    "Ingenieria Mecanica": "^Ingenier[oa] Mecanic[oa]",
                    "Ingenieria Quimica": "^Ingenier[oa] Quimic[oa]",
                    "Investigacion en Inteligencia Artificial": "^Investigador[a]? en Inteligencia Artificial",
                    "Investigacion en Biotecnologia": "^Investigador[a]? en Biotecnologia",
                    "Ingenieria Ambiental": "^Ingenier[oa] Ambiental",
                    "Ingenieria Electrica": "^Ingenier[oa] Electric[oa]",
                    "Ingenieria Industrial": "^Ingenier[oa] Industrial",
                    "Fisica": "^Fisic[oa]$",
                    "Matematicas": "^Matematic[oa]$",
                    "Biologia": "^Biolog[oa]$",
                    "Ingenieria de Telecomunicaciones": "^Ingenier[oa] de Telecomunicaciones",
                    "Ciencia de Materiales": "^Cientific[oa] en Materiales",
                    "Ingenieria de Petroleo": "^Ingenier[oa] de Petroleo",
                    "Ingenieria Aeroespacial": "^Ingenier[oa] Aeroespacial",
                    "Medicina": "^Medic[oa]$",
                    "Derecho": "^Abogad[oa]$",
                    "Administracion de Empresas": "^Administrador[a]? de Empresas",
                }
                prof_regex = NEUTRAL_TO_REGEX.get(profession, profession)
                query["profession"] = {"$regex": prof_regex, "$options": "i"}
            if country and country != 'all':
                query["country"] = {"$regex": country, "$options": "i"}
            if visa and visa != 'all':
                query["visa"] = visa
            if featured is not None:
                query["featured"] = featured
            
            cursor = db.success_stories.find(query, {"_id": 0}).sort("createdAt", -1).limit(limit)
            stories = await cursor.to_list(length=limit)
            
            # Get unique values for filters - normalize professions (merge gendered versions)
            all_stories = await db.success_stories.find({"active": True}, {"_id": 0, "profession": 1, "country": 1, "visa": 1, "previousStatus": 1}).to_list(length=1000)
            
            # Full mapping of gendered professions to neutral display names
            PROFESSION_NEUTRAL = {
                "Ingeniero de Software": "Ingenieria de Software",
                "Ingeniera de Software": "Ingenieria de Software",
                "Cientifico de Datos": "Ciencia de Datos",
                "Cientifica de Datos": "Ciencia de Datos",
                "Ingeniero Biomedico": "Ingenieria Biomedica",
                "Ingeniera Biomedica": "Ingenieria Biomedica",
                "Ingeniero Civil": "Ingenieria Civil",
                "Ingeniera Civil": "Ingenieria Civil",
                "Ingeniero Mecanico": "Ingenieria Mecanica",
                "Ingeniera Mecanica": "Ingenieria Mecanica",
                "Ingeniero Quimico": "Ingenieria Quimica",
                "Ingeniera Quimica": "Ingenieria Quimica",
                "Investigador en Inteligencia Artificial": "Investigacion en Inteligencia Artificial",
                "Investigadora en Inteligencia Artificial": "Investigacion en Inteligencia Artificial",
                "Investigador en Biotecnologia": "Investigacion en Biotecnologia",
                "Investigadora en Biotecnologia": "Investigacion en Biotecnologia",
                "Ingeniero Ambiental": "Ingenieria Ambiental",
                "Ingeniera Ambiental": "Ingenieria Ambiental",
                "Ingeniero Electrico": "Ingenieria Electrica",
                "Ingeniera Electrica": "Ingenieria Electrica",
                "Ingeniero Industrial": "Ingenieria Industrial",
                "Ingeniera Industrial": "Ingenieria Industrial",
                "Fisico": "Fisica",
                "Fisica": "Fisica",
                "Matematico": "Matematicas",
                "Matematica": "Matematicas",
                "Biologo": "Biologia",
                "Biologa": "Biologia",
                "Ingeniero de Telecomunicaciones": "Ingenieria de Telecomunicaciones",
                "Ingeniera de Telecomunicaciones": "Ingenieria de Telecomunicaciones",
                "Cientifico en Materiales": "Ciencia de Materiales",
                "Cientifica en Materiales": "Ciencia de Materiales",
                "Ingeniero de Petroleo": "Ingenieria de Petroleo",
                "Ingeniera de Petroleo": "Ingenieria de Petroleo",
                "Ingeniero Aeroespacial": "Ingenieria Aeroespacial",
                "Ingeniera Aeroespacial": "Ingenieria Aeroespacial",
                "Medico": "Medicina",
                "Medica": "Medicina",
                "Abogado": "Derecho",
                "Abogada": "Derecho",
                "Administrador de Empresas": "Administracion de Empresas",
                "Administradora de Empresas": "Administracion de Empresas",
            }
            
            raw_professions = set([s.get("profession") for s in all_stories if s.get("profession")])
            professions = sorted(set([PROFESSION_NEUTRAL.get(p, p) for p in raw_professions]))
            countries = sorted(set([s.get("country") for s in all_stories if s.get("country")]))
            visas = sorted(set([s.get("visa") for s in all_stories if s.get("visa")]))
            statuses = sorted(set([s.get("previousStatus") for s in all_stories if s.get("previousStatus")]))
            
            return {
                "success": True,
                "stories": stories,
                "total": len(stories),
                "filters": {
                    "professions": sorted(professions),
                    "countries": sorted(countries),
                    "visas": sorted(visas),
                    "statuses": sorted(statuses)
                }
            }
        except Exception as e:
            logger.error(f"Error getting public success stories: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ============ ADMIN ENDPOINTS ============
    
    @router.get("/admin/all")
    async def get_all_success_stories(
        staff_payload: dict = Depends(verify_staff_token),
        page: int = 1,
        limit: int = 20,
        search: str = None,
        active: bool = None
    ):
        """Get all success stories for admin management"""
        try:
            query = {}
            
            if search:
                query["$or"] = [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"profession": {"$regex": search, "$options": "i"}},
                    {"country": {"$regex": search, "$options": "i"}}
                ]
            
            if active is not None:
                query["active"] = active
            
            skip = (page - 1) * limit
            
            cursor = db.success_stories.find(query, {"_id": 0}).sort("createdAt", -1).skip(skip).limit(limit)
            stories = await cursor.to_list(length=limit)
            total = await db.success_stories.count_documents(query)
            
            return {
                "success": True,
                "stories": stories,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit
                }
            }
        except Exception as e:
            logger.error(f"Error getting admin success stories: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/admin/export")
    async def export_success_stories(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Export all success stories as JSON (for importing into production)."""
        cursor = db.success_stories.find({}, {"_id": 0})
        stories = await cursor.to_list(length=1000)
        return {"success": True, "stories": stories, "total": len(stories)}

    @router.post("/admin/import")
    async def import_success_stories(
        data: dict,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Import success stories from JSON. Replaces all existing stories."""
        stories = data.get("stories", [])
        if not stories:
            raise HTTPException(status_code=400, detail="No stories provided")
        await db.success_stories.delete_many({})
        for story in stories:
            story.pop("_id", None)
            await db.success_stories.insert_one(story)
        return {"success": True, "message": f"{len(stories)} historias importadas", "total": len(stories)}

    @router.get("/admin/{story_id}")
    async def get_success_story(
        story_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get a single success story by ID"""
        try:
            story = await db.success_stories.find_one({"id": story_id}, {"_id": 0})
            if not story:
                raise HTTPException(status_code=404, detail="Historia no encontrada")
            
            return {"success": True, "story": story}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting success story: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/admin")
    async def create_success_story(
        data: SuccessStoryCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Create a new success story"""
        try:
            story_id = str(uuid.uuid4())
            
            # Generate avatar if no photo provided
            photo = data.photo
            if not photo:
                seed = data.name.replace(" ", "")
                photo = f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}&backgroundColor=ffc700"
            
            story = {
                "id": story_id,
                "name": data.name,
                "gender": data.gender,
                "age": data.age,
                "profession": data.profession,
                "country": data.country,
                "previousStatus": data.previousStatus,
                "projectName": data.projectName,
                "visa": data.visa,
                "photo": photo,
                "videoUrl": data.videoUrl,
                "videoThumbnail": data.videoThumbnail or "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
                "approvalDate": data.approvalDate,
                "processingTime": data.processingTime,
                "score": data.score,
                "quote": data.quote,
                "keyAdvice": data.keyAdvice,
                "featured": data.featured,
                "active": data.active,
                "views": 0,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "createdBy": staff_payload.get("id")
            }
            
            await db.success_stories.insert_one(story)
            
            # Remove _id for response
            story.pop("_id", None)
            
            logger.info(f"Success story created: {data.name} by {staff_payload.get('email')}")
            
            return {
                "success": True,
                "message": "Historia de exito creada exitosamente",
                "story": story
            }
        except Exception as e:
            logger.error(f"Error creating success story: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.put("/admin/{story_id}")
    async def update_success_story(
        story_id: str,
        data: SuccessStoryUpdate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Update an existing success story"""
        try:
            existing = await db.success_stories.find_one({"id": story_id})
            if not existing:
                raise HTTPException(status_code=404, detail="Historia no encontrada")
            
            update_data = {k: v for k, v in data.dict().items() if v is not None}
            update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
            update_data["updatedBy"] = staff_payload.get("id")
            
            await db.success_stories.update_one(
                {"id": story_id},
                {"$set": update_data}
            )
            
            updated = await db.success_stories.find_one({"id": story_id}, {"_id": 0})
            
            logger.info(f"Success story updated: {story_id} by {staff_payload.get('email')}")
            
            return {
                "success": True,
                "message": "Historia actualizada exitosamente",
                "story": updated
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating success story: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.delete("/admin/{story_id}")
    async def delete_success_story(
        story_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a success story"""
        try:
            existing = await db.success_stories.find_one({"id": story_id})
            if not existing:
                raise HTTPException(status_code=404, detail="Historia no encontrada")
            
            await db.success_stories.delete_one({"id": story_id})
            
            logger.info(f"Success story deleted: {story_id} by {staff_payload.get('email')}")
            
            return {
                "success": True,
                "message": "Historia eliminada exitosamente"
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting success story: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/admin/{story_id}/toggle-featured")
    async def toggle_featured(
        story_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Toggle featured status of a success story"""
        try:
            existing = await db.success_stories.find_one({"id": story_id})
            if not existing:
                raise HTTPException(status_code=404, detail="Historia no encontrada")
            
            new_featured = not existing.get("featured", False)
            
            await db.success_stories.update_one(
                {"id": story_id},
                {"$set": {"featured": new_featured, "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {
                "success": True,
                "message": f"Historia {'destacada' if new_featured else 'no destacada'}",
                "featured": new_featured
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error toggling featured: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/admin/{story_id}/toggle-active")
    async def toggle_active(
        story_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Toggle active status of a success story"""
        try:
            existing = await db.success_stories.find_one({"id": story_id})
            if not existing:
                raise HTTPException(status_code=404, detail="Historia no encontrada")
            
            new_active = not existing.get("active", True)
            
            await db.success_stories.update_one(
                {"id": story_id},
                {"$set": {"active": new_active, "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {
                "success": True,
                "message": f"Historia {'activada' if new_active else 'desactivada'}",
                "active": new_active
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error toggling active: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ============ GENERATION ENDPOINTS ============
    
    class GenerateRequest(BaseModel):
        gemini_api_key: Optional[str] = None
        fal_api_key: Optional[str] = None
        count: int = 100

    @router.post("/admin/generate")
    async def generate_success_stories(
        data: GenerateRequest,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """
        Generate N success stories from scratch with AI-generated face images.
        Images are uploaded to Supabase Storage for persistence.
        Tries: Gemini Flash → Gemini Imagen → fal.ai (if key provided).
        Runs as a background task - poll /admin/generate/status for progress.
        """
        from success_stories_generator import get_generation_status, run_generation

        status = get_generation_status()
        if status["running"]:
            raise HTTPException(status_code=409, detail="Ya hay una generacion en progreso")

        api_key = data.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="Se requiere gemini_api_key o GEMINI_API_KEY en .env")

        fal_key = data.fal_api_key or os.environ.get("FAL_KEY")

        asyncio.ensure_future(run_generation(db, api_key, data.count, fal_key))

        models_info = "Gemini Flash + Imagen"
        if fal_key:
            models_info += " + fal.ai (fallback)"

        return {
            "success": True,
            "message": f"Generacion de {data.count} historias iniciada ({models_info})",
            "note": "Consulta /api/success-stories/admin/generate/status para ver el progreso"
        }

    @router.get("/admin/generate/status")
    async def get_generate_status(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get the status of the background generation task."""
        from success_stories_generator import get_generation_status
        return get_generation_status()

    class RefreshPhotosRequest(BaseModel):
        gemini_api_key: Optional[str] = None
        fal_api_key: Optional[str] = None
        offset: int = 0
        batch_size: int = 20

    @router.post("/admin/refresh-photos")
    async def refresh_photos(
        data: RefreshPhotosRequest,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """
        Regenerate ONLY the photos for existing stories in batches.
        Does NOT delete any data - just updates the photo field.
        Use offset to control which batch: 0=first 20, 20=next 20, etc.
        """
        from success_stories_generator import get_generation_status, run_photo_refresh

        status = get_generation_status()
        if status["running"]:
            raise HTTPException(status_code=409, detail="Ya hay una tarea en progreso")

        api_key = data.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="Se requiere gemini_api_key")

        fal_key = data.fal_api_key or os.environ.get("FAL_KEY")

        asyncio.ensure_future(run_photo_refresh(db, api_key, fal_key, data.offset, data.batch_size))

        return {
            "success": True,
            "message": f"Regenerando fotos {data.offset+1}-{data.offset+data.batch_size} (solo fotos, datos intactos)",
            "note": "Consulta /api/success-stories/admin/generate/status para ver el progreso"
        }

    @router.post("/admin/migrate-to-supabase")
    async def migrate_images_to_supabase(
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """
        Migrate local /api/faces/ images to Supabase Storage.
        Updates all story photo URLs to point to Supabase.
        """
        from supabase import create_client
        from pathlib import Path

        supabase_url = os.environ.get("SUPABASE_STORAGE_URL")
        supabase_key = os.environ.get("SUPABASE_STORAGE_KEY")
        bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")

        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="SUPABASE_STORAGE_URL/KEY not configured")

        supabase_client = create_client(supabase_url, supabase_key)
        faces_dir = Path(__file__).parent / "uploads" / "faces"

        cursor = db.success_stories.find({"photo": {"$regex": "^/api/faces/"}}, {"_id": 0})
        stories = await cursor.to_list(length=1000)

        migrated = 0
        errors = 0

        for story in stories:
            photo = story.get("photo", "")
            filename = photo.replace("/api/faces/", "")
            local_path = faces_dir / filename

            if not local_path.exists():
                errors += 1
                continue

            try:
                with open(local_path, "rb") as f:
                    content = f.read()

                supabase_path = f"success-stories/faces/{filename}"
                supabase_client.storage.from_(bucket).upload(
                    supabase_path, content,
                    file_options={"content-type": "image/png", "upsert": "true"}
                )
                public_url = supabase_client.storage.from_(bucket).get_public_url(supabase_path)

                await db.success_stories.update_one(
                    {"id": story["id"]},
                    {"$set": {"photo": public_url, "updatedAt": datetime.now(timezone.utc).isoformat()}}
                )
                migrated += 1
            except Exception as e:
                logger.error(f"Migration error for {filename}: {e}")
                errors += 1

        return {
            "success": True,
            "message": f"Migracion completada: {migrated} imagenes subidas a Supabase, {errors} errores",
            "migrated": migrated,
            "errors": errors,
            "total": len(stories)
        }

    return router
