"""
Patent Drawing Generator
Generates technical diagrams for USPTO patent applications
STRICTLY following USPTO guidelines: BLACK AND WHITE ONLY, RECTANGLES ONLY
"""
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Rectangle
import io
import base64
import logging

# Initialize logger
logger = logging.getLogger(__name__)

# USPTO STYLE CONSTANTS
USPTO_BLACK = '#000000'
USPTO_WHITE = '#FFFFFF'
USPTO_LINE_WIDTH = 2
USPTO_FONT_SIZE = 10
USPTO_TITLE_FONT = 'serif'

def generate_context_diagram(invention_title: str) -> str:
    """Generate FIG. 1 - System Context Diagram (USPTO Style)"""
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    
    # Central system box (101)
    central_box = Rectangle((3.5, 4), 3, 2, 
                            edgecolor=USPTO_BLACK, 
                            facecolor=USPTO_WHITE, 
                            linewidth=USPTO_LINE_WIDTH)
    ax.add_patch(central_box)
    ax.text(5, 5.2, 'MAIN SYSTEM', ha='center', va='center', fontsize=USPTO_FONT_SIZE, weight='bold', family=USPTO_TITLE_FONT)
    ax.text(5, 4.8, '(101)', ha='center', va='center', fontsize=8, family=USPTO_TITLE_FONT)
    
    # External actors (rectangles only - NO circles)
    actors = [
        {'name': 'USER\nINTERFACE', 'ref': '(102)', 'pos': (1, 7)},
        {'name': 'DATA\nPROVIDER', 'ref': '(103)', 'pos': (7.5, 7)},
        {'name': 'DATABASE', 'ref': '(104)', 'pos': (1, 1.5)},
        {'name': 'EXTERNAL\nSERVICES', 'ref': '(105)', 'pos': (7.5, 1.5)}
    ]
    
    for actor in actors:
        rect = Rectangle((actor['pos'][0], actor['pos'][1]), 1.5, 1.5, 
                        edgecolor=USPTO_BLACK, 
                        facecolor=USPTO_WHITE, 
                        linewidth=USPTO_LINE_WIDTH)
        ax.add_patch(rect)
        ax.text(actor['pos'][0] + 0.75, actor['pos'][1] + 1, actor['name'], 
               ha='center', va='center', fontsize=8, weight='bold', family=USPTO_TITLE_FONT)
        ax.text(actor['pos'][0] + 0.75, actor['pos'][1] + 0.3, actor['ref'], 
               ha='center', va='center', fontsize=7, family=USPTO_TITLE_FONT)
        
        # Draw straight arrows to central system
        center_x = actor['pos'][0] + 0.75
        center_y = actor['pos'][1] + 0.75
        ax.annotate('', xy=(5, 5), xytext=(center_x, center_y),
                   arrowprops=dict(arrowstyle='->', lw=1.5, color=USPTO_BLACK))
    
    ax.set_title(f'FIG. 1 — System Context Diagram', 
                fontsize=12, weight='bold', family=USPTO_TITLE_FONT, pad=20)
    
    # Convert to base64
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor=USPTO_WHITE)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close()
    
    return img_base64


def generate_layered_architecture() -> str:
    """Generate FIG. 2 - Layered Architecture Diagram (USPTO Style)"""
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    
    layers = [
        {'name': 'PRESENTATION LAYER', 'ref': '(201)', 'y': 8},
        {'name': 'BUSINESS LOGIC LAYER', 'ref': '(202)', 'y': 6.5},
        {'name': 'INTEGRATION LAYER', 'ref': '(203)', 'y': 5},
        {'name': 'PERSISTENCE LAYER', 'ref': '(204)', 'y': 3.5},
        {'name': 'INFRASTRUCTURE LAYER', 'ref': '(205)', 'y': 2}
    ]
    
    for i, layer in enumerate(layers):
        rect = Rectangle((1, layer['y'] - 0.5), 8, 1, 
                        edgecolor=USPTO_BLACK, 
                        facecolor=USPTO_WHITE, 
                        linewidth=USPTO_LINE_WIDTH)
        ax.add_patch(rect)
        ax.text(5, layer['y'] + 0.1, layer['name'], 
               ha='center', va='center', fontsize=USPTO_FONT_SIZE, weight='bold', family=USPTO_TITLE_FONT)
        ax.text(2, layer['y'] - 0.3, layer['ref'], 
               ha='center', va='center', fontsize=8, family=USPTO_TITLE_FONT)
        
        # Draw straight arrows between layers
        if i < len(layers) - 1:
            ax.annotate('', xy=(5, layer['y'] - 0.6), xytext=(5, layer['y'] - 1.4),
                       arrowprops=dict(arrowstyle='->', lw=1.5, color=USPTO_BLACK))
    
    ax.set_title('FIG. 2 — Layered Architecture', fontsize=12, weight='bold', family=USPTO_TITLE_FONT, pad=20)
    
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor=USPTO_WHITE)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close()
    
    return img_base64


