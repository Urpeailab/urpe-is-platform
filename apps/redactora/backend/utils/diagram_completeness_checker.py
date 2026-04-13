import re
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class DiagramCompletenessChecker:
    """Verifica que todos los componentes mencionados en texto estén en diagramas."""
    
    def extract_references_from_text(self, patent_text: str) -> List[str]:
        """Extrae todos los números de referencia del texto."""
        pattern = r'\((\d{3,4})\)'
        refs = re.findall(pattern, patent_text)
        unique_refs = sorted(set(refs))
        logger.info(f"Referencias encontradas en texto: {unique_refs}")
        return unique_refs
    
    def extract_references_from_svgs(self, diagram_content: str) -> List[str]:
        """Extrae todos los números de referencia de los SVGs."""
        pattern = r'\((\d{3,4})\)'
        refs = re.findall(pattern, diagram_content)
        unique_refs = sorted(set(refs))
        logger.info(f"Referencias encontradas en SVGs: {unique_refs}")
        return unique_refs
    
    def check_completeness(self, patent_text: str, diagram_content: str) -> Dict:
        """Verifica que todos los componentes del texto estén en diagramas."""
        text_refs = set(self.extract_references_from_text(patent_text))
        svg_refs = set(self.extract_references_from_svgs(diagram_content))
        
        missing = text_refs - svg_refs
        extra = svg_refs - text_refs
        
        result = {
            'complete': len(missing) == 0,
            'text_refs': sorted(text_refs),
            'svg_refs': sorted(svg_refs),
            'missing_in_diagrams': sorted(missing),
            'extra_in_diagrams': sorted(extra),
            'coverage_percent': (len(svg_refs & text_refs) / len(text_refs) * 100) if text_refs else 100
        }
        
        # Logging
        if missing:
            logger.warning(f"⚠ Componentes mencionados en texto pero NO en diagramas: {missing}")
        if extra:
            logger.info(f"ℹ Componentes en diagramas pero no mencionados en texto: {extra}")
        
        logger.info(f"Cobertura de diagramas: {result['coverage_percent']:.1f}%")
        
        return result
    
    def validate_sequence_diagram(self, svg_content: str) -> Dict:
        """Validación específica para Sequence Diagrams."""
        errors = []
        
        # Debe tener lifelines (líneas verticales)
        if 'stroke-dasharray' not in svg_content:
            errors.append('Sequence diagram sin lifelines punteadas')
        
        # Debe tener flechas horizontales (line con y1=y2)
        lines = re.findall(r'<line[^>]+y1=["\']?(\d+)[^>]+y2=["\']?(\d+)', svg_content)
        horizontal_lines = [l for l in lines if l[0] == l[1]]
        
        if len(horizontal_lines) < 4:
            errors.append(f'Sequence diagram tiene solo {len(horizontal_lines)} mensajes (mínimo 4)')
        
        # Debe tener markers para flechas
        if horizontal_lines and 'marker-end=' not in svg_content:
            errors.append('Flechas sin markers (sin puntas)')
        
        # Debe tener activaciones (rects pequeños)
        small_rects = re.findall(r'<rect[^>]+width=["\']?(\d+)', svg_content)
        activation_rects = [r for r in small_rects if int(r) <= 15]
        
        if len(activation_rects) == 0:
            errors.append('Sequence diagram sin rectángulos de activación')
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'num_messages': len(horizontal_lines),
            'num_activations': len(activation_rects)
        }


def validate_patent_diagrams(patent_text: str, diagram_content: str) -> Dict:
    """Función principal de validación."""
    checker = DiagramCompletenessChecker()
    
    # Validar completitud general
    completeness = checker.check_completeness(patent_text, diagram_content)
    
    # Validar Sequence Diagrams específicamente
    svg_blocks = re.findall(r'```svg\s*\n(.*?)\n```', diagram_content, re.DOTALL)
    sequence_validations = []
    
    for idx, svg in enumerate(svg_blocks, 1):
        if 'sequence' in svg.lower() or 'FIG. 3' in svg:
            seq_result = checker.validate_sequence_diagram(svg)
            seq_result['fig_number'] = idx
            sequence_validations.append(seq_result)
            
            if not seq_result['valid']:
                logger.error(f"✗ FIG. {idx} (Sequence) inválida:")
                for err in seq_result['errors']:
                    logger.error(f"  - {err}")
    
    return {
        'completeness': completeness,
        'sequence_validations': sequence_validations,
        'overall_valid': completeness['complete'] and all(sv['valid'] for sv in sequence_validations)
    }
