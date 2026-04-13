"""Capa 6: Generador de salida descargable."""
from typing import Dict
from uscis_pipeline.esquemas import ResultadoRenderizado

def generar_salida(pdf_bytes: bytes, nombre_archivo: str, resultado: ResultadoRenderizado) -> Dict:
    return {"bytes": pdf_bytes, "filename": nombre_archivo, "content_type": "application/pdf", "size": len(pdf_bytes), "reporte": resultado.model_dump()}
