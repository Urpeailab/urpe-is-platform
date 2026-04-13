"""
Success Stories Generator Service
Generates 100 success stories with AI-generated face images uploaded to Supabase.
Can be called via endpoint or script for production seeding.
"""
import random
import uuid
import os
import time
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ===== PROFESSION-SPECIFIC IMAGE SETTINGS =====
# Each profession gets a unique setting + attire for more natural, varied photos

PROFESSION_IMAGE_CONFIG = {
    "Software": {"setting": "modern tech startup office with dual monitors and code on screen", "attire": "smart casual navy blazer over a crew neck t-shirt"},
    "Datos": {"setting": "data analytics workspace with dashboards on large screens", "attire": "business casual button-down shirt"},
    "Biomedic": {"setting": "biomedical research laboratory with microscopes", "attire": "white lab coat over professional shirt"},
    "Civil": {"setting": "architecture office with building blueprints and scale models", "attire": "dress shirt with rolled sleeves, safety helmet on desk nearby"},
    "Mecanico": {"setting": "advanced mechanical engineering workshop with prototypes", "attire": "professional polo shirt with company lanyard"},
    "Quimic": {"setting": "modern chemistry laboratory with glass equipment and colorful solutions", "attire": "lab coat with safety goggles pushed up on forehead"},
    "Inteligencia Artificial": {"setting": "AI research lab with neural network visualizations on screens", "attire": "casual tech hoodie under a blazer"},
    "Ciberseguridad": {"setting": "cybersecurity operations center with multiple monitors showing code", "attire": "dark tactical-style business casual"},
    "Biotecnologia": {"setting": "biotech clean room laboratory with advanced equipment", "attire": "sterile lab coat and professional appearance"},
    "Ambiental": {"setting": "green sustainable office with plants and nature views through windows", "attire": "eco-friendly business casual with field vest"},
    "Electric": {"setting": "electrical engineering lab with circuit boards and oscilloscopes", "attire": "professional polo with tool belt nearby"},
    "Industrial": {"setting": "modern smart factory floor with robotic arms in background", "attire": "safety vest over dress shirt, hard hat on table"},
    "Fisic": {"setting": "physics research facility with particle accelerator equipment", "attire": "academic casual tweed blazer with open collar shirt"},
    "Matematico": {"setting": "university professor office with whiteboards full of equations", "attire": "casual academic style with corduroy blazer"},
    "Biolog": {"setting": "tropical field research station with specimen samples", "attire": "field research vest over casual shirt"},
    "Telecomunicaciones": {"setting": "telecommunications tower facility control room", "attire": "technical business casual with company badge"},
    "Materiales": {"setting": "materials science lab with electron microscope", "attire": "lab coat with protective eyewear on head"},
    "Sistemas": {"setting": "enterprise IT operations center with server racks", "attire": "smart casual with company polo"},
    "Petroleo": {"setting": "petroleum engineering office with geological maps and drill models", "attire": "professional dress shirt with oil industry hard hat on shelf"},
    "Aeroespacial": {"setting": "aerospace facility with satellite components in background", "attire": "NASA-style professional jumpsuit or business formal"},
    "Medic": {"setting": "modern hospital consultation room with medical equipment", "attire": "white medical coat with stethoscope around neck"},
    "Abogad": {"setting": "prestigious law firm office with leather-bound legal books", "attire": "formal dark pinstripe suit with silk tie"},
    "Administrad": {"setting": "executive corner office in a glass skyscraper with city views", "attire": "premium business suit with power tie"},
    "Negocios": {"setting": "international conference center or global trade office with world map", "attire": "sophisticated international business attire"},
}

# ===== DATA ARRAYS =====

MALE_FIRST = [
    "Carlos", "Miguel", "Andres", "Jorge", "Ricardo", "Fernando", "Roberto", "Alejandro",
    "Daniel", "David", "Santiago", "Sebastian", "Eduardo", "Gabriel", "Manuel", "Francisco",
    "Luis", "Javier", "Hector", "Ramon", "Oscar", "Pablo", "Nicolas", "Enrique",
    "Guillermo", "Martin", "Rafael", "Tomas", "Ignacio", "Emilio", "Arturo", "Sergio",
    "Rodrigo", "Alfonso", "Gustavo", "Felipe", "Adrian", "Angel", "Camilo", "Mateo",
    "Ivan", "Cesar", "Raul", "Hugo", "Ernesto", "Marcos", "Diego", "Julio", "Armando", "Alvaro"
]

