"""Módulo de Impresión — organiza entregables de un caso y genera el PDF maestro.

Fase 1: CRUD del layout (árbol de secciones/subsecciones) + subida de la imagen
de marca por cliente. La generación del PDF maestro se agrega en Fase 2.

Datastore: Supabase Postgres, tabla `visa_print_layouts` (migración 019).
Un layout por caso; se siembra desde la plantilla base la primera vez que se abre.
"""

import asyncio
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Header, UploadFile, File

from config import logger
from db.supabase_client import select, insert, update
from utils.auth_helpers import verify_staff_token_impl
from storage_service import upload_file as supabase_upload
from visa_print_models import PrintLayoutUpdate, default_print_template
from services.print_master import generate_master_pdf

router = APIRouter(prefix="/admin/visa-cases", tags=["Admin Print Layout"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_case(case_id: str) -> dict:
    case = select("visa_cases", filters={"id": case_id}, single=True)
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return case


def _get_or_create_layout(case_id: str) -> dict:
    layout = select("visa_print_layouts", filters={"case_id": case_id}, single=True)
    if layout:
        return layout
    created = insert(
        "visa_print_layouts",
        {
            "case_id": case_id,
            "sections": default_print_template(),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        },
    )
    return created


@router.get("/{case_id}/print-layout")
async def get_print_layout(case_id: str, authorization: Annotated[str, Header()]):
    """Devuelve el layout de impresión del caso (lo crea desde plantilla si no existe)."""
    try:
        verify_staff_token_impl(authorization)
        _ensure_case(case_id)
        layout = _get_or_create_layout(case_id)
        return {
            "id": layout.get("id"),
            "caseId": case_id,
            "sections": layout.get("sections") or [],
            "brandingImageUrl": layout.get("brandingImageUrl"),
            "brandingClientName": layout.get("brandingClientName"),
            "brandingAddress": layout.get("brandingAddress"),
            "master": layout.get("master"),
            "updatedAt": layout.get("updatedAt"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[print_layout] get error case={case_id}: {e}")
        raise HTTPException(status_code=500, detail="Error obteniendo el layout de impresión")


@router.put("/{case_id}/print-layout")
async def update_print_layout(
    case_id: str,
    body: PrintLayoutUpdate,
    authorization: Annotated[str, Header()],
):
    """Guarda el árbol de secciones (tras drag&drop) y los textos de portada."""
    try:
        verify_staff_token_impl(authorization)
        _ensure_case(case_id)
        _get_or_create_layout(case_id)  # garantiza que la fila exista

        data = {
            "sections": [s.model_dump() for s in body.sections],
            "updated_at": _now_iso(),
        }
        if body.brandingClientName is not None:
            data["branding_client_name"] = body.brandingClientName
        if body.brandingAddress is not None:
            data["branding_address"] = body.brandingAddress

        update("visa_print_layouts", filters={"case_id": case_id}, data=data)
        return {"success": True, "sections": data["sections"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[print_layout] update error case={case_id}: {e}")
        raise HTTPException(status_code=500, detail="Error guardando el layout de impresión")


@router.post("/{case_id}/print-layout/branding")
async def upload_branding_image(
    case_id: str,
    authorization: Annotated[str, Header()],
    file: UploadFile = File(...),
):
    """Sube la imagen de marca del cliente (va en portada, índice y separadoras)."""
    try:
        verify_staff_token_impl(authorization)
        _ensure_case(case_id)
        _get_or_create_layout(case_id)

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Archivo vacío")

        result = supabase_upload(
            file_content=content,
            filename=file.filename or "branding.png",
            folder="print-branding",
        )
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Error subiendo imagen: {result.get('error', 'desconocido')}",
            )

        update(
            "visa_print_layouts",
            filters={"case_id": case_id},
            data={
                "branding_image_url": result["fileUrl"],
                "branding_image_path": result["filePath"],
                "updated_at": _now_iso(),
            },
        )
        return {"success": True, "brandingImageUrl": result["fileUrl"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[print_layout] branding upload error case={case_id}: {e}")
        raise HTTPException(status_code=500, detail="Error subiendo la imagen de marca")


@router.post("/{case_id}/print-layout/generate")
async def generate_master(case_id: str, authorization: Annotated[str, Header()]):
    """Genera el PDF maestro (portada + índice + separadoras + documentos)."""
    try:
        verify_staff_token_impl(authorization)
        _ensure_case(case_id)
        # La generación es bloqueante (descargas + LibreOffice) → a un thread.
        master = await asyncio.to_thread(generate_master_pdf, case_id)
        return {"success": True, "master": master}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[print_layout] generate error case={case_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando el PDF maestro: {e}")