def generate_method_flow() -> str:
    """Generate FIG. 3 - Method Flow Diagram (Steps S1-S5) (USPTO Style)"""
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 12)
    ax.axis('off')
    
    steps = [
        {'name': 'S1: START\nCONFIGURATION', 'ref': '(301)', 'y': 10},
        {'name': 'S2: DATA\nCAPTURE', 'ref': '(302)', 'y': 8},
        {'name': 'S3: PROCESSING', 'ref': '(303)', 'y': 6},
        {'name': 'S4: VALIDATION', 'ref': '(304)', 'y': 4},
        {'name': 'S5: COMPLETION\nAND OUTPUT', 'ref': '(305)', 'y': 2}
    ]
    
    for i, step in enumerate(steps):
        # Draw rectangle box
        rect = Rectangle((2.5, step['y'] - 0.6), 5, 1.2, 
                        edgecolor=USPTO_BLACK, 
                        facecolor=USPTO_WHITE, 
                        linewidth=USPTO_LINE_WIDTH)
        ax.add_patch(rect)
        ax.text(5, step['y'] + 0.1, step['name'], 
               ha='center', va='center', fontsize=9, weight='bold', family=USPTO_TITLE_FONT)
        ax.text(3.2, step['y'] - 0.4, step['ref'], 
               ha='center', va='center', fontsize=7, family=USPTO_TITLE_FONT)
        
        # Draw straight arrow to next step
        if i < len(steps) - 1:
            ax.annotate('', xy=(5, step['y'] - 0.7), xytext=(5, step['y'] - 1.3),
                       arrowprops=dict(arrowstyle='->', lw=1.5, color=USPTO_BLACK))
    
    ax.set_title('FIG. 3 — Method Flow (Steps S1-S5)', 
                fontsize=12, weight='bold', family=USPTO_TITLE_FONT, pad=20)
    
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor=USPTO_WHITE)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close()
    
    return img_base64


def generate_data_pipeline() -> str:
    """Generate FIG. 4 - Data Pipeline Diagram (USPTO Style)"""
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 6)
    ax.axis('off')
    
    pipeline_stages = [
        {'name': 'DATA\nINPUT', 'ref': '(401)', 'x': 1.5},
        {'name': 'CLEANING', 'ref': '(402)', 'x': 3.5},
        {'name': 'TRANSFORMATION', 'ref': '(403)', 'x': 5.5},
        {'name': 'VALIDATION', 'ref': '(404)', 'x': 7.5},
        {'name': 'STORAGE', 'ref': '(405)', 'x': 9.5}
    ]
    
    for i, stage in enumerate(pipeline_stages):
        rect = Rectangle((stage['x'] - 0.7, 2.5), 1.4, 1.5, 
                        edgecolor=USPTO_BLACK, 
                        facecolor=USPTO_WHITE, 
                        linewidth=USPTO_LINE_WIDTH)
        ax.add_patch(rect)
        ax.text(stage['x'], 3.5, stage['name'], 
               ha='center', va='center', fontsize=8, weight='bold', family=USPTO_TITLE_FONT)
        ax.text(stage['x'], 2.7, stage['ref'], 
               ha='center', va='center', fontsize=7, family=USPTO_TITLE_FONT)
        
        # Draw straight arrow to next stage
        if i < len(pipeline_stages) - 1:
            ax.annotate('', xy=(stage['x'] + 1.2, 3.25), xytext=(stage['x'] + 0.8, 3.25),
                       arrowprops=dict(arrowstyle='->', lw=1.5, color=USPTO_BLACK))
    
    ax.set_title('FIG. 4 — Data Pipeline', fontsize=12, weight='bold', family=USPTO_TITLE_FONT, pad=20)
    
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor=USPTO_WHITE)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close()
    
    return img_base64