FEMALE_FIRST = [
    "Maria", "Ana", "Carolina", "Gabriela", "Valentina", "Isabella", "Sofia", "Natalia",
    "Daniela", "Camila", "Laura", "Andrea", "Patricia", "Veronica", "Claudia", "Silvia",
    "Elena", "Mariana", "Fernanda", "Paola", "Diana", "Alejandra", "Lucia", "Rosa",
    "Carmen", "Monica", "Sandra", "Cecilia", "Adriana", "Gloria", "Teresa", "Paula",
    "Catalina", "Beatriz", "Lorena", "Marcela", "Viviana", "Juliana", "Angelica", "Liliana",
    "Yolanda", "Pilar", "Ximena", "Renata", "Soledad", "Rocio", "Amanda", "Estela", "Ines", "Karla"
]

LAST_NAMES = [
    "Gonzalez", "Rodriguez", "Martinez", "Lopez", "Hernandez", "Garcia", "Perez", "Sanchez",
    "Ramirez", "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Cruz", "Morales",
    "Reyes", "Gutierrez", "Ortiz", "Ramos", "Castillo", "Mendoza", "Vargas", "Romero",
    "Castro", "Jimenez", "Ruiz", "Herrera", "Medina", "Aguilar", "Vega", "Contreras",
    "Delgado", "Molina", "Silva", "Munoz", "Rojas", "Salazar", "Navarro", "Paredes",
    "Cordoba", "Valencia", "Rios", "Guerrero", "Acosta", "Campos", "Espinoza", "Leon", "Suarez", "Pineda"
]

STEM_PROFESSIONS_M = [
    "Ingeniero de Software", "Cientifico de Datos", "Ingeniero Biomedico",
    "Ingeniero Civil", "Ingeniero Mecanico", "Ingeniero Quimico",
    "Investigador en Inteligencia Artificial", "Especialista en Ciberseguridad",
    "Investigador en Biotecnologia", "Ingeniero Ambiental",
    "Ingeniero Electrico", "Ingeniero Industrial", "Fisico",
    "Matematico", "Biologo", "Ingeniero de Telecomunicaciones",
    "Cientifico en Materiales", "Analista de Sistemas",
    "Ingeniero de Petroleo", "Ingeniero Aeroespacial"
]
STEM_PROFESSIONS_F = [
    "Ingeniera de Software", "Cientifica de Datos", "Ingeniera Biomedica",
    "Ingeniera Civil", "Ingeniera Mecanica", "Ingeniera Quimica",
    "Investigadora en Inteligencia Artificial", "Especialista en Ciberseguridad",
    "Investigadora en Biotecnologia", "Ingeniera Ambiental",
    "Ingeniera Electrica", "Ingeniera Industrial", "Fisica",
    "Matematica", "Biologa", "Ingeniera de Telecomunicaciones",
    "Cientifica en Materiales", "Analista de Sistemas",
    "Ingeniera de Petroleo", "Ingeniera Aeroespacial"
]

NON_STEM_M = ["Medico", "Abogado", "Administrador de Empresas", "Especialista en Negocios Internacionales"]
NON_STEM_F = ["Medica", "Abogada", "Administradora de Empresas", "Especialista en Negocios Internacionales"]

