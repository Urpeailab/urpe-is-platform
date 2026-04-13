from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg
from reportlab.platypus import Spacer, Table, KeepInFrame
from reportlab.lib import colors
from io import BytesIO
import re
import logging

logger = logging.getLogger(__name__)

class UniversalSVGProcessor:
    """
    Procesador universal de diagramas SVG para patentes USPTO.
    Funciona para cualquier campo técnico.
    """
    
    def __init__(self, max_width=532, max_height=700):
        """
        Args:
            max_width: Ancho máximo en puntos (US Letter con márgenes = 532pt)
            max_height: Alto máximo en puntos
        """
        self.max_width = max_width
        self.max_height = max_height
    
    def extract_svg_blocks(self, content):
        """
        Extrae todos los bloques SVG del contenido generado por GPT-4o.
        Funciona con múltiples formatos.
        """
        svg_blocks = []
        
        # Patrón 1: SVG en bloques markdown ```svg
        pattern1 = r'```svg\s*\n(.*?)\n```'
        matches = re.findall(pattern1, content, re.DOTALL | re.IGNORECASE)
        svg_blocks.extend(matches)
        
        # Patrón 2: SVG directo sin backticks
        if not svg_blocks:
            pattern2 = r'(<svg[^>]*>.*?</svg>)'
            matches = re.findall(pattern2, content, re.DOTALL | re.IGNORECASE)
            svg_blocks.extend(matches)
        
        logger.info(f"Bloques SVG encontrados: {len(svg_blocks)}")
        return svg_blocks
    
    def normalize_svg(self, svg_content):
        """
        Normaliza el SVG para asegurar compatibilidad.
        """
        svg_content = svg_content.strip()
        
        # Agregar xmlns si falta
        if 'xmlns=' not in svg_content:
            svg_content = svg_content.replace(
                '<svg',
                '<svg xmlns="http://www.w3.org/2000/svg"',
                1
            )
            logger.debug("xmlns agregado al SVG")
        
        return svg_content
    
    def svg_to_drawing(self, svg_content):
        """
        Convierte SVG string a ReportLab Drawing vectorial.
        """
        try:
            svg_content = self.normalize_svg(svg_content)
            svg_bytes = BytesIO(svg_content.encode('utf-8'))
            
            # Conversión directa SVG → Drawing (vectorial, no raster)
            drawing = svg2rlg(svg_bytes)
            
            if not drawing:
                logger.error("svg2rlg retornó None")
                return None
            
            # Escalar si excede límites
            scale_factor = 1.0
            
            if drawing.width > self.max_width:
                scale_factor = self.max_width / drawing.width
                logger.info(f"Escalando por ancho: {scale_factor:.2f}x")
            
            if drawing.height > self.max_height:
                height_scale = self.max_height / drawing.height
                scale_factor = min(scale_factor, height_scale)
                logger.info(f"Escalando por altura: {scale_factor:.2f}x")
            
            if scale_factor < 1.0:
                drawing.width = drawing.width * scale_factor
                drawing.height = drawing.height * scale_factor
                drawing.scale(scale_factor, scale_factor)
            
            logger.info(f"Drawing creado: {drawing.width:.0f}×{drawing.height:.0f}pt")
            return drawing
            
        except Exception as e:
            logger.error(f"Error en svg_to_drawing: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return None
    
    def center_drawing(self, drawing):
        """
        Centra un Drawing horizontalmente usando Table.
        Método más robusto que KeepInFrame.
        """
        if not drawing:
            return None
        
        try:
            # Crear tabla de 1 celda para centrado
            table = Table(
                [[drawing]],
                colWidths=[self.max_width],
                rowHeights=[drawing.height + 20]  # +20 para espaciado
            )
            
            # Estilo para centrado
            table.setStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ])
            
            logger.debug("Drawing centrado en tabla")
            return table
            
        except Exception as e:
            logger.error(f"Error en center_drawing: {e}")
            return drawing  # Retornar sin centrar si falla
    
    def process_diagrams(self, content):
        """
        Procesa todo el contenido y retorna lista de elementos para PDF.
        """
        elements = []
        
        svg_blocks = self.extract_svg_blocks(content)
        
        if not svg_blocks:
            logger.warning("No se encontraron bloques SVG")
            return elements
        
        for idx, svg_content in enumerate(svg_blocks, 1):
            logger.info(f"Procesando diagrama {idx}/{len(svg_blocks)}")
            
            # Convertir SVG a Drawing
            drawing = self.svg_to_drawing(svg_content)
            
            if drawing:
                # Centrar Drawing
                centered = self.center_drawing(drawing)
                
                # Agregar espaciado y elemento
                elements.append(Spacer(1, 20))
                elements.append(centered)
                elements.append(Spacer(1, 30))
                
                logger.info(f"✓ Diagrama {idx} agregado exitosamente")
            else:
                logger.error(f"✗ No se pudo procesar diagrama {idx}")
        
        logger.info(f"Total elementos generados: {len(elements)}")
        return elements


# Función helper para usar en el generador de PDF
def process_patent_diagrams(diagram_content, max_width=532, max_height=700):
    """
    Función wrapper para procesar diagramas de cualquier patente.
    
    Args:
        diagram_content (str): Contenido con diagramas SVG de GPT-4o
        max_width (int): Ancho máximo en puntos
        max_height (int): Alto máximo en puntos
    
    Returns:
        list: Elementos ReportLab listos para agregar al PDF
    """
    processor = UniversalSVGProcessor(max_width, max_height)
    return processor.process_diagrams(diagram_content)
