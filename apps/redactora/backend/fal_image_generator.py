"""
Image Generator for Patent Drawings
Generates technical patent diagrams using OpenAI DALL-E or fal.ai
"""
import os
import base64
import asyncio
import logging
from typing import Dict
from dotenv import load_dotenv
import fal_client
from openai import AsyncOpenAI

# Load environment variables
load_dotenv('/app/backend/.env')

logger = logging.getLogger(__name__)

# Set FAL API key from environment
FAL_KEY = os.environ.get('FAL_KEY')
if not FAL_KEY:
    logger.warning("FAL_KEY not found in environment variables")
else:
    logger.info(f"FAL_KEY loaded: {FAL_KEY[:20]}...")
    os.environ['FAL_KEY'] = FAL_KEY



async def generate_image_with_openai(prompt: str, size: str = "1024x1024") -> str:
    """
    Generate an image using OpenAI DALL-E 3
    
    Args:
        prompt: Text description of the image to generate
        size: Image size (1024x1024, 1792x1024, or 1024x1792)
    
    Returns:
        Base64 encoded image string
    """
    if not openai_client:
        raise Exception("OpenAI client not initialized - check OPENAI_API_KEY")
    
    try:
        logger.info(f"Generating image with OpenAI DALL-E: {prompt[:100]}...")
        
        # Generate image using DALL-E 2 (more widely available)
        response = await openai_client.images.generate(
            model="dall-e-2",
            prompt=prompt,
            size="1024x1024",  # DALL-E 2 only supports 1024x1024
            n=1,
        )
        
        # Get image URL
        image_url = response.data[0].url
        logger.info(f"Image generated successfully: {image_url}")
        
        # Download image and convert to base64
        import httpx
        async with httpx.AsyncClient() as client:
            img_response = await client.get(image_url)
            if img_response.status_code == 200:
                image_base64 = base64.b64encode(img_response.content).decode()
                logger.info("Image downloaded and converted to base64")
                return image_base64
            else:
                raise Exception(f"Failed to download image: {img_response.status_code}")
                
    except Exception as e:
        logger.error(f"Error generating image with OpenAI: {str(e)}")
        raise

# Initialize OpenAI client
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
if OPENAI_API_KEY:
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    logger.info("OpenAI client initialized for image generation")
else:
    openai_client = None
    logger.warning("OPENAI_API_KEY not found - OpenAI image generation not available")