PROJECT_NAMES = {
    "Software": [
        "Plataforma de Automatizacion Empresarial", "Sistema de Gestion Cloud Nativo",
        "Aplicacion de Telemedicina Avanzada", "Motor de Busqueda Semantico",
        "Plataforma de E-commerce Inteligente", "Sistema de Microservicios Escalable"
    ],
    "Datos": [
        "Modelo Predictivo para Salud Publica", "Analisis de Big Data en Finanzas",
        "Sistema de Recomendacion con Machine Learning", "Plataforma de Analitica en Tiempo Real",
        "Pipeline de Datos para Investigacion Genomica", "Dashboard de Inteligencia de Negocios"
    ],
    "Biomedic": [
        "Dispositivo de Diagnostico Portatil", "Protesis Inteligente con Sensores IoT",
        "Sistema de Monitoreo Cardiaco Remoto", "Implante Neural de Nueva Generacion",
        "Equipo de Imagenologia de Bajo Costo", "Sensor Biomedico para Diabetes"
    ],
    "Civil": [
        "Puente Antisismico de Fibra de Carbono", "Sistema de Drenaje Urbano Sostenible",
        "Edificio Verde de Alto Rendimiento", "Infraestructura Resiliente al Cambio Climatico",
        "Red de Transporte Inteligente", "Proyecto de Vivienda Social Sustentable"
    ],
    "Mecanico": [
        "Motor de Hidrogeno de Alta Eficiencia", "Robot Industrial Colaborativo",
        "Sistema de Manufactura Aditiva", "Turbina Eolica de Nueva Generacion",
        "Vehiculo Autonomo de Carga", "Prototipo de Exoesqueleto Mecanico"
    ],
    "Quimic": [
        "Catalizador para Energia Limpia", "Material Biodegradable Innovador",
        "Proceso de Desalinizacion Eficiente", "Bateria de Estado Solido",
        "Nanomaterial para Purificacion de Agua", "Polimero Inteligente Termoresponsivo"
    ],
    "Inteligencia Artificial": [
        "Sistema de Vision por Computador Medico", "Modelo de Lenguaje para Espanol Legal",
        "Red Neuronal para Prediccion Climatica", "Agente IA para Automatizacion",
        "Sistema de Reconocimiento de Voz Multilingue", "IA Generativa para Diseno"
    ],
    "Ciberseguridad": [
        "Plataforma de Deteccion de Amenazas con IA", "Sistema de Autenticacion Biometrica",
        "Framework de Seguridad Zero Trust", "Herramienta de Analisis Forense Digital",
        "Protocolo de Cifrado Post-Cuantico", "Red de Defensa Cibernetica Autonoma"
    ],
    "Biotecnologia": [
        "Terapia Genica para Enfermedades Raras", "Vacuna de ARN Mensajero Optimizada",
        "Cultivo Celular para Carne Sintetica", "Biorreactor de Microalgas",
        "Edicion Genetica CRISPR Mejorada", "Biomaterial para Regeneracion Osea"
    ],
    "Ambiental": [
        "Sistema de Captura de Carbono", "Planta de Reciclaje Inteligente",
        "Restauracion de Ecosistemas con Drones", "Modelo de Economia Circular Industrial",
        "Tratamiento de Aguas con Biotecnologia", "Red de Monitoreo Ambiental IoT"
    ],
    "Electric": [
        "Red Electrica Inteligente con IA", "Sistema de Almacenamiento de Energia Solar",
        "Chip de Potencia de Nueva Generacion", "Inversor Solar de Alta Eficiencia",
        "Sistema de Carga Rapida para EVs", "Microrred Autonoma Rural"
    ],
    "Industrial": [
        "Optimizacion de Cadena de Suministro", "Fabrica Inteligente 4.0",
        "Sistema Lean de Produccion Automatizada", "Logistica Predictiva con Machine Learning",
        "Gemelo Digital de Planta Industrial", "Automatizacion Robotica de Procesos"
    ],
    "Fisic": [
        "Detector de Particulas Subatomicas", "Simulacion de Materiales Cuanticos",
        "Laser de Femtosegundos para Medicina", "Modelo de Materia Oscura",
        "Sensor Optico de Alta Precision", "Acelerador de Particulas Compacto"
    ],
    "Matematico": [
        "Algoritmo de Optimizacion Combinatoria", "Modelo Estocastico para Finanzas",
        "Criptografia Basada en Teoria de Numeros", "Simulacion Numerica de Fluidos",
        "Sistema de Prediccion Epidemiologica", "Framework de Computacion Cuantica"
    ],
    "Biolog": [
        "Estudio de Biodiversidad Amazonica", "Terapia con Celulas Madre",
        "Secuenciacion Genomica de Patogenos", "Conservacion de Especies en Peligro",
        "Microbioma Humano y Nutricion", "Biomonitoreo con eDNA Ambiental"
    ],
    "Telecomunicaciones": [
        "Red 5G de Bajo Consumo", "Sistema Satelital de Comunicaciones",
        "Fibra Optica de Ultra Capacidad", "IoT para Ciudades Inteligentes",
        "Protocolo de Comunicacion Cuantica", "Antena MIMO Masiva"
    ],
    "Materiales": [
        "Superconductor a Temperatura Ambiente", "Grafeno para Electronica Flexible",
        "Aleacion Metalica de Alta Entropia", "Composite Aeronautico Ligero",
        "Ceramica Avanzada para Proteccion Termica", "Material Piezoelectrico Nano"
    ],
    "Sistemas": [
        "Arquitectura de Microservicios Enterprise", "Plataforma de Computacion en la Nube",
        "Sistema ERP de Nueva Generacion", "Infraestructura DevOps Automatizada",
        "Plataforma de Datos Distribuida", "Sistema de Gestion Hospitalario"
    ],
    "Petroleo": [
        "Metodo de Extraccion Sostenible", "Simulacion de Yacimientos con IA",
        "Tecnologia de Recuperacion Mejorada", "Sensor de Monitoreo de Pozos IoT",
        "Refineria de Bajo Impacto Ambiental", "Sistema de Prevencion de Derrames"
    ],
    "Aeroespacial": [
        "Propulsor Ionico de Alta Eficiencia", "Satelite de Observacion Terrestre",
        "Vehiculo de Reentrada Reutilizable", "Drone de Vigilancia Autonomo",
        "Sistema de Navegacion Espacial", "Material Ablativo para Reentrada"
    ],
    "Medic": [
        "Protocolo de Telemedicina Rural", "Sistema de Diagnostico Asistido por IA",
        "Terapia Personalizada contra Cancer", "Programa de Salud Preventiva Comunitaria",
        "Dispositivo de Monitoreo de Glucosa", "Red de Hospitales Inteligentes"
    ],
    "Abogad": [
        "Marco Legal para IA y Datos", "Programa de Justicia Digital",
        "Plataforma de Resolucion de Conflictos Online", "Reforma de Propiedad Intelectual Tech",
        "Sistema de Compliance Automatizado", "Programa de Acceso a Justicia"
    ],
    "Administrad": [
        "Modelo de Gestion Agil Corporativa", "Plataforma de Transformacion Digital",
        "Sistema de Indicadores de Rendimiento", "Programa de Innovacion Empresarial",
        "Estrategia de Expansion Multinacional", "Framework de Gobierno Corporativo"
    ],
    "Negocios": [
        "Estrategia de Comercio Transfronterizo", "Plataforma de Exportacion Digital",
        "Red de Distribucion Latinoamericana", "Programa de Inversion Extranjera",
        "Acuerdo Comercial Bilateral", "Hub de Innovacion Internacional"
    ],
}

