"""
Patent Diagram Generator - Programmatic SVG Generation
Generates professional USPTO-compliant patent diagrams using svgwrite library
for precise control over layout, text wrapping, and connections.
"""

import svgwrite
from svgwrite import cm, mm
import re
import logging
from typing import List, Dict, Tuple, Optional
import textwrap


class PatentDiagramGenerator:
    """Generate USPTO-compliant patent diagrams programmatically"""
    
    # Standard dimensions
    SVG_WIDTH = 700
    SVG_HEIGHT = 600
    MARGIN_TOP = 60
    MARGIN_SIDE = 40
    MARGIN_BOTTOM = 40
    
    # Component box dimensions
    BOX_MIN_WIDTH = 240
    BOX_MIN_HEIGHT = 130
    BOX_PADDING = 15
    
    # Text styling
    TITLE_FONT_SIZE = 18
    LABEL_FONT_SIZE = 14
    REF_NUM_FONT_SIZE = 12
    
    def __init__(self):
        self.components = []
        self.connections = []
        
    def wrap_text(self, text: str, max_chars: int = 20) -> List[str]:
        """Wrap text into multiple lines"""
        if len(text) <= max_chars:
            return [text]
        
        # Try to break at word boundaries
        words = text.split()
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            if current_length + len(word) + 1 <= max_chars:
                current_line.append(word)
                current_length += len(word) + 1
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]
                current_length = len(word)
        
        if current_line:
            lines.append(' '.join(current_line))
        
        return lines
    
    def create_component_box(self, dwg, x: float, y: float, width: float, height: float,
                            label: str, ref_num: str, lines: Optional[List[str]] = None) -> svgwrite.container.Group:
        """Create a component box with properly wrapped text"""
        group = dwg.g()
        
        # Draw rectangle
        group.add(dwg.rect(
            insert=(x, y),
            size=(width, height),
            fill='white',
            stroke='black',
            stroke_width=2,
            rx=10
        ))
        
        # Calculate text position (centered)
        text_x = x + width / 2
        
        # Wrap label text
        if lines is None:
            lines = self.wrap_text(label, max_chars=18)
        
        # Calculate starting Y position for centered text
        line_height = 18
        total_text_height = len(lines) * line_height + 25  # +25 for ref number
        text_start_y = y + (height - total_text_height) / 2 + line_height
        
        # Add label lines
        for i, line in enumerate(lines):
            group.add(dwg.text(
                line,
                insert=(text_x, text_start_y + i * line_height),
                text_anchor='middle',
                font_size=self.LABEL_FONT_SIZE,
                font_weight='500',
                font_family='Times New Roman, serif'
            ))
        
        # Add reference number
        ref_y = text_start_y + len(lines) * line_height + 20
        group.add(dwg.text(
            f'({ref_num})',
            insert=(text_x, ref_y),
            text_anchor='middle',
            font_size=self.REF_NUM_FONT_SIZE,
            fill='#666',
            font_family='Times New Roman, serif'
        ))
        
        return group
    
    def create_arrow(self, dwg, x1: float, y1: float, x2: float, y2: float,
                    label: str = '', bidirectional: bool = False) -> svgwrite.container.Group:
        """Create an arrow with optional label"""
        group = dwg.g()
        
        # Add line
        group.add(dwg.line(
            start=(x1, y1),
            end=(x2, y2),
            stroke='black',
            stroke_width=2,
            marker_end='url(#arrowhead)'
        ))
        
        # Add bidirectional arrow if needed
        if bidirectional:
            group.add(dwg.line(
                start=(x2, y2),
                end=(x1, y1),
                stroke='black',
                stroke_width=2,
                marker_end='url(#arrowhead)'
            ))
        
        # Add label in the middle
        if label:
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2 - 5
            group.add(dwg.text(
                label,
                insert=(mid_x, mid_y),
                text_anchor='middle',
                font_size=11,
                font_family='Times New Roman, serif'
            ))
        
        return group
    
    def add_arrow_marker(self, dwg):
        """Add arrow marker definition to SVG"""
        marker = dwg.marker(
            id='arrowhead',
            markerWidth=10,
            markerHeight=10,
            refX=9,
            refY=3,
            orient='auto'
        )
        marker.add(dwg.polygon(
            points=[(0, 0), (10, 3), (0, 6)],
            fill='black'
        ))
        dwg.defs.add(marker)
    
    def generate_system_architecture(self, components: List[Dict], title: str = "System Architecture Overview") -> str:
        """Generate FIG. 1 - System Architecture Block Diagram"""
        dwg = svgwrite.Drawing(size=(self.SVG_WIDTH, self.SVG_HEIGHT))
        self.add_arrow_marker(dwg)
        
        # Add title
        dwg.add(dwg.text(
            f'FIG. 1 — {title}',
            insert=(self.SVG_WIDTH / 2, 35),
            text_anchor='middle',
            font_size=self.TITLE_FONT_SIZE,
            font_weight='600',
            font_family='Times New Roman, serif'
        ))
        
        # Layout components in a grid (3 columns max)
        cols = min(3, len(components))
        rows = (len(components) + cols - 1) // cols
        
        box_width = (self.SVG_WIDTH - 2 * self.MARGIN_SIDE - (cols - 1) * 60) / cols
        box_width = max(box_width, self.BOX_MIN_WIDTH)
        box_height = self.BOX_MIN_HEIGHT
        
        spacing_x = 60
        spacing_y = 160
        
        start_x = self.MARGIN_SIDE
        start_y = self.MARGIN_TOP + 60
        
        positions = []
        
        for i, comp in enumerate(components[:9]):  # Max 9 components for clean layout
            row = i // cols
            col = i % cols
            
            x = start_x + col * (box_width + spacing_x)
            y = start_y + row * spacing_y
            
            box = self.create_component_box(
                dwg, x, y, box_width, box_height,
                comp['name'], comp['ref_num']
            )
            dwg.add(box)
            
            positions.append({
                'x': x,
                'y': y,
                'width': box_width,
                'height': box_height,
                'center_x': x + box_width / 2,
                'center_y': y + box_height / 2
            })
        
        # Add connections (vertical between rows)
        for i in range(len(positions) - cols):
            if i + cols < len(positions):
                # Connect vertically
                arrow = self.create_arrow(
                    dwg,
                    positions[i]['center_x'],
                    positions[i]['y'] + positions[i]['height'],
                    positions[i + cols]['center_x'],
                    positions[i + cols]['y']
                )
                dwg.add(arrow)
        
        return dwg.tostring()
    
    def generate_flowchart(self, steps: List[Dict], title: str = "Process Flow") -> str:
        """Generate FIG. 3 - Process Flowchart"""
        height = max(700, 150 + len(steps) * 140)
        dwg = svgwrite.Drawing(size=(self.SVG_WIDTH, height))
        self.add_arrow_marker(dwg)
        
        # Add title
        dwg.add(dwg.text(
            f'FIG. 3 — {title}',
            insert=(self.SVG_WIDTH / 2, 35),
            text_anchor='middle',
            font_size=self.TITLE_FONT_SIZE,
            font_weight='600',
            font_family='Times New Roman, serif'
        ))
        
        box_width = 280
        box_height = 100
        center_x = self.SVG_WIDTH / 2 - box_width / 2
        start_y = 100
        spacing = 140
        
        positions = []
        
        for i, step in enumerate(steps):
            y = start_y + i * spacing
            
            # Determine shape (diamond for decisions, rectangle for processes)
            is_decision = 'decision' in step.get('type', '').lower() or '?' in step['name']
            
            if is_decision:
                # Create diamond shape
                points = [
                    (center_x + box_width / 2, y),  # top
                    (center_x + box_width, y + box_height / 2),  # right
                    (center_x + box_width / 2, y + box_height),  # bottom
                    (center_x, y + box_height / 2)  # left
                ]
                dwg.add(dwg.polygon(
                    points=points,
                    fill='white',
                    stroke='black',
                    stroke_width=2
                ))
                
                # Add text
                lines = self.wrap_text(step['name'], max_chars=22)
                text_y = y + box_height / 2 - len(lines) * 7
                for j, line in enumerate(lines):
                    dwg.add(dwg.text(
                        line,
                        insert=(center_x + box_width / 2, text_y + j * 16),
                        text_anchor='middle',
                        font_size=13,
                        font_family='Times New Roman, serif'
                    ))
            else:
                # Regular box
                box = self.create_component_box(
                    dwg, center_x, y, box_width, box_height,
                    step['name'], step.get('ref_num', str(i + 1))
                )
                dwg.add(box)
            
            positions.append({
                'x': center_x + box_width / 2,
                'y_bottom': y + box_height,
                'y_top': y
            })
            
            # Add arrow to next step
            if i < len(steps) - 1:
                arrow = self.create_arrow(
                    dwg,
                    center_x + box_width / 2,
                    y + box_height,
                    center_x + box_width / 2,
                    y + spacing - 40,
                    label=step.get('arrow_label', '')
                )
                dwg.add(arrow)
        
        return dwg.tostring()
    
    def generate_sequence_diagram(self, actors: List[str], messages: List[Dict], 
                                  title: str = "Component Interaction Sequence") -> str:
        """Generate FIG. 4 - Sequence Diagram"""
        height = 150 + len(messages) * 60 + 100
        dwg = svgwrite.Drawing(size=(self.SVG_WIDTH, height))
        self.add_arrow_marker(dwg)
        
        # Add title
        dwg.add(dwg.text(
            f'FIG. 4 — {title}',
            insert=(self.SVG_WIDTH / 2, 35),
            text_anchor='middle',
            font_size=self.TITLE_FONT_SIZE,
            font_weight='600',
            font_family='Times New Roman, serif'
        ))
        
        # Calculate swimlane positions
        num_actors = len(actors)
        spacing = (self.SVG_WIDTH - 2 * self.MARGIN_SIDE) / (num_actors - 1) if num_actors > 1 else 0
        actor_x_positions = [self.MARGIN_SIDE + i * spacing for i in range(num_actors)]
        
        # Draw actor names
        for i, actor in enumerate(actors):
            dwg.add(dwg.text(
                actor,
                insert=(actor_x_positions[i], 70),
                text_anchor='middle',
                font_size=13,
                font_weight='600',
                font_family='Times New Roman, serif'
            ))
            
            # Draw lifeline
            dwg.add(dwg.line(
                start=(actor_x_positions[i], 85),
                end=(actor_x_positions[i], height - 50),
                stroke='#999',
                stroke_width=1.5,
                stroke_dasharray='5,5'
            ))
        
        # Draw messages
        message_y = 120
        for i, msg in enumerate(messages):
            from_idx = msg['from']
            to_idx = msg['to']
            label = msg['label']
            is_return = msg.get('return', False)
            
            x1 = actor_x_positions[from_idx]
            x2 = actor_x_positions[to_idx]
            
            # Draw arrow
            line_props = {
                'stroke': 'black',
                'stroke_width': 2 if not is_return else 1.5,
            }
            if is_return:
                line_props['stroke_dasharray'] = '4,4'
            else:
                line_props['marker_end'] = 'url(#arrowhead)'
            
            dwg.add(dwg.line(
                start=(x1, message_y),
                end=(x2, message_y),
                **line_props
            ))
            
            # Add message label
            mid_x = (x1 + x2) / 2
            dwg.add(dwg.text(
                f"{i + 1}. {label}",
                insert=(mid_x, message_y - 5),
                text_anchor='middle',
                font_size=11,
                font_family='Times New Roman, serif'
            ))
            
            # Draw activation box if not return
            if not is_return and to_idx >= 0:
                dwg.add(dwg.rect(
                    insert=(x2 - 5, message_y),
                    size=(10, 40),
                    fill='#e8e8e8',
                    stroke='black',
                    stroke_width=1
                ))
            
            message_y += 60
        
        return dwg.tostring()
    
    def generate_deployment_diagram(self, nodes: List[Dict], title: str = "Deployment Architecture") -> str:
        """Generate FIG. 6 - Deployment Diagram"""
        dwg = svgwrite.Drawing(size=(self.SVG_WIDTH, 650))
        self.add_arrow_marker(dwg)
        
        # Add title
        dwg.add(dwg.text(
            f'FIG. 6 — {title}',
            insert=(self.SVG_WIDTH / 2, 35),
            text_anchor='middle',
            font_size=self.TITLE_FONT_SIZE,
            font_weight='600',
            font_family='Times New Roman, serif'
        ))
        
        # Layout nodes (2 columns)
        cols = 2
        box_width = 280
        box_height = 150
        spacing_x = (self.SVG_WIDTH - 2 * self.MARGIN_SIDE - 2 * box_width) / 2
        spacing_y = 180
        
        start_x = self.MARGIN_SIDE
        start_y = 100
        
        for i, node in enumerate(nodes):
            row = i // cols
            col = i % cols
            
            x = start_x + col * (box_width + spacing_x)
            y = start_y + row * spacing_y
            
            # Draw node container
            dwg.add(dwg.rect(
                insert=(x, y),
                size=(box_width, box_height),
                fill='#f5f5f5',
                stroke='black',
                stroke_width=3,
                rx=5
            ))
            
            # Add node title
            dwg.add(dwg.text(
                node['name'],
                insert=(x + box_width / 2, y + 25),
                text_anchor='middle',
                font_size=15,
                font_weight='600',
                font_family='Times New Roman, serif'
            ))
            
            # Add components inside node
            comp_y = y + 50
            for comp in node.get('components', [])[:3]:
                dwg.add(dwg.text(
                    f"• {comp}",
                    insert=(x + 15, comp_y),
                    font_size=12,
                    font_family='Times New Roman, serif'
                ))
                comp_y += 22
        
        return dwg.tostring()


