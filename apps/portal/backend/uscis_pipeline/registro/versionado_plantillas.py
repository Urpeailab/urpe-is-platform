"""Registro: versionado de plantillas USCIS."""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)

def calcular_hash_pdf(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()

async def registrar_plantilla(db, template_id: str, codigo_formulario: str, pdf_bytes: bytes, instrucciones_bytes: bytes = None, edicion: str = None, version_prompt: str = "v2", version_modelo: str = "gemini-2.0-flash") -> Dict:
    pdf_hash = calcular_hash_pdf(pdf_bytes)
    instr_hash = calcular_hash_pdf(instrucciones_bytes) if instrucciones_bytes else None
    existente = await db.uscis_template_registry.find_one({"form_code": codigo_formulario, "pdf_hash": pdf_hash})
    if existente:
        return {"status": "exists", "existing_id": existente.get("template_id")}
    previo = await db.uscis_template_registry.find_one({"form_code": codigo_formulario}, sort=[("registered_at", -1)])
    es_nueva_edicion = previo is not None and previo.get("pdf_hash") != pdf_hash
    entrada = {"template_id": template_id, "form_code": codigo_formulario, "edition": edicion or datetime.now(timezone.utc).strftime("%Y-%m"), "pdf_hash": pdf_hash, "instructions_hash": instr_hash, "pdf_size": len(pdf_bytes), "is_new_edition": es_nueva_edicion, "previous_template_id": previo.get("template_id") if previo else None, "status": "active", "version_prompt": version_prompt, "version_modelo": version_modelo, "version_extractor": "pypdf+pymupdf", "registered_at": datetime.now(timezone.utc).isoformat()}
    await db.uscis_template_registry.insert_one(entrada)
    if es_nueva_edicion and previo:
        await db.uscis_template_registry.update_one({"template_id": previo["template_id"]}, {"$set": {"status": "superseded", "superseded_by": template_id}})
        logger.warning(f"Registro: NUEVA EDICIÓN de {codigo_formulario}")
    logger.info(f"Registro: {codigo_formulario} (edición: {entrada['edition']})")
    return {"status": "registered", "is_new_edition": es_nueva_edicion}