COUNTRIES_WEIGHTED = ["Colombia"] * 30 + ["Venezuela"] * 25 + ["Mexico"] * 20 + ["Ecuador"] * 15 + ["Argentina"] * 10
PREV_STATUS_WEIGHTED = ["Asylum Pending"] * 60 + ["Visa TN"] * 20 + ["Visa de Turista"] * 20

QUOTES = [
    "Gracias a URPE, pude demostrar que mi trabajo tiene un impacto real en Estados Unidos.",
    "Nunca pense que mi perfil profesional calificaria, pero el equipo encontro la estrategia perfecta.",
    "El proceso fue mas rapido de lo que imaginaba. URPE hizo todo mas claro.",
    "Mi caso parecia complicado, pero el equipo de URPE lo manejo con total profesionalismo.",
    "La clave fue documentar bien mi trayectoria, y URPE me guio en cada paso.",
    "Despues de anos de incertidumbre, finalmente tengo estabilidad migratoria.",
    "El equipo entendio perfectamente mi campo profesional y como presentarlo ante USCIS.",
    "URPE transformo mi ansiedad en confianza. El resultado hablo por si solo.",
    "Mi familia y yo estamos agradecidos. Este proceso cambio nuestras vidas.",
    "Recomiendo URPE a cualquier profesional latino que busque su green card.",
    "La estrategia que disenaron para mi caso fue brillante y efectiva.",
    "Pense que tendria que esperar anos, pero URPE acelero todo el proceso.",
    "Lo mejor fue la comunicacion constante. Siempre supe en que etapa estaba mi caso.",
    "El analisis inicial de elegibilidad fue clave para entender mis posibilidades reales.",
    "URPE no solo gestiono mi caso, me educo sobre todo el proceso migratorio.",
    "Mi experiencia con URPE fue excepcional de principio a fin.",
    "Gracias al equipo, pude enfocarme en mi trabajo mientras ellos manejaban todo.",
    "La inversion valio cada centavo. Ahora tengo la libertad de crecer profesionalmente.",
    "URPE encontro fortalezas en mi perfil que yo ni sabia que tenia.",
    "El proceso fue transparente y sin sorpresas. Exactamente lo que necesitaba.",
    "Llegue con muchas dudas y URPE las resolvio todas con datos y experiencia.",
    "Mi aprobacion llego antes de lo esperado. Estoy impresionado con la eficiencia.",
    "URPE entiende las necesidades unicas de los profesionales latinoamericanos.",
    "El equipo juridico es excepcional. Conocen cada detalle de la ley de inmigracion.",
    "Mi caso fue aprobado sin RFE. Eso dice mucho de la calidad del trabajo de URPE.",
    "Desde la primera consulta supe que estaba en buenas manos.",
    "URPE me ayudo a ver mi carrera desde una perspectiva completamente nueva.",
    "El seguimiento personalizado marco la diferencia en mi experiencia.",
    "Ahora puedo planificar mi futuro en EE.UU. con total tranquilidad.",
    "La paciencia y dedicacion del equipo fueron fundamentales para mi caso.",
]

KEY_ADVICE_POOL = [
    "Documenta cada logro profesional con metricas concretas",
    "Manten publicaciones academicas y patentes al dia",
    "Consigue cartas de recomendacion de expertos reconocidos",
    "No subestimes tu experiencia internacional",
    "Prepara tu caso con al menos 6 meses de anticipacion",
    "Organiza toda tu evidencia antes de iniciar el proceso",
    "Busca asesoramiento legal especializado desde el inicio",
    "Mantente actualizado sobre cambios en politicas migratorias",
    "La evidencia de impacto nacional es clave para EB-2 NIW",
    "Las citas de tus publicaciones fortalecen enormemente el caso",
    "Incluye cobertura mediatica de tu trabajo si la tienes",
    "Las membresias en organizaciones profesionales suman puntos",
    "Documenta cualquier premio o reconocimiento recibido",
    "Manten un portafolio actualizado de tus proyectos",
    "La constancia y paciencia son fundamentales en el proceso",
    "Registra todas las conferencias donde has participado",
    "Las revisiones de pares de tus publicaciones son valiosas",
    "Cuantifica el impacto economico de tu trabajo cuando sea posible",
    "Solicita testimonios de colegas internacionales",
    "Mantente activo en tu campo durante todo el proceso",
]