async def generate_mermaid_diagram_with_gpt(prompt: str, diagram_type: str) -> str:
    """
    Generate Mermaid.js diagram code using GPT-5.1
    
    Args:
        prompt: Description of what the diagram should show
        diagram_type: Type of diagram (flowchart, sequence, class, etc.)
    
    Returns:
        Mermaid.js code as string
    """
    if not openai_client:
        raise Exception("OpenAI client not initialized - check OPENAI_API_KEY")
    
    try:
        logger.info(f"Generating Mermaid diagram with GPT-5.1: {diagram_type}")
        
        system_prompt = f"""You are a technical diagram expert. Generate clean, professional Mermaid.js diagram code.

IMPORTANT RULES:
1. Generate ONLY the Mermaid code, no explanation
2. Use proper Mermaid syntax
3. Make diagrams clear and professional
4. Use appropriate diagram type: {diagram_type}
5. Keep it concise but informative
6. Use proper indentation
7. No markdown code blocks, just the Mermaid code"""

        user_prompt = f"""Generate a {diagram_type} Mermaid diagram for a USPTO patent application:

{prompt}

Generate ONLY the Mermaid code, starting with the diagram type (e.g., 'graph TD' or 'sequenceDiagram')."""

        response = await openai_client.chat.completions.create(
            model="gpt-5-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        mermaid_code = response.choices[0].message.content.strip()
        
        # Clean up any markdown code blocks if present
        if mermaid_code.startswith("```"):
            lines = mermaid_code.split('\n')
            mermaid_code = '\n'.join(lines[1:-1])
        
        logger.info(f"✅ Mermaid diagram generated successfully")
        return mermaid_code
        
    except Exception as e:
        logger.error(f"Error generating Mermaid diagram: {str(e)}")
        raise


async def generate_image_from_prompt(prompt: str, timeout: int = 120) -> str:
    """
    DEPRECATED - Use generate_mermaid_diagram_with_gpt instead
    This function is kept for backward compatibility but will raise an error
    """
    raise Exception("Image generation APIs not available. Use Mermaid diagrams instead.")


async def generate_patent_diagram_fig1(invention_title: str, language: str = 'en') -> str:
    """Generate FIG. 1 - System Context Diagram"""
    if language == 'es':
        prompt = f"""Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Title: {invention_title}

Create a System Context Diagram showing:
- Central large rectangular box labeled "Sistema Principal" (Main System) in the center
- Four circular nodes around it labeled: "Usuarios" (Users), "Proveedores" (Providers), "Base de Datos" (Database), "Servicios Externos" (External Services)
- Bidirectional arrows connecting each external actor to the central system
- Clean, technical style with clear labels
- Professional patent drawing aesthetic: simple lines, no shading, white background
- Similar to UML context diagrams used in software patents"""
    else:
        prompt = f"""Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Title: {invention_title}

Create a System Context Diagram showing:
- Central large rectangular box labeled "Main System" in the center
- Four circular nodes around it labeled: "Users", "Providers", "Database", "External Services"
- Bidirectional arrows connecting each external actor to the central system
- Clean, technical style with clear labels
- Professional patent drawing aesthetic: simple lines, no shading, white background
- Similar to UML context diagrams used in software patents"""
    
    return await generate_image_from_prompt(prompt)


async def generate_patent_diagram_fig2(language: str = 'en') -> str:
    """Generate FIG. 2 - Layered Architecture Diagram"""
    if language == 'es':
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Layered Architecture Diagram showing 5 horizontal layers stacked vertically:
1. Top layer: "Capa de Presentación" (Presentation Layer)
2. "Capa de Lógica de Negocio" (Business Logic Layer)
3. "Capa de Integración" (Integration Layer)
4. "Capa de Persistencia" (Persistence Layer)
5. Bottom layer: "Capa de Infraestructura" (Infrastructure Layer)

Each layer is a rectangular box with clear borders.
Vertical arrows showing data flow between layers.
Clean, technical style. Professional patent drawing: simple lines, no shading, white background."""
    else:
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Layered Architecture Diagram showing 5 horizontal layers stacked vertically:
1. Top layer: "Presentation Layer"
2. "Business Logic Layer"
3. "Integration Layer"
4. "Persistence Layer"
5. Bottom layer: "Infrastructure Layer"

Each layer is a rectangular box with clear borders.
Vertical arrows showing data flow between layers.
Clean, technical style. Professional patent drawing: simple lines, no shading, white background."""
    
    return await generate_image_from_prompt(prompt)


async def generate_patent_diagram_fig3(language: str = 'en') -> str:
    """Generate FIG. 3 - Method Flow Diagram (Steps S1-S5)"""
    if language == 'es':
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Method Flow Diagram showing 5 sequential steps in vertical flow:
- S1: "Inicio y Configuración" (Start and Configuration) - top box
- S2: "Captura de Datos" (Data Capture)
- S3: "Procesamiento" (Processing)
- S4: "Validación" (Validation)
- S5: "Finalización y Salida" (Finalization and Output) - bottom box

Each step is a rectangular box with rounded corners.
Downward arrows connecting each step sequentially.
Clean flowchart style. Professional patent drawing: simple lines, no shading, white background."""
    else:
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Method Flow Diagram showing 5 sequential steps in vertical flow:
- S1: "Start and Configuration" - top box
- S2: "Data Capture"
- S3: "Processing"
- S4: "Validation"
- S5: "Finalization and Output" - bottom box

Each step is a rectangular box with rounded corners.
Downward arrows connecting each step sequentially.
Clean flowchart style. Professional patent drawing: simple lines, no shading, white background."""
    
    return await generate_image_from_prompt(prompt)


async def generate_patent_diagram_fig4(language: str = 'en') -> str:
    """Generate FIG. 4 - Data Pipeline Diagram"""
    if language == 'es':
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Data Pipeline Diagram showing 5 stages in horizontal flow from left to right:
1. "Entrada de Datos" (Data Input)
2. "Limpieza" (Cleaning)
3. "Transformación" (Transformation)
4. "Validación" (Validation)
5. "Almacenamiento" (Storage)

Each stage is a rectangular box.
Rightward arrows connecting stages sequentially.
Clean, technical pipeline diagram. Professional patent drawing: simple lines, no shading, white background."""
    else:
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Data Pipeline Diagram showing 5 stages in horizontal flow from left to right:
1. "Data Input"
2. "Cleaning"
3. "Transformation"
4. "Validation"
5. "Storage"

Each stage is a rectangular box.
Rightward arrows connecting stages sequentially.
Clean, technical pipeline diagram. Professional patent drawing: simple lines, no shading, white background."""
    
    return await generate_image_from_prompt(prompt)


async def generate_patent_diagram_fig5(language: str = 'en') -> str:
    """Generate FIG. 5 - Component Diagram"""
    if language == 'es':
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Component Diagram showing system components and their relationships:
- Central node: "Lógica de Negocio" (Business Logic)
- Connected nodes: "API Gateway", "Servicio de Auth" (Auth Service), "Capa de Datos" (Data Layer), "Caché" (Cache), "APIs Externas" (External APIs)
- Lines/arrows showing connections between components
- Network-style diagram with labeled boxes/circles for each component
Clean technical style. Professional patent drawing: simple lines, no shading, white background."""
    else:
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Component Diagram showing system components and their relationships:
- Central node: "Business Logic"
- Connected nodes: "API Gateway", "Auth Service", "Data Layer", "Cache", "External APIs"
- Lines/arrows showing connections between components
- Network-style diagram with labeled boxes/circles for each component
Clean technical style. Professional patent drawing: simple lines, no shading, white background."""
    
    return await generate_image_from_prompt(prompt)


async def generate_patent_diagram_fig6(language: str = 'en') -> str:
    """Generate FIG. 6 - Optimization Map"""
    if language == 'es':
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create an Optimization Map showing interconnected optimization areas:
- 5 circular nodes labeled: "Rendimiento" (Performance), "Escalabilidad" (Scalability), "Seguridad" (Security), "Eficiencia" (Efficiency), "Mantenibilidad" (Maintainability)
- Nodes arranged in a network pattern
- Dashed or solid lines connecting nodes to show interdependencies
- Mind-map or network diagram style
Clean technical style. Professional patent drawing: simple lines, no shading, white background."""
    else:
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create an Optimization Map showing interconnected optimization areas:
- 5 circular nodes labeled: "Performance", "Scalability", "Security", "Efficiency", "Maintainability"
- Nodes arranged in a network pattern
- Dashed or solid lines connecting nodes to show interdependencies
- Mind-map or network diagram style
Clean technical style. Professional patent drawing: simple lines, no shading, white background."""
    
    return await generate_image_from_prompt(prompt)


async def generate_patent_diagram_fig7(language: str = 'en') -> str:
    """Generate FIG. 7 - Explainability Outputs Diagram"""
    if language == 'es':
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Hierarchical Tree Diagram showing system outputs:
- Root node at top: "Salidas del Sistema" (System Outputs)
- Three Level 1 branches: "Reportes" (Reports), "Métricas" (Metrics), "Alertas" (Alerts)
- Each Level 1 node has 2-3 child nodes showing output types (e.g., "PDF", "Excel", "Tiempo Real" (Real-time), "Histórico" (Historical))
- Tree structure with boxes for nodes and lines connecting parent to children
Clean hierarchical diagram. Professional patent drawing: simple lines, no shading, white background."""
    else:
        prompt = """Technical patent drawing diagram for USPTO application. Professional black and white line art illustration.

Create a Hierarchical Tree Diagram showing system outputs:
- Root node at top: "System Outputs"
- Three Level 1 branches: "Reports", "Metrics", "Alerts"
- Each Level 1 node has 2-3 child nodes showing output types (e.g., "PDF", "Excel", "Real-time", "Historical")
- Tree structure with boxes for nodes and lines connecting parent to children
Clean hierarchical diagram. Professional patent drawing: simple lines, no shading, white background."""
    
    return await generate_image_from_prompt(prompt)


async def generate_all_patent_diagrams_fal(invention_title: str, language: str = 'en') -> Dict[str, str]:
    """
    Generate all 7 patent diagrams using fal.ai nano-banana model
    
    Args:
        invention_title: Title of the invention
        language: Language for labels ('en' or 'es')
    
    Returns:
        Dict with keys 'fig1' through 'fig7' containing base64 encoded PNG images
    """
    logger.info(f"Starting generation of all 7 patent diagrams for: {invention_title}")
    
    try:
        # Generate all diagrams in parallel for efficiency
        tasks = [
            generate_patent_diagram_fig1(invention_title, language),
            generate_patent_diagram_fig2(language),
            generate_patent_diagram_fig3(language),
            generate_patent_diagram_fig4(language),
            generate_patent_diagram_fig5(language),
            generate_patent_diagram_fig6(language),
            generate_patent_diagram_fig7(language)
        ]
        
        results = await asyncio.gather(*tasks)
        
        diagrams = {
            'fig1': results[0],
            'fig2': results[1],
            'fig3': results[2],
            'fig4': results[3],
            'fig5': results[4],
            'fig6': results[5],
            'fig7': results[6]
        }
        
        logger.info("Successfully generated all 7 patent diagrams")
        return diagrams
        
    except Exception as e:
        logger.error(f"Error generating patent diagrams: {str(e)}")
        raise
