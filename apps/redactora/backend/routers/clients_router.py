"""
Clients Router - Handles client CRUD operations and management
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import math
import asyncio
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Models
# ============================================================================

class Client(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str  # ID del operador asignado
    name: str
    email: str
    phone: Optional[str] = ""
    company: Optional[str] = ""
    country: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    street_address: Optional[str] = ""
    postal_code: Optional[str] = ""
    industry: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "active"  # active, archived, transferred
    tags: List[str] = []
    transfer_history: List[dict] = []
    search_text: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_by: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class ClientInput(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    company: Optional[str] = ""
    country: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    street_address: Optional[str] = ""
    postal_code: Optional[str] = ""
    industry: Optional[str] = ""
    notes: Optional[str] = ""
    tags: List[str] = []


class ClientTransferRequest(BaseModel):
    new_operator_id: str


# ============================================================================
# Dependencies - Will be injected from server.py
# ============================================================================

_db = None
_get_current_user = None
_require_admin = None
_get_or_create_cliente_supabase = None
_create_activity_log = None


def init_router(
    database,
    get_current_user_func,
    require_admin_func,
    get_or_create_cliente_supabase_func=None,
    create_activity_log_func=None
):
    """Initialize the router with dependencies from server.py"""
    global _db, _get_current_user, _require_admin, _get_or_create_cliente_supabase, _create_activity_log
    _db = database
    _get_current_user = get_current_user_func
    _require_admin = require_admin_func
    _get_or_create_cliente_supabase = get_or_create_cliente_supabase_func
    _create_activity_log = create_activity_log_func
    logger.info("✅ Clients Router initialized with dependencies")


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_router() first.")
    return _db


# Dependency wrapper that will be resolved at request time
async def get_current_user_wrapper(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """Wrapper that calls the injected get_current_user function"""
    if _get_current_user is None:
        raise RuntimeError("get_current_user not initialized. Call init_router() first.")
    # Call the actual get_current_user with credentials
    return await _get_current_user(credentials)


# ============================================================================
# Helper Functions
# ============================================================================

async def get_client_documents_count(client_id: str) -> int:
    """Count total documents for a client across ALL document types"""
    db = get_db()
    try:
        count = 0
        # NIW / Business Plans
        count += await db.niw_in_progress.count_documents({"client_id": client_id})
        count += await db.business_plans.count_documents({"client_id": client_id})
        # Patents
        count += await db.patents_in_progress.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        count += await db.patents.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Books
        count += await db.books_in_progress.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        count += await db.books.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Whitepapers
        count += await db.whitepapers_in_progress.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        count += await db.whitepapers.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Econometric Studies
        count += await db.econometric_studies_in_progress.count_documents({"client_id": client_id, "status": {"$nin": ["deleted", None]}})
        count += await db.econometric_studies.count_documents({"client_id": client_id, "status": {"$nin": ["deleted", None]}})
        # Designed Documents
        count += await db.designed_documents.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Policy Papers
        count += await db.policy_papers.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Case Studies
        count += await db.case_studies.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Recommendation Letters
        count += await db.recommendation_letters.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Expert Letters
        count += await db.expert_letters.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Self-Petition Letters
        count += await db.self_petition_letters.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        count += await db.self_petition_v2_letters.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        # Certified Translations
        count += await db.certified_translations.count_documents({"client_id": client_id, "status": {"$ne": "deleted"}})
        return count
    except Exception:
        return 0


# ============================================================================
# Router
# ============================================================================

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post("")
async def create_client(client_data: ClientInput, current_user = Depends(get_current_user_wrapper)):
    """Create new client"""
    db = get_db()
    try:
        # Validate email doesn't exist
        existing_by_email = await db.clients.find_one({
            "email": client_data.email,
            "status": "active"
        }, {"_id": 0, "id": 1, "name": 1, "operator_id": 1})
        
        if existing_by_email:
            creator = await db.users.find_one(
                {"id": existing_by_email["operator_id"]},
                {"_id": 0, "full_name": 1, "email": 1}
            )
            creator_name = creator.get("full_name", "Usuario desconocido") if creator else "Usuario desconocido"
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un cliente con este email en el sistema. Creado por: {creator_name}."
            )
        
        # Validate name doesn't exist (case-insensitive)
        existing_by_name = await db.clients.find_one({
            "name": {"$regex": f"^{client_data.name}$", "$options": "i"},
            "status": "active"
        }, {"_id": 0, "id": 1, "email": 1, "operator_id": 1})
        
        if existing_by_name:
            creator = await db.users.find_one(
                {"id": existing_by_name["operator_id"]},
                {"_id": 0, "full_name": 1, "email": 1}
            )
            creator_name = creator.get("full_name", "Usuario desconocido") if creator else "Usuario desconocido"
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un cliente con este nombre en el sistema. Creado por: {creator_name}."
            )
        
        # Create search_text
        search_text = f"{client_data.name} {client_data.email} {client_data.company}".lower()
        
        # Create client
        now = datetime.now(timezone.utc).isoformat()
        client_dict = client_data.model_dump()
        client_dict.update({
            "id": str(uuid.uuid4()),
            "operator_id": current_user.id,
            "created_by": current_user.id,
            "created_by_name": current_user.full_name,
            "updated_by": None,
            "updated_by_name": None,
            "search_text": search_text,
            "status": "active",
            "transfer_history": [],
            "created_at": now,
            "updated_at": now
        })
        
        # Link with Supabase if function available
        supabase_id = None
        if _get_or_create_cliente_supabase:
            supabase_cliente = await _get_or_create_cliente_supabase(
                email=client_data.email,
                nombre=client_data.name
            )
            if supabase_cliente:
                client_dict['supabase_id'] = supabase_cliente.get('id')
                supabase_id = supabase_cliente.get('id')
                logger.info(f"✅ Cliente vinculado con Supabase ID: {supabase_id}")
        
        if not supabase_id:
            client_dict['supabase_id'] = None
        
        await db.clients.insert_one(client_dict)
        logger.info(f"Client created: {client_dict['id']} by operator {current_user.id}")
        
        # Remove MongoDB _id
        client_dict.pop('_id', None)
        
        return {
            "message": "Cliente creado exitosamente",
            "client_id": client_dict["id"],
            "client": client_dict,
            "supabase_linked": supabase_id is not None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating client: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating client: {str(e)}")


@router.get("")
async def get_clients(
    status: str = "active",
    page: int = 1,
    limit: int = 50,
    created_by: str = None,
    current_user = Depends(get_current_user_wrapper)
):
    """Get list of clients - ALL authenticated users see ALL clients (no role restriction)"""
    db = get_db()
    try:
        query = {"status": status}
        
        # Optional filter by specific operator (from query param only)
        if created_by:
            query["operator_id"] = created_by
        
        skip = (page - 1) * limit
        
        clients = await db.clients.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        total = await db.clients.count_documents(query)
        
        # Get operator info
        operator_ids = list(set([c.get("operator_id") for c in clients if c.get("operator_id")]))
        operators = {}
        if operator_ids:
            users = await db.users.find(
                {"id": {"$in": operator_ids}},
                {"_id": 0, "id": 1, "full_name": 1, "email": 1}
            ).to_list(length=len(operator_ids))
            operators = {u["id"]: u for u in users}
        
        # Add info for each client
        for client in clients:
            operator_id = client.get("operator_id")
            if operator_id and operator_id in operators:
                client["created_by"] = {
                    "id": operators[operator_id]["id"],
                    "name": operators[operator_id].get("full_name", "Sin nombre"),
                    "email": operators[operator_id].get("email", "")
                }
            else:
                client["created_by"] = {
                    "id": operator_id or "unknown",
                    "name": "Usuario desconocido",
                    "email": ""
                }
            
            # Document counts
            client_id = client["id"]
            doc_counts = await asyncio.gather(
                db.niw_in_progress.count_documents({"client_id": client_id, "status": "completed"}),
                db.business_plans.count_documents({"client_id": client_id, "status": "completed"}),
                db.patents_in_progress.count_documents({"client_id": client_id, "status": "completed"}),
                db.patents.count_documents({"client_id": client_id}),
                db.books_in_progress.count_documents({"client_id": client_id, "status": "completed"}),
                db.books.count_documents({"client_id": client_id}),
                db.case_studies.count_documents({"client_id": client_id, "status": "completed"}),
                db.self_petition_letters.count_documents({"client_id": client_id, "status": "completed"}),
                return_exceptions=True
            )
            
            niw_count = doc_counts[0] if isinstance(doc_counts[0], int) else 0
            bp_count = doc_counts[1] if isinstance(doc_counts[1], int) else 0
            patent_prog_count = doc_counts[2] if isinstance(doc_counts[2], int) else 0
            patent_count = doc_counts[3] if isinstance(doc_counts[3], int) else 0
            book_prog_count = doc_counts[4] if isinstance(doc_counts[4], int) else 0
            book_count = doc_counts[5] if isinstance(doc_counts[5], int) else 0
            case_study_count = doc_counts[6] if isinstance(doc_counts[6], int) else 0
            letter_count = doc_counts[7] if isinstance(doc_counts[7], int) else 0
            
            total_docs = sum([niw_count, bp_count, patent_prog_count, patent_count,
                            book_prog_count, book_count, case_study_count, letter_count])
            
            client["documents_count"] = total_docs
            client["documents_by_type"] = {
                "niw": niw_count,
                "business_plans": bp_count,
                "patents": patent_prog_count + patent_count,
                "books": book_prog_count + book_count,
                "case_studies": case_study_count,
                "letters": letter_count
            }
        
        return {
            "clients": clients,
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if limit > 0 else 0
        }
    except Exception as e:
        logger.error(f"Error getting clients: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting clients: {str(e)}")


@router.get("/search")
async def search_clients(
    q: str = "",
    status: str = "active",
    page: int = 1,
    limit: int = 20,
    current_user = Depends(get_current_user_wrapper)
):
    """Search clients - ALL authenticated users see ALL clients (no role restriction)"""
    db = get_db()
    try:
        query = {"status": status}
        
        if q:
            query["$or"] = [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
                {"company": {"$regex": q, "$options": "i"}}
            ]
        
        skip = (page - 1) * limit
        
        clients = await db.clients.find(
            query,
            {"_id": 0}
        ).skip(skip).limit(limit).to_list(length=limit)
        
        for client in clients:
            try:
                client["documents_count"] = await get_client_documents_count(client.get("id", ""))
            except:
                client["documents_count"] = 0
        
        total = await db.clients.count_documents(query)
        
        return {
            "clients": clients,
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if limit > 0 else 0
        }
    except Exception as e:
        logger.error(f"Error searching clients: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching clients: {str(e)}")


@router.get("/{client_id}")
async def get_client(client_id: str, current_user = Depends(get_current_user_wrapper)):
    """Get client detail"""
    db = get_db()
    try:
        query = {"id": client_id}
        
        client = await db.clients.find_one(query, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return client
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting client: {str(e)}")


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    client_data: ClientInput,
    current_user = Depends(get_current_user_wrapper)
):
    """Update client"""
    db = get_db()
    try:
        query = {"id": client_id}
        
        client = await db.clients.find_one(query)
        
        update_dict = client_data.model_dump()
        update_dict.update({
            "search_text": search_text,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.id,
            "updated_by_name": current_user.full_name
        })
        
        # Don't allow changing operator_id
        if "operator_id" in update_dict:
            del update_dict["operator_id"]
        
        await db.clients.update_one(
            {"id": client_id},
            {"$set": update_dict}
        )
        
        # Activity log
        activity = {
            "id": str(uuid.uuid4()),
            "operator_id": current_user.id,
            "operator_name": current_user.full_name,
            "action": "client_updated",
            "entity_type": "client",
            "entity_id": client_id,
            "entity_name": client_data.name,
            "description": f"Actualizó información del cliente {client_data.name}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "client_id": client_id,
                "client_name": client_data.name
            }
        }
        await db.activity_logs.insert_one(activity)
        
        logger.info(f"Client updated: {client_id} by operator {current_user.id}")
        
        return {"message": "Cliente actualizado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating client: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating client: {str(e)}")


@router.delete("/{client_id}")
async def delete_client(client_id: str, current_user = Depends(get_current_user_wrapper)):
    """Delete client permanently"""
    db = get_db()
    try:
        query = {"id": client_id}
        
        result = await db.clients.delete_one(query)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Client not found")
        
        logger.info(f"Client deleted: {client_id} by operator {current_user.id}")
        
        return {"message": "Cliente eliminado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting client: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting client: {str(e)}")


@router.get("/{client_id}/stats")
async def get_client_stats(client_id: str, current_user = Depends(get_current_user_wrapper)):
    """Get client statistics"""
    db = get_db()
    try:
        query = {"id": client_id}
        
        client = await db.clients.find_one(query, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        stats = {
            "client": client,
            "niw_count": await db.niw_in_progress.count_documents({
                "client_id": client_id,
                "status": {"$nin": ["completed", "deleted"]}
            }),
            "niw_completed": await db.business_plans.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "patent_count": await db.patents_in_progress.count_documents({
                "client_id": client_id,
                "status": {"$nin": ["complete", "completed", "deleted"]}
            }),
            "patent_completed": (
                await db.patents.count_documents({
                    "client_id": client_id,
                    "status": {"$ne": "deleted"}
                }) +
                await db.patents_in_progress.count_documents({
                    "client_id": client_id,
                    "status": {"$in": ["complete", "completed"]}
                })
            ),
            "book_count": await db.books_in_progress.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "book_completed": await db.books.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "whitepaper_count": await db.whitepapers_in_progress.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "whitepaper_completed": await db.whitepapers.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "study_count": (
                await db.econometric_studies_in_progress.count_documents({
                    "client_id": client_id,
                    "status": {"$nin": ["deleted", "completed", "complete", None]}
                }) +
                await db.econometric_studies.count_documents({
                    "client_id": client_id,
                    "status": {"$nin": ["deleted", None]}
                })
            ),
            "design_count": await db.designed_documents.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "recommendation_letter_count": await db.recommendation_letters.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "expert_count": await db.expert_letters.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "selfpetition_count": await db.self_petition_letters.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "policypaper_count": await db.policy_papers.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "case_study_count": await db.case_studies.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "translation_count": await db.translations.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "certified_translation_count": await db.certified_translations.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            }),
            "intent_letter_count": await db.intent_letters.count_documents({
                "client_id": client_id,
                "status": {"$ne": "deleted"}
            })
        }
        
        stats["total_documents"] = (
            stats["niw_count"] + stats["niw_completed"] +
            stats["patent_count"] + stats["patent_completed"] +
            stats["book_count"] + stats["book_completed"] +
            stats["whitepaper_count"] + stats["whitepaper_completed"] +
            stats["study_count"] + stats["design_count"] +
            stats["recommendation_letter_count"] + stats["case_study_count"] +
            stats["policypaper_count"] +
            stats.get("expert_count", 0) +
            stats.get("selfpetition_count", 0) +
            stats.get("intent_letter_count", 0) +
            stats.get("translation_count", 0) +
            stats.get("certified_translation_count", 0)
        )
        
        return stats
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting client stats: {str(e)}")



@router.get("/{client_id}/documents-detail")
async def get_client_documents_with_authors(
    client_id: str,
    current_user = Depends(get_current_user_wrapper)
):
    """Get all documents for a client with author information"""
    db = get_db()
    try:
        # Get ONLY completed documents
        niw_docs = await db.niw_in_progress.find(
            {"client_id": client_id, "status": "completed"},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        bp_docs = await db.business_plans.find(
            {"client_id": client_id, "status": "completed"},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        patent_docs = await db.patents_in_progress.find(
            {"client_id": client_id, "status": "completed"},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        patent_completed = await db.patents.find(
            {"client_id": client_id},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        book_docs = await db.books_in_progress.find(
            {"client_id": client_id, "status": "completed"},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        book_completed = await db.books.find(
            {"client_id": client_id},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        case_study_docs = await db.case_studies.find(
            {"client_id": client_id, "status": "completed"},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        letter_docs = await db.self_petition_letters.find(
            {"client_id": client_id, "status": "completed"},
            {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1, "created_at": 1}
        ).to_list(length=1000)
        
        # Combine all documents with type
        all_docs = []
        
        for doc in niw_docs:
            doc['type'] = 'NIW'
            all_docs.append(doc)
        for doc in bp_docs:
            doc['type'] = 'Plan de Negocio'
            all_docs.append(doc)
        for doc in patent_docs + patent_completed:
            doc['type'] = 'Patente'
            all_docs.append(doc)
        for doc in book_docs + book_completed:
            doc['type'] = 'Libro'
            all_docs.append(doc)
        for doc in case_study_docs:
            doc['type'] = 'Caso de Estudio'
            all_docs.append(doc)
        for doc in letter_docs:
            doc['type'] = 'Carta de Auto-Petición'
            all_docs.append(doc)
        
        # Get unique user IDs
        user_ids = list(set([doc.get('user_id') for doc in all_docs if doc.get('user_id')]))
        
        # Get user information
        users = {}
        if user_ids:
            users_data = await db.users.find(
                {"id": {"$in": user_ids}},
                {"_id": 0, "id": 1, "full_name": 1, "email": 1}
            ).to_list(length=len(user_ids))
            users = {u['id']: u for u in users_data}
        
        # Add author info to each document
        for doc in all_docs:
            user_id = doc.get('user_id')
            if user_id and user_id in users:
                doc['created_by'] = {
                    'id': users[user_id]['id'],
                    'name': users[user_id].get('full_name', 'Usuario desconocido'),
                    'email': users[user_id].get('email', '')
                }
            else:
                doc['created_by'] = {
                    'id': user_id or 'unknown',
                    'name': 'Usuario desconocido',
                    'email': ''
                }
            
            # Normalize created_at to string
            if doc.get('created_at'):
                if hasattr(doc['created_at'], 'isoformat'):
                    doc['created_at'] = doc['created_at'].isoformat()
        
        # Sort by creation date (most recent first)
        def get_sort_key(doc):
            created_at = doc.get('created_at', '')
            if not created_at:
                return ''
            if isinstance(created_at, str):
                return created_at
            if hasattr(created_at, 'isoformat'):
                return created_at.isoformat()
            return ''
        
        all_docs.sort(key=get_sort_key, reverse=True)
        
        return {
            "documents": all_docs,
            "total": len(all_docs)
        }
    except Exception as e:
        logger.error(f"Error getting client documents detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting client documents detail: {str(e)}")