# ===== Variety modifiers - GENUINE, imperfect, real-looking =====
LIGHTING_STYLES = [
    "natural daylight from a window", "overcast outdoor light",
    "warm indoor ambient light, slightly yellow", "harsh midday sun with shadows",
    "soft cloudy day lighting", "fluorescent office light, slightly green tint",
    "evening golden hour through blinds", "cafeteria lighting",
    "natural shade under a tree", "mixed indoor lighting"
]
EXPRESSIONS = [
    "natural half-smile, slightly tired eyes", "serious thoughtful look, mid-conversation",
    "genuine laugh showing teeth, eyes squinting", "relaxed neutral expression, looking slightly off camera",
    "subtle smirk, one eyebrow slightly raised", "friendly but distracted expression, looking to the side",
    "calm expression with slight bags under eyes", "mid-sentence expression, mouth slightly open",
    "warm but reserved smile, closed lips", "concentrated frown, deep in thought"
]
HAIR_M = [
    "slightly messy dark hair", "receding hairline with gray temples", "thick unkempt black curly hair",
    "buzz cut with some gray", "thinning hair combed to the side", "wild curly hair slightly overgrown",
    "bald head with goatee", "short hair needing a cut, slightly long on the sides",
    "salt and pepper hair, uncombed", "dark hair with visible gray roots"
]
HAIR_F = [
    "messy bun with loose strands", "natural curly hair, slightly frizzy",
    "straight dark hair with split ends, no styling", "short pixie cut, low maintenance",
    "thick wavy hair in a simple ponytail", "shoulder-length hair tucked behind ears, no product",
    "natural graying hair worn proudly", "braided hair, simple style",
    "windblown hair, no effort to fix it", "medium hair with visible roots growing out"
]
SKIN_TONES = [
    "warm olive skin with visible pores", "light brown skin with sun spots",
    "tan mestizo complexion with laugh lines", "deep brown skin with natural texture",
    "golden caramel skin with freckles", "weathered olive skin from years of work",
    "light skin with redness on cheeks", "dark complexion with smile wrinkles"
]
CASUAL_CLOTHING = [
    "worn polo shirt with the collar slightly bent",
    "faded t-shirt with jeans",
    "simple button-down with sleeves rolled up",
    "plain crew neck sweater, slightly oversized",
    "wrinkled dress shirt, no tie, untucked",
    "old university hoodie, well loved",
    "casual denim jacket over a solid color tee",
    "medical scrubs, clearly end of shift",
    "simple henley shirt, top buttons open",
    "cardigan over a rumpled blouse",
    "leather jacket over a plain white shirt",
    "simple V-neck shirt, nothing fancy",
    "plaid flannel shirt, sleeves pushed up",
    "plain gray zip-up hoodie, half open",
    "casual linen shirt, slightly wrinkled from the day",
    "striped polo, untucked",
    "basic black turtleneck, minimalist",
    "company branded polo, a bit faded from washing",
    "light windbreaker jacket, unzipped",
    "cotton blazer over a casual graphic tee",
    "knit sweater with visible wear at the elbows",
    "chambray work shirt, soft from many washes",
]
# ===== Photo styles - like REAL people's social media / WhatsApp photos =====
SELFIE_STYLES = [
    # Selfies
    "selfie taken with front camera, arm visible at bottom, slight lens distortion on face",
    "bathroom mirror selfie, phone visible in reflection, messy background",
    "car selfie, seatbelt visible, dashboard reflection on face",
    "elevator mirror selfie, fluorescent lighting from above",
    "selfie at a restaurant table, plates and glasses blurred behind",
    "quick selfie in a hallway, motion blur on edges",
    "selfie with sunglasses pushed up on head, outdoors",
    # Taken by someone else casually
    "photo taken by a friend at a dinner table, flash too bright, red eyes slightly",
    "candid photo at a family gathering, caught mid-laugh, someone's arm in frame",
    "photo at a graduation or ceremony, bad angle from below",
    "someone snapped this while they were talking, not posed at all",
    "group photo cropped to just show one person, edge of someone else's shoulder visible",
    "photo in a living room couch, TV light in background",
    "standing outside a house, taken by a family member, slightly tilted",
    "at a park with kids playground blurred behind, weekend dad/mom energy",
    # Work but unglamorous
    "at a tiny cubicle desk, motivational calendar on the wall behind",
    "in a basic office with drop ceiling tiles and a water cooler",
    "standing in front of a whiteboard with scribbles, lanyard around neck",
    "at a folding table in a community center, papers everywhere",
    "on a video call, webcam angle from below showing ceiling",
    # Real life moments
    "waiting in line at a coffee shop, coat on, looking at phone then up at camera",
    "walking on a sidewalk, wind in hair, blurry buildings behind",
    "at a laundromat, sitting on a plastic chair, reading something",
    "in a grocery store parking lot, shopping bags in hand",
    "on public transit, seated by the window, city passing behind",
    "at a kids soccer game, folding chair, casual weekend clothes",
    "cooking in a small kitchen, apron on, looking up from the stove",
    "at a birthday party, paper plates and cake in background",
]

