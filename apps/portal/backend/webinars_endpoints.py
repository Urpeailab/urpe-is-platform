"""
Webinars Management Endpoints
Handles webinar creation, listing, and management for admin
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List
from pydantic import BaseModel
import logging
from db.supabase_client import select, insert, update as sb_update, delete, count, get_supabase

logger = logging.getLogger(__name__)


class WebinarCreate(BaseModel):
    title: dict
    description: dict
    type: str
    date: Optional[str] = None
    time: Optional[str] = None
    duration: int = 60
    capacity: int = 100
    videoUrl: Optional[str] = None
    thumbnail: Optional[str] = None
    presenter: dict
    level: str = 'intermediate'
    topics: List[str] = []
    language: str = 'both'


class WebinarUpdate(BaseModel):
    title: Optional[dict] = None
    description: Optional[dict] = None
    type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration: Optional[int] = None
    capacity: Optional[int] = None
    videoUrl: Optional[str] = None
    thumbnail: Optional[str] = None
    presenter: Optional[dict] = None
    level: Optional[str] = None
    topics: Optional[List[str]] = None
    language: Optional[str] = None


def setup_webinars_router(db, verify_staff_token):
    """Setup webinars router with dependencies"""
    webinars_router = APIRouter()

    @webinars_router.get("/admin/webinars")
    async def get_webinars(
        limit: int = 100,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Get all webinars"""
        try:
            webinars = select('webinars', order='created_at', order_desc=True, limit=limit)

            return {
                "success": True,
                "webinars": webinars,
                "total": len(webinars)
            }
        except Exception as e:
            logger.error(f"Error fetching webinars: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch webinars: {str(e)}")

    @webinars_router.post("/admin/webinars")
    async def create_webinar(
        request: WebinarCreate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Create a new webinar"""
        try:
            webinar = {
                "title": request.title,
                "description": request.description,
                "type": request.type,
                # The DB column is TEXT, but it has a NOT NULL-friendly default.
                # Empty strings cause some Supabase clients to treat the value
                # oddly when the underlying column expects null — coerce to None.
                "date": request.date or None,
                "time": request.time or None,
                "duration": request.duration,
                "capacity": request.capacity,
                "video_url": request.videoUrl or None,
                "meeting_link": request.videoUrl or None,
                "thumbnail": request.thumbnail or None,
                "presenter": request.presenter,
                "level": request.level,
                "topics": request.topics or [],
                "language": request.language,
                "registered_count": 0,
                "created_by": staff_payload['id'],
            }

            result = insert('webinars', webinar)
            webinar_id = result.get('id')
            logger.info(f"Webinar created: {webinar_id} by {staff_payload.get('name', 'admin')}")

            return {
                "success": True,
                "message": "Webinar created successfully",
                "webinar": result or webinar,
            }
        except Exception as e:
            # Surface the actual Supabase error so the client can see what
            # column / constraint is failing instead of a generic 500.
            logger.error(f"Error creating webinar: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to create webinar: {str(e)}")

    @webinars_router.put("/admin/webinars/{webinar_id}")
    async def update_webinar(
        webinar_id: str,
        request: WebinarUpdate,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Update a webinar"""
        try:
            # Check if webinar exists
            webinar = select('webinars', filters={'id': webinar_id}, single=True)
            if not webinar:
                raise HTTPException(status_code=404, detail="Webinar not found")
            
            # Build update data (snake_case columns)
            update_data = {}
            if request.title is not None:
                update_data['title'] = request.title
            if request.description is not None:
                update_data['description'] = request.description
            if request.type is not None:
                update_data['type'] = request.type
            if request.date is not None:
                update_data['date'] = request.date
            if request.time is not None:
                update_data['time'] = request.time
            if request.duration is not None:
                update_data['duration'] = request.duration
            if request.capacity is not None:
                update_data['capacity'] = request.capacity
            if request.videoUrl is not None:
                update_data['video_url'] = request.videoUrl
                update_data['meeting_link'] = request.videoUrl
            if request.thumbnail is not None:
                update_data['thumbnail'] = request.thumbnail
            if request.presenter is not None:
                update_data['presenter'] = request.presenter
            if request.level is not None:
                update_data['level'] = request.level
            if request.topics is not None:
                update_data['topics'] = request.topics
            if request.language is not None:
                update_data['language'] = request.language
            
            # Update webinar
            sb_update('webinars', {'id': webinar_id}, update_data)
            
            logger.info(f"Webinar updated: {webinar_id} by {staff_payload.get('name', 'admin')}")
            
            # Get updated webinar
            updated_webinar = select('webinars', filters={'id': webinar_id}, single=True)
            
            return {
                "success": True,
                "message": "Webinar updated successfully",
                "webinar": updated_webinar
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating webinar: {e}")
            raise HTTPException(status_code=500, detail="Failed to update webinar")

    @webinars_router.delete("/admin/webinars/{webinar_id}")
    async def delete_webinar(
        webinar_id: str,
        staff_payload: dict = Depends(verify_staff_token)
    ):
        """Delete a webinar"""
        try:
            # Check if webinar exists
            webinar = select('webinars', filters={'id': webinar_id}, single=True)
            if not webinar:
                raise HTTPException(status_code=404, detail="Webinar not found")
            
            # Delete webinar
            delete('webinars', {'id': webinar_id})
            logger.info(f"Webinar deleted: {webinar_id} by {staff_payload.get('name', 'admin')}")
            
            return {
                "success": True,
                "message": "Webinar deleted successfully"
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting webinar: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete webinar")

    # ============================================
    # PUBLIC ENDPOINTS FOR USERS (No Auth Required)
    # ============================================
    
    @webinars_router.get("/webinars")
    async def get_public_webinars(
        webinar_type: Optional[str] = None,
        limit: int = 100
    ):
        """Get public webinars for users (no authentication required)"""
        try:
            filters = None
            if webinar_type:
                filters = {'type': webinar_type}

            webinars = select('webinars', filters=filters, order='created_at', order_desc=True, limit=limit)

            return {
                "success": True,
                "webinars": webinars,
                "total": len(webinars)
            }
        except Exception as e:
            logger.error(f"Error fetching public webinars: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch webinars: {str(e)}")
    
    @webinars_router.get("/webinars/{webinar_id}")
    async def get_public_webinar_detail(webinar_id: str):
        """Get single webinar details for users"""
        try:
            webinar = select('webinars', filters={'id': webinar_id}, single=True)
            if not webinar:
                raise HTTPException(status_code=404, detail="Webinar not found")
            
            return {
                "success": True,
                "webinar": webinar
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching webinar detail: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch webinar")
    
    @webinars_router.post("/webinars/{webinar_id}/register")
    async def register_to_webinar(
        webinar_id: str,
        user_data: dict
    ):
        """Register user to a webinar (requires user authentication in production)"""
        try:
            # Find webinar
            webinar = select('webinars', filters={'id': webinar_id}, single=True)
            if not webinar:
                raise HTTPException(status_code=404, detail="Webinar not found")
            
            # Check capacity
            registered_count = webinar.get('registeredCount', 0)
            capacity = webinar.get('capacity', 100)
            
            if registered_count >= capacity:
                raise HTTPException(status_code=400, detail="Webinar is full")
            
            # Check if already registered
            user_id = user_data.get('userId')
            if user_id:
                existing_registration = select('webinar_registrations', filters={
                    'webinarId': webinar_id,
                    'userId': user_id
                }, single=True)
                if existing_registration:
                    raise HTTPException(status_code=400, detail="Already registered")
            
            # Create registration
            registration = {
                "id": str(uuid4()),
                "webinarId": webinar_id,
                "userId": user_id,
                "userEmail": user_data.get('email'),
                "userName": user_data.get('name'),
                "registeredAt": datetime.now(timezone.utc).isoformat()
            }
            
            insert('webinar_registrations', registration)
            
            # Update registered count (read-modify-write)
            _w = select('webinars', filters={'id': webinar_id}, single=True)
            if _w:
                sb_update('webinars', {'id': webinar_id}, {'registered_count': (_w.get('registered_count', 0) or 0) + 1})
            
            logger.info(f"User registered to webinar: {webinar_id}")
            
            return {
                "success": True,
                "message": "Successfully registered to webinar",
                "registration": registration
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error registering to webinar: {e}")
            raise HTTPException(status_code=500, detail="Failed to register")

    return webinars_router
