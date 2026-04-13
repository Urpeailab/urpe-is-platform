import React, { useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  BookOpen, 
  FileText, 
  Scale, 
  Search,
  ExternalLink,
  BookMarked,
  Gavel,
  Library,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const LegalLibrary = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Leyes con texto completo en español
  const laws = [
    {
      id: 'law-001',
      title: 'INA § 203(b)(2) - EB-2 Inmigración Basada en Empleo',
      category: 'Basado en Empleo',
      description: 'Define la categoría de segunda preferencia basada en empleo, incluyendo las provisiones de Exención por Interés Nacional (NIW).',
      reference: '8 U.S.C. § 1153(b)(2)',
      year: '1990',
      popular: true,
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1153&num=0&edition=prelim',
      fullText: `LEY DE INMIGRACIÓN Y NACIONALIDAD - SECCIÓN 203(b)(2)

(A) En General — Las visas estarán disponibles, en un número que no exceda el 28.6 por ciento del nivel mundial, más cualquier visa no requerida para las clases especificadas en el párrafo (1), para inmigrantes calificados que sean miembros de profesiones con títulos avanzados o su equivalente, o que debido a su habilidad excepcional en las ciencias, artes o negocios, beneficiarán sustancialmente de manera prospectiva la economía nacional, los intereses culturales o educativos, o el bienestar de los Estados Unidos.

(B) Exención de Oferta de Trabajo (Exención por Interés Nacional)

(i) Exención por Interés Nacional — Sujeto a la cláusula (ii), el Fiscal General puede, cuando lo considere de interés nacional, eximir los requisitos del subpárrafo (A) de que los servicios del extranjero en las ciencias, artes, profesiones o negocios sean buscados por un empleador en los Estados Unidos.

(ii) Médicos trabajando en áreas de escasez — Los requisitos del subpárrafo (A) no aplicarán en el caso de un extranjero que sea médico, si:
  - (I) el extranjero ha completado un programa de residencia,
  - (II) el extranjero acepta trabajar tiempo completo como médico en un área designada como de escasez de profesionales de salud,
  - (III) el extranjero completará un servicio de al menos 5 años, y
  - (IV) la petición ha sido presentada con una determinación hecha por USCIS.

REQUISITOS CLAVE PARA CLASIFICACIÓN EB-2:

1. El nacional extranjero debe tener un título avanzado (maestría o superior) O
2. Tener un título de licenciatura más 5 años de experiencia progresiva en la especialidad, O
3. Tener habilidad excepcional en ciencias, artes o negocios

ESTÁNDARES DE EXENCIÓN POR INTERÉS NACIONAL (Matter of Dhanasar):

1. El proyecto propuesto tiene mérito sustancial e importancia nacional
2. El nacional extranjero está bien posicionado para avanzar el proyecto propuesto
3. En balance, sería beneficioso para Estados Unidos eximir los requisitos de oferta de trabajo y certificación laboral`
    },
    {
      id: 'law-002',
      title: 'INA § 203(b)(1) - EB-1 Trabajadores Prioritarios',
      category: 'Basado en Empleo',
      description: 'Define la categoría de primera preferencia para personas con habilidad extraordinaria, profesores e investigadores destacados, y ejecutivos multinacionales.',
      reference: '8 U.S.C. § 1153(b)(1)',
      year: '1990',
      popular: true,
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1153&num=0&edition=prelim',
      fullText: `LEY DE INMIGRACIÓN Y NACIONALIDAD - SECCIÓN 203(b)(1)

TRABAJADORES PRIORITARIOS - PRIMERA PREFERENCIA

(A) Extranjeros con Habilidad Extraordinaria (EB-1A)

Extranjeros con habilidad extraordinaria en las ciencias, artes, educación, negocios o atletismo que ha sido demostrada por aclamación nacional o internacional sostenida y cuyos logros han sido reconocidos en el campo a través de documentación extensa, que buscan entrar a Estados Unidos para continuar trabajando en el área de habilidad extraordinaria, y cuya entrada beneficiará sustancialmente de manera prospectiva a Estados Unidos.

Criterios (debe cumplir al menos 3 de 10):
1. Premios o reconocimientos de excelencia
2. Membresía en asociaciones que requieren logros destacados
3. Material publicado sobre el extranjero en medios profesionales
4. Participación como juez del trabajo de otros
5. Contribuciones originales de importancia significativa
6. Autoría de artículos académicos
7. Exhibición de trabajo en exposiciones artísticas
8. Rol de liderazgo en organizaciones distinguidas
9. Salario alto en relación con otros en el campo
10. Éxito comercial en las artes escénicas

(B) Profesores e Investigadores Destacados (EB-1B)

Extranjeros reconocidos internacionalmente como destacados en un área académica específica, con al menos 3 años de experiencia en enseñanza o investigación en el área académica, que buscan entrar a Estados Unidos para un puesto permanente de profesor o investigador en una universidad, institución de educación superior, o empleador privado.

(C) Ejecutivos y Gerentes Multinacionales (EB-1C)

Extranjeros que, en los 3 años precedentes, han sido empleados por al menos 1 año por una firma o corporación y que buscan entrar a Estados Unidos para continuar prestando servicios en capacidad gerencial o ejecutiva para la misma empresa o su filial o subsidiaria.

BENEFICIOS DE EB-1:

- No requiere certificación laboral (PERM)
- No requiere oferta de trabajo (solo EB-1A)
- Fechas de prioridad generalmente más actuales
- Proceso más rápido que otras categorías`
    },
    {
      id: 'law-003',
      title: 'INA § 245 - Ajuste de Estatus',
      category: 'Procedimientos',
      description: 'Proporciona la base legal para ajustar el estatus migratorio a residente permanente mientras se está en Estados Unidos.',
      reference: '8 U.S.C. § 1255',
      year: '1952',
      popular: true,
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1255&num=0&edition=prelim',
      fullText: `LEY DE INMIGRACIÓN Y NACIONALIDAD - SECCIÓN 245

§ 1255. Ajuste de Estatus de No Inmigrante a Persona Admitida para Residencia Permanente

(a) Estatus como Persona Admitida para Residencia Permanente

El estatus de un extranjero que fue inspeccionado y admitido o que entró bajo libertad condicional a los Estados Unidos puede ser ajustado por el Fiscal General, a su discreción y bajo las regulaciones que prescriba, al de un extranjero legalmente admitido para residencia permanente si:

(1) El extranjero hace una solicitud para dicho ajuste,

(2) El extranjero es elegible para recibir una visa de inmigrante y es admisible a los Estados Unidos para residencia permanente, y

(3) Una visa de inmigrante está inmediatamente disponible para el extranjero al momento de presentar la solicitud.

REQUISITOS CLAVE DE ELEGIBILIDAD:

1. Entrada Legal: Debe haber sido inspeccionado y admitido o entrado bajo libertad condicional
   - Excepción: INA § 245(i) para ciertos extranjeros

2. Mantenimiento de Estatus: Generalmente debe haber mantenido estatus legal
   - Excepciones para familiares inmediatos (INA § 245(c)(2))

3. Disponibilidad de Visa de Inmigrante: La fecha de prioridad debe estar vigente

4. Admisibilidad: No debe ser inadmisible bajo INA § 212

IMPEDIMENTOS PARA AJUSTE (INA § 245(c)):

- Extranjeros que entraron sin inspección (con excepciones)
- Extranjeros que no mantuvieron estatus legal (con excepciones)
- Extranjeros que trabajaron sin autorización (con excepciones)
- Extranjeros en ciertas categorías de no inmigrante

BENEFICIOS DE AJUSTE vs. PROCESAMIENTO CONSULAR:

- Permanecer en EE.UU. durante el proceso
- Autorización de trabajo (EAD) disponible
- Autorización de viaje (Advance Parole) disponible
- No se requiere sello de visa inicialmente`
    },
    {
      id: 'law-004',
      title: 'INA § 208 - Asilo',
      category: 'Humanitario',
      description: 'Establece el marco legal para la elegibilidad de asilo y procedimientos de solicitud.',
      reference: '8 U.S.C. § 1158',
      year: '1980',
      popular: true,
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1158&num=0&edition=prelim',
      fullText: `LEY DE INMIGRACIÓN Y NACIONALIDAD - SECCIÓN 208

§ 1158. Asilo

(a) Autoridad para Solicitar Asilo

(1) En General — Cualquier extranjero que esté físicamente presente en los Estados Unidos o que llegue a los Estados Unidos (ya sea o no en un puerto de entrada designado e incluyendo un extranjero que sea traído a los Estados Unidos después de haber sido interceptado en aguas internacionales o de Estados Unidos), independientemente del estatus de dicho extranjero, puede solicitar asilo de acuerdo con esta sección.

(2) Excepciones
  - (A) País tercero seguro
  - (B) Límite de tiempo - la solicitud debe presentarse dentro de 1 año de llegada (con excepciones)
  - (C) Negación previa - impide nueva solicitud a menos que haya cambio de circunstancias

(b) Condiciones para Otorgar Asilo

(1) En General — El Secretario de Seguridad Nacional o el Fiscal General puede otorgar asilo a un extranjero que ha solicitado asilo si determina que dicho extranjero es un refugiado según el significado de la sección 101(a)(42)(A).

DEFINICIÓN DE REFUGIADO (INA § 101(a)(42)(A)):

Una persona que no puede o no quiere regresar a su país de nacionalidad debido a persecución o un temor fundado de persecución por motivos de:
- Raza
- Religión
- Nacionalidad
- Pertenencia a un grupo social particular
- Opinión política

(2) Carga de la Prueba — La carga de la prueba recae en el solicitante para establecer que es un refugiado. El testimonio del solicitante, si es creíble, puede ser suficiente para sostener la carga de la prueba sin corroboración.

ESTÁNDARES CLAVE:

1. Persecución Pasada: Crea una presunción refutable de persecución futura
2. Temor Fundado: Debe mostrar tanto temor subjetivo como razonabilidad objetiva
3. Nexo: La persecución debe ser "por motivo de" un fundamento protegido
4. Grupo Social Particular: Debe definirse por características inmutables o fundamentales`
    },
    {
      id: 'law-005',
      title: 'INA § 201 - Inmigración Patrocinada por Familia',
      category: 'Basado en Familia',
      description: 'Gobierna las categorías de visa de familiares inmediatos y preferencias familiares.',
      reference: '8 U.S.C. § 1151',
      year: '1965',
      popular: true,
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1151&num=0&edition=prelim',
      fullText: `LEY DE INMIGRACIÓN Y NACIONALIDAD - SECCIÓN 201

§ 1151. Nivel Mundial de Inmigración

(a) En General — Excluyendo a los extranjeros descritos en la subsección (b), los extranjeros nacidos en un estado extranjero o área dependiente a quienes se les puede emitir visas de inmigrante o que de otra manera pueden adquirir el estatus de extranjero legalmente admitido para residencia permanente están limitados a:
  - (1) inmigrantes patrocinados por familia (480,000 anualmente)
  - (2) inmigrantes basados en empleo (140,000 anualmente)
  - (3) inmigrantes de diversidad (55,000 anualmente)

(b) Familiares Inmediatos (Sin Limitaciones Numéricas)

(2)(A)(i) Para propósitos de esta subsección, el término "familiares inmediatos" significa los hijos, cónyuges y padres de un ciudadano de los Estados Unidos, excepto que, en el caso de padres, dichos ciudadanos deben tener al menos 21 años de edad.

CATEGORÍAS DE PREFERENCIA FAMILIAR:

F1 - Primera Preferencia: Hijos e hijas solteros de ciudadanos estadounidenses (23,400 visas)

F2A - Segunda Preferencia A: Cónyuges e hijos de residentes permanentes (87,934 visas)

F2B - Segunda Preferencia B: Hijos e hijas solteros (21+) de residentes permanentes (26,266 visas)

F3 - Tercera Preferencia: Hijos e hijas casados de ciudadanos estadounidenses (23,400 visas)

F4 - Cuarta Preferencia: Hermanos y hermanas de ciudadanos estadounidenses adultos (65,000 visas)

PUNTOS CLAVE:

- Los familiares inmediatos NO están sujetos a límites anuales
- Otras categorías familiares tienen fechas de prioridad y tiempos de espera
- Aplican límites por país (no más del 7% de cualquier país individual)
- Los beneficiarios derivados (cónyuge/hijos) reciben la misma clasificación`
    },
    {
      id: 'law-006',
      title: 'INA § 101(a)(15)(H) - Visa H-1B Ocupación Especializada',
      category: 'No Inmigrante',
      description: 'Describe los requisitos para visas de ocupación especializada H-1B.',
      reference: '8 U.S.C. § 1101(a)(15)(H)',
      year: '1990',
      popular: true,
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1101&num=0&edition=prelim',
      fullText: `LEY DE INMIGRACIÓN Y NACIONALIDAD - SECCIÓN 101(a)(15)(H)

TRABAJADORES DE OCUPACIÓN ESPECIALIZADA H-1B

(H)(i)(b) Un extranjero que viene temporalmente a los Estados Unidos para realizar servicios en una ocupación especializada descrita en la sección 214(i)(1), que cumple con los requisitos para la ocupación especificados en la sección 214(i)(2), y con respecto a quien el Secretario de Trabajo determina y certifica que el empleador ha presentado una solicitud bajo la sección 212(n)(1).

DEFINICIÓN DE OCUPACIÓN ESPECIALIZADA (INA § 214(i)(1)):

Una ocupación que requiere:
- (A) Aplicación teórica y práctica de un cuerpo de conocimiento altamente especializado, Y
- (B) Obtención de un título de licenciatura o superior en la especialidad específica (o su equivalente) como mínimo para entrada en la ocupación en Estados Unidos

REQUISITOS PARA CLASIFICACIÓN H-1B:

1. Requisitos del Puesto:
- La posición debe calificar como "ocupación especializada"
- Título de licenciatura o superior en especialidad específica normalmente requerido
- Estándar de la industria requiriendo el título
- Naturaleza de las funciones tan especializadas que el conocimiento requerido usualmente está asociado con un título

2. Calificaciones del Beneficiario:
- Poseer un título de licenciatura estadounidense o equivalente en la especialidad
- Poseer un título extranjero equivalente a licenciatura estadounidense
- Tener educación y experiencia equivalente al título requerido
- Poseer licencia estatal sin restricciones si es requerida para la ocupación

3. Solicitud de Condición Laboral (LCA):
- El empleador debe certificar que pagará el salario prevaleciente
- Las condiciones de trabajo no afectarán adversamente a trabajadores estadounidenses similarmente empleados
- No hay huelga o cierre patronal en el lugar de empleo
- Se proporcionó aviso a los trabajadores

LÍMITE ANUAL: 65,000 límite regular + 20,000 para poseedores de maestría estadounidense
DURACIÓN: 3 años iniciales, extensible a 6 años en total (con excepciones)`
    }
  ];

  // Manuales
  const manuals = [
    {
      id: 'manual-001',
      title: 'Manual de Políticas USCIS - Volumen 6: Basado en Empleo',
      category: 'Empleo',
      description: 'Guía completa sobre categorías de inmigración basada en empleo incluyendo EB-1, EB-2, EB-3, Exenciones por Interés Nacional y certificación laboral PERM.',
      chapters: 12,
      lastUpdated: '2024',
      url: 'https://www.uscis.gov/policy-manual/volume-6',
      popular: true,
      content: `Volumen 6: Inmigrantes - Inmigración Basada en Empleo

Parte A - Políticas de Ajuste de Estatus
- Capítulo 1: Propósito y Antecedentes
- Capítulo 2: Requisitos de Elegibilidad
- Capítulo 3: Instrucciones de Presentación

Parte B - Inmigrantes Basados en Empleo
- Capítulo 1: Visión General de Inmigración Basada en Empleo
- Capítulo 2: Habilidad Extraordinaria (EB-1A)
- Capítulo 3: Profesores e Investigadores Destacados (EB-1B)
- Capítulo 4: Gerentes y Ejecutivos Multinacionales (EB-1C)

Parte F - Exención por Interés Nacional (NIW)
- Requisitos bajo Matter of Dhanasar
- Estándares de evaluación de evidencia
- Mérito sustancial e importancia nacional
- Bien posicionado para avanzar el proyecto

Parte G - Trabajadores Calificados y Profesionales (EB-3)
- Requisitos de certificación laboral
- Requisitos de oferta de trabajo
- Requisitos de salario`
    },
    {
      id: 'manual-002',
      title: 'Manual de Campo del Adjudicador Capítulo 22 - Asilo',
      category: 'Asilo',
      description: 'Procedimientos detallados para solicitudes de asilo, entrevistas de temor creíble, asilo defensivo y alivio relacionado.',
      chapters: 8,
      lastUpdated: '2023',
      url: 'https://www.uscis.gov/humanitarian/refugees-and-asylum',
      popular: true,
      content: `Manual de Campo del Adjudicador - Capítulo 22: Asilo

22.1 Visión General del Asilo
- Definición de refugiado
- Persecución vs. discriminación
- Fundamentos protegidos

22.2 Jurisdicción
- Asilo afirmativo (USCIS)
- Asilo defensivo (Corte de Inmigración)
- Proceso de temor creíble

22.3 Requisitos de Elegibilidad
- Plazo de presentación de un año
- Impedimentos de país tercero seguro
- Impedimento de reasentamiento firme
- Impedimentos criminales

22.4 Estándares de Evidencia
- Testimonio creíble
- Documentación de condiciones del país
- Testimonio de testigos expertos

22.5 Análisis de Grupo Social Particular
- Requisito de inmutabilidad
- Requisito de particularidad
- Requisito de distinción social`
    },
    {
      id: 'manual-003',
      title: 'Manual de Políticas USCIS - Volumen 12: Ciudadanía',
      category: 'Ciudadanía',
      description: 'Guía completa de requisitos de naturalización, procesamiento del N-400, exenciones y procedimientos de ceremonia.',
      chapters: 15,
      lastUpdated: '2024',
      url: 'https://www.uscis.gov/policy-manual/volume-12',
      popular: false,
      content: `Volumen 12: Ciudadanía y Naturalización

Parte A - Políticas de Ciudadanía y Naturalización
- Propósito y antecedentes
- Autoridad estatutaria y regulatoria

Parte D - Requisitos Generales de Naturalización
- Requisito de edad (18+)
- Estatus de residente permanente legal
- Residencia continua (5 años / 3 años para cónyuge de ciudadano)
- Presencia física (30 meses / 18 meses)
- Buen carácter moral
- Capacidad en idioma inglés
- Conocimiento cívico

Parte E - Exámenes de Inglés y Cívica
- Procedimientos de examen
- Exenciones (edad/discapacidad)
- Acomodaciones

Parte J - Juramento de Lealtad
- Requisitos del juramento
- Disposiciones de juramento modificado
- Ceremonias del juramento`
    },
    {
      id: 'manual-004',
      title: 'Guía de Adjudicación I-140',
      category: 'Formularios',
      description: 'Guía paso a paso para la adjudicación del Formulario I-140 Petición de Inmigrante para Trabajadores Extranjeros.',
      chapters: 6,
      lastUpdated: '2024',
      url: 'https://www.uscis.gov/i-140',
      popular: true,
      content: `Petición de Inmigrante I-140 para Trabajadores Extranjeros - Guía de Adjudicación

Capítulo 1: Visión General del Formulario
- Propósito del Formulario I-140
- Requisitos de presentación
- Requisitos de tarifa
- Disponibilidad de procesamiento premium

Capítulo 2: Habilidad Extraordinaria EB-1
- Requisitos de evidencia inicial
- Criterios regulatorios (8 de 10)
- Determinación de méritos final
- Análisis de dos pasos de Kazarian

Capítulo 3: Investigador Destacado EB-1B
- Requisitos del empleador
- Requisitos de posición de investigación
- Evidencia de reconocimiento internacional

Capítulo 4: Título Avanzado EB-2
- Requisitos educativos
- Equivalencia de experiencia
- Requisitos de certificación laboral

Capítulo 5: NIW EB-2
- Marco de Dhanasar
- Requisitos de evidencia
- Factores discrecionales

Capítulo 6: Trabajadores Calificados EB-3
- Requisitos PERM
- Requisitos del trabajo
- Calificaciones del beneficiario`
    }
  ];

  // Glosario con definiciones completas en español
  const glossary = [
    {
      id: 'term-001',
      term: 'Exención por Interés Nacional (NIW)',
      definition: `Una exención que permite a nacionales extranjeros con títulos avanzados o habilidad excepcional solicitar residencia permanente sin certificación laboral si su trabajo es de interés nacional para Estados Unidos.

Requisitos bajo Matter of Dhanasar (2016):

1. El proyecto propuesto tiene mérito sustancial e importancia nacional
2. El nacional extranjero está bien posicionado para avanzar el proyecto propuesto
3. En balance, sería beneficioso para Estados Unidos eximir los requisitos de oferta de trabajo y certificación laboral

Consideraciones Clave:

- No se requiere una ocupación específica
- Se permite el autoempleo
- Los proyectos empresariales pueden calificar
- El alcance geográfico puede ser nacional o global`,
      relatedLaw: 'INA § 203(b)(2)',
      category: 'EB-2'
    },
    {
      id: 'term-002',
      term: 'Habilidad Extraordinaria (EB-1A)',
      definition: `Clasificación de primera preferencia para personas que han alcanzado el nivel más alto en su campo y han recibido aclamación nacional o internacional sostenida.

Requisitos (debe cumplir al menos 3 de 10 criterios):

1. Premios o reconocimientos de excelencia menores a nivel nacional o internacional
2. Membresía en asociaciones que requieren logros destacados
3. Material publicado sobre el extranjero en medios profesionales o de comercio
4. Participación como juez del trabajo de otros en el campo
5. Contribuciones originales de importancia significativa en el campo
6. Autoría de artículos académicos en publicaciones profesionales
7. Exhibición de trabajo en exposiciones artísticas
8. Rol de liderazgo o crítico en organizaciones distinguidas
9. Salario alto o remuneración significativamente superior a otros en el campo
10. Éxito comercial en las artes escénicas

Beneficios:

- No requiere oferta de trabajo
- No requiere certificación laboral (PERM)
- Puede auto-peticionarse`,
      relatedLaw: 'INA § 203(b)(1)',
      category: 'EB-1'
    },
    {
      id: 'term-003',
      term: 'Ajuste de Estatus (AOS)',
      definition: `El proceso de solicitar el estatus de residente permanente legal (green card) mientras se está físicamente presente en Estados Unidos, en lugar de hacerlo a través de procesamiento consular en el extranjero.

Requisitos:

- Inspeccionado y admitido o entrado bajo libertad condicional a EE.UU.
- Elegible para una visa de inmigrante
- Visa de inmigrante inmediatamente disponible
- Admisible a Estados Unidos

Beneficios:

- Permanecer en EE.UU. durante el procesamiento
- Autorización de trabajo (EAD) disponible
- Autorización de viaje (Advance Parole) disponible
- Entrevista realizada domésticamente

Formulario: I-485, Solicitud para Registrar Residencia Permanente o Ajustar Estatus`,
      relatedLaw: 'INA § 245',
      category: 'Procedimientos'
    },
    {
      id: 'term-004',
      term: 'Persecución',
      definition: `Daño o sufrimiento infligido a un individuo por un gobierno o grupo que el gobierno no puede o no quiere controlar, por motivo de un fundamento protegido (raza, religión, nacionalidad, opinión política o pertenencia a un grupo social particular).

Estándares:

- Debe ser más severo que acoso o discriminación
- Debe elevarse al nivel de amenaza a la vida o libertad
- Puede ser daño físico, privación económica o daño psicológico

Tipos:

- Persecución Pasada: Crea presunción refutable de temor futuro
- Persecución Futura: Debe mostrar temor fundado (1 en 10 de probabilidad)

Requisito de Nexo:

La persecución debe ser "por motivo de" un fundamento protegido. Esto requiere mostrar que el perseguidor estaba motivado, al menos en parte, por una característica protegida.`,
      relatedLaw: 'INA § 208',
      category: 'Asilo'
    },
    {
      id: 'term-005',
      term: 'Familiar Inmediato',
      definition: `Familiares de ciudadanos estadounidenses que tienen derecho a visas de inmigrante sin limitaciones numéricas ni períodos de espera.

Categorías:

- Cónyuge: Esposo o esposa legal de ciudadano estadounidense
- Hijos solteros menores de 21: Incluyendo hijos adoptados e hijastros
- Padres: De ciudadanos estadounidenses que tienen 21 años o más

Beneficios:

- Sin límites anuales de visas
- Sin período de espera de fecha de prioridad
- Sin limitaciones por país
- Puede presentar I-485 inmediatamente si está en estatus válido`,
      relatedLaw: 'INA § 201',
      category: 'Familia'
    },
    {
      id: 'term-006',
      term: 'Ocupación Especializada (H-1B)',
      definition: `Una ocupación que requiere la aplicación teórica y práctica de un cuerpo de conocimiento altamente especializado y la obtención de un título de licenciatura o superior como mínimo para entrada en la ocupación.

Criterios (debe cumplir al menos uno):

1. Un título de licenciatura o superior es normalmente el requisito mínimo para la posición
2. El requisito de título es común en la industria para posiciones paralelas
3. El empleador normalmente requiere un título o su equivalente para la posición
4. La naturaleza de las funciones específicas es tan especializada que el conocimiento requerido usualmente está asociado con un título

Ejemplos de Ocupaciones Especializadas:

- Ingenieros
- Arquitectos
- Analistas de sistemas
- Contadores
- Médicos
- Abogados
- Profesores universitarios`,
      relatedLaw: 'INA § 101(a)(15)(H)',
      category: 'H-1B'
    },
    {
      id: 'term-007',
      term: 'Fecha de Prioridad',
      definition: `La fecha que establece el lugar de un solicitante en la fila para una visa de inmigrante.

Basado en Empleo:

- Si se requiere PERM: Fecha en que se presentó la solicitud PERM ante el DOL
- Si no se requiere PERM (EB-1, NIW): Fecha en que USCIS recibió el I-140

Basado en Familia:

- Fecha en que se presentó la petición I-130 ante USCIS

Importancia:

- Debe estar "vigente" (antes de la fecha de corte) para presentar I-485
- El Boletín de Visas se publica mensualmente por el Departamento de Estado
- Los límites por país pueden causar esperas más largas para algunas nacionalidades`,
      relatedLaw: 'INA § 203',
      category: 'General'
    },
    {
      id: 'term-008',
      term: 'Certificación Laboral (PERM)',
      definition: `El proceso por el cual un empleador demuestra al Departamento de Trabajo (DOL) que no hay trabajadores estadounidenses calificados, dispuestos y capaces disponibles para la posición ofrecida a un trabajador extranjero.

Pasos del Proceso:

1. Determinación del salario prevaleciente del DOL
2. Reclutamiento (órdenes de trabajo, anuncios, etc.)
3. Revisión de solicitudes de trabajadores estadounidenses
4. Presentar Formulario ETA 9089 ante el DOL

Excepciones (no se requiere PERM):

- Categorías EB-1
- Exención por Interés Nacional EB-2
- Ocupaciones del Schedule A (enfermeras, fisioterapeutas)`,
      relatedLaw: 'INA § 212(a)(5)(A)',
      category: 'Empleo'
    }
  ];

  // Jurisprudencia con resúmenes completos en español
  const caseLaw = [
    {
      id: 'case-001',
      title: 'Matter of Dhanasar',
      citation: '26 I&N Dec. 884 (AAO 2016)',
      court: 'AAO',
      year: '2016',
      category: 'EB-2 NIW',
      summary: `La Oficina de Apelaciones Administrativas (AAO) estableció un nuevo marco analítico para evaluar peticiones de Exención por Interés Nacional, reemplazando el estándar anterior de NYSDOT que había estado vigente desde 1998.

Antecedentes:

El Dr. Dhanasar, un científico de materiales, presentó una petición EB-2 NIW basada en su investigación en química verde y tecnología sostenible. El caso fue inicialmente negado y apelado a la AAO.

El Antiguo Estándar NYSDOT Requería:

1. Mérito intrínseco sustancial
2. Alcance nacional del beneficio
3. Demostrar que el interés nacional se vería afectado adversamente si se requiriera certificación laboral`,
      impact: `La Nueva Prueba de Tres Puntas de Dhanasar:

Punta 1: El proyecto propuesto tiene mérito sustancial E importancia nacional
- El mérito puede demostrarse en varios campos
- La importancia nacional no requiere impacto a nivel nacional
- Los beneficios remotos pueden calificar si son significativos

Punta 2: El nacional extranjero está bien posicionado para avanzar el proyecto propuesto
- Educación, habilidades, conocimiento y trayectoria
- Modelo o plan para actividad futura
- Progreso ya realizado
- Interés de partes relevantes

Punta 3: En balance, sería beneficioso para Estados Unidos eximir los requisitos de oferta de trabajo y certificación laboral

Impacto en la Práctica:

- Estándar más flexible que NYSDOT
- Emprendedores y autoempleados pueden calificar más fácilmente
- Enfoque en el posicionamiento del beneficiario, no solo el proyecto`,
      landmark: true
    },
    {
      id: 'case-002',
      title: 'Kazarian v. USCIS',
      citation: '596 F.3d 1115 (9th Cir. 2010)',
      court: 'Noveno Circuito',
      year: '2010',
      category: 'EB-1A',
      summary: `La Corte de Apelaciones del Noveno Circuito estableció el análisis de dos pasos para evaluar evidencia en casos de habilidad extraordinaria EB-1A, revocando la práctica de USCIS de descartar subjetivamente la evidencia.

Antecedentes:

El Dr. Kazarian, un físico, presentó una petición EB-1A por habilidad extraordinaria en las ciencias. USCIS negó la petición al descontar subjetivamente evidencia que cumplía con los criterios regulatorios. El Noveno Circuito revocó.

Enfoque Problemático de USCIS:

- Añadió requisitos extra-regulatorios
- Comparó al peticionario con científicos de élite en lugar de criterios regulatorios
- Hizo determinaciones subjetivas sobre la calidad de la evidencia`,
      impact: `El Análisis de Dos Pasos de Kazarian:

Paso Uno - Ejercicio de Conteo:

USCIS debe primero determinar, usando un estándar de "preponderancia de la evidencia", qué evidencia satisface los criterios regulatorios. En este paso:
- No añadir requisitos que no están en las regulaciones
- No comparar con otros beneficiarios
- No hacer juicios subjetivos de calidad
- Simplemente contar qué criterios se cumplen

Paso Dos - Determinación de Méritos Final:

Si el peticionario cumple al menos 3 de los 10 criterios, USCIS entonces evalúa si la totalidad de la evidencia demuestra:
- Aclamación nacional o internacional sostenida
- Reconocimiento como uno del pequeño porcentaje en la cima del campo

Impacto en la Práctica:

- Evaluación inicial más objetiva
- Marco claro para apelaciones
- Previene mover la meta`,
      landmark: true
    },
    {
      id: 'case-003',
      title: 'Matter of Acosta',
      citation: '19 I&N Dec. 211 (BIA 1985)',
      court: 'BIA',
      year: '1985',
      category: 'Asilo',
      summary: `La Junta de Apelaciones de Inmigración estableció la definición fundacional de "grupo social particular" como fundamento protegido para reclamaciones de asilo.

Antecedentes:

El Sr. Acosta, un taxista salvadoreño, reclamó persecución basada en su pertenencia a una cooperativa de taxistas que se negaron a participar en paros laborales exigidos por guerrilleros.

El Problema:

A diferencia de raza, religión, nacionalidad y opinión política, el término "grupo social particular" no tenía una definición clara en la ley de inmigración.`,
      impact: `El Enfoque Ejusdem Generis:

La BIA interpretó "grupo social particular" a la luz de los otros cuatro fundamentos protegidos, que comparten la característica común de ser:
- Inmutables (no pueden cambiarse), o
- Fundamentales para la identidad (no debería requerirse que se cambien)

Las Características Inmutables Incluyen:

- Características innatas (sexo, color, lazos de parentesco)
- Experiencias pasadas compartidas
- Características fundamentales para la identidad o conciencia

Prueba Moderna de Tres Partes:

1. Inmutabilidad o fundamentalidad
2. Particularidad (límites discretos y definidos)
3. Distinción social (la sociedad percibe al grupo como distinto)`,
      landmark: true
    },
    {
      id: 'case-004',
      title: 'INS v. Cardoza-Fonseca',
      citation: '480 U.S. 421 (1987)',
      court: 'Corte Suprema',
      year: '1987',
      category: 'Asilo',
      summary: `La Corte Suprema estableció que el estándar de "temor fundado de persecución" para asilo es diferente y más generoso que el estándar de "probabilidad clara" requerido para suspensión de deportación.

Antecedentes:

Una ciudadana nicaragüense solicitó asilo y suspensión de deportación, argumentando que enfrentaba persecución si regresaba a Nicaragua debido a las actividades políticas de su hermano.

La Pregunta Legal:

¿Es el estándar de "temor fundado" para asilo el mismo que el estándar de "probabilidad clara" para suspensión de deportación?`,
      impact: `Conclusiones de la Corte:

1. Estándares Diferentes:

- Asilo (INA § 208): Requiere "temor fundado de persecución" - estándar más bajo
- Suspensión de Deportación: Requiere demostrar que la vida o libertad "sería amenazada" - estándar más alto

2. Definición de "Temor Fundado":

El estándar de temor fundado incluye un componente subjetivo (temor genuino) y un componente objetivo (base razonable para el temor). No requiere demostrar que la persecución es "más probable que no".

3. El Estándar del 10%:

La Corte sugirió que incluso una probabilidad del 10% de persecución podría ser suficiente para establecer un "temor fundado".

Impacto en la Práctica:

- Facilitó la obtención de asilo al clarificar el estándar más bajo
- Distinguió claramente entre asilo y suspensión de deportación`,
      landmark: true
    },
    {
      id: 'case-005',
      title: 'Fiallo v. Bell',
      citation: '430 U.S. 787 (1977)',
      court: 'Corte Suprema',
      year: '1977',
      category: 'Familia',
      summary: `La Corte Suprema confirmó la constitucionalidad de las distinciones en la ley de inmigración basadas en el estatus de legitimidad, estableciendo el amplio poder del Congreso sobre inmigración.

Antecedentes:

Padres solteros y sus hijos impugnaron disposiciones de la INA que daban preferencia de inmigración solo a la relación entre madres solteras y sus hijos, pero no a padres solteros y sus hijos.`,
      impact: `Conclusiones de la Corte:

1. Poder Plenario del Congreso:

La Corte reafirmó que el Congreso tiene poder plenario sobre inmigración, sujeto solo a limitaciones constitucionales estrechas.

2. Estándar de Revisión Deferencial:

En asuntos de inmigración, las distinciones legales se mantienen si tienen una "base racional facialmente legítima":
- No se requiere escrutinio estricto
- Solo base racional

Impacto en la Práctica:

- Estableció deferencia judicial amplia en casos de inmigración familiar
- Limita impugnaciones constitucionales a leyes de inmigración`,
      landmark: true
    }
  ];

  const filterData = (data, query) => {
    if (!query) return data;
    return data.filter(item => 
      item.title?.toLowerCase().includes(query.toLowerCase()) ||
      item.term?.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase()) ||
      item.definition?.toLowerCase().includes(query.toLowerCase()) ||
      item.fullText?.toLowerCase().includes(query.toLowerCase())
    );
  };

  const filteredLaws = filterData(laws, searchQuery);
  const filteredManuals = filterData(manuals, searchQuery);
  const filteredGlossary = filterData(glossary, searchQuery);
  const filteredCaseLaw = filterData(caseLaw, searchQuery);

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 flex items-center gap-3 mb-2">
            <Library className="h-7 w-7 text-yellow-600" />
            Biblioteca Legal
          </h1>
          <p className="text-gray-600">
            Recursos completos de leyes de inmigración, manuales y jurisprudencia
          </p>
        </div>

        {/* Barra de Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar leyes, casos, términos..."
            className="pl-11 bg-white border-gray-300 text-gray-900 h-12 rounded-xl focus:border-yellow-500 focus:ring-yellow-500"
          />
        </div>

        {/* Pestañas */}
        <Tabs defaultValue="laws" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100 border border-gray-200 rounded-xl h-12">
            <TabsTrigger value="laws" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-600 rounded-lg">
              <Scale className="h-4 w-4 mr-2 hidden sm:inline" />
              Leyes
            </TabsTrigger>
            <TabsTrigger value="manuals" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-600 rounded-lg">
              <BookOpen className="h-4 w-4 mr-2 hidden sm:inline" />
              Manuales
            </TabsTrigger>
            <TabsTrigger value="glossary" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-600 rounded-lg">
              <BookMarked className="h-4 w-4 mr-2 hidden sm:inline" />
              Glosario
            </TabsTrigger>
            <TabsTrigger value="caselaw" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-600 rounded-lg">
              <Gavel className="h-4 w-4 mr-2 hidden sm:inline" />
              Casos
            </TabsTrigger>
          </TabsList>

          {/* Pestaña de Leyes */}
          <TabsContent value="laws" className="space-y-3 mt-6">
            {filteredLaws.map((law) => (
              <Card key={law.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <CardContent className="p-4">
                  {/* Header compacto */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <Scale className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-medium text-sm sm:text-base leading-tight">{law.title}</h3>
                      <p className="text-gray-500 text-xs mt-1">{law.reference}</p>
                    </div>
                    {law.popular && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs flex-shrink-0">
                        Popular
                      </Badge>
                    )}
                  </div>
                  
                  {/* Descripción corta */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{law.description}</p>
                  
                  {/* Botones */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => toggleExpand(law.id)}
                      variant="outline"
                      className="min-h-[48px] border-gray-300 text-gray-700 hover:bg-gray-100 justify-center"
                    >
                      {expandedItems[law.id] ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Ver Texto
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => window.open(law.url, '_blank')}
                      className="min-h-[48px] bg-yellow-500 hover:bg-yellow-600 text-black justify-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ir a la Ley
                    </Button>
                  </div>
                  
                  {/* Texto expandible */}
                  {expandedItems[law.id] && (
                    <div className="bg-gray-50 rounded-lg p-4 mt-4 border border-gray-200 max-h-[400px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-gray-800 text-sm font-sans leading-relaxed">
                        {law.fullText}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Pestaña de Manuales */}
          <TabsContent value="manuals" className="space-y-3 mt-6">
            {filteredManuals.map((manual) => (
              <Card key={manual.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <CardContent className="p-4">
                  {/* Header compacto */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-medium text-sm sm:text-base leading-tight">{manual.title}</h3>
                      <p className="text-gray-500 text-xs mt-1">{manual.chapters} capítulos · {manual.lastUpdated}</p>
                    </div>
                  </div>
                  
                  {/* Descripción corta */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{manual.description}</p>
                  
                  {/* Botones */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => toggleExpand(manual.id)}
                      variant="outline"
                      className="min-h-[48px] border-gray-300 text-gray-700 hover:bg-gray-100 justify-center"
                    >
                      {expandedItems[manual.id] ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Ver Índice
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => window.open(manual.url, '_blank')}
                      className="min-h-[48px] bg-yellow-500 hover:bg-yellow-600 text-black justify-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir
                    </Button>
                  </div>
                  
                  {/* Contenido expandible */}
                  {expandedItems[manual.id] && (
                    <div className="bg-gray-50 rounded-lg p-4 mt-4 border border-gray-200 max-h-[300px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-gray-800 text-sm font-sans leading-relaxed">
                        {manual.content}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Pestaña de Glosario */}
          <TabsContent value="glossary" className="space-y-3 mt-6">
            {filteredGlossary.map((item) => (
              <Card key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <CardContent className="p-4">
                  {/* Header con término */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <BookMarked className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-medium">{item.term}</h3>
                      <p className="text-gray-500 text-xs">{item.relatedLaw}</p>
                    </div>
                  </div>
                  
                  {/* Botón para expandir/colapsar */}
                  <Button
                    onClick={() => toggleExpand(item.id)}
                    variant="outline"
                    className="w-full min-h-[48px] border-gray-300 text-gray-700 hover:bg-gray-100 justify-center mb-3"
                  >
                    {expandedItems[item.id] ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Ocultar Definición
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Ver Definición Completa
                      </>
                    )}
                  </Button>
                  
                  {/* Definición expandible */}
                  {expandedItems[item.id] && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-[300px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-gray-800 text-sm font-sans leading-relaxed">
                        {item.definition}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Pestaña de Jurisprudencia */}
          <TabsContent value="caselaw" className="space-y-3 mt-6">
            {filteredCaseLaw.map((caseItem) => (
              <Card key={caseItem.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <CardContent className="p-4">
                  {/* Header compacto */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Gavel className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-gray-900 font-medium">{caseItem.title}</h3>
                        {caseItem.landmark && (
                          <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                            Histórico
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{caseItem.citation} · {caseItem.court} · {caseItem.year}</p>
                    </div>
                  </div>
                  
                  {/* Botones para expandir secciones */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Button
                      onClick={() => toggleExpand(`${caseItem.id}-summary`)}
                      variant="outline"
                      className="min-h-[48px] border-gray-300 text-gray-700 hover:bg-gray-100 justify-center text-sm"
                    >
                      {expandedItems[`${caseItem.id}-summary`] ? 'Ocultar' : 'Resumen'}
                    </Button>
                    <Button
                      onClick={() => toggleExpand(`${caseItem.id}-impact`)}
                      className="min-h-[48px] bg-yellow-500 hover:bg-yellow-600 text-black justify-center text-sm"
                    >
                      {expandedItems[`${caseItem.id}-impact`] ? 'Ocultar' : 'Impacto'}
                    </Button>
                  </div>
                  
                  {/* Resumen expandible */}
                  {expandedItems[`${caseItem.id}-summary`] && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-3 max-h-[250px] overflow-y-auto">
                      <h4 className="text-yellow-600 font-medium text-sm mb-2">Resumen del Caso</h4>
                      <pre className="whitespace-pre-wrap text-gray-800 text-sm font-sans leading-relaxed">
                        {caseItem.summary}
                      </pre>
                    </div>
                  )}
                  
                  {/* Impacto expandible */}
                  {expandedItems[`${caseItem.id}-impact`] && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200 max-h-[250px] overflow-y-auto">
                      <h4 className="text-green-700 font-medium text-sm mb-2">Impacto Legal</h4>
                      <pre className="whitespace-pre-wrap text-gray-800 text-sm font-sans leading-relaxed">
                        {caseItem.impact}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Banner Informativo */}
        <Card className="bg-blue-50 border border-blue-200 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Recurso Educativo</h3>
                <p className="text-gray-700 text-sm">
                  Esta biblioteca se proporciona con fines educativos. Para asesoría legal específica sobre tu caso, consulta con tu asesor asignado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
