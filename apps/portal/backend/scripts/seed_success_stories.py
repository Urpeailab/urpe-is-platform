"""
Seed script to generate 100 success stories with Gemini-generated face images.
Run: python scripts/seed_success_stories.py
"""
import random
import uuid
import os
import sys
import time
import logging
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pymongo import MongoClient
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

GEMINI_API_KEY = 'AIzaSyDUw5hpmldxVKtWzXUqF3bInBiS5UrOBrU'
FACES_DIR = Path(__file__).parent.parent / 'uploads' / 'faces'
FACES_DIR.mkdir(parents=True, exist_ok=True)

mongo_client = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = mongo_client[os.environ.get('DB_NAME', 'test_database')]

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

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

# 60% STEM
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

# Project names mapped to profession keywords
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

COUNTRIES_WEIGHTED = (
    ["Colombia"] * 30 + ["Venezuela"] * 25 + ["Mexico"] * 20 +
    ["Ecuador"] * 15 + ["Argentina"] * 10
)

PREV_STATUS_WEIGHTED = (
    ["Asylum Pending"] * 60 + ["Visa TN"] * 20 + ["Visa de Turista"] * 20
)

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
    "Las membresías en organizaciones profesionales suman puntos",
    "Documenta cualquier premio o reconocimiento recibido",
    "Manten un portafolio actualizado de tus proyectos",
    "La constancia y paciencia son fundamentales en el proceso",
    "Registra todas las conferencias donde has participado",
    "Las revisiones de pares de tus publicaciones son valiosas",
    "Cuantifica el impacto economico de tu trabajo cuando sea posible",
    "Solicita testimonios de colegas internacionales",
    "Mantente activo en tu campo durante todo el proceso",
]


def get_project_name(profession):
    """Get a project name related to the profession."""
    for key, names in PROJECT_NAMES.items():
        if key.lower() in profession.lower():
            return random.choice(names)
    # Fallback
    return random.choice(PROJECT_NAMES.get("Software", ["Proyecto de Innovacion Tecnologica"]))


def get_processing_time():
    """Generate a random processing time between 15 days and 18 months."""
    days = random.randint(15, 540)  # 15 days to ~18 months
    if days <= 30:
        return f"{days} dias"
    elif days <= 60:
        months = round(days / 30)
        return f"{months} mes" if months == 1 else f"{months} meses"
    else:
        months = round(days / 30)
        if months >= 12:
            years = months // 12
            remaining_months = months % 12
            if remaining_months == 0:
                return f"{years} ano" if years == 1 else f"{years} anos"
            else:
                return f"{years} ano y {remaining_months} meses" if years == 1 else f"{years} anos y {remaining_months} meses"
        else:
            return f"{months} meses"


def generate_face_image(gender, age, profession, name, index):
    """Generate a face image using Gemini Imagen 4.0 Fast."""
    gender_word = "man" if gender == "M" else "woman"
    gender_desc = "Latino" if gender == "M" else "Latina"
    
    prompt = (
        f"Professional corporate headshot photograph of a {age}-year-old {gender_desc} {gender_word}, "
        f"who is a {profession}, wearing formal business attire, "
        f"studio lighting, neutral gray background, looking directly at camera, "
        f"confident expression, high quality portrait photography, sharp focus, "
        f"natural skin tones, professional setting"
    )
    
    filename = f"face_{index:03d}_{gender.lower()}.png"
    filepath = FACES_DIR / filename
    
    # Skip if already exists
    if filepath.exists():
        logger.info(f"[{index+1}/100] Image already exists: {filename}")
        return filename
    
    try:
        response = gemini_client.models.generate_images(
            model='imagen-4.0-fast-generate-001',
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
            )
        )
        
        if response.generated_images:
            img_bytes = response.generated_images[0].image.image_bytes
            with open(filepath, 'wb') as f:
                f.write(img_bytes)
            logger.info(f"[{index+1}/100] Generated: {filename} ({len(img_bytes)} bytes)")
            return filename
        else:
            logger.warning(f"[{index+1}/100] No image generated for {name}")
            return None
    except Exception as e:
        logger.error(f"[{index+1}/100] Error generating image for {name}: {e}")
        return None