REAL_IMPERFECTIONS = [
    "slightly blurry, phone camera quality",
    "harsh flash creating shiny forehead and dark shadows behind",
    "grainy low-light photo, some noise visible",
    "overexposed from window light behind them",
    "slightly out of focus, autofocus missed a bit",
    "camera tilted about 5 degrees, not perfectly straight",
    "jpeg compression artifacts visible, shared via WhatsApp quality",
    "background completely blown out from bright sunlight",
    "indoor yellow tungsten lighting making skin look warm",
    "mixed lighting, half face in shadow half in light",
]


def _get_image_config(profession):
    """Get profession-specific image setting and attire."""
    for key, config in PROFESSION_IMAGE_CONFIG.items():
        if key.lower() in profession.lower():
            return config
    return {"setting": "modern professional office", "attire": "business professional attire"}


def _build_image_prompt(gender, age, profession, index):
    """Build prompts that look like real people's phone photos, NOT professional photography."""
    gender_word = "man" if gender == "M" else "woman"
    gender_desc = "Latino" if gender == "M" else "Latina"
    hair = random.choice(HAIR_M if gender == "M" else HAIR_F)
    skin = random.choice(SKIN_TONES)
    expression = random.choice(EXPRESSIONS)
    clothing = random.choice(CASUAL_CLOTHING)
    scene = random.choice(SELFIE_STYLES)
    imperfection = random.choice(REAL_IMPERFECTIONS)

    prompt = (
        f"A {scene} of a {age}-year-old {gender_desc} {gender_word}, "
        f"{hair}, {skin}, {expression}, wearing {clothing}, "
        f"{imperfection}, "
        f"looks like a real photo from someone's phone gallery or Facebook profile, "
        f"absolutely NOT a professional photo, NOT studio lighting, NOT a model, "
        f"normal everyday person, the kind of photo you'd see on a real immigrant's social media"
    )
    return prompt


def _get_project_name(profession):
    for key, names in PROJECT_NAMES.items():
        if key.lower() in profession.lower():
            return random.choice(names)
    return random.choice(PROJECT_NAMES.get("Software", ["Proyecto de Innovacion Tecnologica"]))


def _get_processing_time():
    days = random.randint(15, 540)
    if days <= 30:
        return f"{days} dias"
    months = round(days / 30)
    if months == 1:
        return "1 mes"
    if months < 12:
        return f"{months} meses"
    years = months // 12
    rem = months % 12
    if rem == 0:
        return f"{years} ano" if years == 1 else f"{years} anos"
    base = f"{years} ano" if years == 1 else f"{years} anos"
    return f"{base} y {rem} meses"