def extract_components_from_patent_text(patent_text: str) -> List[Dict]:
    """Extract component names and reference numbers from patent text"""
    components = []
    
    # Find patterns like "orchestrator (101)" or "(101) orchestrator"
    patterns = [
        r'\((\d{3})\)\s+([A-Za-z\s]+(?:[A-Za-z]+))',  # (101) Component Name
        r'([A-Za-z\s]+(?:[A-Za-z]+))\s+\((\d{3})\)',  # Component Name (101)
    ]
    
    seen_refs = set()
    
    for pattern in patterns:
        matches = re.finditer(pattern, patent_text)
        for match in matches:
            if pattern.startswith(r'\('):
                ref_num = match.group(1)
                name = match.group(2).strip()
            else:
                name = match.group(1).strip()
                ref_num = match.group(2)
            
            if ref_num not in seen_refs and len(name) > 3:
                components.append({
                    'name': name.title(),
                    'ref_num': ref_num
                })
                seen_refs.add(ref_num)
    
    # If we found components, return them
    if components:
        return components[:10]  # Limit to 10 main components
    
    # Fallback: extract from common keywords
    keywords = ['module', 'engine', 'controller', 'manager', 'processor', 'gateway', 'service']
    sentences = patent_text.split('.')
    
    ref_num = 101
    for sentence in sentences[:50]:  # Check first 50 sentences
        for keyword in keywords:
            if keyword in sentence.lower():
                # Extract the phrase containing the keyword
                words = sentence.split()
                for i, word in enumerate(words):
                    if keyword in word.lower():
                        # Get 1-3 words before keyword
                        start = max(0, i - 2)
                        name = ' '.join(words[start:i+1]).strip('(),.:;')
                        if len(name) > 3 and ref_num not in seen_refs:
                            components.append({
                                'name': name.title(),
                                'ref_num': str(ref_num)
                            })
                            seen_refs.add(str(ref_num))
                            ref_num += 1
                            if len(components) >= 10:
                                return components
    
    return components if components else [
        {'name': 'System Core', 'ref_num': '101'},
        {'name': 'Processing Module', 'ref_num': '102'},
        {'name': 'Data Interface', 'ref_num': '103'},
        {'name': 'Control Unit', 'ref_num': '104'},
    ]