def generate_cases():
    """Generate all 100 success cases."""
    cases = []
    used_names = set()
    
    # Create gender distribution: ~50/50
    genders = ["M"] * 50 + ["F"] * 50
    random.shuffle(genders)
    
    # Create profession distribution: 60 STEM, 10 each of 4 non-STEM
    professions_indices = []
    # 60 STEM
    for i in range(60):
        professions_indices.append(("STEM", i % len(STEM_PROFESSIONS_M)))
    # 10 doctors
    for _ in range(10):
        professions_indices.append(("NON_STEM", 0))
    # 10 lawyers
    for _ in range(10):
        professions_indices.append(("NON_STEM", 1))
    # 10 business admin
    for _ in range(10):
        professions_indices.append(("NON_STEM", 2))
    # 10 international business
    for _ in range(10):
        professions_indices.append(("NON_STEM", 3))
    
    random.shuffle(professions_indices)
    
    for i in range(100):
        gender = genders[i]
        prof_type, prof_idx = professions_indices[i]
        
        # Name
        while True:
            first = random.choice(MALE_FIRST if gender == "M" else FEMALE_FIRST)
            last1 = random.choice(LAST_NAMES)
            last2 = random.choice(LAST_NAMES)
            full_name = f"{first} {last1} {last2}"
            if full_name not in used_names:
                used_names.add(full_name)
                break
        
        # Profession
        if prof_type == "STEM":
            profession = STEM_PROFESSIONS_M[prof_idx] if gender == "M" else STEM_PROFESSIONS_F[prof_idx]
        else:
            profession = NON_STEM_M[prof_idx] if gender == "M" else NON_STEM_F[prof_idx]
        
        age = random.randint(35, 60)
        country = random.choice(COUNTRIES_WEIGHTED)
        prev_status = random.choice(PREV_STATUS_WEIGHTED)
        score = random.randint(40, 60)
        project_name = get_project_name(profession)
        processing_time = get_processing_time()
        quote = random.choice(QUOTES)
        advice = random.sample(KEY_ADVICE_POOL, k=random.randint(2, 3))
        
        # Visa type (mostly EB-2 NIW with some variation)
        visa_weights = ["EB-2 NIW"] * 85 + ["EB-1A"] * 10 + ["O-1"] * 5
        visa = random.choice(visa_weights)
        
        cases.append({
            "index": i,
            "name": full_name,
            "gender": gender,
            "age": age,
            "profession": profession,
            "country": country,
            "previousStatus": prev_status,
            "projectName": project_name,
            "visa": visa,
            "score": score,
            "processingTime": processing_time,
            "quote": quote,
            "keyAdvice": advice,
        })
    
    return cases


def main():
    logger.info("=" * 60)
    logger.info("SEED SUCCESS STORIES - Starting")
    logger.info("=" * 60)
    
    # Check if stories already exist
    existing_count = db.success_stories.count_documents({})
    if existing_count >= 100:
        logger.info(f"Already {existing_count} stories in database. Skipping seed.")
        logger.info("To re-seed, drop the collection first: db.success_stories.drop()")
        return
    
    # Clear existing stories
    if existing_count > 0:
        logger.info(f"Clearing {existing_count} existing stories...")
        db.success_stories.delete_many({})
    
    # Generate case data
    logger.info("Generating 100 case data...")
    cases = generate_cases()
    
    # Generate images and insert into DB
    success_count = 0
    fail_count = 0
    
    for case in cases:
        i = case["index"]
        
        # Generate face image
        filename = generate_face_image(
            case["gender"], case["age"], case["profession"], case["name"], i
        )
        
        photo_url = f"/api/faces/{filename}" if filename else None
        
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
            "featured": i < 6,  # First 6 are featured
            "active": True,
            "views": random.randint(10, 500),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        
        try:
            db.success_stories.insert_one(story)
            success_count += 1
        except Exception as e:
            logger.error(f"Error inserting story {case['name']}: {e}")
            fail_count += 1
        
        # Small delay to avoid rate limiting
        if (i + 1) % 10 == 0:
            logger.info(f"Progress: {i+1}/100 stories processed")
            time.sleep(1)
    
    logger.info("=" * 60)
    logger.info(f"SEED COMPLETE: {success_count} success, {fail_count} failures")
    logger.info(f"Total stories in DB: {db.success_stories.count_documents({})}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
