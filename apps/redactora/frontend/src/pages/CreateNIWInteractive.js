import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Download, Loader2, ArrowLeft, ArrowRight, Save, CheckCircle, RefreshCw, Upload, Globe, AlertCircle, AlertTriangle, Copy, Sparkles, Languages, Play, Edit, Wand2, Plus, Rocket, X, Filter, Info, Key, List, Monitor, Search, Star, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AsyncSelect from 'react-select/async';
import { API, BACKEND_URL } from '../utils/constants';

// NIW Section titles
const NIW_SECTION_TITLES = [
  "I. Cover Page",
  "II. Executive Summary",
  "III. Statement of Substantial Merit & National Importance (Prong 1)",
  "IV. Problem & National Context",
  "IV-B. Petitioner's Qualifications & Demonstrated Capacity (Prong 2)",
  "V. Objectives",
  "VI. Indicators & Metrics",
  "VII. Scope & Deliverables",
  "VIII. Execution Plan by Phases",
  "IX. Capital-Free Start Strategy",
  "X. Methodology",
  "XI. Risk Management & Assumptions",
  "XII. Expected Results & Impact",
  "XIII. Governance, Ethics & Compliance",
  "XIV. Monitoring & Evaluation",
  "XV. Empirical Basis & References",
  "XVI. Annexes",
  "XVII. Balance of Factors & Waiver Justification (Prong 3)"
];