def generate_component_diagram() -> str:
    """Generate FIG. 5 - Component Diagram (USPTO Style)"""
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    
    # Components as rectangles
    components = [
        {'name': 'API\nGATEWAY', 'ref': '(501)', 'pos': (4, 8)},
        {'name': 'AUTH\nSERVICE', 'ref': '(502)', 'pos': (1, 5.5)},
        {'name': 'BUSINESS\nLOGIC', 'ref': '(503)', 'pos': (7, 5.5)},
        {'name': 'DATA\nLAYER', 'ref': '(504)', 'pos': (4, 3)},
        {'name': 'CACHE', 'ref': '(505)', 'pos': (1, 1)},
        {'name': 'EXTERNAL\nAPIS', 'ref': '(506)', 'pos': (7, 1)}
    ]
    
    # Draw components
    for comp in components:
        rect = Rectangle((comp['pos'][0] - 0.75, comp['pos'][1] - 0.6), 1.5, 1.2, 
                        edgecolor=USPTO_BLACK, 
                        facecolor=USPTO_WHITE, 
                        linewidth=USPTO_LINE_WIDTH)
        ax.add_patch(rect)
        ax.text(comp['pos'][0], comp['pos'][1] + 0.15, comp['name'], 
               ha='center', va='center', fontsize=8, weight='bold', family=USPTO_TITLE_FONT)
        ax.text(comp['pos'][0], comp['pos'][1] - 0.4, comp['ref'], 
               ha='center', va='center', fontsize=7, family=USPTO_TITLE_FONT)
    
    # Draw connections (straight lines with arrows)
    connections = [
        (0, 1), (0, 2), (2, 3), (2, 5), (1, 3), (3, 4)
    ]
    
    for i, j in connections:
        start = components[i]['pos']
        end = components[j]['pos']
        ax.annotate('', xy=end, xytext=start,
                   arrowprops=dict(arrowstyle='->', lw=1, color=USPTO_BLACK))
    
    ax.set_title('FIG. 5 — Component Diagram', fontsize=12, weight='bold', family=USPTO_TITLE_FONT, pad=20)
    
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor=USPTO_WHITE)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close()
    
    return img_base64


def generate_deployment_topology() -> str:
    """Generate FIG. 6 - Deployment Topology (USPTO Style)"""
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    
    # Deployment nodes as rectangles
    nodes = [
        {'name': 'WEB\nSERVER', 'ref': '(601)', 'pos': (5, 8)},
        {'name': 'APPLICATION\nSERVER', 'ref': '(602)', 'pos': (2, 5)},
        {'name': 'DATABASE\nSERVER', 'ref': '(603)', 'pos': (8, 5)},
        {'name': 'CACHE\nSERVER', 'ref': '(604)', 'pos': (3.5, 2)},
        {'name': 'STORAGE', 'ref': '(605)', 'pos': (6.5, 2)}
    ]
    
    for node in nodes:
        rect = Rectangle((node['pos'][0] - 0.9, node['pos'][1] - 0.7), 1.8, 1.4, 
                        edgecolor=USPTO_BLACK, 
                        facecolor=USPTO_WHITE, 
                        linewidth=USPTO_LINE_WIDTH)
        ax.add_patch(rect)
        ax.text(node['pos'][0], node['pos'][1] + 0.15, node['name'], 
               ha='center', va='center', fontsize=8, weight='bold', family=USPTO_TITLE_FONT)
        ax.text(node['pos'][0], node['pos'][1] - 0.45, node['ref'], 
               ha='center', va='center', fontsize=7, family=USPTO_TITLE_FONT)
    
    # Draw connections
    connections = [
        (0, 1), (0, 2), (1, 3), (2, 4), (3, 4), (1, 2)
    ]
    
    for i, j in connections:
        start = nodes[i]['pos']
        end = nodes[j]['pos']
        ax.plot([start[0], end[0]], [start[1], end[1]], 'k-', linewidth=1.5)
    
    ax.set_title('FIG. 6 — Deployment Topology', fontsize=12, weight='bold', family=USPTO_TITLE_FONT, pad=20)
    
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor=USPTO_WHITE)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    plt.close()
    
    return img_base64


def generate_all_patent_diagrams(invention_title: str) -> dict:
    """
    Generate all 6 patent diagrams and return them as base64 encoded images
    
    Returns:
        Dict with keys 'fig1' through 'fig6' containing base64 encoded PNG images
    """
    diagrams = {
        'fig1': generate_context_diagram(invention_title),
        'fig2': generate_layered_architecture(),
        'fig3': generate_method_flow(),
        'fig4': generate_data_pipeline(),
        'fig5': generate_component_diagram(),
        'fig6': generate_deployment_topology()
    }
    
    return diagrams