def generate_case_data(count=100):
    """Generate structured data for N success stories (no images yet)."""
    cases = []
    used_names = set()

    genders = ["M"] * (count // 2) + ["F"] * (count - count // 2)
    random.shuffle(genders)

    stem_count = int(count * 0.6)
    non_stem_each = (count - stem_count) // 4
    remainder = count - stem_count - non_stem_each * 4

    prof_slots = []
    for i in range(stem_count):
        prof_slots.append(("STEM", i % len(STEM_PROFESSIONS_M)))
    for cat_idx in range(4):
        for _ in range(non_stem_each + (1 if cat_idx < remainder else 0)):
            prof_slots.append(("NON_STEM", cat_idx))
    random.shuffle(prof_slots)

    for i in range(count):
        gender = genders[i]
        pt, pi = prof_slots[i]

        while True:
            first = random.choice(MALE_FIRST if gender == "M" else FEMALE_FIRST)
            l1, l2 = random.choice(LAST_NAMES), random.choice(LAST_NAMES)
            name = f"{first} {l1} {l2}"
            if name not in used_names:
                used_names.add(name)
                break

        if pt == "STEM":
            profession = STEM_PROFESSIONS_M[pi] if gender == "M" else STEM_PROFESSIONS_F[pi]
        else:
            profession = NON_STEM_M[pi] if gender == "M" else NON_STEM_F[pi]

        visa_pool = ["EB-2 NIW"] * 85 + ["EB-1A"] * 10 + ["O-1"] * 5

        cases.append({
            "index": i,
            "name": name,
            "gender": gender,
            "age": random.randint(35, 60),
            "profession": profession,
            "country": random.choice(COUNTRIES_WEIGHTED),
            "previousStatus": random.choice(PREV_STATUS_WEIGHTED),
            "projectName": _get_project_name(profession),
            "visa": random.choice(visa_pool),
            "score": random.randint(40, 60),
            "processingTime": _get_processing_time(),
            "quote": random.choice(QUOTES),
            "keyAdvice": random.sample(KEY_ADVICE_POOL, k=random.randint(2, 3)),
        })

    return cases


def generate_image_and_upload(gemini_client, supabase_client, bucket, case, index, model="imagen-4.0-fast-generate-001", fal_api_key=None):
    """Generate a face image and upload to Supabase.
    Priority: fal.ai nano-banana (primary) -> Gemini Flash -> Gemini Imagen -> retry."""
    from google.genai import types as genai_types

    prompt = _build_image_prompt(case["gender"], case["age"], case["profession"], index)
    filename = f"face_{index:03d}_{case['gender'].lower()}_{uuid.uuid4().hex[:6]}.png"
    supabase_path = f"success-stories/faces/{filename}"

    max_retries = 3
    img_bytes = None

    for attempt in range(max_retries):
        # --- 1. fal.ai nano-banana (PRIMARY) ---
        if fal_api_key and not img_bytes:
            try:
                import fal_client
                os.environ['FAL_KEY'] = fal_api_key
                result = fal_client.subscribe(
                    'fal-ai/nano-banana',
                    arguments={'prompt': prompt, 'aspect_ratio': '1:1', 'num_images': 1}
                )
                if result.get("images") and len(result["images"]) > 0:
                    import urllib.request
                    img_url = result["images"][0]["url"]
                    with urllib.request.urlopen(img_url, timeout=30) as resp:
                        img_bytes = resp.read()
                    if img_bytes:
                        logger.info(f"[{index+1}] nano-banana OK")
            except Exception as e:
                logger.warning(f"[{index+1}] nano-banana failed: {str(e)[:80]}")

        # --- 2. Gemini Flash (fallback) ---
        if not img_bytes:
            try:
                response = gemini_client.models.generate_content(
                    model='gemini-2.0-flash-exp-image-generation',
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE']),
                )
                for part in response.candidates[0].content.parts:
                    if part.inline_data:
                        img_bytes = part.inline_data.data
                        break
                if img_bytes:
                    logger.info(f"[{index+1}] Gemini Flash OK")
            except Exception as e:
                logger.info(f"[{index+1}] Gemini Flash failed: {str(e)[:80]}")

        # --- 3. Gemini Imagen (fallback) ---
        if not img_bytes:
            try:
                response = gemini_client.models.generate_images(
                    model=model, prompt=prompt,
                    config=genai_types.GenerateImagesConfig(number_of_images=1),
                )
                if response.generated_images:
                    img_bytes = response.generated_images[0].image.image_bytes
                    logger.info(f"[{index+1}] Gemini Imagen OK")
            except Exception as e:
                logger.info(f"[{index+1}] Gemini Imagen failed: {str(e)[:80]}")

        if img_bytes:
            break

        wait = 15 * (attempt + 1)
        logger.info(f"[{index+1}] All failed attempt {attempt+1}/{max_retries}, waiting {wait}s...")
        time.sleep(wait)

    if not img_bytes:
        logger.error(f"[{index+1}/100] FAIL after {max_retries} retries: {case['name']}")
        return None

    try:
        supabase_client.storage.from_(bucket).upload(
            supabase_path, img_bytes,
            file_options={"content-type": "image/png", "upsert": "true"}
        )
        public_url = supabase_client.storage.from_(bucket).get_public_url(supabase_path)
        logger.info(f"[{index+1}/100] OK: {case['name']} -> Supabase")
        return public_url
    except Exception as e:
        logger.error(f"[{index+1}/100] Supabase FAIL {case['name']}: {e}")
        return None


# ===== Global generation status =====
_generation_status = {
    "running": False,
    "progress": 0,
    "total": 0,
    "errors": 0,
    "completed": False,
    "message": "",
    "started_at": None,
}


def get_generation_status():
    return dict(_generation_status)


async def run_generation(db, gemini_api_key: str, count: int = 100, fal_api_key: str = None):
    """Run the full generation pipeline in background."""
    global _generation_status
    from google import genai as google_genai
    from supabase import create_client

    _generation_status.update(running=True, progress=0, total=count, errors=0, completed=False,
                              message="Iniciando generacion...", started_at=datetime.now(timezone.utc).isoformat())

    try:
        gemini_client = google_genai.Client(api_key=gemini_api_key)
        supabase_url = os.environ.get("SUPABASE_STORAGE_URL")
        supabase_key = os.environ.get("SUPABASE_STORAGE_KEY")
        bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")

        if not supabase_url or not supabase_key:
            _generation_status.update(running=False, message="Error: SUPABASE_STORAGE_URL/KEY not configured")
            return

        supabase_client = create_client(supabase_url, supabase_key)

        # Clear existing stories
        _generation_status["message"] = "Limpiando datos anteriores..."
        await db.success_stories.delete_many({})

        # Generate case data
        _generation_status["message"] = "Generando datos de casos..."
        cases = generate_case_data(count)

        # Generate images and insert into DB
        request_count_this_minute = 0
        minute_start = time.time()

        for case in cases:
            i = case["index"]
            _generation_status["message"] = f"Generando imagen {i+1}/{count}: {case['name']}..."

            # Rate limiting: max 9 requests per minute to stay safe
            request_count_this_minute += 1
            if request_count_this_minute >= 9:
                elapsed = time.time() - minute_start
                if elapsed < 65:
                    wait = 65 - elapsed
                    _generation_status["message"] = f"Esperando rate limit ({int(wait)}s)... {i+1}/{count}"
                    await asyncio.sleep(wait)
                request_count_this_minute = 0
                minute_start = time.time()

            photo_url = await asyncio.to_thread(
                generate_image_and_upload, gemini_client, supabase_client, bucket, case, i,
                "imagen-4.0-fast-generate-001", fal_api_key
            )

            story = {
                "id": str(uuid.uuid4()),
                "name": case["name"],
                "gender": case["gender"],
                "age": case["age"],
                "profession": case["profession"],
                "country": case["country"],
                "previousStatus": case["previousStatus"],
                "projectName": case["projectName"],
                "visa": case["visa"],
                "photo": photo_url,
                "videoUrl": None,
                "videoThumbnail": None,
                "approvalDate": None,
                "processingTime": case["processingTime"],
                "score": case["score"],
                "quote": case["quote"],
                "keyAdvice": case["keyAdvice"],
                "featured": i < 6,
                "active": True,
                "views": random.randint(10, 500),
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }

            await db.success_stories.insert_one(story)

            if not photo_url:
                _generation_status["errors"] += 1

            _generation_status["progress"] = i + 1

        _generation_status.update(
            running=False, completed=True,
            message=f"Completado: {count} historias generadas ({_generation_status['errors']} errores de imagen)"
        )

    except Exception as e:
        logger.error(f"Generation pipeline error: {e}")
        _generation_status.update(running=False, message=f"Error fatal: {str(e)}")


async def run_photo_refresh(db, gemini_api_key: str, fal_api_key: str = None, offset: int = 0, batch_size: int = 20):
    """Regenerate ONLY photos for existing stories in batches, without deleting data."""
    global _generation_status
    from google import genai as google_genai
    from supabase import create_client

    _generation_status.update(running=True, progress=0, total=batch_size, errors=0, completed=False,
                              message=f"Regenerando fotos {offset+1}-{offset+batch_size}...",
                              started_at=datetime.now(timezone.utc).isoformat())

    try:
        gemini_client = google_genai.Client(api_key=gemini_api_key)
        supabase_url = os.environ.get("SUPABASE_STORAGE_URL")
        supabase_key = os.environ.get("SUPABASE_STORAGE_KEY")
        bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")

        if not supabase_url or not supabase_key:
            _generation_status.update(running=False, message="Error: SUPABASE_STORAGE no configurado")
            return

        supabase_client = create_client(supabase_url, supabase_key)

        # Get stories sorted by creation, skip offset, take batch_size
        cursor = db.success_stories.find({}, {"_id": 0}).sort("createdAt", 1).skip(offset).limit(batch_size)
        stories = await cursor.to_list(length=batch_size)

        if not stories:
            _generation_status.update(running=False, completed=True, message="No hay historias en ese rango")
            return

        actual_count = len(stories)
        _generation_status["total"] = actual_count

        for idx, story in enumerate(stories):
            case = {
                "gender": story.get("gender", "M"),
                "age": story.get("age", 40),
                "profession": story.get("profession", "Professional"),
                "name": story.get("name", "Unknown"),
            }
            global_idx = offset + idx
            _generation_status["message"] = f"Foto {idx+1}/{actual_count}: {case['name']}..."

            photo_url = await asyncio.to_thread(
                generate_image_and_upload, gemini_client, supabase_client, bucket, case, global_idx,
                "imagen-4.0-fast-generate-001", fal_api_key
            )

            if photo_url:
                await db.success_stories.update_one(
                    {"id": story["id"]},
                    {"$set": {"photo": photo_url, "updatedAt": datetime.now(timezone.utc).isoformat()}}
                )
            else:
                _generation_status["errors"] += 1

            _generation_status["progress"] = idx + 1

            # Small delay between requests
            if idx < actual_count - 1:
                await asyncio.sleep(2)

        _generation_status.update(
            running=False, completed=True,
            message=f"Fotos {offset+1}-{offset+actual_count} actualizadas ({_generation_status['errors']} errores)"
        )

    except Exception as e:
        logger.error(f"Photo refresh error: {e}")
        _generation_status.update(running=False, message=f"Error: {str(e)}")
