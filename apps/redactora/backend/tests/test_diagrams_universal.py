import sys
sys.path.insert(0, '/app/backend')

import pytest
from utils.svg_processor import UniversalSVGProcessor
from utils.svg_validator import SVGValidator
from utils.diagram_completeness_checker import DiagramCompletenessChecker

def test_block_diagram():
    """Test Block Diagram básico."""
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="700" height="600" viewBox="0 0 700 600">
      <text x="350" y="35" text-anchor="middle" font-size="18">FIG. 1 — Test</text>
      <rect x="100" y="100" width="180" height="90" fill="white" stroke="black" stroke-width="2"/>
      <text x="190" y="145" text-anchor="middle" font-size="15">Component (101)</text>
    </svg>'''
    
    validator = SVGValidator()
    result = validator.validate_svg(svg, 1)
    
    assert result['valid'], f"Errors: {result['errors']}"
    assert result['score'] >= 8.0, f"Score too low: {result['score']}"

def test_sequence_diagram_complete():
    """Test Sequence Diagram completo."""
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="700" height="600" viewBox="0 0 700 600">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="black"/>
        </marker>
      </defs>
      <text x="350" y="35" text-anchor="middle" font-size="18">FIG. 3 — Sequence</text>
      
      <!-- Lifelines -->
      <line x1="100" y1="85" x2="100" y2="500" stroke="#999" stroke-dasharray="5,5"/>
      <line x1="300" y1="85" x2="300" y2="500" stroke="#999" stroke-dasharray="5,5"/>
      
      <!-- Mensajes (DEBE TENER) -->
      <line x1="100" y1="120" x2="300" y2="120" stroke="black" stroke-width="2" marker-end="url(#arrowhead)"/>
      <text x="200" y="115" text-anchor="middle" font-size="11">1. Request</text>
      
      <line x1="300" y1="160" x2="100" y2="160" stroke="black" stroke-dasharray="4,4" marker-end="url(#arrowhead)"/>
      <text x="200" y="155" text-anchor="middle" font-size="11">2. Response</text>
      
      <line x1="100" y1="200" x2="300" y2="200" stroke="black" stroke-width="2" marker-end="url(#arrowhead)"/>
      <text x="200" y="195" text-anchor="middle" font-size="11">3. Another</text>
      
      <line x1="300" y1="240" x2="100" y2="240" stroke="black" stroke-dasharray="4,4" marker-end="url(#arrowhead)"/>
      <text x="200" y="235" text-anchor="middle" font-size="11">4. Final</text>
      
      <!-- Activación -->
      <rect x="295" y="120" width="10" height="60" fill="#e8e8e8" stroke="black"/>
    </svg>'''
    
    checker = DiagramCompletenessChecker()
    result = checker.validate_sequence_diagram(svg)
    
    assert result['valid'], f"Errors: {result['errors']}"
    assert result['num_messages'] >= 4, f"Too few messages: {result['num_messages']}"
    assert result['num_activations'] >= 1, f"No activations found"

def test_sequence_diagram_incomplete():
    """Test detecta Sequence Diagram incompleto."""
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="700" height="600">
      <text x="350" y="35" text-anchor="middle" font-size="18">FIG. 3 — Sequence</text>
      <line x1="100" y1="85" x2="100" y2="500" stroke="#999" stroke-dasharray="5,5"/>
      <line x1="300" y1="85" x2="300" y2="500" stroke="#999" stroke-dasharray="5,5"/>
      <!-- SIN MENSAJES HORIZONTALES -->
    </svg>'''
    
    checker = DiagramCompletenessChecker()
    result = checker.validate_sequence_diagram(svg)
    
    assert not result['valid'], "Debería detectar que está incompleto"
    assert any('mensaje' in e.lower() for e in result['errors']), "Debería mencionar mensajes faltantes"

def test_component_coverage():
    """Test que verifica cobertura de componentes."""
    patent_text = "comprising module (101), gateway (102), and store (103)"
    
    diagram_complete = '''```svg
<svg>...(101)...(102)...(103)...</svg>
```'''
    
    diagram_incomplete = '''```svg
<svg>...(101)...(102)...</svg>
```'''  # Falta (103)
    
    checker = DiagramCompletenessChecker()
    
    result_complete = checker.check_completeness(patent_text, diagram_complete)
    assert result_complete['complete'], "Debería ser completo"
    assert result_complete['coverage_percent'] == 100.0
    
    result_incomplete = checker.check_completeness(patent_text, diagram_incomplete)
    assert not result_incomplete['complete'], "Debería detectar componente faltante"
    assert '103' in result_incomplete['missing_in_diagrams']

def test_svg_processor_basic():
    """Test procesador SVG básico."""
    processor = UniversalSVGProcessor(max_width=532, max_height=700)
    
    test_svg = '''```svg
<svg xmlns='http://www.w3.org/2000/svg' width='700' height='500' viewBox='0 0 700 500'>
  <text x='350' y='35' text-anchor='middle' font-size='18'>TEST</text>
  <rect x='100' y='100' width='180' height='80' fill='white' stroke='black' stroke-width='2'/>
</svg>
```'''
    
    blocks = processor.extract_svg_blocks(test_svg)
    assert len(blocks) > 0, "Debería extraer al menos 1 bloque"
    
    drawing = processor.svg_to_drawing(blocks[0])
    assert drawing is not None, "Debería crear Drawing"
    assert drawing.width > 0 and drawing.height > 0

def test_invalid_width():
    """Test detecta width incorrecto."""
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <text x="400" y="35">FIG. 1</text>
    </svg>'''
    
    validator = SVGValidator()
    result = validator.validate_svg(svg, 1)
    
    assert not result['valid'], "Debería detectar width incorrecto"
    assert any('width' in e.lower() for e in result['errors'])

def test_missing_xmlns():
    """Test detecta xmlns faltante."""
    svg = '''<svg width="700" height="600">
      <text x="350" y="35">FIG. 1</text>
    </svg>'''
    
    validator = SVGValidator()
    result = validator.validate_svg(svg, 1)
    
    assert not result['valid'], "Debería detectar xmlns faltante"
    assert any('xmlns' in e.lower() for e in result['errors'])

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
