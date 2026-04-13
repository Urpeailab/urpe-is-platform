"""Formatters for patent information"""

from typing import Dict, Any

def format_patent_info_for_niw(patent_data: Dict[str, Any]) -> str:
    """
    Format extracted patent data for the NIW project prompt.
    
    Args:
        patent_data: Dictionary with extracted patent information
        
    Returns:
        Formatted string ready to be inserted into NIW prompt
    """
    # Get values with defaults
    title = patent_data.get('patent_title', 'No especificado')
    number = patent_data.get('patent_number', patent_data.get('application_number', 'Pendiente/No asignado'))
    filing_date = patent_data.get('filing_date', 'No especificado')
    status = patent_data.get('patent_status', 'Solicitud')
    inventors = patent_data.get('inventors', 'No especificado')
    abstract = patent_data.get('abstract', 'No disponible')
    innovation = patent_data.get('key_innovation', 'Detallado en el documento de patente')
    
    template = '''**INFORMACIÓN DE PATENTE:**

**Título de la Patente:** {title}

**Número de Patente/Solicitud:** {number}

**Fecha de Presentación:** {filing_date}

**Estado:** {status}

**Inventor(es):** {inventors}

**Resumen/Abstract:**
{abstract}

**Innovación Clave:**
{innovation}

**Relevancia para el Proyecto Propuesto:**
Esta patente {status_article} {status_lower} demuestra el enfoque innovador del solicitante y establece protección de propiedad intelectual para la metodología propuesta, mejorando la replicabilidad e impacto nacional del proyecto.
'''
    
    # Determine article for status
    status_lower = status.lower()
    if status_lower in ['granted', 'otorgada', 'concedida']:
        status_article = ''
    elif status_lower in ['pending', 'pendiente']:
        status_article = 'solicitud'
    elif status_lower in ['published', 'publicada']:
        status_article = ''
    else:
        status_article = ''
    
    return template.format(
        title=title,
        number=number,
        filing_date=filing_date,
        status=status,
        status_lower=status_lower,
        status_article=status_article,
        inventors=inventors,
        abstract=abstract,
        innovation=innovation
    )

def format_patent_info_for_display(patent_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Format patent data for frontend display (editable preview).
    
    Args:
        patent_data: Dictionary with extracted patent information
        
    Returns:
        Dictionary with clean, display-ready values
    """
    return {
        'patent_title': patent_data.get('patent_title', ''),
        'patent_number': patent_data.get('patent_number', ''),
        'application_number': patent_data.get('application_number', ''),
        'filing_date': patent_data.get('filing_date', ''),
        'publication_date': patent_data.get('publication_date', ''),
        'patent_status': patent_data.get('patent_status', 'Application'),
        'inventors': patent_data.get('inventors', ''),
        'abstract': patent_data.get('abstract', ''),
        'key_innovation': patent_data.get('key_innovation', '')
    }