def generate_all_patent_diagrams_matplotlib(patent_data: dict) -> str:
    """
    Generate all 6 patent diagrams using Matplotlib (USPTO technical style)
    Returns HTML with embedded diagrams as base64 PNG images
    
    STRICTLY FOLLOWS USPTO GUIDELINES:
    - BLACK AND WHITE ONLY
    - RECTANGLES ONLY (no circles or rounded shapes)
    - Reference numbers in parentheses
    - Simple, technical appearance
    """
    logger.info("Starting generation of all 6 patent diagrams using Matplotlib (USPTO style)")
    
    invention_title = patent_data.get('invention_title', 'Invention')
    technical_field = patent_data.get('technical_field', 'Technology')
    
    try:
        # Generate all diagrams using Matplotlib functions
        diagrams = generate_all_patent_diagrams(invention_title)
        
        # Create HTML with all diagrams
        diagrams_html = []
        diagram_titles = [
            "System Context Diagram",
            "Layered Architecture Diagram",
            "Method Flow Diagram",
            "Data Pipeline Diagram",
            "Component Diagram",
            "Deployment Topology"
        ]
        
        for i, (fig_key, diagram_title) in enumerate(zip(diagrams.keys(), diagram_titles), 1):
            image_base64 = diagrams[fig_key]
            diagram_html = f"""
            <div class="diagram-container" style="page-break-inside: avoid; margin: 30px 0;">
                <h3 style="text-align: center; color: #000; font-family: serif;">FIG. {i} — {diagram_title}</h3>
                <div style="text-align: center; background: white; padding: 20px; border: 2px solid #000;">
                    <img src="data:image/png;base64,{image_base64}" style="max-width: 100%; height: auto;" alt="FIG. {i}" />
                </div>
            </div>
            """
            diagrams_html.append(diagram_html)
            logger.info(f"✅ FIG. {i} generated successfully (USPTO style)")
        
        # Create complete HTML document
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Patent Drawings - {invention_title}</title>
            <style>
                body {{
                    font-family: 'Times New Roman', serif;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #fff;
                }}
                h1 {{
                    text-align: center;
                    color: #000;
                    border-bottom: 3px solid #000;
                    padding-bottom: 10px;
                    font-family: 'Times New Roman', serif;
                }}
                .diagram-container {{
                    background: white;
                    padding: 20px;
                    margin: 30px 0;
                    border: 2px solid #000;
                }}
                @media print {{
                    body {{ background: white; }}
                    .diagram-container {{ 
                        page-break-inside: avoid;
                        border: 2px solid #000;
                    }}
                }}
            </style>
        </head>
        <body>
            <h1>PATENT DRAWINGS - USPTO APPLICATION</h1>
            <h2 style="text-align: center; color: #000; font-family: serif;">{invention_title}</h2>
            <p style="text-align: center; color: #000; font-family: serif;">Technical Field: {technical_field}</p>
            
            {''.join(diagrams_html)}
            
            <div style="margin-top: 50px; padding: 20px; border: 2px solid #000;">
                <h3 style="font-family: serif;">USPTO Compliance Notes:</h3>
                <ul style="font-family: serif;">
                    <li>All diagrams use BLACK AND WHITE only (USPTO requirement)</li>
                    <li>Rectangles only, no circles or rounded shapes (USPTO standard)</li>
                    <li>Reference numbers in parentheses: (101), (102), etc.</li>
                    <li>Simple, technical appearance suitable for patent applications</li>
                    <li>High-quality PNG images at 150 DPI</li>
                </ul>
            </div>
        </body>
        </html>
        """
        
        logger.info("✅ All patent diagrams HTML generated successfully (USPTO compliant)")
        return html_content
        
    except Exception as e:
        logger.error(f"Error generating patent diagrams: {str(e)}")
        raise



async def generate_patent_diagrams_from_description(patent_data: dict, call_llm_func) -> str:
    """
    Generate patent diagrams using LLM based on ACTUAL patent content
    Analyzes "BRIEF DESCRIPTION OF THE DRAWINGS" to create accurate diagrams
    
    Args:
        patent_data: Patent information with sections
        call_llm_func: Async function to call LLM
    
    Returns:
        HTML with embedded diagrams
    """
    logger.info("🎨 Starting intelligent diagram generation based on patent content")
    
    invention_title = patent_data.get('invention_title', 'Invention')
    technical_field = patent_data.get('technical_field', 'Technology')
    
    # STEP 1: Find "BRIEF DESCRIPTION OF THE DRAWINGS" section
    brief_description = ""
    sections = patent_data.get('sections', [])
    
    for section in sections:
        title = section.get('title', '').upper()
        if 'BRIEF DESCRIPTION' in title and 'DRAWING' in title:
            brief_description = section.get('content_en', section.get('content_es', ''))
            logger.info(f"✅ Found BRIEF DESCRIPTION section ({len(brief_description)} chars)")
            break
    
    if not brief_description:
        logger.warning("⚠️ No BRIEF DESCRIPTION OF DRAWINGS found, using generic diagrams")
        # Fallback to generic diagrams
        return None
    
    # STEP 2: Extract figure descriptions using regex
    import re
    figure_descriptions = []
    
    # Pattern: "FIG. X" followed by description until next "FIG." or end
    pattern = r'FIG\.\s*(\d+)\s+(?:is|shows|illustrates|depicts|represents)?\s*(.+?)(?=FIG\.\s*\d+|$)'
    matches = re.findall(pattern, brief_description, re.IGNORECASE | re.DOTALL)
    
    for fig_num, description in matches:
        cleaned_desc = ' '.join(description.strip().split())
        if len(cleaned_desc) > 10:  # Only valid descriptions
            figure_descriptions.append({
                "num": int(fig_num),
                "description": cleaned_desc[:500]  # Limit to 500 chars
            })
            logger.info(f"📋 FIG. {fig_num}: {cleaned_desc[:80]}...")
    
    if not figure_descriptions:
        logger.warning("⚠️ No figures extracted, using generic diagrams")
        return None
    
    # STEP 3: Generate HTML/SVG for each figure using LLM
    diagrams_html = []
    
    for fig_info in figure_descriptions:
        try:
            fig_num = fig_info['num']
            fig_desc = fig_info['description']
            
            logger.info(f"🎨 Generating FIG. {fig_num} using LLM...")
            
            # LLM prompt for diagram generation
            system_message = """You are a USPTO patent diagram generator. Create SVG diagrams for patent applications.