const CreateNIWInteractive = () => {
  const [step, setStep] = useState('cv'); // cv, project_names, details, generating, review
  const [cvData, setCvData] = useState({
    applicant_name: '',
    applicant_cv: '',
    patent_info: '',
    custom_project_suggestion: '', // NEW: Custom project suggestion
    language: 'en'
  });
  const [projectNameSuggestions, setProjectNameSuggestions] = useState([]);
  const [projectRecommendation, setProjectRecommendation] = useState(null); // { recommended_index, from, reason }
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [formData, setFormData] = useState({
    project_title: '',
    applicant_name: '',
    applicant_cv: '',
    project_idea: '',
    patent_info: '',
    language: 'en',
    apply_graphic_design: false,
    design_description: '',
    client_id: ''
  });
  const [niwId, setNiwId] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [cvInputMode, setCvInputMode] = useState('text'); // 'text' or 'pdf'
  const [savingDraft, setSavingDraft] = useState(false); // ⭐ Estado para guardar borrador
  
  // ⭐ NUEVO: Estado para generación completa (BETA)
  const [generatingComplete, setGeneratingComplete] = useState(false);
  const [completeGenerationProgress, setCompleteGenerationProgress] = useState(0);
  
  // ⭐ NUEVO: Estado para progreso visual (Bug #2)
  const [visualProgress, setVisualProgress] = useState(0);
  
  // ⭐ NUEVO: Estado para idioma actual (bilingüe)
  const [currentLanguage, setCurrentLanguage] = useState('es'); // 'es' o 'en'
  const [regeneratingOtherLanguage, setRegeneratingOtherLanguage] = useState(false);
  
  // ⭐ NUEVO: Estados para Edición Global con IA
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [aiEditInstructions, setAiEditInstructions] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [showAIEditResults, setShowAIEditResults] = useState(false);
  const [aiEditResults, setAiEditResults] = useState(null);
  
  // ⭐ Función para edición global con IA
  const handleAIGlobalEdit = async () => {
    if (!aiEditInstructions.trim() || !niwId) return;
    
    setAiEditLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/ai-edit/${niwId}`,
        {
          edit_instructions: aiEditInstructions,
          language: currentLanguage
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setAiEditResults(response.data);
        setShowAIEditModal(false);
        setShowAIEditResults(true);
        
        // Recargar las secciones actualizadas
        const niwResponse = await axios.get(`${API}/business-plans/in-progress/${niwId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (niwResponse.data && niwResponse.data.sections) {
          setSections(niwResponse.data.sections.sort((a, b) => a.number - b.number));
          // Actualizar la sección actual si fue modificada
          const updatedCurrentSection = niwResponse.data.sections.find(s => s.number === sectionNumber);
          if (updatedCurrentSection) {
            setCurrentSection(updatedCurrentSection);
          }
        }
        
        toast.success(`✅ ${response.data.total_sections_modified} secciones modificadas exitosamente`);
      } else {
        toast.error('No se pudieron aplicar los cambios');
      }
    } catch (error) {
      console.error('Error en edición con IA:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar la edición con IA');
    } finally {
      setAiEditLoading(false);
    }
  };
  
  // ⭐ Helper function para obtener contenido según idioma
  const getCurrentContent = (section) => {
    if (!section) return '';
    
    // Si tiene estructura bilingüe nueva
    if (section.content_es || section.content_en) {
      return currentLanguage === 'es' ? section.content_es : section.content_en;
    }
    
    // Fallback para estructura antigua (backward compatibility)
    return section.content || '';
  };
  
  // ⭐ SISTEMA DE PLANTILLAS para evaluaciones - evita traducciones mixtas
  const evaluationTemplates = {
    es: {
      character_exceeds: (count, max) => `El conteo de caracteres excede el máximo de ${max} caracteres (actualmente ${count} caracteres). Debe reducirse.`,
      character_below: (count, min) => `El conteo de caracteres está por debajo del mínimo requerido de ${min} caracteres (actualmente ${count} caracteres).`,
      too_detailed: 'Algún contenido está más detallado de lo necesario para una página de portada y se superpone con lo que típicamente está reservado para secciones posteriores.',
      has_conclusion: 'La sección termina con una frase de conclusión que debe eliminarse.',
      extended_summary: 'Incluye un Resumen Ejecutivo extendido y descripción detallada del rol técnico, contribuyendo a longitud excesiva.',
      verbose_content: 'Algunas oraciones son algo verbosas y podrían ser optimizadas mientras se preserva el significado para asegurar cumplimiento con el límite de caracteres.',
      overlaps_sections: 'Algunas secciones anticipan argumentos analíticos que podrían ser más apropiados en secciones dedicadas.',
      needs_trimming: (current, min, max) => `El conteo de caracteres debe estar entre ${min}-${max} caracteres (actualmente ${current} caracteres). Necesita ajustarse.`,
      slightly_above: (current, max) => `El conteo de caracteres excede el máximo de ${max} caracteres (actualmente ${current} caracteres). Debe reducirse.`,
      alignment_issue: 'Aunque esto generalmente se alinea con los estándares NIW de USCIS y toca la importancia nacional, podría vincular más explícitamente y concisamente la plataforma específica del solicitante a prioridades nacionales concretas de EE.UU. (ej., órdenes ejecutivas específicas, iniciativas de modernización federal) dentro de un texto más corto.',
      
      feedback_reduce_length: (min, max) => `Reducir la longitud para estar dentro del rango de ${min}-${max} caracteres. Ajustar el contenido manteniendo los puntos clave.`,
      feedback_focus: 'Mantén el foco en identificación concisa, título del proyecto, base legal, y una breve declaración de importancia nacional sin expandirse en exposición técnica o estratégica detallada que pertenece a secciones posteriores.',
      feedback_no_conclusion: 'No agregues frases de conclusión o párrafos de resumen al final de esta sección.',
      feedback_trim: (min, max) => `Ajustar el texto para permanecer dentro del rango ${min}-${max} caracteres. No exceder el máximo permitido.`,
      feedback_concise: 'Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto.'
    },
    en: {
      character_exceeds: (count, max) => `Character count exceeds the maximum of ${max} characters (currently ${count} characters). Must be reduced.`,
      character_below: (count, min) => `Character count is below the required minimum of ${min} characters (currently ${count} characters).`,
      too_detailed: 'Some content is more detailed than necessary for a cover page and overlaps with what is typically reserved for later sections.',
      has_conclusion: 'The section ends with a conclusion phrase that should be removed.',
      extended_summary: 'Includes extended Executive Summary and detailed technical role description, contributing to excessive length.',
      verbose_content: 'Some sentences are somewhat verbose and could be streamlined while preserving meaning to ensure compliance with the character limit.',
      overlaps_sections: 'Some sections anticipate analytical arguments that might be more appropriate in dedicated sections.',
      needs_trimming: (current, min, max) => `Character count must be between ${min}-${max} characters (currently ${current} characters). Needs adjustment.`,
      slightly_above: (current, max) => `Character count exceeds the maximum of ${max} characters (currently ${current} characters). Must be reduced.`,
      alignment_issue: 'While this generally aligns with USCIS NIW standards and touches on national importance, it could more explicitly and concisely tie the applicant\'s specific platform to concrete U.S. national priorities (e.g., specific executive orders, federal modernization initiatives) within a shorter text.',
      
      feedback_reduce_length: (min, max) => `Reduce the length to fall within the ${min}-${max} character range. Adjust content while maintaining key points.`,
      feedback_focus: 'Keep the focus on concise identification, project title, legal basis, and a brief statement of national importance without expanding into detailed technical or strategic exposition that belongs in later sections.',
      feedback_no_conclusion: 'Do not add conclusion phrases or summary paragraphs at the end of this section.',
      feedback_trim: (min, max) => `Adjust text to stay within the ${min}-${max} character range. Do not exceed the maximum allowed.`,
      feedback_concise: 'Maintain professional, USCIS-aligned tone and project specificity while making the text more compact.'
    }
  };

  // ⭐ Función para detectar el tipo de issue y devolver plantilla apropiada
  const getIssueTemplate = (issue, targetLang) => {
    if (!issue) return issue;
    
    const lower = issue.toLowerCase();
    const templates = evaluationTemplates[targetLang] || evaluationTemplates.es;
    
    // Detectar tipo de issue y usar plantilla
    if (lower.includes('exceed') || lower.includes('excede')) {
      // Extraer números si es posible
      const match = issue.match(/(\d+)/g);
      if (match && match.length >= 2) {
        return templates.character_exceeds(match[0], match[1] || '3000');
      }
      return templates.character_exceeds('', '3000');
    }
    
    if (lower.includes('detailed') || lower.includes('detallado') || lower.includes('cover page')) {
      return templates.too_detailed;
    }
    
    if (lower.includes('conclusion') || lower.includes('conclusión')) {
      return templates.has_conclusion;
    }
    
    if (lower.includes('executive summary') || lower.includes('resumen ejecutivo')) {
      return templates.extended_summary;
    }
    
    if (lower.includes('verbose') || lower.includes('verbosa')) {
      return templates.verbose_content;
    }
    
    if (lower.includes('overlap') || lower.includes('anticipate')) {
      return templates.overlaps_sections;
    }
    
    if (lower.includes('trimming') || lower.includes('recorte')) {
      const match = issue.match(/(\d+)/g);
      if (match && match.length >= 3) {
        return templates.needs_trimming(match[0], match[1] || '2500', match[2] || '3000');
      }
      return templates.needs_trimming('', '2500', '3000');
    }
    
    if (lower.includes('slightly') || lower.includes('ligeramente')) {
      const match = issue.match(/(\d+)/g);
      if (match && match.length >= 2) {
        return templates.slightly_above(match[0], match[1] || '3000');
      }
      return templates.slightly_above('', '3000');
    }
    
    if (lower.includes('aligns') || lower.includes('alinea') || lower.includes('uscis') || (lower.includes('national') && lower.includes('priorities'))) {
      return templates.alignment_issue;
    }
    
    // Si no coincide con ninguna plantilla, intentar traducción básica
    return issue;
  };

  // ⭐ Función para detectar el tipo de feedback y devolver plantilla apropiada
  const getFeedbackTemplate = (feedback, targetLang) => {
    if (!feedback) return feedback;
    
    const lower = feedback.toLowerCase();
    const templates = evaluationTemplates[targetLang] || evaluationTemplates.es;
    
    // Construir feedback completo basado en patrones detectados
    let result = '';
    
    if (lower.includes('reduce') || lower.includes('reducir')) {
      result += templates.feedback_reduce_length('2500', '3000') + ' ';
    }
    
    if (lower.includes('focus') || lower.includes('foco') || lower.includes('identification')) {
      result += templates.feedback_focus + ' ';
    }
    
    if (lower.includes('conclusion') || lower.includes('conclusión')) {
      result += templates.feedback_no_conclusion + ' ';
    }
    
    if (lower.includes('trim') || lower.includes('recortar')) {
      result += templates.feedback_trim('2500', '3000') + ' ';
    }
    
    if (lower.includes('professional') || lower.includes('profesional') || lower.includes('compact')) {
      result += templates.feedback_concise;
    }
    
    return result.trim() || feedback;
  };

  // ⭐ Función ULTRA AGRESIVA para traducir issues - todas las palabras en inglés
  const translateIssue = (issue, targetLang) => {
    if (!issue) return issue;
    
    // ⭐ PRIMERO: Intentar usar plantilla predefinida
    const template = getIssueTemplate(issue, targetLang);
    if (template !== issue) return template;
    
    if (targetLang === 'es') {
      // Traducción ULTRA AGRESIVA - cada palabra en inglés se traduce
      let translated = issue
        // ⭐ NUEVAS TRADUCCIONES basadas en texto real del usuario
        .replace(/carácter conteo exceeds el 3000-carácter máximo/gi, 'el conteo de caracteres excede el máximo de 3000 caracteres')
        .replace(/carácter conteo exceeds el/gi, 'el conteo de caracteres excede el')
        .replace(/Algunas content está más detailed de necessary for una cover page/gi, 'Algún contenido está más detallado de lo necesario para una página de portada')
        .replace(/overlaps con what está typically reserved for later sections/gi, 'se superpone con lo que típicamente está reservado para secciones posteriores')
        .replace(/extended Executive Summary y detailed technical role descripción/gi, 'Resumen Ejecutivo extendido y descripción detallada del rol técnico')
        .replace(/contributing para excessive length/gi, 'contribuyendo a longitud excesiva')
        .replace(/Algunas content/gi, 'Algún contenido')
        .replace(/está más detailed de necessary/gi, 'está más detallado de lo necesario')
        .replace(/for una cover page/gi, 'para una página de portada')
        .replace(/overlaps con what está/gi, 'se superpone con lo que está')
        .replace(/typically reserved for/gi, 'típicamente reservado para')
        .replace(/later sections/gi, 'secciones posteriores')
        .replace(/extended Executive Summary/gi, 'Resumen Ejecutivo extendido')
        .replace(/detailed technical role descripción/gi, 'descripción detallada del rol técnico')
        .replace(/contributing para/gi, 'contribuyendo a')
        .replace(/excessive length/gi, 'longitud excesiva')
        
        // Frases completas muy específicas
        .replace(/is slightly por encima el requerido máximo of/gi, 'está ligeramente por encima del máximo requerido de')
        .replace(/measured at approximately/gi, 'medido en aproximadamente')
        .replace(/but this is very tight and may exceed/gi, 'pero esto es muy ajustado y puede exceder')
        .replace(/depending on final formatoting\/encoding/gi, 'dependiendo del formato/codificación final')
        .replace(/needs trimming to safely fall dentro de/gi, 'necesita recorte para estar seguramente dentro de')
        .replace(/are somewhat verbose y podrían ser streamlined mientras se preservan meaning to ensure compliance with the character limit/gi, 'son algo verbosas y podrían ser optimizadas mientras se preserva el significado para asegurar cumplimiento con el límite de caracteres')
        .replace(/While la sección is generally strong and USCIS-aligned/gi, 'Aunque la sección es generalmente fuerte y alineada con USCIS')
        .replace(/it could emphasize more clearly that the described project is the applicant's own proposed endeavor/gi, 'podría enfatizar más claramente que el proyecto descrito es la propuesta propia del solicitante')
        .replace(/by explicitly tying the framework and implementations to/gi, 'vinculando explícitamente el marco y las implementaciones a')
        .replace(/planned work in the U\.S\. rather than sonar como a sector-wide description/gi, 'trabajo planificado en EE.UU. en lugar de sonar como una descripción del sector')
        
        // Frases medianas
        .replace(/character count exceeds the required/gi, 'el conteo de caracteres excede el requerido')
        .replace(/must be shortened to fall within/gi, 'debe acortarse para estar dentro de')
        .replace(/is slightly above/gi, 'está ligeramente por encima')
        .replace(/is slightly por encima/gi, 'está ligeramente por encima')
        .replace(/measured at/gi, 'medido en')
        .replace(/approximately/gi, 'aproximadamente')
        .replace(/but this is very tight/gi, 'pero esto es muy ajustado')
        .replace(/and may exceed/gi, 'y puede exceder')
        .replace(/depending on final/gi, 'dependiendo del')
        .replace(/formatoting/gi, 'formato')
        .replace(/encoding/gi, 'codificación')
        .replace(/needs trimming/gi, 'necesita recorte')
        .replace(/to safely fall/gi, 'para estar seguramente')
        .replace(/Some sentences/gi, 'Algunas oraciones')
        .replace(/are somewhat verbose/gi, 'son algo verbosas')
        .replace(/y podrían ser/gi, 'y podrían ser')
        .replace(/streamlined/gi, 'optimizadas')
        .replace(/mientras se preservan/gi, 'mientras se preserva')
        .replace(/meaning to/gi, 'el significado para')
        .replace(/ensure compliance with/gi, 'asegurar cumplimiento con')
        .replace(/the character limit/gi, 'el límite de caracteres')
        .replace(/is generally strong/gi, 'es generalmente fuerte')
        .replace(/USCIS-aligned/gi, 'alineada con USCIS')
        .replace(/it could emphasize/gi, 'podría enfatizar')
        .replace(/more clearly that/gi, 'más claramente que')
        .replace(/the described project/gi, 'el proyecto descrito')
        .replace(/is the applicant's own/gi, 'es la propuesta propia del')
        .replace(/proposed endeavor/gi, 'proyecto propuesto')
        .replace(/explicitly tying/gi, 'vinculando explícitamente')
        .replace(/the framework/gi, 'el marco')
        .replace(/and implementations/gi, 'y las implementaciones')
        .replace(/planned work/gi, 'trabajo planificado')
        .replace(/rather than/gi, 'en lugar de')
        .replace(/sonar como/gi, 'sonar como')
        .replace(/a sector-wide/gi, 'una descripción del sector')
        
        // Palabras individuales - MUY completo
        .replace(/\bexceeds\b/gi, 'excede')
        .replace(/\bcontent\b/gi, 'contenido')
        .replace(/\bdetailed\b/gi, 'detallado')
        .replace(/\bnecessary\b/gi, 'necesario')
        .replace(/\bfor\b/gi, 'para')
        .replace(/\bcover page\b/gi, 'página de portada')
        .replace(/\boverlaps\b/gi, 'se superpone')
        .replace(/\bwhat\b/gi, 'lo que')
        .replace(/\btypically\b/gi, 'típicamente')
        .replace(/\breserved\b/gi, 'reservado')
        .replace(/\blater\b/gi, 'posteriores')
        .replace(/\bsections\b/gi, 'secciones')
        .replace(/\bextended\b/gi, 'extendido')
        .replace(/\bExecutive Summary\b/gi, 'Resumen Ejecutivo')
        .replace(/\btechnical\b/gi, 'técnico')
        .replace(/\brole\b/gi, 'rol')
        .replace(/\bcontributing\b/gi, 'contribuyendo')
        .replace(/\bexcessive\b/gi, 'excesiva')
        .replace(/\blength\b/gi, 'longitud')
        .replace(/\brange\b/gi, 'rango')
        .replace(/\bhighest-level\b/gi, 'más alto nivel')
        .replace(/\bessential\b/gi, 'esenciales')
        .replace(/\bpoints\b/gi, 'puntos')
        .replace(/\bsuitable\b/gi, 'adecuados')
        .replace(/\bconcise\b/gi, 'concisa')
        .replace(/\bidentification\b/gi, 'identificación')
        .replace(/\btitle\b/gi, 'título')
        .replace(/\blegal basis\b/gi, 'base legal')
        .replace(/\bbrief\b/gi, 'breve')
        .replace(/\bstatement\b/gi, 'declaración')
        .replace(/\bexpanding\b/gi, 'expandirse')
        .replace(/\binto\b/gi, 'en')
        .replace(/\bstrategic\b/gi, 'estratégica')
        .replace(/\bexposition\b/gi, 'exposición')
        .replace(/\bbelongs\b/gi, 'pertenece')
        .replace(/\bis\b/gi, 'está')
        .replace(/\bslightly\b/gi, 'ligeramente')
        .replace(/\babove\b/gi, 'por encima')
        .replace(/\bof\b/gi, 'de')
        .replace(/\bat\b/gi, 'en')
        .replace(/\bbut\b/gi, 'pero')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bvery\b/gi, 'muy')
        .replace(/\btight\b/gi, 'ajustado')
        .replace(/\band\b/gi, 'y')
        .replace(/\bmay\b/gi, 'puede')
        .replace(/\bexceed\b/gi, 'exceder')
        .replace(/\bon\b/gi, 'en')
        .replace(/\bfinal\b/gi, 'final')
        .replace(/\bneeds\b/gi, 'necesita')
        .replace(/\bto\b/gi, 'para')
        .replace(/\bsafely\b/gi, 'seguramente')
        .replace(/\bfall\b/gi, 'estar')
        .replace(/\bwithin\b/gi, 'dentro de')
        .replace(/\bSome\b/gi, 'Algunas')
        .replace(/\bsentences\b/gi, 'oraciones')
        .replace(/\bare\b/gi, 'son')
        .replace(/\bsomewhat\b/gi, 'algo')
        .replace(/\bverbose\b/gi, 'verbosas')
        .replace(/\bcould\b/gi, 'podrían')
        .replace(/\bbe\b/gi, 'ser')
        .replace(/\bwhile\b/gi, 'mientras')
        .replace(/\bmeaning\b/gi, 'significado')
        .replace(/\bensure\b/gi, 'asegurar')
        .replace(/\bcompliance\b/gi, 'cumplimiento')
        .replace(/\bwith\b/gi, 'con')
        .replace(/\bthe\b/gi, 'el')
        .replace(/\bcharacter\b/gi, 'carácter')
        .replace(/\blimit\b/gi, 'límite')
        .replace(/\bgenerally\b/gi, 'generalmente')
        .replace(/\bstrong\b/gi, 'fuerte')
        .replace(/\bit\b/gi, 'esto')
        .replace(/\bemphasize\b/gi, 'enfatizar')
        .replace(/\bmore\b/gi, 'más')
        .replace(/\bclearly\b/gi, 'claramente')
        .replace(/\bthat\b/gi, 'que')
        .replace(/\bdescribed\b/gi, 'descrito')
        .replace(/\bproject\b/gi, 'proyecto')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bown\b/gi, 'propia')
        .replace(/\bproposed\b/gi, 'propuesto')
        .replace(/\bendeavor\b/gi, 'proyecto')
        .replace(/\bby\b/gi, 'mediante')
        .replace(/\bexplicitly\b/gi, 'explícitamente')
        .replace(/\btying\b/gi, 'vinculando')
        .replace(/\bframework\b/gi, 'marco')
        .replace(/\bimplementations\b/gi, 'implementaciones')
        .replace(/\bplanned\b/gi, 'planificado')
        .replace(/\bwork\b/gi, 'trabajo')
        .replace(/\bin\b/gi, 'en')
        .replace(/\brather\b/gi, 'en lugar')
        .replace(/\bthan\b/gi, 'de')
        .replace(/\ba\b/gi, 'una')
        .replace(/\bsector-wide\b/gi, 'del sector')
        .replace(/\bdescription\b/gi, 'descripción')
        .replace(/\bcharacters\b/gi, 'caracteres')
        .replace(/\bcount\b/gi, 'conteo')
        .replace(/\brequired\b/gi, 'requerido')
        .replace(/\bmaximum\b/gi, 'máximo')
        .replace(/\bminimum\b/gi, 'mínimo')
        .replace(/\bsection\b/gi, 'sección')
        .replace(/\bhas\b/gi, 'tiene')
        .replace(/\bno\b/gi, 'no')
        .replace(/\bconclusion\b/gi, 'conclusión')
        // ⭐ NUEVAS traducciones basadas en texto real del usuario
        .replace(/\baligns\b/gi, 'se alinea')
        .replace(/\balign\b/gi, 'alinear')
        .replace(/\btouches\b/gi, 'toca')
        .replace(/\btouch\b/gi, 'tocar')
        .replace(/\btie\b/gi, 'vincular')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bapplicant\b/gi, 'solicitante')
        .replace(/\bspecific\b/gi, 'específico')
        .replace(/\bplatform\b/gi, 'plataforma')
        .replace(/\bconcrete\b/gi, 'concretas')
        .replace(/\bpriorities\b/gi, 'prioridades')
        .replace(/\bpriority\b/gi, 'prioridad')
        .replace(/\bexecutive orders\b/gi, 'órdenes ejecutivas')
        .replace(/\bfederal\b/gi, 'federales')
        .replace(/\bmodernization\b/gi, 'modernización')
        .replace(/\binitiatives\b/gi, 'iniciativas')
        .replace(/\binitiative\b/gi, 'iniciativa')
        .replace(/\bshorter\b/gi, 'más corto')
        .replace(/\btext\b/gi, 'texto')
        .replace(/\bconcisely\b/gi, 'concisamente')
        .replace(/\bexplicitly\b/gi, 'explícitamente')
        .replace(/\bgenerally\b/gi, 'generalmente')
        .replace(/\bstandards\b/gi, 'estándares')
        .replace(/\bstandard\b/gi, 'estándar')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bmore\b/gi, 'más')
        .replace(/\bU\.S\.\b/gi, 'EE.UU.')
        .replace(/\bnational\b/gi, 'nacional')
        .replace(/\bimportance\b/gi, 'importancia')
        .replace(/\bwithin\b/gi, 'dentro de')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bthese\b/gi, 'estos')
        .replace(/\bwhile\b/gi, 'mientras')
        .replace(/\bwith\b/gi, 'con')
        .replace(/\bto\b/gi, 'para')
        .replace(/\bthe\b/gi, 'el')
        .replace(/\band\b/gi, 'y')
        .replace(/\be\.g\.\b/gi, 'por ejemplo')
        .replace(/\be\.g\b/gi, 'ej')
        // ⭐ MÁS traducciones basadas en errores del usuario
        .replace(/\belements\b/gi, 'elementos')
        .replace(/\bread\b/gi, 'se leen')
        .replace(/\bgeneric\b/gi, 'genérico')
        .replace(/\btécnico\b/gi, 'técnico')
        .replace(/\bexecution\b/gi, 'ejecución')
        .replace(/\bsteps\b/gi, 'pasos')
        .replace(/\buse\b/gi, 'uso')
        .replace(/\bDocker\b/gi, 'Docker')
        .replace(/\bGitHub\b/gi, 'GitHub')
        .replace(/\bPostgreSQL\b/gi, 'PostgreSQL')
        .replace(/\bRedis\b/gi, 'Redis')
        .replace(/\bCI\/CD\b/gi, 'CI/CD')
        .replace(/\bActions\b/gi, 'Actions')
        .replace(/\btightly\b/gi, 'estrechamente')
        .replace(/\btied\b/gi, 'vinculado')
        .replace(/\bespecífico\b/gi, 'específico')
        .replace(/\bimportancia\b/gi, 'importancia')
        .replace(/\boutcomes\b/gi, 'resultados')
        .replace(/\bservice industries\b/gi, 'industrias de servicios')
        .replace(/\bservice\b/gi, 'servicio')
        .replace(/\bindustries\b/gi, 'industrias')
        .replace(/\bsolicitante's\b/gi, 'del solicitante')
        .replace(/\bunique\b/gi, 'único')
        .replace(/\bcontributions\b/gi, 'contribuciones')
        .replace(/\bcontribution\b/gi, 'contribución')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bemphasize\b/gi, 'enfatizar')
        .replace(/\bhow\b/gi, 'cómo')
        .replace(/\beach\b/gi, 'cada')
        .replace(/\bphase\b/gi, 'fase')
        .replace(/\bconcretely\b/gi, 'concretamente')
        .replace(/\badvances\b/gi, 'avanza')
        .replace(/\bsubstantial\b/gi, 'sustancial')
        .replace(/\bmerit\b/gi, 'mérito')
        .replace(/\bProng\b/gi, 'Criterio')
        .replace(/\bbeyond\b/gi, 'más allá de')
        .replace(/\bdescribing\b/gi, 'describir')
        .replace(/\btools\b/gi, 'herramientas')
        .replace(/\benvironments\b/gi, 'entornos')
        .replace(/\benvironment\b/gi, 'entorno');
      
      return translated;
    } else if (targetLang === 'en') {
      // ⭐ Traducción ULTRA AGRESIVA de español a inglés
      return issue
        // Frases completas primero
        .replace(/el conteo de caracteres excede el requerido/gi, 'character count exceeds the required')
        .replace(/medido en aproximadamente/gi, 'measured at approximately')
        .replace(/pero esto es muy ajustado y puede exceder/gi, 'but this is very tight and may exceed')
        .replace(/dependiendo del formato\/codificación final/gi, 'depending on final formatting/encoding')
        .replace(/necesita recorte para estar seguramente dentro de/gi, 'needs trimming to safely fall within')
        .replace(/está ligeramente por encima del máximo requerido de/gi, 'is slightly above the required maximum of')
        .replace(/son algo verbosas y podrían ser optimizadas/gi, 'are somewhat verbose and could be streamlined')
        .replace(/mientras se preserva el significado para asegurar cumplimiento con el límite de caracteres/gi, 'while preserving meaning to ensure compliance with the character limit')
        .replace(/es generalmente fuerte y alineada con USCIS/gi, 'is generally strong and USCIS-aligned')
        .replace(/podría enfatizar más claramente que/gi, 'could emphasize more clearly that')
        .replace(/el proyecto descrito es la propuesta propia del/gi, 'the described project is the applicant\'s own proposed')
        .replace(/vinculando explícitamente el marco y las implementaciones a/gi, 'by explicitly tying the framework and implementations to')
        .replace(/trabajo planificado en EE.UU./gi, 'planned work in the U.S.')
        .replace(/en lugar de sonar como una descripción del sector/gi, 'rather than sounding like a sector-wide description')
        
        // Palabras individuales
        .replace(/\bestá\b/gi, 'is')
        .replace(/\bligeramente\b/gi, 'slightly')
        .replace(/\bpor encima\b/gi, 'above')
        .replace(/\bde\b/gi, 'of')
        .replace(/\ben\b/gi, 'at')
        .replace(/\bpero\b/gi, 'but')
        .replace(/\besto\b/gi, 'this')
        .replace(/\bmuy\b/gi, 'very')
        .replace(/\bajustado\b/gi, 'tight')
        .replace(/\by\b/gi, 'and')
        .replace(/\bpuede\b/gi, 'may')
        .replace(/\bexceder\b/gi, 'exceed')
        .replace(/\bfinal\b/gi, 'final')
        .replace(/\bnecesita\b/gi, 'needs')
        .replace(/\brecorte\b/gi, 'trimming')
        .replace(/\bpara\b/gi, 'to')
        .replace(/\bseguramente\b/gi, 'safely')
        .replace(/\bestar\b/gi, 'fall')
        .replace(/\bdentro de\b/gi, 'within')
        .replace(/\bAlgunas\b/gi, 'Some')
        .replace(/\boraciones\b/gi, 'sentences')
        .replace(/\bson\b/gi, 'are')
        .replace(/\balgo\b/gi, 'somewhat')
        .replace(/\bverbosas\b/gi, 'verbose')
        .replace(/\bpodrían\b/gi, 'could')
        .replace(/\bser\b/gi, 'be')
        .replace(/\boptimizadas\b/gi, 'streamlined')
        .replace(/\bmientras\b/gi, 'while')
        .replace(/\bse preserva\b/gi, 'preserving')
        .replace(/\bel significado\b/gi, 'meaning')
        .replace(/\basegurar\b/gi, 'ensure')
        .replace(/\bcumplimiento\b/gi, 'compliance')
        .replace(/\bcon\b/gi, 'with')
        .replace(/\bel límite\b/gi, 'the limit')
        .replace(/\bcaracteres\b/gi, 'characters')
        .replace(/\bes\b/gi, 'is')
        .replace(/\bgeneralmente\b/gi, 'generally')
        .replace(/\bfuerte\b/gi, 'strong')
        .replace(/\balineada\b/gi, 'aligned')
        .replace(/\bconteo de caracteres\b/gi, 'character count')
        .replace(/\bcarácter\b/gi, 'character')
        .replace(/\bcontenido\b/gi, 'content')
        .replace(/\bevidencia\b/gi, 'evidence')
        .replace(/\bsección\b/gi, 'section')
        .replace(/\bconclusión\b/gi, 'conclusion');
    }
    
    return issue;
  };
  
  // ⭐ Función ULTRA AGRESIVA para traducir feedback - cada palabra en inglés
  const translateFeedback = (feedback, targetLang) => {
    if (!feedback) return feedback;
    
    // ⭐ PRIMERO: Intentar usar plantilla predefinida
    const template = getFeedbackTemplate(feedback, targetLang);
    if (template !== feedback) return template;
    
    if (targetLang === 'es') {
      // Traducción ULTRA AGRESIVA palabra por palabra (fallback)
      return feedback
        // ⭐ NUEVAS TRADUCCIONES basadas en texto real del usuario
        .replace(/Reducir la longitud general para estar dentro del 2500–3000 character range by ajustando el Executive Summary y rol secciones/gi, 'Reducir la longitud general para estar dentro del rango de 2500-3000 caracteres ajustando el Resumen Ejecutivo y secciones de rol')
        .replace(/Mantenering only el highest-level, essential points suitable for una cover page/gi, 'Manteniendo solo los puntos de más alto nivel esenciales adecuados para una página de portada')
        .replace(/Mantén el foco en concise identification, proyecto title, legal basis, y una brief statement of importancia nacional/gi, 'Mantén el foco en identificación concisa, título del proyecto, base legal, y una breve declaración de importancia nacional')
        .replace(/sin expanding into detailed technical or strategic exposition that belongs in later secciones/gi, 'sin expandirse en exposición técnica o estratégica detallada que pertenece a secciones posteriores')
        .replace(/character range by ajustando/gi, 'rango de caracteres ajustando')
        .replace(/Mantenering only el/gi, 'Manteniendo solo el')
        .replace(/highest-level, essential points/gi, 'puntos de más alto nivel esenciales')
        .replace(/suitable for una cover page/gi, 'adecuados para una página de portada')
        .replace(/concise identification/gi, 'identificación concisa')
        .replace(/proyecto title/gi, 'título del proyecto')
        .replace(/legal basis/gi, 'base legal')
        .replace(/brief statement of/gi, 'breve declaración de')
        .replace(/sin expanding into/gi, 'sin expandirse en')
        .replace(/detailed technical or strategic exposition/gi, 'exposición técnica o estratégica detallada')
        .replace(/that belongs in later secciones/gi, 'que pertenece a secciones posteriores')
        
        // Frases largas primero (más específicas)
        .replace(/Reduce the overall length to fall within the 2500-3000 character requirement by tightening the Project Overview, Strategic Relevance, and Key Project Attributes\./gi, 'Reduce la longitud general para estar dentro del requisito de 2500-3000 caracteres ajustando el Resumen del Proyecto, Relevancia Estratégica y Atributos Clave del Proyecto.')
        .replace(/Keep the section focused on identification and a concise description of national importance, avoiding extended argumentation\./gi, 'Mantén la sección enfocada en la identificación y una descripción concisa de importancia nacional, evitando argumentación extendida.')
        .replace(/Do not add any conclusion-style wrap-up\./gi, 'No agregues ningún cierre estilo conclusión.')
        .replace(/Maintain professional, USCIS-aligned tone and project specificity while making the text more compact\./gi, 'Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto.')
        .replace(/Reduce the overall length to fall within the/gi, 'Reduce la longitud general para estar dentro del')
        .replace(/character requirement by tightening the/gi, 'requisito de caracteres ajustando el')
        .replace(/Project Overview, Strategic Relevance, and Key Project Attributes/gi, 'Resumen del Proyecto, Relevancia Estratégica y Atributos Clave del Proyecto')
        .replace(/Keep the section focused on identification and a concise description of/gi, 'Mantén la sección enfocada en la identificación y una descripción concisa de')
        .replace(/avoiding extended argumentation/gi, 'evitando argumentación extendida')
        .replace(/Do not add any conclusion-style wrap-up/gi, 'No agregues ningún cierre estilo conclusión')
        .replace(/Maintain professional, USCIS-aligned tone and project specificity while making the text more compact/gi, 'Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto')
        .replace(/Reduce the overall length so that the/gi, 'Reduce la longitud general para que el')
        .replace(/character count falls between/gi, 'conteo de caracteres esté entre')
        .replace(/and characters/gi, 'y caracteres')
        .replace(/primarily by tightening language in the/gi, 'principalmente ajustando el lenguaje en las secciones de')
        .replace(/Project Overview and Strategic Alignment/gi, 'Resumen del Proyecto y Alineación Estratégica')
        .replace(/Keep the content focused on/gi, 'Mantén el contenido enfocado en')
        .replace(/core project identification/gi, 'identificación central del proyecto')
        .replace(/the applicant's role/gi, 'el rol del solicitante')
        .replace(/a concise statement of/gi, 'una declaración concisa de')
        .replace(/Do not add any concluding phrases/gi, 'No agregues ninguna frase de conclusión')
        .replace(/or summary sentences at the end of the/gi, 'o frases de resumen al final de la')
        .replace(/Maintain focus on/gi, 'Mantén el foco en')
        .replace(/project identity/gi, 'identidad del proyecto')
        .replace(/applicant data/gi, 'datos del solicitante')
        .replace(/role/gi, 'rol')
        .replace(/clear articulation of/gi, 'articulación clara de')
        .replace(/national importance/gi, 'importancia nacional')
        .replace(/without drifting into explanatory/gi, 'sin desviarse hacia lenguaje explicativo')
        .replace(/strategic closure language/gi, 'o de cierre estratégico')
        .replace(/Keep the tone/gi, 'Mantén el tono')
        .replace(/Professional and USCIS-aligned/gi, 'Profesional y alineado con USCIS')
        .replace(/but more concise/gi, 'pero más conciso')
        .replace(/character count/gi, 'conteo de caracteres')
        .replace(/character requirement/gi, 'requisito de caracteres')
        .replace(/characters/gi, 'caracteres')
        .replace(/requirement/gi, 'requisito')
        .replace(/the section/gi, 'la sección')
        .replace(/Review/gi, 'Revisar')
        .replace(/review/gi, 'revisar')
        .replace(/Reduce/gi, 'Reducir')
        .replace(/reduce/gi, 'reducir')
        .replace(/overall/gi, 'general')
        .replace(/length/gi, 'longitud')
        .replace(/so that/gi, 'para que')
        .replace(/falls/gi, 'esté')
        .replace(/between/gi, 'entre')
        .replace(/primarily/gi, 'principalmente')
        .replace(/tightening/gi, 'ajustando')
        .replace(/language/gi, 'lenguaje')
        .replace(/sections/gi, 'secciones')
        .replace(/Section/gi, 'Sección')
        .replace(/section/gi, 'sección')
        .replace(/Keep/gi, 'Mantener')
        .replace(/keep/gi, 'mantener')
        .replace(/Content/gi, 'Contenido')
        .replace(/content/gi, 'contenido')
        .replace(/focused/gi, 'enfocado')
        .replace(/Conclusion/gi, 'Conclusión')
        .replace(/conclusion/gi, 'conclusión')
        .replace(/Evidence/gi, 'Evidencia')
        .replace(/evidence/gi, 'evidencia')
        .replace(/Professional/gi, 'Profesional')
        .replace(/professional/gi, 'profesional')
        .replace(/Quality/gi, 'Calidad')
        .replace(/quality/gi, 'calidad')
        .replace(/Structure/gi, 'Estructura')
        .replace(/structure/gi, 'estructura')
        .replace(/Requirements/gi, 'Requisitos')
        .replace(/requirements/gi, 'requisitos')
        .replace(/Missing/gi, 'Faltante')
        .replace(/missing/gi, 'faltante')
        .replace(/Insufficient/gi, 'Insuficiente')
        .replace(/insufficient/gi, 'insuficiente')
        .replace(/Improve/gi, 'Mejorar')
        .replace(/improve/gi, 'mejorar')
        .replace(/Add/gi, 'Agregar')
        .replace(/add/gi, 'agregar')
        .replace(/Remove/gi, 'Eliminar')
        .replace(/remove/gi, 'eliminar')
        .replace(/tighten/gi, 'ajustar')
        .replace(/shorten/gi, 'acortar')
        .replace(/specific/gi, 'específico')
        .replace(/alignment/gi, 'alineación')
        .replace(/required/gi, 'requerido')
        .replace(/should/gi, 'debe')
        .replace(/without/gi, 'sin')
        // Palabras individuales muy completo
        .replace(/\bis\b/gi, 'es')
        .replace(/\bProfesional\b/gi, 'Profesional')
        .replace(/\bhas\b/gi, 'tiene')
        .replace(/\bno\b/gi, 'no')
        .replace(/\bplaceholders\b/gi, 'marcadores de posición')
        .replace(/\bdoes not include\b/gi, 'no incluye')
        .replace(/\ba\b/gi, 'una')
        .replace(/\bConclusion\b/gi, 'Conclusión')
        .replace(/\bIt\b/gi, 'Esto')
        .replace(/\bclearly\b/gi, 'claramente')
        .replace(/\btargets\b/gi, 'apunta a')
        .replace(/\bProng\b/gi, 'Criterio')
        .replace(/\bwith\b/gi, 'con')
        .replace(/\bsubstantial merit\b/gi, 'mérito sustancial')
        .replace(/\bimportancia nacional\b/gi, 'importancia nacional')
        .replace(/\bespecifico\b/gi, 'específico')
        .replace(/\bto\b/gi, 'para')
        .replace(/\bel\/la\b/gi, 'el')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bAI-driven automation\b/gi, 'automatización impulsada por IA')
        .replace(/\binfraEstructura\b/gi, 'infraestructura')
        .replace(/\bproject\b/gi, 'proyecto')
        .replace(/\bHowever\b/gi, 'Sin embargo')
        .replace(/\bconteo de caracteres\b/gi, 'conteo de caracteres')
        .replace(/\bat\b/gi, 'en')
        .replace(/\bupper edge\b/gi, 'límite superior')
        .replace(/\ballowed range\b/gi, 'rango permitido')
        .replace(/\bmay exceed\b/gi, 'puede exceder')
        .replace(/\bonce finalized\b/gi, 'una vez finalizado')
        .replace(/\btrim\b/gi, 'recortar')
        .replace(/\bMantenering\b/gi, 'Manteniendo')
        .replace(/\bajustando\b/gi, 'ajustando')
        .replace(/\bcharacter range\b/gi, 'rango de caracteres')
        .replace(/\bby\b/gi, 'mediante')
        .replace(/\bonly\b/gi, 'solo')
        .replace(/\bhighest-level\b/gi, 'de más alto nivel')
        .replace(/\bessential points\b/gi, 'puntos esenciales')
        .replace(/\bsuitable for\b/gi, 'adecuados para')
        .replace(/\bcover page\b/gi, 'página de portada')
        .replace(/\bfoco\b/gi, 'foco')
        .replace(/\bidentification\b/gi, 'identificación')
        .replace(/\btitle\b/gi, 'título')
        .replace(/\blegal basis\b/gi, 'base legal')
        .replace(/\bbrief statement\b/gi, 'breve declaración')
        .replace(/\bsin\b/gi, 'sin')
        .replace(/\bexpanding\b/gi, 'expandirse')
        .replace(/\binto\b/gi, 'en')
        .replace(/\bdetailed\b/gi, 'detallado')
        .replace(/\btechnical\b/gi, 'técnico')
        .replace(/\bor\b/gi, 'o')
        .replace(/\bstrategic\b/gi, 'estratégico')
        .replace(/\bexposition\b/gi, 'exposición')
        .replace(/\bthat belongs\b/gi, 'que pertenece')
        .replace(/\bin later\b/gi, 'en posteriores')
        .replace(/\bsecciones\b/gi, 'secciones')
        .replace(/\bajustar\b/gi, 'ajustar')
        .replace(/\btext\b/gi, 'texto')
        .replace(/\bslightly\b/gi, 'ligeramente')
        .replace(/\bstay\b/gi, 'permanecer')
        .replace(/\bsafely\b/gi, 'seguramente')
        .replace(/\bwithin\b/gi, 'dentro de')
        .replace(/\bcaracteres\b/gi, 'caracteres')
        .replace(/\bensure\b/gi, 'asegurar')
        .replace(/\ball\b/gi, 'todo el')
        .replace(/\blenguaje\b/gi, 'lenguaje')
        .replace(/\bframes\b/gi, 'enmarca')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bown\b/gi, 'propia')
        .replace(/\bendeavor\b/gi, 'proyecto')
        .replace(/\bU\.S\.\b/gi, 'EE.UU.')
        .replace(/\band\b/gi, 'y')
        .replace(/\bthe\b/gi, 'el')
        .replace(/\bla\b/gi, 'the')
        .replace(/\by\b/gi, 'and')
        .replace(/\bpara\b/gi, 'to')
        // ⭐ Más traducciones para feedback
        .replace(/\baligns\b/gi, 'se alinea')
        .replace(/\balign\b/gi, 'alinear')
        .replace(/\btouches\b/gi, 'toca')
        .replace(/\btouch\b/gi, 'tocar')
        .replace(/\btie\b/gi, 'vincular')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bapplicant\b/gi, 'solicitante')
        .replace(/\bspecific\b/gi, 'específico')
        .replace(/\bplatform\b/gi, 'plataforma')
        .replace(/\bconcrete\b/gi, 'concretas')
        .replace(/\bpriorities\b/gi, 'prioridades')
        .replace(/\bpriority\b/gi, 'prioridad')
        .replace(/\bexecutive orders\b/gi, 'órdenes ejecutivas')
        .replace(/\bfederal\b/gi, 'federales')
        .replace(/\bmodernization\b/gi, 'modernización')
        .replace(/\binitiatives\b/gi, 'iniciativas')
        .replace(/\binitiative\b/gi, 'iniciativa')
        .replace(/\bshorter\b/gi, 'más corto')
        .replace(/\bconcisely\b/gi, 'concisamente')
        .replace(/\bexplicitly\b/gi, 'explícitamente')
        .replace(/\bstandards\b/gi, 'estándares')
        .replace(/\bstandard\b/gi, 'estándar')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bmore\b/gi, 'más')
        .replace(/\bU\.S\.\b/gi, 'EE.UU.')
        .replace(/\bnational\b/gi, 'nacional')
        .replace(/\bimportance\b/gi, 'importancia')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bthese\b/gi, 'estos')
        .replace(/\bwhile\b/gi, 'mientras')
        .replace(/\be\.g\.\b/gi, 'por ejemplo')
        .replace(/\be\.g\b/gi, 'ej')
        // ⭐ MÁS traducciones basadas en errores del usuario
        .replace(/\belements\b/gi, 'elementos')
        .replace(/\bread\b/gi, 'se leen')
        .replace(/\bgeneric\b/gi, 'genérico')
        .replace(/\btécnico\b/gi, 'técnico')
        .replace(/\bexecution\b/gi, 'ejecución')
        .replace(/\bsteps\b/gi, 'pasos')
        .replace(/\buse\b/gi, 'uso')
        .replace(/\bDocker\b/gi, 'Docker')
        .replace(/\bGitHub\b/gi, 'GitHub')
        .replace(/\bPostgreSQL\b/gi, 'PostgreSQL')
        .replace(/\bRedis\b/gi, 'Redis')
        .replace(/\bCI\/CD\b/gi, 'CI/CD')
        .replace(/\bActions\b/gi, 'Actions')
        .replace(/\btightly\b/gi, 'estrechamente')
        .replace(/\btied\b/gi, 'vinculado')
        .replace(/\bespecífico\b/gi, 'específico')
        .replace(/\bimportancia\b/gi, 'importancia')
        .replace(/\boutcomes\b/gi, 'resultados')
        .replace(/\bservice industries\b/gi, 'industrias de servicios')
        .replace(/\bservice\b/gi, 'servicio')
        .replace(/\bindustries\b/gi, 'industrias')
        .replace(/\bsolicitante's\b/gi, 'del solicitante')
        .replace(/\bunique\b/gi, 'único')
        .replace(/\bcontributions\b/gi, 'contribuciones')
        .replace(/\bcontribution\b/gi, 'contribución')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bemphasize\b/gi, 'enfatizar')
        .replace(/\bhow\b/gi, 'cómo')
        .replace(/\beach\b/gi, 'cada')
        .replace(/\bphase\b/gi, 'fase')
        .replace(/\bconcretely\b/gi, 'concretamente')
        .replace(/\badvances\b/gi, 'avanza')
        .replace(/\bsubstantial\b/gi, 'sustancial')
        .replace(/\bmerit\b/gi, 'mérito')
        .replace(/\bProng\b/gi, 'Criterio')
        .replace(/\bbeyond\b/gi, 'más allá de')
        .replace(/\bdescribing\b/gi, 'describir')
        .replace(/\btools\b/gi, 'herramientas')
        .replace(/\benvironments\b/gi, 'entornos')
        .replace(/\benvironment\b/gi, 'entorno');
    } else if (targetLang === 'en') {
      // ⭐ Traducción ULTRA AGRESIVA de español a inglés para feedback
      return feedback
        // Frases completas primero
        .replace(/Reduce la longitud general para estar dentro del requisito de/gi, 'Reduce the overall length to fall within the')
        .replace(/requisito de caracteres ajustando el/gi, 'character requirement by tightening the')
        .replace(/Resumen del Proyecto, Relevancia Estratégica y Atributos Clave del Proyecto/gi, 'Project Overview, Strategic Relevance, and Key Project Attributes')
        .replace(/Mantén la sección enfocada en la identificación y una descripción concisa de/gi, 'Keep the section focused on identification and a concise description of')
        .replace(/evitando argumentación extendida/gi, 'avoiding extended argumentation')
        .replace(/No agregues ningún cierre estilo conclusión/gi, 'Do not add any conclusion-style wrap-up')
        .replace(/Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto/gi, 'Maintain professional, USCIS-aligned tone and project specificity while making the text more compact')
        .replace(/Reducir el total longitud para fall strictly dentro de/gi, 'Reduce the overall length to fall strictly within')
        .replace(/mientras Mantenering el Estructura y key data points/gi, 'while maintaining the structure and key data points')
        .replace(/Mantener el cover page enfocado on identification/gi, 'Keep the cover page focused on identification')
        .replace(/proyecto title, brief description, y alineación/gi, 'project title, brief description, and alignment')
        .replace(/but move more detailed analytical or argumentative lenguaje about importancia nacional/gi, 'but move more detailed analytical or argumentative language about national importance')
        .replace(/y technical depth para later secciones/gi, 'and technical depth to later sections')
        .replace(/Do not Agregar marcadores de posición or any concluding\/summary paragraph en el end of esto Sección/gi, 'Do not add placeholders or any concluding/summary paragraph at the end of this section')
        .replace(/la sección es Profesional/gi, 'the section is Professional')
        .replace(/tiene no marcadores de posición/gi, 'has no placeholders')
        .replace(/no incluye una Conclusión/gi, 'does not include a Conclusion')
        .replace(/claramente apunta a Criterio/gi, 'clearly targets Prong')
        .replace(/el conteo de caracteres es en el límite superior/gi, 'the character count is at the upper edge')
        .replace(/puede exceder 3000 una vez finalizado/gi, 'may exceed 3000 once finalized')
        .replace(/recortar y ajustar el texto/gi, 'trim and adjust the text')
        
        // Palabras individuales
        .replace(/\bReducir\b/gi, 'Reduce')
        .replace(/\blongitud\b/gi, 'length')
        .replace(/\bgeneral\b/gi, 'overall')
        .replace(/\bestrictamente\b/gi, 'strictly')
        .replace(/\bdentro de\b/gi, 'within')
        .replace(/\bmientras\b/gi, 'while')
        .replace(/\bMantener\b/gi, 'Maintain')
        .replace(/\bestructura\b/gi, 'structure')
        .replace(/\benfocado\b/gi, 'focused')
        .replace(/\btítulo del proyecto\b/gi, 'project title')
        .replace(/\bbreve descripción\b/gi, 'brief description')
        .replace(/\balineación\b/gi, 'alignment')
        .replace(/\bmover\b/gi, 'move')
        .replace(/\bdetallado\b/gi, 'detailed')
        .replace(/\banalítico\b/gi, 'analytical')
        .replace(/\bargumentativo\b/gi, 'argumentative')
        .replace(/\blenguaje\b/gi, 'language')
        .replace(/\bimportancia nacional\b/gi, 'national importance')
        .replace(/\bprofundidad técnica\b/gi, 'technical depth')
        .replace(/\bsecciones posteriores\b/gi, 'later sections')
        .replace(/\bagregar\b/gi, 'add')
        .replace(/\bmarcadores de posición\b/gi, 'placeholders')
        .replace(/\bpárrafo de conclusión\b/gi, 'concluding paragraph')
        .replace(/\bal final de\b/gi, 'at the end of')
        .replace(/\besta sección\b/gi, 'this section')
        .replace(/\bRevisar\b/gi, 'Review')
        .replace(/\brevisar\b/gi, 'review')
        .replace(/\bSección\b/gi, 'Section')
        .replace(/\bsección\b/gi, 'section')
        .replace(/\bContenido\b/gi, 'Content')
        .replace(/\bcontenido\b/gi, 'content')
        .replace(/\bConclusión\b/gi, 'Conclusion')
        .replace(/\bconclusión\b/gi, 'conclusion')
        .replace(/\bEvidencia\b/gi, 'Evidence')
        .replace(/\bevidencia\b/gi, 'evidence')
        .replace(/\bconteo de caracteres\b/gi, 'character count')
        .replace(/\bProfesional\b/gi, 'Professional')
        .replace(/\bprofesional\b/gi, 'professional')
        .replace(/\bcaracteres\b/gi, 'characters')
        .replace(/\brequisito\b/gi, 'requirement')
        .replace(/\bajustar\b/gi, 'tighten')
        .replace(/\bel\b/gi, 'the')
        .replace(/\bla\b/gi, 'the')
        .replace(/\by\b/gi, 'and')
        .replace(/\bpara\b/gi, 'to');
    }
    
    return feedback;
  };
  // ⭐ Toggle de idioma con debugging
  const toggleLanguage = () => {
    const newLanguage = currentLanguage === 'es' ? 'en' : 'es';
    console.log('🔄 Cambiando idioma de', currentLanguage, 'a', newLanguage);
    
    setCurrentLanguage(newLanguage);
    
    // Actualizar validation_warning cuando cambia el idioma
    if (currentSection) {
      console.log('📝 Actualizando advertencias para idioma:', newLanguage);
      const updatedSection = updateValidationWarning(currentSection, newLanguage);
      console.log('✅ Advertencias actualizadas:', updatedSection.validation_warning?.issues);
      setCurrentSection(updatedSection);
    }
  };
  
  // ⭐ Función MEJORADA para actualizar validation_warning según idioma
  const updateValidationWarning = (section, language) => {
    if (!section || !section.evaluations) return section;
    
    const evalEs = section.evaluations.spanish || {};
    const evalEn = section.evaluations.english || {};
    
    // ⭐ FIX: Usar la evaluación del idioma solicitado, no la que tenga más issues
    // Si el usuario quiere español, usar evalEs; si quiere inglés, usar evalEn
    let selectedEval;
    if (language === 'es') {
      // Intentar usar evaluación en español primero, si no existe o está vacía, usar inglés y traducir
      selectedEval = (evalEs.issues && evalEs.issues.length > 0) ? evalEs : evalEn;
    } else {
      // Intentar usar evaluación en inglés primero, si no existe o está vacía, usar español y traducir
      selectedEval = (evalEn.issues && evalEn.issues.length > 0) ? evalEn : evalEs;
    }
    
    // Traducir issues y feedback al idioma solicitado (SIEMPRE traducir)
    const translatedIssues = (selectedEval.issues || []).map(issue => translateIssue(issue, language));
    const translatedFeedback = translateFeedback(selectedEval.feedback, language);
    
    return {
      ...section,
      validation_warning: {
        title: language === 'es' ? "⚠️ Advertencia de Validación" : "⚠️ Validation Warning",
        summary: language === 'es' 
          ? "Revisión de calidad completada." 
          : "Quality review completed.",
        issues: translatedIssues.length > 0 ? translatedIssues : [
          language === 'es' ? "Revisa el contenido generado" : "Review the generated content"
        ],
        feedback: translatedFeedback || (language === 'es' 
          ? "Revisa el contenido antes de aprobar." 
          : "Review content before approval."),
        recommendation: language === 'es' 
          ? "Revisa el contenido cuidadosamente antes de aprobar. Puedes usar la opción de 'Editar Sección' para solicitar cambios específicos a la IA."
          : "Review content carefully before approval. You can use 'Edit Section' to request specific AI changes.",
        metrics: {
          character_count: language === 'es' 
            ? (section.content_es?.length || 0) 
            : (section.content_en?.length || 0),
          required_range: "2500-4000",
          has_conclusion: selectedEval.has_conclusion || false,
          has_repetition: selectedEval.has_repetition || false
        }
      }
    };
  };
  
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Load client information and preload form
  React.useEffect(() => {
    const loadClientInfo = async () => {
      if (clientId && !resumeId) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/clients/${clientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.data) {
            const client = response.data;
            // Preload applicant name from client name
            const clientName = client.name || '';
            if (clientName) {
              setCvData(prev => ({ ...prev, applicant_name: clientName }));
              setFormData(prev => ({ ...prev, applicant_name: clientName, client_id: clientId }));
              console.log('✅ Client info preloaded:', clientName);
            } else {
              setFormData(prev => ({ ...prev, client_id: clientId }));
            }
          }
        } catch (error) {
          console.error('Error loading client info:', error);
          // Still set client_id even if client load fails
          setFormData(prev => ({ ...prev, client_id: clientId }));
        }
      } else if (clientId && !formData.client_id) {
        setFormData(prev => ({ ...prev, client_id: clientId }));
      }
    };
    
    loadClientInfo();
  }, [clientId]);
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      if (clientId && !formData.client_id) {
        setFormData(prev => ({ ...prev, client_id: clientId }));
      }
      
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = window.location.origin;
          const response = await fetch(`${BACKEND_URL}/api/business-plans/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setNiwId(doc.id);
            setFormData({
              project_title: doc.project_title || '',
              applicant_name: doc.applicant_name || '',
              applicant_cv: doc.applicant_cv || '',
              project_idea: doc.project_idea || '',
              patent_info: doc.patent_info || '',
              language: doc.language || 'en',
              apply_graphic_design: doc.apply_graphic_design || false,
              design_description: doc.design_description || '',
              client_id: doc.client_id || ''
            });
            
            setCvData({
              applicant_name: doc.applicant_name || '',
              applicant_cv: doc.applicant_cv || '',
              patent_info: doc.patent_info || '',
              language: doc.language || 'en'
            });
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`Documento cargado - ${doc.sections.length}/16 secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('Documento cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar documento');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'niw' && draft.content) {
            // Load draft data into form
            if (draft.content.cvData) setCvData(draft.content.cvData);
            if (draft.content.formData) setFormData(draft.content.formData);
            if (draft.content.selectedProjectName) setSelectedProjectName(draft.content.selectedProjectName);
            if (draft.content.step) setStep(draft.content.step);
            toast.success('Borrador cargado exitosamente');
          }
          sessionStorage.removeItem('draft_to_load');
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    
    loadDocument();
  }, [clientId, resumeId]);
  
  const saveDraft = async () => {
    try {
      setSavingDraft(true);
      toast.info('💾 Guardando borrador...');
      const token = localStorage.getItem('token');
      const BACKEND_URL = window.location.origin;
      
      // Calculate completion percentage
      let completion = 0;
      if (cvData.applicant_name) completion += 20;
      if (cvData.applicant_cv) completion += 30;
      if (selectedProjectName || formData.project_title) completion += 25;
      if (formData.project_idea) completion += 25;
      
      console.log('💾 Guardando borrador:', { step, completion, clientId, niwId, sectionNumber });
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'niw',
          title: formData.project_title || selectedProjectName || cvData.applicant_name || 'Borrador NIW sin título',
          content: {
            cvData,
            formData,
            selectedProjectName,
            projectNameSuggestions,
            step,
            niwId,
            sectionNumber,
            sections,
            currentSection
          },
          client_id: formData.client_id || clientId,
          notes: `Borrador guardado en paso: ${step}, sección: ${sectionNumber}`,
          completion_percentage: completion
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('💾 Respuesta del servidor:', data);
      
      if (data.success || data.id) {
        toast.success('✅ Borrador guardado exitosamente');
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error(`Error al guardar borrador: ${error.message}`);
    } finally {
      setSavingDraft(false);
    }
  };
  
  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleCVPdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX');
      return;
    }

    setUploadingCV(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const additionalInfo = cvData.project_idea || '';
      formData.append('additional_info', additionalInfo);

      // Use sonner API: toast.loading with id for updatable toasts
      toast.loading('Analizando y mejorando CV con IA...', { id: 'cv-stream' });

      // Use fetch with streaming to avoid Cloudflare 504 timeout
      const API_URL = window.location.origin;
      const resp = await fetch(`${API_URL}/api/upload-cv-enhanced`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Error desconocido' }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let enhanced = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            // Skip heartbeat events
            if (data.heartbeat) {
              if (data.status === 'extracting') {
                toast.loading('Extrayendo texto del CV...', { id: 'cv-stream' });
              } else if (data.status === 'enhancing') {
                toast.loading('Mejorando CV con IA...', { id: 'cv-stream' });
              }
              continue;
            }
            if (data.token) {
              enhanced += data.token;
              // Update loading toast with progress (sonner: use toast.loading with same id)
              if (enhanced.length % 500 < 20) {
                toast.loading(`Generando CV... ${Math.round(enhanced.length / 80)} párrafos`, { id: 'cv-stream' });
              }
            }
            if (data.done) {
              enhanced = data.enhanced_cv || enhanced;
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected token') throw parseErr;
          }
        }
      }

      if (enhanced.trim()) {
        setCvData({ ...cvData, applicant_cv: enhanced });
        // sonner: update to success by calling toast.success with same id
        toast.success('✅ CV mejorado exitosamente', { id: 'cv-stream' });
      } else {
        throw new Error('No se recibió contenido del CV mejorado');
      }

    } catch (error) {
      console.error('Error:', error);
      toast.dismiss('cv-stream');
      toast.error(error.message || 'Error al procesar el archivo');
    } finally {
      setUploadingCV(false);
    }
  };


  const handleCVSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      
      // Si el usuario tiene una sugerencia personalizada, ir directo a detalles (sin generar sugerencias)
      if (cvData.custom_project_suggestion && cvData.custom_project_suggestion.trim()) {
        
        // ⚠️ VALIDACIÓN DE ALINEACIÓN CV-PROYECTO: alertar si la idea no coincide con el perfil
        if (cvData.applicant_cv && cvData.applicant_cv.trim().length > 100) {
          try {
            const alignCheck = await axios.post(`${API}/business-plans/validate-cv-alignment`, {
              cv_text: cvData.applicant_cv.substring(0, 3000),
              project_idea: cvData.custom_project_suggestion.substring(0, 1000)
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            const { confidence, aligned, reason, suggestion: alignSuggestion } = alignCheck.data;
            
            if (!aligned && confidence < 5) {
              // Mostrar alerta bloqueante con opción de continuar
              const proceed = window.confirm(
                `⚠️ ALERTA DE ALINEACIÓN BAJA (${confidence}/10)\n\n` +
                `${reason}\n\n` +
                `${alignSuggestion || 'Considera ajustar la idea del proyecto para que refleje mejor tu experiencia y credenciales.'}\n\n` +
                `¿Deseas continuar de todas formas con esta idea de proyecto?`
              );
              if (!proceed) {
                setLoadingSuggestions(false);
                return;
              }
            } else if (!aligned && confidence < 7) {
              // Advertencia no bloqueante
              toast.warning(
                `⚠️ Alineación moderada con el CV (${confidence}/10): ${reason}. La generación continuará pero considera ajustar la propuesta.`,
                { duration: 8000 }
              );
            }
          } catch (alignErr) {
            console.warn('⚠️ Validación de alineación falló (no bloqueante):', alignErr.message);
          }
        }
        
        // Usar GPT-4o para extraer el título de forma inteligente
        let extractedTitle = "";
        
        try {
          console.log('🔍 Extracting title using GPT-4o...');
          const extractResponse = await axios.post(`${API}/business-plans/extract-title-from-proposal`, {
            proposal_text: cvData.custom_project_suggestion,
            applicant_name: cvData.applicant_name,
            language: cvData.language || 'es'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (extractResponse.data.success && extractResponse.data.title) {
            extractedTitle = extractResponse.data.title;
            console.log('🎯 AI Extracted title:', extractedTitle, '(confidence:', extractResponse.data.confidence, ')');
          }
        } catch (extractError) {
          console.warn('⚠️ AI extraction failed, using fallback:', extractError.message);
        }
        
        // Fallback: Si la IA no pudo extraer, usar el nombre del solicitante
        if (!extractedTitle) {
          extractedTitle = `Proyecto de ${cvData.applicant_name}`;
          console.log('⚠️ Using fallback title:', extractedTitle);
        }
        
        // Preparar los datos del NIW con la propuesta personalizada
        const niwData = {
          ...formData,
          project_title: extractedTitle,
          applicant_name: cvData.applicant_name,
          applicant_cv: cvData.applicant_cv,
          patent_info: cvData.patent_info || '',
          project_idea: `PROPUESTA DE PROYECTO DEL SOLICITANTE:\n\n${cvData.custom_project_suggestion}\n\n---\nBasado en el perfil profesional de: ${cvData.applicant_name}`,
          language: 'en',
          has_graphic_design: false,
          design_description: ''
        };
        
        setFormData(niwData);
        setSelectedProjectName(extractedTitle);
        setStep('details'); // Ir directo a detalles, saltando las sugerencias
        setLoadingSuggestions(false);
        toast.success('✨ Usando tu propuesta personalizada para crear el plan de negocio');
        return;
      }
      
      // Si NO hay sugerencia personalizada, generar las 3 sugerencias de Mónica (ASYNC con polling)
      toast.loading('Generando sugerencias de proyecto...', { id: 'suggest-project' });
      
      const startResponse = await axios.post(`${API}/business-plans/suggest-project-names-async`, cvData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const { task_id } = startResponse.data;
      if (!task_id) throw new Error('No se obtuvo task_id');
      
      // Polling: check every 3 seconds, max 60 polls (3 min)
      const MAX_POLLS = 60;
      let polls = 0;
      let taskResult = null;
      
      while (polls < MAX_POLLS) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        polls++;
        
        const statusResponse = await axios.get(
          `${API}/business-plans/suggest-project-status/${task_id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const task = statusResponse.data;
        
        if (task.status === 'completed') {
          taskResult = task.result;
          toast.dismiss('suggest-project');
          break;
        } else if (task.status === 'failed') {
          toast.dismiss('suggest-project');
          throw new Error(task.error || 'Error generando sugerencias');
        }
        // Still processing, update toast
        if (polls % 3 === 0) {
          toast.loading(`Analizando CV... (${polls * 3}s)`, { id: 'suggest-project' });
        }
      }
      
      if (polls >= MAX_POLLS) {
        toast.dismiss('suggest-project');
        throw new Error('Tiempo de espera agotado. Intenta de nuevo.');
      }
      
      const suggestions = taskResult?.suggestions || [];
      
      setProjectNameSuggestions(suggestions);
      setProjectRecommendation(taskResult?.recommendation || null);
      setStep('project_names');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sugerencias de nombres');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleProjectNameSelection = async (name, suggestion) => {
    setSelectedProjectName(name);
    
    // ⭐ Preparar datos completos del NIW
    // Include suggestion description for richer project_idea context
    const suggestionDesc = suggestion && suggestion.description ? suggestion.description : '';
    const specificDomain = projectRecommendation && projectRecommendation.specific_domain
      ? `\nSpecific Domain: ${projectRecommendation.specific_domain}`
      : '';
    const niwData = {
      ...formData,
      project_title: name,
      applicant_name: cvData.applicant_name,
      applicant_cv: cvData.applicant_cv,
      patent_info: cvData.patent_info || '',
      project_idea: `Project: ${name}${specificDomain}\n\n${suggestionDesc ? `Project Description: ${suggestionDesc}\n\n` : ''}Based on the professional profile of: ${cvData.applicant_name}`,
      language: 'en', // ⭐ Siempre inglés por defecto
      has_graphic_design: false,
      design_description: ''
    };
    
    setFormData(niwData);
    
    // ⭐ Ir al paso de detalles donde el usuario puede elegir modo interactivo o Beta
    setStep('details');
  };

  const handleStartNIW = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/business-plans/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNiwId(response.data.id);
      setStep('generating');
      await generateSection(response.data.id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar la propuesta');
      setGenerating(false);
    }
  };

  // ⭐ BETA: Generación completa en segundo plano
  const handleStartCompleteGeneration = async (e) => {
    e.preventDefault();
    setGeneratingComplete(true);
    setCompleteGenerationProgress(0);

    try {
      const token = localStorage.getItem('token');
      
      // Primero crear el NIW
      const createResponse = await axios.post(`${API}/business-plans/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const newNiwId = createResponse.data.id;
      setNiwId(newNiwId);
      
      // Iniciar generación completa en background
      await axios.post(`${API}/business-plans/generate-complete/${newNiwId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success('Generación completa iniciada');
      
      // Cambiar a pantalla de carga especial para generación completa
      setStep('generating_complete');
      
      // Simular progreso y verificar estado periódicamente
      const progressInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API}/business-plans/generation-status/${newNiwId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const status = statusResponse.data;
          setCompleteGenerationProgress(status.progress || 0);
          
          if (status.status === 'completed' || status.status === 'review_needed') {
            clearInterval(progressInterval);
            toast.success('¡Plan de negocio generado exitosamente!');
            // Redirigir al dashboard del cliente
            const clientId = formData.client_id;
            if (clientId) {
              navigate(`/client-dashboard/${clientId}`);
            } else {
              navigate('/dashboard');
            }
          } else if (status.status === 'error') {
            clearInterval(progressInterval);
            toast.error('Error en la generación: ' + (status.error_message || 'Error desconocido'));
            setGeneratingComplete(false);
            setStep('details');
          }
        } catch (err) {
          console.error('Error checking status:', err);
        }
      }, 5000); // Verificar cada 5 segundos
      
      // Auto-redirigir después de 10 segundos (la generación continúa en segundo plano)
      setTimeout(() => {
        clearInterval(progressInterval); // Limpiar el interval antes de redirigir
        toast.info('Redirigiendo al dashboard... La generación continúa en segundo plano.');
        const clientId = formData.client_id;
        if (clientId) {
          navigate(`/client-dashboard/${clientId}`);
        } else {
          navigate('/dashboard');
        }
      }, 10000);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar la generación completa');
      setGeneratingComplete(false);
    }
  };

  // Función para iniciar generación V3 (Dhanasar Framework - BETA)
  const handleStartGenerationV3 = async (e) => {
    e.preventDefault();
    setGeneratingComplete(true);
    setCompleteGenerationProgress(0);

    try {
      const token = localStorage.getItem('token');
      
      // Primero crear el NIW
      const createResponse = await axios.post(`${API}/business-plans/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const newNiwId = createResponse.data.id;
      setNiwId(newNiwId);
      
      // Iniciar generación V3 en background
      await axios.post(`${API}/business-plans/generate-complete-v3/${newNiwId}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success('🧪 Generación V3 (Dhanasar Framework) iniciada');
      
      // Cambiar a pantalla de carga
      setStep('generating_complete');
      
      // Verificar estado periódicamente
      const progressInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API}/business-plans/generation-status/${newNiwId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const status = statusResponse.data;
          setCompleteGenerationProgress(status.progress || 0);
          
          if (status.status === 'completed' || status.status === 'review_needed') {
            clearInterval(progressInterval);
            toast.success('🎉 ¡Plan V3 generado exitosamente!');
            const clientId = formData.client_id;
            if (clientId) {
              navigate(`/client-dashboard/${clientId}`);
            } else {
              navigate('/dashboard');
            }
          } else if (status.status === 'error') {
            clearInterval(progressInterval);
            toast.error('Error en V3: ' + (status.error_message || 'Error desconocido'));
            setGeneratingComplete(false);
            setStep('details');
          }
        } catch (err) {
          console.error('Error checking V3 status:', err);
        }
      }, 5000);
      
      // Auto-redirigir después de 12 segundos
      setTimeout(() => {
        clearInterval(progressInterval);
        toast.info('Redirigiendo... La generación V3 continúa en segundo plano.');
        const clientId = formData.client_id;
        if (clientId) {
          navigate(`/client-dashboard/${clientId}`);
        } else {
          navigate('/dashboard');
        }
      }, 12000);
      
    } catch (error) {
      console.error('Error V3:', error);
      toast.error('Error al iniciar la generación V3');
      setGeneratingComplete(false);
    }
  };

  const generateSection = async (id, secNum) => {
    setGenerating(true);
    setEditMode(false);
    setEditInstructions('');
    
    // ⭐ FIX Bug #2: Actualizar sectionNumber y progreso visual
    setSectionNumber(secNum);
    setVisualProgress((secNum / 18) * 100);
    
    // ⭐ Simular progreso incremental durante la generación (actualizar cada 1 segundo)
    const targetProgress = (secNum / 18) * 100;
    const progressInterval = setInterval(() => {
      setVisualProgress(prev => {
        // Incrementar progreso simulado hasta un máximo de targetProgress + 4%
        if (prev < targetProgress + 4) {
          return Math.min(prev + 0.8, targetProgress + 4);
        }
        return prev;
      });
    }, 1000);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/generate-section/${id}?section_number=${secNum}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      // ⭐ Detener el intervalo de progreso y establecer el progreso final
      clearInterval(progressInterval);
      setVisualProgress((secNum / 18) * 100);
      
      // ⭐ Mapear respuesta bilingüe correctamente
      const section = response.data.section;
      
      // ⭐ Procesar validation_warning de evaluaciones bilingües
      let validation_warning = response.data.validation_warning;
      
      // Si la respuesta tiene estructura bilingüe (evaluations.spanish/english)
      if (response.data.evaluations) {
        const evalEs = response.data.evaluations.spanish || {};
        const evalEn = response.data.evaluations.english || {};
        
        // ⭐ FIX Bug #3: SIEMPRE usar evaluación en español si existe
        const selectedEval = (evalEs.issues && evalEs.issues.length > 0) ? evalEs : evalEn;
        
        // ⭐ Traducir issues y feedback AL ESPAÑOL (idioma por defecto = español)
        const translatedIssues = (selectedEval.issues || []).map(issue => translateIssue(issue, 'es'));
        const translatedFeedback = translateFeedback(selectedEval.feedback, 'es');
        
        // Crear validation_warning con textos 100% en español
        validation_warning = {
          title: "⚠️ Advertencia de Validación",
          summary: "Revisión de calidad completada.",
          issues: translatedIssues.length > 0 ? translatedIssues : ["Revisa el contenido generado"],
          feedback: translatedFeedback || "Revisa el contenido antes de aprobar.",
          recommendation: "Revisa el contenido cuidadosamente antes de aprobar. Puedes usar la opción de 'Editar Sección' para solicitar cambios específicos a la IA.",
          metrics: {
            character_count: section.content_es?.length || section.content?.length || 0,
            required_range: "2500-4000",
            has_conclusion: selectedEval.has_conclusion || false,
            has_repetition: selectedEval.has_repetition || false
          }
        };
      }
      
      setCurrentSection({
        ...section,
        validation_warning: validation_warning,
        evaluations: response.data.evaluations // ⭐ Guardar evaluaciones para toggle de idioma
      });
      // ⭐ sectionNumber ya fue actualizado al inicio de la función
      
      // Show validation info if available
      if (response.data.validation_passed === false || validation_warning) {
        toast.warning('⚠️ Sección generada. Revisa los detalles de validación.');
      } else if (response.data.validation_passed) {
        toast.success('✓ Sección generada y validada exitosamente');
      }
      
      setStep('review');
    } catch (error) {
      // ⭐ Detener el intervalo de progreso en caso de error
      clearInterval(progressInterval);
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setGenerating(true);
    setRegeneratingOtherLanguage(true);
    try {
      const token = localStorage.getItem('token');
      
      // ⭐ Usar nuevo endpoint bilingüe
      const response = await axios.post(
        `${API}/business-plans/edit-section-bilingual/${niwId}`,
        {
          section_number: sectionNumber,
          edit_instructions: editInstructions,
          edited_content: getCurrentContent(currentSection),
          edited_language: currentLanguage,
          current_section_title: currentSection.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentSection(response.data.section);
      setEditInstructions('');
      setEditMode(false);
      
      // Mensaje de éxito con info de regeneración
      const otherLang = currentLanguage === 'es' ? 'inglés' : 'español';
      toast.success(`✅ Sección editada y versión en ${otherLang} regenerada automáticamente`);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
      setRegeneratingOtherLanguage(false);
    }
  };

  const handleApproveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/business-plans/approve-section/${niwId}`,
        currentSection,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newSections = [...sections, currentSection];
      setSections(newSections);
      
      if (sectionNumber < 18) {
        toast.success(`Sección ${sectionNumber} aprobada. Generando siguiente...`);
        await generateSection(niwId, sectionNumber + 1);
      } else {
        toast.success('¡Todas las secciones completadas! Finalizando propuesta...');
        await finalizeNIW();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
      setGenerating(false);
    }
  };

  const finalizeNIW = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/finalize/${niwId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('¡Propuesta EB-2 NIW completa generada exitosamente!');
      
      // ⭐ Siempre navegar a la vista del documento al finalizar
      navigate(`/view-business-plan/${response.data.id}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar propuesta');
      setGenerating(false);
    }
  };

  const goToSection = async (secNum) => {
    if (secNum < 1 || secNum > 18) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      await generateSection(niwId, secNum);
    }
  };

  // Step 1: CV Submission
  if (step === 'cv') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Paso 1: Información del Solicitante</h1>
            <p className="form-subtitle">
              Proporciona tu hoja de vida o resumen profesional para generar una propuesta EB-2 NIW personalizada
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleCVSubmit} className="form-grid">
                <div className="form-field">
                  <Label htmlFor="applicant_name">Nombre Completo *</Label>
                  <Input
                    id="applicant_name"
                    value={cvData.applicant_name}
                    onChange={(e) => setCvData({ ...cvData, applicant_name: e.target.value })}
                    required
                    placeholder="Dr. John Smith"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="applicant_cv">Hoja de Vida / Resumen Profesional *</Label>
                  
                  {/* Toggle between text and PDF upload */}
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={cvInputMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCvInputMode('text')}
                    >
                      ✏️ Escribir Texto
                    </Button>
                    <Button
                      type="button"
                      variant={cvInputMode === 'pdf' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCvInputMode('pdf')}
                    >
                      📄 Subir Documento
                    </Button>
                  </div>

                  {cvInputMode === 'text' ? (
                    <Textarea
                      id="applicant_cv"
                      value={cvData.applicant_cv}
                      onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                      required
                      placeholder="Incluye: educación, experiencia profesional, publicaciones, premios, certificaciones relevantes, áreas de especialización..."
                      rows={10}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCVPdfUpload}
                          className="hidden"
                          id="cv-pdf-upload"
                          disabled={uploadingCV}
                        />
                        <label 
                          htmlFor="cv-pdf-upload" 
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          {uploadingCV ? (
                            <>
                              <Loader2 className="animate-spin text-blue-600" size={32} />
                              <p className="text-sm text-gray-600">Mejorando CV con IA (GPT-4o)...</p>
                              <p className="text-xs text-gray-500">Detectando campo profesional y agregando políticas federales...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                ✨ Click para subir tu CV (PDF, DOC o DOCX)
                              </p>
                              <p className="text-xs text-gray-500">
                                Auto-mejora con IA: detección de campo + políticas federales + logros
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {cvData.applicant_cv && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ CV Mejorado con IA - Optimizado para NIW
                          </p>
                          <Textarea
                            value={cvData.applicant_cv}
                            onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                            rows={12}
                            className="text-sm font-mono"
                          />
                          <p className="text-xs text-gray-600 mt-2">
                            💡 El CV ha sido enriquecido automáticamente con políticas federales y estructura NIW. Puedes editarlo si lo deseas.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SUGERENCIA PERSONALIZADA DE PLAN DE NEGOCIO */}
                <div className="form-field full-width">
                  <Label htmlFor="custom_project_suggestion">
                    💡 Tu Idea de Proyecto (Opcional)
                  </Label>
                  <p className="text-xs text-gray-600 mb-2">
                    ¿Ya tienes una idea o propuesta de proyecto? Descríbela aquí o sube un documento y Mónica la usará directamente para redactar tu plan de negocio NIW.
                  </p>
                  
                  {/* Botón para subir archivo de propuesta */}
                  <div className="mb-3">
                    <input
                      type="file"
                      id="project-suggestion-file-upload"
                      accept=".pdf,.docx,.doc,.txt"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const maxSize = 10 * 1024 * 1024;
                        if (file.size > maxSize) {
                          toast.error('El archivo es demasiado grande. Máximo 10MB.');
                          e.target.value = '';
                          return;
                        }
                        
                        toast.info('Procesando documento de propuesta...');
                        setLoadingSuggestions(true);
                        
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          
                          const response = await axios.post(
                            `${API}/business-plans/upload-patent-doc`,
                            formData,
                            {
                              headers: {
                                'Content-Type': 'multipart/form-data',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                              }
                            }
                          );
                          
                          if (response.data.success) {
                            // Use raw_text for proposals (preserves original title better than patent-formatted text)
                            const proposalText = response.data.raw_text || response.data.formatted_text;
                            setCvData({ 
                              ...cvData, 
                              custom_project_suggestion: proposalText
                            });
                            
                            toast.success('✅ Propuesta de proyecto extraída exitosamente');
                          } else {
                            toast.error(response.data.error || 'No se pudo extraer información del documento');
                          }
                        } catch (error) {
                          console.error('Error uploading project suggestion:', error);
                          toast.error(
                            error.response?.data?.detail || 
                            'Error al procesar el documento. Por favor, intenta manualmente.'
                          );
                        } finally {
                          setLoadingSuggestions(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('project-suggestion-file-upload').click()}
                      className="w-full sm:w-auto"
                      disabled={loadingSuggestions}
                    >
                      <Upload className="mr-2" size={16} />
                      Subir Documento de Propuesta (PDF, DOCX)
                    </Button>
                  </div>
                  
                  <Textarea
                    id="custom_project_suggestion"
                    value={cvData.custom_project_suggestion}
                    onChange={(e) => setCvData({ ...cvData, custom_project_suggestion: e.target.value })}
                    placeholder="O escribe tu idea: ¿Qué problema resuelve? ¿Cuál es la innovación? ¿Por qué es de importancia nacional?

Ejemplo: 'Desarrollo de una plataforma de telemedicina con IA para diagnóstico temprano de enfermedades cardíacas en comunidades rurales desatendidas...'"
                    rows={5}
                    className="resize-y"
                  />
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    ✨ Si proporcionas tu propia idea, Mónica la usará directamente para crear tu plan de negocio (sin mostrar otras sugerencias).
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSuggestions} 
                  className="submit-button"
                >
                  {loadingSuggestions ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      {cvData.custom_project_suggestion ? 'Preparando...' : 'Generando Sugerencias...'}
                    </>
                  ) : (
                    <>
                      {cvData.custom_project_suggestion ? 'Usar Mi Propuesta →' : 'Ver Sugerencias de Mónica →'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Project Name Selection
  if (step === 'project_names') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('cv')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Paso 2: Selecciona el Nombre del Proyecto</h1>
            <p className="form-subtitle">
              Basándonos en tu perfil, te sugerimos estos nombres profesionales. Debes seleccionar uno.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Recomendación de Mónica */}
            <Card className="border-2 border-purple-500 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <span style={{ fontSize: '32px' }}>M</span>
                  <span>Recomendación de Mónica</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projectRecommendation ? (
                  <>
                    <p className="text-purple-800 leading-relaxed">
                      Basándome en tu perfil profesional y experiencia, <strong>recomiendo la Opción {(projectRecommendation.recommended_index || 0) + 1}</strong>:
                    </p>
                    <p className="mt-3 text-purple-700 leading-relaxed">
                      {projectRecommendation.reason}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-purple-800 leading-relaxed">
                      Basándome en tu perfil profesional y experiencia, <strong>recomiendo la Opción 1</strong> porque:
                    </p>
                    <ul className="mt-3 space-y-2 text-purple-700">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">✓</span>
                        <span>Tiene mayor alineación con tus credenciales y experiencia específica</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">✓</span>
                        <span>Presenta un caso más fuerte de importancia nacional inmediata</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">✓</span>
                        <span>Demuestra mérito sustancial con mayor claridad para USCIS</span>
                      </li>
                    </ul>
                  </>
                )}
                <p className="mt-3 text-sm text-purple-600 italic">
                  Sin embargo, puedes elegir cualquier opción que mejor represente tu proyecto.
                </p>
              </CardContent>
            </Card>

            {(projectNameSuggestions || []).map((suggestion, index) => {
              // Obtener el nombre de la sugerencia (puede ser string o objeto)
              const suggestionName = typeof suggestion === 'string' ? suggestion : suggestion.name;
              
              // Generar descripción DETALLADA y específica basada en el proyecto
              const getProjectDescription = (projectName, idx) => {
                const lowerName = projectName.toLowerCase();
                
                let description = `<div class="space-y-3">`;
                description += `<p><strong className="text-gray-900">Solicitante:</strong> ${cvData.applicant_name}</p>`;
                
                // Descripción del proyecto según tipo
                description += `<p><strong className="text-gray-900">Descripción:</strong> `;
                
                if (lowerName.includes('ai') || lowerName.includes('artificial intelligence') || lowerName.includes('machine learning')) {
                  description += `Este proyecto propone desarrollar e implementar soluciones avanzadas de inteligencia artificial y machine learning con aplicaciones directas en sectores críticos de EE.UU. La iniciativa se enfoca en crear sistemas inteligentes que mejoren la eficiencia, seguridad y competitividad de infraestructura nacional, alineándose con prioridades federales de innovación tecnológica.`;
                } else if (lowerName.includes('infrastructure') || lowerName.includes('platform')) {
                  description += `Este proyecto busca diseñar y construir infraestructura tecnológica robusta, escalable y segura que sirva como base para sistemas de importancia nacional. La plataforma propuesta modernizará procesos críticos, mejorará la interoperabilidad entre agencias federales y fortalecerá la capacidad tecnológica del país.`;
                } else if (lowerName.includes('security') || lowerName.includes('secure') || lowerName.includes('cybersecurity')) {
                  description += `Este proyecto se centra en implementar sistemas de seguridad avanzados y arquitecturas de ciberseguridad que protejan infraestructura crítica nacional, datos sensibles y redes gubernamentales. La iniciativa responde directamente a amenazas emergentes y prioridades de seguridad nacional establecidas por órdenes ejecutivas federales.`;
                } else if (lowerName.includes('healthcare') || lowerName.includes('medical') || lowerName.includes('health')) {
                  description += `Este proyecto propone revolucionar la atención médica mediante tecnología innovadora que mejore diagnósticos, tratamientos y acceso a servicios de salud. La iniciativa aborda desafíos críticos del sistema de salud estadounidense, alineándose con objetivos de modernización del sector salud y bienestar público.`;
                } else if (lowerName.includes('optimization') || lowerName.includes('efficiency')) {
                  description += `Este proyecto se enfoca en optimizar procesos críticos a nivel nacional mediante soluciones tecnológicas que mejoren la eficiencia, reduzcan costos operativos y aumenten la productividad en sectores clave. La iniciativa demuestra impacto medible en la competitividad económica de EE.UU.`;
                } else if (lowerName.includes('data') || lowerName.includes('analytics')) {
                  description += `Este proyecto propone desarrollar sistemas avanzados de análisis de datos y business intelligence que permitan toma de decisiones basada en evidencia para organizaciones de importancia nacional. La iniciativa mejora la capacidad analítica y predictiva en sectores estratégicos.`;
                } else if (lowerName.includes('automation') || lowerName.includes('robotic')) {
                  description += `Este proyecto busca implementar soluciones de automatización y robótica que transformen procesos industriales y operacionales críticos. La iniciativa aumenta la eficiencia, seguridad y competitividad de sectores manufactureros y de servicios estadounidenses.`;
                } else {
                  description += `Este proyecto aborda desafíos tecnológicos significativos mediante soluciones innovadoras que demuestran mérito excepcional e importancia nacional directa. La iniciativa se alinea con prioridades federales de innovación y competitividad tecnológica.`;
                }
                description += `</p>`;
                
                // Por qué cumple con NIW
                description += `<p><strong className="text-gray-900">Cumplimiento EB-2 NIW:</strong></p>`;
                description += `<ul class="list-disc pl-5 space-y-1 text-sm">`;
                description += `<li><strong>Mérito Sustancial:</strong> Innovación tecnológica con aplicaciones demostrables en sectores críticos</li>`;
                description += `<li><strong>Importancia Nacional:</strong> Impacto directo en seguridad, economía, salud o infraestructura de EE.UU.</li>`;
                description += `<li><strong>Beneficio para EE.UU.:</strong> Renuncia del requisito de certificación laboral justificada por el interés nacional</li>`;
                description += `</ul>`;
                
                description += `</div>`;
                
                return description;
              };
              
              const isRecommended = projectRecommendation
                ? index === (projectRecommendation.recommended_index || 0)
                : index === 0;
              
              return (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedProjectName === suggestionName ? 'border-2 border-black' : ''
                  } ${isRecommended ? 'border-purple-300' : ''}`}
                  onClick={() => handleProjectNameSelection(suggestionName, suggestion)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>Opción {index + 1}</span>
                        {isRecommended && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            ⭐ Recomendada
                          </span>
                        )}
                      </div>
                      {selectedProjectName === suggestionName && (
                        <span className="text-green-600">✓ Seleccionado</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold mb-3">{suggestionName}</p>
                    <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <span dangerouslySetInnerHTML={{ __html: getProjectDescription(suggestionName, index) }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Project Details
  if (step === 'details') {
    // Determinar si vino directamente del CV (con propuesta personalizada) o de las sugerencias
    const hasCustomProposal = formData.project_idea?.includes('PROPUESTA DE PROYECTO DEL SOLICITANTE');
    
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep(hasCustomProposal ? 'cv' : 'project_names')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">{hasCustomProposal ? 'Paso 2' : 'Paso 3'}: Detalles del Proyecto</h1>
            <p className="form-subtitle">
              {hasCustomProposal ? (
                <>✨ Usando tu propuesta personalizada</>
              ) : (
                <>Proyecto seleccionado: <strong>{selectedProjectName}</strong></>
              )}
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartNIW} className="form-grid">
                <div className="form-field full-width">
                  <Label>Título del Proyecto</Label>
                  <Input
                    value={formData.project_title}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

              {/* Botones de acción */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '0.75rem', 
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                {/* Botón único: Crear Plan Completo */}
                <Button 
                  type="button"
                  onClick={handleStartCompleteGeneration}
                  disabled={generating || generatingComplete || !cvData.applicant_cv}
                  className="submit-button"
                  data-testid="generate-complete-plan-btn"
                  style={{ 
                    width: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    padding: '14px 24px',
                    fontSize: '1rem'
                  }}
                >
                  {generatingComplete ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Generando Plan Completo...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2" size={18} />
                      🚀 Crear Plan Completo
                    </>
                  )}
                </Button>
                <p style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center', margin: '8px 0 0 0' }}>
                  Genera las 19 secciones automáticamente (~10 min) y evalúa calidad USCIS
                </p>

              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
          {/* Logo Monica con animación */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            margin: '0 auto 30px',
            backgroundColor: '#000',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '48px', color: '#fff', fontWeight: 'bold' }}>M</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, visualProgress)}%`,
                height: '100%',
                backgroundColor: '#000',
                transition: 'width 0.5s ease',
                animation: 'shimmer 1.5s infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
              {Math.round(visualProgress)}%
            </p>
          </div>

          {/* Información de progreso */}
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px', color: '#000' }}>
            Generando Sección {sectionNumber} de 18
          </h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
            {NIW_SECTION_TITLES[sectionNumber - 1]}
          </p>
          <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
            <p>✨ Generando contenido con IA...</p>
            <p>🔍 Validando calidad automáticamente...</p>
            <p>⏱️ Esto puede tomar 30-90 segundos</p>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
        `}</style>
      </div>
    );
  }

  // ⭐ BETA: Pantalla de carga para generación completa
  if (step === 'generating_complete') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
          {/* Logo con animación especial */}
          <div style={{ 
            width: '140px', 
            height: '140px', 
            margin: '0 auto 30px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse-beta 2s ease-in-out infinite',
            boxShadow: '0 0 60px rgba(255,255,255,0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <span style={{ fontSize: '56px' }}>🚀</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '100%',
              height: '12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${completeGenerationProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #fff, #f0f0f0)',
                transition: 'width 0.5s ease',
                animation: 'shimmer-beta 1.5s infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
              {completeGenerationProgress}%
            </p>
          </div>

          {/* Información de progreso */}
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '15px', color: '#fff' }}>
            Generando Plan Completo
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)', marginBottom: '20px' }}>
            {completeGenerationProgress < 30 && '📝 Generando secciones iniciales (Cover, Executive Summary, Prong 1)...'}
            {completeGenerationProgress >= 30 && completeGenerationProgress < 50 && '📋 Generando posicionamiento y calificaciones...'}
            {completeGenerationProgress >= 50 && completeGenerationProgress < 70 && '⚙️ Generando plan de ejecución y estrategia...'}
            {completeGenerationProgress >= 70 && completeGenerationProgress < 85 && '📊 Generando metodología y resultados esperados...'}
            {completeGenerationProgress >= 85 && completeGenerationProgress < 95 && '⚖️ Generando Prong 3 y justificación de waiver...'}
            {completeGenerationProgress >= 95 && '🔍 Evaluando calidad USCIS y aplicando correcciones...'}
          </p>
          
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '12px', 
            padding: '20px',
            marginTop: '20px'
          }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '10px' }}>
              ⏱️ <strong>Tiempo estimado:</strong> 8-12 minutos
            </p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '10px' }}>
              ✅ <strong>19 secciones</strong> generándose automáticamente
            </p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
              🤖 <strong>Agente Evaluador</strong> verificará cumplimiento USCIS
            </p>
          </div>

          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '25px' }}>
            Serás redirigido al dashboard del cliente en 10 segundos...<br/>
            La generación continuará en segundo plano.
          </p>
        </div>

        <style>{`
          @keyframes pulse-beta {
            0%, 100% { transform: scale(1); box-shadow: 0 0 60px rgba(255,255,255,0.3); }
            50% { transform: scale(1.08); box-shadow: 0 0 80px rgba(255,255,255,0.5); }
          }
          @keyframes shimmer-beta {
            0% { background-position: -200px 0; }
            100% { background-position: 200px 0; }
          }
        `}</style>
      </div>
    );
  }

  if (step === 'review' && currentSection) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de 18
            </span>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          <div className="mb-4 flex gap-1 flex-wrap">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => setSectionNumber(num)}
                disabled={num > sections.length}
                title={`Sección ${num}`}
                className={`px-3 py-2 rounded text-xs ${
                  num === sectionNumber 
                    ? 'bg-black text-white' 
                    : num <= sections.length 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {currentSection.validation_warning && (
            <Card className="mb-4" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  {currentSection.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentSection.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Sección "Problemas detectados" eliminada para evitar problemas de traducción */}
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>
                    {currentLanguage === 'es' ? 'Retroalimentación del evaluador:' : 'Evaluator feedback:'}
                  </strong>
                  <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentSection.validation_warning.feedback}</p>
                </div>
                {currentSection.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>
                      {currentLanguage === 'es' ? 'Métricas:' : 'Metrics:'}
                    </strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>
                        📏 {currentLanguage === 'es' ? 'Caracteres:' : 'Characters:'} {currentSection.validation_warning.metrics.character_count || 'N/A'} ({currentLanguage === 'es' ? 'requerido:' : 'required:'} {currentSection.validation_warning.metrics.required_range || '2500-4000'})
                      </li>
                      <li style={{ color: '#5d4037' }}>
                        📝 {currentLanguage === 'es' ? 'Tiene conclusión:' : 'Has conclusion:'} {currentSection.validation_warning.metrics.has_conclusion ? (currentLanguage === 'es' ? '❌ Sí (debe eliminarse)' : '❌ Yes (should be removed)') : (currentLanguage === 'es' ? '✓ No' : '✓ No')}
                      </li>
                      <li style={{ color: '#5d4037' }}>
                        🔄 {currentLanguage === 'es' ? 'Tiene repetición:' : 'Has repetition:'} {currentSection.validation_warning.metrics.has_repetition ? (currentLanguage === 'es' ? '❌ Sí (debe evitarse)' : '❌ Yes (should be avoided)') : (currentLanguage === 'es' ? '✓ No' : '✓ No')}
                      </li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 {currentLanguage === 'es' ? 'Recomendación:' : 'Recommendation:'}</strong> {currentSection.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success evaluation card - show when no warnings but has evaluation history */}
          {!currentSection.validation_warning && currentSection.evaluation_history && currentSection.evaluation_history.length > 0 && (
            <Card className="mb-4" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Esta sección pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Sección aprobada en intento {currentSection.evaluation_history.length}
                  </p>
                </div>
                {currentSection.evaluation_history[0] && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#4caf50' }}>📏 Caracteres: {(currentSection.content_es || currentSection.content || '').length} (cumple estándares)</li>
                      <li style={{ color: '#4caf50' }}>📝 Estructura narrativa: ✓ Adecuada</li>
                      <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Este capítulo está listo para continuar o puedes editarlo para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Sección {sectionNumber} de 18</CardTitle>
              <CardDescription>{formData.title}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* ⭐ Toggle de Idioma Bilingüe */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <span style={{ 
                  fontWeight: currentLanguage === 'es' ? 'bold' : 'normal',
                  color: currentLanguage === 'es' ? '#8b5cf6' : '#666',
                  fontSize: '0.95rem'
                }}>
                  🇪🇸 Español
                </span>
                
                <button
                  onClick={toggleLanguage}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '0.5rem 1.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                  }}
                >
                  {currentLanguage === 'es' ? '→ Switch to English' : '→ Cambiar a Español'}
                </button>
                
                <span style={{ 
                  fontWeight: currentLanguage === 'en' ? 'bold' : 'normal',
                  color: currentLanguage === 'en' ? '#8b5cf6' : '#666',
                  fontSize: '0.95rem'
                }}>
                  🇺🇸 English
                </span>
              </div>
              
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentLanguage === 'es' ? (currentSection.content_es || currentSection.content || '') : (currentSection.content_en || '') }}
                style={{
                  lineHeight: '1.6',
                  color: '#333'
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-top: 1.5rem;
                  margin-bottom: 1rem;
                  color: #000;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                }
                .prose table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 1.5rem 0;
                  border: 1px solid #ddd;
                }
                .prose th {
                  background-color: #000;
                  color: #fff;
                  padding: 12px;
                  text-align: left;
                  font-weight: 600;
                  border: 1px solid #000;
                }
                .prose td {
                  padding: 10px 12px;
                  border: 1px solid #ddd;
                }
                .prose tr:nth-child(even) {
                  background-color: #f9f9f9;
                }
                .prose ul, .prose ol {
                  margin: 1rem 0;
                  padding-left: 2rem;
                }
                .prose li {
                  margin-bottom: 0.5rem;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
                data-testid="edit-section-btn"
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              {/* ⭐ NUEVO: Botón de Edición Global con IA */}
              <Button
                variant="outline"
                onClick={() => setShowAIEditModal(true)}
                disabled={generating || !sections.length}
                className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                data-testid="ai-global-edit-btn"
              >
                <Wand2 className="mr-2" size={18} />
                ✨ Editar con IA
              </Button>
              <Button
                variant="outline"
                onClick={() => generateSection(niwId, sectionNumber)}
                disabled={generating}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="regenerate-section-btn"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Regenerando...
                  </>
                ) : (
                  <>
                    🔄 Regenerar Sección
                  </>
                )}
              </Button>
              <Button
                onClick={handleApproveSection}
                disabled={generating}
                data-testid="approve-section-btn"
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {sectionNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en esta sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {currentLanguage === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {currentLanguage === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más evidencia cuantitativa del impacto nacional. Incluye referencias a estudios académicos recientes. Fortalece la argumentación sobre substantial merit.'"
                  rows={5}
                  className="mb-4"
                  data-testid="edit-instructions-input"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEditSection}
                    disabled={generating || !editInstructions.trim()}
                    data-testid="apply-edit-btn"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ⭐ MODAL: Edición Global con IA
  if (showAIEditModal) {
    return (
      <>
        <Dialog open={showAIEditModal} onOpenChange={setShowAIEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="text-purple-600" size={24} />
                Edición Global con IA
              </DialogTitle>
              <DialogDescription>
                Describe los cambios que deseas aplicar a todo el documento. La IA analizará todas las secciones y aplicará las modificaciones necesarias.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-800 mb-2">💡 Ejemplos de instrucciones:</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• "Agrega más estadísticas y datos cuantitativos sobre el impacto económico"</li>
                  <li>• "Reduce el contenido de todas las secciones en un 20%"</li>
                  <li>• "Fortalece la argumentación sobre importancia nacional con referencias a políticas federales"</li>
                  <li>• "Cambia el tono a más formal y académico"</li>
                  <li>• "Añade más evidencia de las calificaciones del peticionario"</li>
                </ul>
              </div>
              
              <div>
                <Label htmlFor="ai-instructions" className="text-base font-medium">
                  Instrucciones de edición
                </Label>
                <Textarea
                  id="ai-instructions"
                  value={aiEditInstructions}
                  onChange={(e) => setAiEditInstructions(e.target.value)}
                  placeholder="Describe qué cambios quieres aplicar al documento..."
                  rows={6}
                  className="mt-2"
                  data-testid="ai-edit-instructions-textarea"
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-amber-800">
                  La IA modificará las secciones relevantes según tus instrucciones. Podrás revisar todos los cambios antes de que sean definitivos.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAIEditModal(false);
                  setAiEditInstructions('');
                }}
                disabled={aiEditLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAIGlobalEdit}
                disabled={aiEditLoading || !aiEditInstructions.trim()}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="apply-ai-edit-btn"
              >
                {aiEditLoading ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando con IA...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2" size={18} />
                    Aplicar Cambios
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Mantener el contenido de fondo visible */}
        <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
          {step === 'review' && currentSection && (
            <div className="min-h-screen bg-gray-50 p-8">
              {/* Contenido de fondo */}
            </div>
          )}
        </div>
      </>
    );
  }

  // ⭐ MODAL: Resultados de Edición con IA (Antes/Después)
  if (showAIEditResults && aiEditResults) {
    return (
      <Dialog open={showAIEditResults} onOpenChange={setShowAIEditResults}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle size={24} />
              Cambios Aplicados Exitosamente
            </DialogTitle>
            <DialogDescription>
              {aiEditResults.message}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                ✅ Se modificaron {aiEditResults.total_sections_modified} sección(es)
              </p>
            </div>
            
            {/* Lista de cambios con antes/después */}
            <div className="space-y-6">
              {aiEditResults.changes.map((change, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b">
                    <h4 className="font-medium">
                      Sección {change.section_number}: {change.section_title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      📝 {change.change_summary}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 divide-x">
                    {/* Antes */}
                    <div className="p-4">
                      <h5 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-200 rounded-full"></span>
                        Antes
                        <span className="text-xs text-gray-500 ml-2">
                          ({change.original_content?.length || 0} caracteres)
                        </span>
                      </h5>
                      <div className="text-sm text-gray-700 bg-red-50 p-3 rounded max-h-96 overflow-y-auto whitespace-pre-wrap">
                        {change.original_content || '(Sin contenido previo)'}
                      </div>
                    </div>
                    
                    {/* Después */}
                    <div className="p-4">
                      <h5 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                        <span className="w-3 h-3 bg-green-200 rounded-full"></span>
                        Después
                        <span className="text-xs text-gray-500 ml-2">
                          ({change.new_content?.length || 0} caracteres)
                          {change.new_content?.length > change.original_content?.length && (
                            <span className="text-green-600 ml-1">
                              (+{change.new_content.length - (change.original_content?.length || 0)})
                            </span>
                          )}
                        </span>
                      </h5>
                      <div className="text-sm text-gray-700 bg-green-50 p-3 rounded max-h-96 overflow-y-auto whitespace-pre-wrap">
                        {change.new_content || '(Sin contenido)'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => {
                setShowAIEditResults(false);
                setAiEditResults(null);
                setAiEditInstructions('');
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="close-ai-results-btn"
            >
              <CheckCircle className="mr-2" size={18} />
              Entendido, Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};

export default CreateNIWInteractive;
