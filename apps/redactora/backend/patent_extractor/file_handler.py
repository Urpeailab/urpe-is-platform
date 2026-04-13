"""File upload handler and text extraction"""

import io
import logging
import pdfplumber
import docx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """
    Extract text from uploaded document - FAST extraction without AI
    Supports: .pdf, .docx, .doc, .txt
    
    Args:
        file_content: File bytes
        filename: Original filename
        
    Returns:
        Extracted text as string
    """
    try:
        filename_lower = filename.lower()
        
        if filename_lower.endswith(('.docx', '.doc')):
            return _extract_from_docx(file_content)
        elif filename_lower.endswith('.pdf'):
            return _extract_from_pdf(file_content)
        elif filename_lower.endswith('.txt'):
            return _extract_from_txt(file_content)
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato no soportado. Use PDF, DOCX o TXT"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar archivo: {str(e)}"
        )

def _extract_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF using pdfplumber (faster and more accurate)"""
    try:
        text_parts = []
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text and text.strip():
                    text_parts.append(text)
        
        if not text_parts:
            raise ValueError("No se pudo extraer texto del PDF")
            
        return '\n\n'.join(text_parts)
    except Exception as e:
        logger.error(f"Error in PDF extraction: {e}")
        raise ValueError(f"Error al leer PDF: {str(e)}")

def _extract_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX"""
    try:
        doc = docx.Document(io.BytesIO(file_content))
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        
        if not paragraphs:
            raise ValueError("El documento DOCX está vacío")
            
        return '\n\n'.join(paragraphs)
    except Exception as e:
        logger.error(f"Error in DOCX extraction: {e}")
        raise ValueError(f"Error al leer DOCX: {str(e)}")

def _extract_from_txt(file_content: bytes) -> str:
    """Extract text from TXT"""
    try:
        text = file_content.decode('utf-8')
        if not text.strip():
            raise ValueError("El archivo TXT está vacío")
        return text
    except UnicodeDecodeError:
        try:
            text = file_content.decode('latin-1')
            if not text.strip():
                raise ValueError("El archivo TXT está vacío")
            return text
        except Exception as e:
            logger.error(f"Error in TXT extraction: {e}")
            raise ValueError(f"Error al leer TXT: {str(e)}")