CRITICAL REQUIREMENTS:
- BLACK AND WHITE ONLY (no colors, no grays)
- Use ONLY rectangles and straight lines (no circles, curves)
- Add reference numbers in parentheses: (101), (102), (103)
- Simple, clean, technical appearance
- Labels clearly visible

OUTPUT:
- Return ONLY the SVG code
- Start with <svg> and end with </svg>
- Use viewBox="0 0 800 600"
- stroke="black" stroke-width="2" fill="white" for rectangles
- font-family="Arial" font-size="12" for text"""

            user_message = f"""Generate USPTO-compliant SVG diagram:

**Patent Context:**
- Title: {invention_title}
- Field: {technical_field}

**Figure to Generate:**
FIG. {fig_num}: {fig_desc}

**Requirements:**
1. Analyze the description and determine diagram type (architecture, flowchart, block diagram, etc.)
2. Create appropriate diagram matching the description
3. Use rectangles for all components
4. Add reference numbers (101), (102), etc.
5. Use arrows (straight lines with arrowheads) to show relationships
6. Keep it simple and technical

Generate ONLY the SVG code."""

            # Call LLM
            svg_content = await call_llm_func(
                system_message,
                user_message,
                temperature=0.3,
                max_tokens=2000
            )
            
            # Clean SVG content
            svg_content = svg_content.strip()
            if svg_content.startswith('```'):
                lines = svg_content.split('\n')
                svg_content = '\n'.join(lines[1:-1])
            svg_content = svg_content.strip()
            
            # Validate SVG
            if not svg_content.startswith('<svg'):
                logger.warning(f"⚠️ Invalid SVG for FIG. {fig_num}, using placeholder")
                svg_content = f'<svg viewBox="0 0 800 600"><rect x="10" y="10" width="780" height="580" fill="white" stroke="black" stroke-width="2"/><text x="400" y="300" text-anchor="middle" font-family="Arial" font-size="16" fill="black">FIG. {fig_num}</text></svg>'
            
            # Create HTML for this diagram
            diagram_html = f"""
            <div class="diagram-container" style="page-break-after: always; page-break-inside: avoid; margin: 30px 0;">
                <h3 style="text-align: center; color: #000; font-family: Arial; font-size: 14px;">FIG. {fig_num}</h3>
                <p style="text-align: center; color: #666; font-family: Arial; font-size: 11px; margin: 10px 0 20px 0;">{fig_desc[:150]}</p>
                <div style="text-align: center; background: white; padding: 20px; border: 2px solid #000;">
                    {svg_content}
                </div>
            </div>
            """
            diagrams_html.append(diagram_html)
            logger.info(f"✅ FIG. {fig_num} generated successfully")
            
        except Exception as e:
            logger.error(f"❌ Error generating FIG. {fig_num}: {str(e)}")
            # Add placeholder
            diagrams_html.append(f"""
            <div class="diagram-container" style="page-break-after: always;">
                <h3 style="text-align: center;">FIG. {fig_num}</h3>
                <p style="text-align: center; color: #666;">{fig_desc[:150]}</p>
                <div style="text-align: center; padding: 40px; border: 2px solid #000;">
                    <p>Diagram generation error</p>
                </div>
            </div>
            """)
    
    # STEP 4: Create complete HTML document
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Patent Drawings - {invention_title}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: #fff;
            }}
            h1 {{
                text-align: center;
                color: #000;
                border-bottom: 3px solid #000;
                padding-bottom: 10px;
            }}
            .diagram-container {{
                background: white;
                padding: 20px;
                margin: 30px 0;
                border: 2px solid #000;
            }}
            svg {{
                max-width: 100%;
                height: auto;
            }}
        </style>
    </head>
    <body>
        <h1>PATENT DRAWINGS - USPTO APPLICATION</h1>
        <h2 style="text-align: center; color: #000;">{invention_title}</h2>
        <p style="text-align: center; color: #000;">Technical Field: {technical_field}</p>
        <p style="text-align: center; color: #666; font-size: 12px;">Generated based on BRIEF DESCRIPTION OF THE DRAWINGS</p>
        
        {''.join(diagrams_html)}
        
        <div style="margin-top: 50px; padding: 20px; border: 2px solid #000; page-break-before: always;">
            <h3>Generation Notes:</h3>
            <ul style="font-size: 12px;">
                <li><strong>Method:</strong> AI-powered analysis of patent description</li>
                <li><strong>Total Figures:</strong> {len(figure_descriptions)} diagrams</li>
                <li><strong>Format:</strong> BLACK AND WHITE (USPTO compliant)</li>
                <li><strong>Style:</strong> Rectangles and straight lines only</li>
                <li><strong>Quality:</strong> Scalable vector graphics (SVG)</li>
                <li><strong>Source:</strong> Based on "BRIEF DESCRIPTION OF THE DRAWINGS" section</li>
            </ul>
            <p style="font-size: 11px; color: #666; margin-top: 15px;">
                Note: These diagrams were automatically generated based on the patent description. 
                Please review for accuracy before filing.
            </p>
        </div>
    </body>
    </html>
    """
    
    logger.info(f"✅ Generated {len(figure_descriptions)} intelligent diagrams based on patent content")
    return html_content



