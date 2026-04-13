import re
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

class SVGValidator:
    """Validador automático de SVG para asegurar calidad USPTO."""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
    
    def validate_svg(self, svg_content: str, fig_number: int) -> Dict:
        """Valida un SVG completo."""
        self.errors = []
        self.warnings = []
        
        # Validaciones críticas
        self._check_xmlns(svg_content)
        self._check_dimensions(svg_content)
        self._check_viewbox(svg_content)
        self._check_title(svg_content, fig_number)
        self._check_markers(svg_content)
        self._check_font_sizes(svg_content)
        self._check_completeness(svg_content)
        
        return {
            'valid': len(self.errors) == 0,
            'errors': self.errors,
            'warnings': self.warnings,
            'score': self._calculate_score()
        }
    
    def _check_xmlns(self, svg: str):
        if 'xmlns=' not in svg:
            self.errors.append('Missing xmlns attribute')
    
    def _check_dimensions(self, svg: str):
        width_match = re.search(r'width=["\']?(\d+)', svg)
        if not width_match:
            self.errors.append('Missing width attribute')
        elif int(width_match.group(1)) != 700:
            self.errors.append(f'Invalid width: {width_match.group(1)} (must be 700)')
        
        height_match = re.search(r'height=["\']?(\d+)', svg)
        if not height_match:
            self.errors.append('Missing height attribute')
        else:
            height = int(height_match.group(1))
            if height < 500 or height > 900:
                self.warnings.append(f'Height {height} outside recommended range (500-900)')
    
    def _check_viewbox(self, svg: str):
        if 'viewBox=' not in svg:
            self.warnings.append('Missing viewBox (recommended for scaling)')
    
    def _check_title(self, svg: str, fig_number: int):
        if f'FIG. {fig_number}' not in svg and f'FIG.{fig_number}' not in svg:
            self.warnings.append(f'Title should include FIG. {fig_number}')
    
    def _check_markers(self, svg: str):
        has_lines = '<line' in svg
        has_markers = '<marker' in svg or 'marker-end=' in svg
        
        if has_lines and not has_markers:
            self.warnings.append('Lines present but no arrow markers defined')
    
    def _check_font_sizes(self, svg: str):
        font_sizes = re.findall(r'font-size=["\']?(\d+)', svg)
        for size in font_sizes:
            if int(size) < 11:
                self.warnings.append(f'Font size {size}px too small (minimum 11px)')
    
    def _check_completeness(self, svg: str):
        """Verifica que diagrama esté completo."""
        # Sequence diagrams deben tener flechas
        if 'sequence' in svg.lower() or 'interaction' in svg.lower():
            num_lines = svg.count('<line')
            if num_lines < 4:
                self.errors.append(f'Sequence diagram incomplete: only {num_lines} messages (expected ≥4)')
        
        # Block diagrams deben tener componentes
        num_rects = svg.count('<rect')
        if num_rects < 2:
            self.warnings.append(f'Diagram has only {num_rects} components (seems incomplete)')
    
    def _calculate_score(self) -> float:
        """Calcula score 0-10."""
        score = 10.0
        score -= len(self.errors) * 2.0  # -2 por cada error
        score -= len(self.warnings) * 0.5  # -0.5 por cada warning
        return max(0.0, score)


def validate_all_diagrams(diagram_content: str) -> List[Dict]:
    """Valida todos los diagramas en el contenido."""
    validator = SVGValidator()
    results = []
    
    # Extraer bloques SVG
    pattern = r'```svg\s*\n(.*?)\n```'
    svgs = re.findall(pattern, diagram_content, re.DOTALL | re.IGNORECASE)
    
    for idx, svg in enumerate(svgs, 1):
        result = validator.validate_svg(svg, idx)
        result['fig_number'] = idx
        results.append(result)
        
        # Log resultado
        if result['valid']:
            logger.info(f"✓ FIG. {idx} válida (score: {result['score']:.1f}/10)")
        else:
            logger.error(f"✗ FIG. {idx} inválida:")
            for error in result['errors']:
                logger.error(f"  - {error}")
        
        for warning in result['warnings']:
            logger.warning(f"  ⚠ {warning}")
    
    # Validar cantidad total
    if len(svgs) < 4:
        logger.warning(f"⚠ Solo {len(svgs)} diagramas generados (recomendado: 5-6)")
    elif len(svgs) > 7:
        logger.warning(f"⚠ Demasiados diagramas: {len(svgs)} (máximo recomendado: 6)")
    
    return results
