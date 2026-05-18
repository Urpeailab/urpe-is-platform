"""Main orchestrator for patent document processing"""

import logging
from typing import Dict, Any
from .file_handler import extract_text_from_file
from .fast_extractor import fast_extract_patent_info
from .intelligent_extractor import intelligent_extract_patent_info
from .formatters import format_patent_info_for_niw, format_patent_info_for_display

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 50  # Use intelligent extraction if below this %

async def process_patent_document(file_content: bytes, filename: str) -> Dict[str, Any]:
    """
    Main orchestrator for processing patent documents.
    
    Flow:
    1. Extract text from file (fast, no AI)
    2. Try fast extraction with regex (1-3 seconds)
    3. If confidence < threshold, use intelligent extraction with GPT (5-8 seconds)
    4. Format results for NIW prompt and frontend display
    
    Args:
        file_content: Uploaded file bytes
        filename: Original filename
        
    Returns:
        Dictionary with:
        - success: bool
        - extraction_method: str
        - confidence: float
        - patent_info: dict (for display/editing)
        - formatted_for_niw: str (ready for prompt)
        - error: str (if failed)
    """
    try:
        logger.info(f"Processing patent document: {filename}")
        
        # Step 1: Extract text
        logger.info("Step 1: Extracting text from file...")
        text = extract_text_from_file(file_content, filename)
        
        if not text or len(text) < 100:
            return {
                'success': False,
                'error': 'No se pudo extraer suficiente texto del documento. El archivo puede estar vacío o corrupto.'
            }
        
        logger.info(f"Extracted {len(text)} characters")
        
        # Step 2: Fast extraction
        logger.info("Step 2: Attempting fast extraction with regex...")
        fast_result = fast_extract_patent_info(text)
        
        logger.info(f"Fast extraction confidence: {fast_result['confidence']:.1f}%")
        
        # Step 3: Decide if we need intelligent extraction
        if fast_result['confidence'] >= CONFIDENCE_THRESHOLD:
            logger.info("✅ Fast extraction sufficient, using these results")
            final_result = fast_result
        else:
            logger.info("⚠️ Fast extraction confidence too low, falling back to GPT...")
            intelligent_result = await intelligent_extract_patent_info(text)
            
            # Merge results - prefer intelligent results but keep fast results as fallback
            if intelligent_result['confidence'] > fast_result['confidence']:
                final_result = intelligent_result
            else:
                # If GPT also failed, keep fast extraction results
                final_result = fast_result
        
        # Check if we have any data
        if not final_result.get('data'):
            return {
                'success': False,
                'error': 'No se pudo extraer información estructurada del documento. Por favor, ingrese la información manualmente.'
            }
        
        # Step 4: Format results
        logger.info("Step 4: Formatting results...")
        patent_data = final_result['data']
        
        formatted_for_niw = format_patent_info_for_niw(patent_data)
        display_data = format_patent_info_for_display(patent_data)
        
        logger.info("✅ Patent document processing completed successfully")
        
        return {
            'success': True,
            'extraction_method': final_result['method'],
            'confidence': final_result['confidence'],
            'patent_info': display_data,
            'formatted_for_niw': formatted_for_niw,
            'raw_text': text,
            'extracted_text_length': len(text)
        }
        
    except Exception as e:
        logger.error(f"Error processing patent document: {e}", exc_info=True)
        return {
            'success': False,
            'error': f'Error al procesar el documento: {str(e)}'
        }