async def generate_all_patent_diagrams_llm_svg(patent_data: dict, call_llm_func) -> str:
    """
    Generate patent diagrams using LLM based on ACTUAL patent content
    Analyzes "BRIEF DESCRIPTION OF THE DRAWINGS" section to create accurate diagrams
    
    STRICTLY FOLLOWS USPTO GUIDELINES:
    - BLACK AND WHITE ONLY
    - RECTANGLES ONLY (no circles or rounded shapes)
    - Reference numbers in parentheses
    - Simple, technical appearance
    - One diagram per page
    
    Args:
        patent_data: Patent information dictionary with sections
        call_llm_func: Async function to call LLM (e.g., call_openai_gpt5)
    """
    logger.info("🎨 Starting generation of patent diagrams using LLM based on patent content")
    
    invention_title = patent_data.get('invention_title', 'Invention')
    technical_field = patent_data.get('technical_field', 'Technology')
    invention_description = patent_data.get('invention_description', '')
    
    # STEP 1: Extract "BRIEF DESCRIPTION OF THE DRAWINGS" from patent sections
    brief_description = ""
    sections = patent_data.get('sections', [])
    
    for section in sections:
        section_title = section.get('title', '').upper()
        if 'BRIEF DESCRIPTION' in section_title and 'DRAWING' in section_title:
            brief_description = section.get('content_en', section.get('content_es', ''))
            logger.info(f"✅ Found BRIEF DESCRIPTION OF THE DRAWINGS section ({len(brief_description)} chars)")
            break
    
    # If not found in sections, check if it's in the invention description
    if not brief_description and 'FIG.' in invention_description.upper():
        brief_description = invention_description
        logger.info(f"⚠️ Using invention description as fallback for figures")
    
    # STEP 2: Extract figure descriptions from brief description
    import re
    figure_descriptions = []
    
    if brief_description:
        # Parse figure descriptions (FIG. 1, FIG. 2, etc.)
        # Common patterns: "FIG. 1 is...", "Figure 1 shows...", etc.
        fig_pattern = r'FIG\.\s*(\d+)[:\s]+([^\.]+\.)'
        matches = re.findall(fig_pattern, brief_description, re.IGNORECASE)
        
        for fig_num, description in matches:
            figure_descriptions.append({
                "num": int(fig_num),
                "description": description.strip()
            })
            logger.info(f"📋 Found FIG. {fig_num}: {description[:60]}...")
    
    # STEP 3: If no figures found, generate default technical diagrams
    if not figure_descriptions:
        logger.warning("⚠️ No figure descriptions found in patent, generating default technical diagrams")
        figure_descriptions = [
            {"num": 1, "description": f"System overview diagram showing the main components of {invention_title}"},
            {"num": 2, "description": f"Architectural diagram showing the technical layers and modules"},
            {"num": 3, "description": f"Process flow diagram showing the method steps"},
            {"num": 4, "description": f"Data flow diagram showing information processing"},
            {"num": 5, "description": f"Component interaction diagram showing system relationships"},
            {"num": 6, "description": f"Deployment diagram showing the system configuration"}
        ]
    
    
    # STEP 4: Generate HTML/SVG for each figure
    diagrams_html = []
    
    for fig_info in figure_descriptions:
        try:
            fig_num = fig_info['num']
            fig_desc = fig_info['description']
            
            logger.info(f"📝 Generating FIG. {fig_num} using LLM based on patent description...")
            
            # Create enhanced prompt for LLM to generate SVG based on actual patent content
            system_message = """You are an expert USPTO patent diagram generator. Your task is to:

1. ANALYZE the patent description provided
2. UNDERSTAND what the figure should show based on the description
3. GENERATE professional SVG diagram code that accurately represents the description

CRITICAL USPTO REQUIREMENTS:
- BLACK AND WHITE ONLY (use black strokes, white fills)
- RECTANGLES ONLY (NO circles, curves, or rounded corners)
- Reference numbers in parentheses: (101), (102), etc.
- Simple, clean, technical appearance
- Labels inside or near rectangles
- Straight arrows connecting components

DIAGRAM TYPES YOU MAY NEED TO CREATE:
- System/context diagrams
- Architecture diagrams (layers, components)
- Flowcharts (process flows, workflows)
- Block diagrams
- Data flow diagrams
- Deployment diagrams
- Interface mockups (use rectangles)
- State diagrams
- Any other technical diagram type

OUTPUT FORMAT:
- Return ONLY the SVG code starting with <svg> and ending with </svg>
- Use viewBox="0 0 800 600" for consistent sizing
- Use stroke="black" stroke-width="2" fill="white" for rectangles
- Use font-family="Arial, sans-serif" font-size="12" for text
- NO explanations, NO markdown, JUST the SVG code"""

            user_message = f"""Generate USPTO-compliant SVG diagram for this patent figure:

**PATENT INFORMATION:**
- Invention Title: {invention_title}
- Technical Field: {technical_field}
- Invention Description: {invention_description[:500]}...

**FIGURE TO GENERATE:**
FIG. {fig_num}: {fig_desc}

**YOUR TASK:**
Based on the figure description above, create a technical diagram that:
1. Accurately represents what FIG. {fig_num} should show
2. Uses appropriate diagram type (flowchart, architecture, block diagram, etc.)
3. Includes relevant components with reference numbers (101), (102), etc.
4. Shows relationships between components with arrows
5. Is clear, professional, and suitable for USPTO patent filing

**TECHNICAL CONSTRAINTS:**
- Use <rect> elements for all boxes/components
- Use <line> and <polygon> for arrows
- Use <text> for all labels
- Keep it simple and technical
- Follow USPTO black-and-white standard
- Make sure all text is readable

Generate ONLY the SVG code, nothing else."""

            # Call LLM to generate SVG
            svg_content = await call_llm_func(
                system_message,
                user_message,
                temperature=0.3,
                max_tokens=2000
            )
            
            # Clean the SVG content (remove markdown code blocks if present)
            svg_content = svg_content.strip()
            if svg_content.startswith('```'):
                # Remove markdown code fences
                lines = svg_content.split('\n')
                svg_content = '\n'.join(lines[1:-1])  # Remove first and last line
            svg_content = svg_content.strip()
            
            # Ensure SVG starts with <svg> tag
            if not svg_content.startswith('<svg'):
                logger.warning(f"⚠️ LLM response doesn't start with <svg>, attempting to extract...")
                # Try to find SVG content
                import re
                svg_match = re.search(r'(<svg.*?</svg>)', svg_content, re.DOTALL | re.IGNORECASE)
                if svg_match:
                    svg_content = svg_match.group(1)
                else:
                    logger.error(f"❌ Could not extract valid SVG from LLM response")
                    svg_content = f'<svg viewBox="0 0 800 600"><rect x="10" y="10" width="780" height="580" fill="white" stroke="black" stroke-width="2"/><text x="400" y="300" text-anchor="middle" font-family="serif" font-size="16">Error generating diagram</text></svg>'
            
            # Create HTML wrapper for this diagram with page break
            diagram_html = f"""
            <div class="diagram-container" style="page-break-after: always; page-break-inside: avoid; margin: 30px 0;">
                <h3 style="text-align: center; color: #000; font-family: serif;">FIG. {fig_num}</h3>
                <p style="text-align: center; color: #666; font-family: serif; font-size: 12px; margin: 10px 0;">{fig_desc}</p>
                <div style="text-align: center; background: white; padding: 20px; border: 2px solid #000;">
                    {svg_content}
                </div>
            </div>
            """
            diagrams_html.append(diagram_html)
            logger.info(f"✅ FIG. {fig_num} generated successfully using LLM SVG")
            
        except Exception as e:
            logger.error(f"❌ Error generating FIG. {fig_num}: {str(e)}")
            # Fallback: create a simple error SVG
            error_svg = f'''<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="780" height="580" fill="white" stroke="black" stroke-width="2"/>
                <text x="400" y="300" text-anchor="middle" font-family="serif" font-size="16" fill="black">
                    Error generating diagram - {str(e)[:50]}
                </text>
            </svg>'''
            diagram_html = f"""
            <div class="diagram-container" style="page-break-after: always; page-break-inside: avoid; margin: 30px 0;">
                <h3 style="text-align: center; color: #000; font-family: serif;">FIG. {fig_num}</h3>
                <p style="text-align: center; color: #666; font-family: serif; font-size: 12px; margin: 10px 0;">{fig_desc}</p>
                <div style="text-align: center; background: white; padding: 20px; border: 2px solid #000;">
                    {error_svg}
                </div>
            </div>
            """
            diagrams_html.append(diagram_html)
    
    # Create complete HTML document
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Patent Drawings - {invention_title}</title>
        <style>
            body {{
                font-family: 'Times New Roman', serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: #fff;
            }}
            h1 {{
                text-align: center;
                color: #000;
                border-bottom: 3px solid #000;
                padding-bottom: 10px;
                font-family: 'Times New Roman', serif;
            }}
            .diagram-container {{
                background: white;
                padding: 20px;
                margin: 30px 0;
                border: 2px solid #000;
            }}
            svg {{
                max-width: 100%;
                height: auto;
            }}
            @media print {{
                body {{ background: white; }}
                .diagram-container {{ 
                    page-break-inside: avoid;
                    border: 2px solid #000;
                }}
            }}
        </style>
    </head>
    <body>
        <h1>PATENT DRAWINGS - USPTO APPLICATION</h1>
        <h2 style="text-align: center; color: #000; font-family: serif;">{invention_title}</h2>
        <p style="text-align: center; color: #000; font-family: serif;">Technical Field: {technical_field}</p>
        
        {''.join(diagrams_html)}
        
        <div style="margin-top: 50px; padding: 20px; border: 2px solid #000; page-break-before: always;">
            <h3 style="font-family: serif;">Diagram Generation Notes:</h3>
            <ul style="font-family: serif;">
                <li><strong>Generation Method:</strong> AI-powered analysis of patent "BRIEF DESCRIPTION OF THE DRAWINGS" section</li>
                <li><strong>Total Figures:</strong> {len(figure_descriptions)} diagrams generated</li>
                <li><strong>Format:</strong> BLACK AND WHITE only (USPTO requirement)</li>
                <li><strong>Style:</strong> Rectangles only, no circles or rounded shapes (USPTO standard)</li>
                <li><strong>Numbering:</strong> Reference numbers in parentheses: (101), (102), etc.</li>
                <li><strong>Quality:</strong> Scalable vector graphics (SVG) for high-quality output</li>
                <li><strong>Layout:</strong> One diagram per page for clarity</li>
                <li><strong>Compliance:</strong> Suitable for USPTO patent filing</li>
            </ul>
            <p style="font-family: serif; font-size: 11px; color: #666; margin-top: 15px;">
                <strong>Note:</strong> These diagrams were automatically generated based on the patent description. 
                Please review for accuracy and modify as needed before filing.
            </p>
        </div>
    </body>
    </html>
    """
    
    logger.info("✅ All patent diagrams HTML generated successfully using LLM SVG (USPTO compliant)")
    return html_content
