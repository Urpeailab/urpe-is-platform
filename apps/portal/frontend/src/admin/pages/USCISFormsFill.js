import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight,
  FileText, 
  Loader2,
  CheckCircle,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  User,
  Send,
  MessageSquare,
  FileEdit,
  Pencil,
  Trash2,
  AlertTriangle,
  Save,
  Languages
} from 'lucide-react';
import ChatAssistant from '../components/ChatAssistant';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const USCISFormsFill = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentSection, setCurrentSection] = useState(0);
  const [clientName, setClientName] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareData, setShareData] = useState({ client_name: '', client_email: '', expires_in_days: 30 });
  const [creatingShare, setCreatingShare] = useState(false);
  
  // New state for fill mode selection
  const [fillMode, setFillMode] = useState(null); // null, 'chat', or 'manual'
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null); // { sectionIndex, questionId, questionText }
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  
  // Save changes state
  const [saving, setSaving] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  
  // Translation state
  const [translating, setTranslating] = useState(false);
  const [translatedAnswers, setTranslatedAnswers] = useState(null);
  const [showTranslatedView, setShowTranslatedView] = useState(false);
  
  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchTemplate();
    
    // Check if we should open share modal or set default mode from navigation state
    const state = location.state || {};
    if (state.openShareModal) {
      setShareModalOpen(true);
    }
    if (state.defaultMode) {
      setFillMode(state.defaultMode);
    }
    // Store submissionId if present
    if (state.submissionId) {
      setSubmissionId(state.submissionId);
    }
  }, [templateId]);

  // Load submission answers after template is loaded
  useEffect(() => {
    const state = location.state || {};
    if (template && state.submissionId) {
      fetchSubmissionAnswers(state.submissionId);
    }
  }, [template, location.state]);

  const fetchSubmissionAnswers = async (submissionId) => {
    console.log('[DEBUG] Fetching submission answers for ID:', submissionId);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/uscis-forms/client-submissions/${submissionId}`,
        { headers }
      );
      
      console.log('[DEBUG] Submission response:', response.data);
      
      if (response.data.answers && response.data.answers.length > 0) {
        console.log(`[DEBUG] Found ${response.data.answers.length} answers, mapping them...`);
        mapSubmissionToAnswers(response.data.answers);
        if (response.data.client_name) {
          setClientName(response.data.client_name);
        }
        // Automatically set to manual mode when completing a pre-validation form
        if (response.data.form_type === 'pre_validation') {
          setFillMode('manual');
        }
        toast.success(`Cargadas ${response.data.answers.length} respuestas del cliente`);
      }
    } catch (error) {
      console.error('[ERROR] Error fetching submission:', error);
      console.error('[ERROR] Error details:', error.response?.data);
      toast.error('Error al cargar las respuestas del cliente');
    }
  };

  const fetchTemplate = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/templates/${templateId}`, { headers });
      setTemplate(response.data);
      
      // Initialize expanded sections
      const sections = response.data.questions?.sections || [];
      const expanded = {};
      sections.forEach((s, i) => { expanded[i] = i === 0; });
      setExpandedSections(expanded);
      
      // Pre-fill answers that have default values
      const preFilledAnswers = {};
      sections.forEach(section => {
        (section.questions || []).forEach(q => {
          if (q.answer && q.answer.trim() !== '') {
            preFilledAnswers[q.id] = q.answer;
          }
        });
      });
      
      if (Object.keys(preFilledAnswers).length > 0) {
        setAnswers(prev => ({ ...prev, ...preFilledAnswers }));
        console.log(`✅ Pre-llenados ${Object.keys(preFilledAnswers).length} campos con valores por defecto`);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Error al cargar la plantilla');
      navigate('/admin/uscis-forms');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Delete question from template
  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;
    
    setDeletingQuestion(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/uscis-forms/templates/${templateId}/questions`, {
        headers,
        data: {
          section_index: questionToDelete.sectionIndex,
          question_id: questionToDelete.questionId
        }
      });
      
      // Update local state to remove the question
      setTemplate(prev => {
        const newSections = [...prev.questions.sections];
        newSections[questionToDelete.sectionIndex] = {
          ...newSections[questionToDelete.sectionIndex],
          questions: newSections[questionToDelete.sectionIndex].questions.filter(
            q => q.id !== questionToDelete.questionId
          )
        };
        return {
          ...prev,
          questions: { ...prev.questions, sections: newSections }
        };
      });
      
      toast.success('Pregunta eliminada correctamente');
      setDeleteConfirmOpen(false);
      setQuestionToDelete(null);
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Error al eliminar la pregunta');
    } finally {
      setDeletingQuestion(false);
    }
  };

  // Open delete confirmation dialog
  const confirmDeleteQuestion = (sectionIndex, question) => {
    setQuestionToDelete({
      sectionIndex,
      questionId: question.id,
      questionText: question.question
    });
    setDeleteConfirmOpen(true);
  };

  // Save partial answers without generating PDF
  const handleSaveChanges = async () => {
    if (!submissionId) {
      toast.error('No hay envío para guardar. Use "Generar y Descargar" primero.');
      return;
    }

    setSaving(true);
    try {
      const sections = template?.questions?.sections || [];
      const answersData = [];
      
      sections.forEach(section => {
        section.questions?.forEach(q => {
          if (answers[q.id] && shouldShowQuestion(q)) {
            answersData.push({
              question: q.question,
              answer: answers[q.id]
            });
          }
        });
      });

      await axios.patch(
        `${BACKEND_URL}/api/uscis-forms/client-submissions/${submissionId}/save`,
        { answers: answersData },
        { headers }
      );

      toast.success('Cambios guardados correctamente');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  // Map pre-validation submission answers to form questions
  // Based on I-140 PDF structure - See /app/docs/USCIS_FORMS_MODULE.md
  const mapSubmissionToAnswers = (submissionAnswers) => {
    if (!submissionAnswers || submissionAnswers.length === 0) return;
    
    const mappedAnswers = {};
    const sections = template?.questions?.sections || [];
    
    // Helper to find question by ID pattern
    const findQuestionByIdPattern = (patterns) => {
      for (const section of sections) {
        for (const q of (section.questions || [])) {
          const qId = q.id?.toLowerCase() || '';
          if (patterns.some(p => qId.includes(p.toLowerCase()))) {
            return q.id;
          }
        }
      }
      return null;
    };

    // Helper to find question by text keywords
    const findQuestionByKeywords = (keywords) => {
      for (const section of sections) {
        for (const q of (section.questions || [])) {
          const qText = q.question?.toLowerCase() || '';
          if (keywords.some(kw => qText.includes(kw.toLowerCase()))) {
            return q.id;
          }
        }
      }
      return null;
    };

    /*
     * MAPEO CORRECTO SEGÚN ESTRUCTURA I-140:
     * 
     * PARTE 3 - INFORMACIÓN DEL BENEFICIARIO (cliente):
     *   - Item 8: A-Number (Alien Registration Number)
     *   - Item 9: SSN del beneficiario
     *   - Item 10: USCIS Online Account Number
     * 
     * PARTE 4 - PROCESSING INFORMATION (Foreign Address = dirección del cliente en su país):
     *   - Item 3.a: Street Number and Name
     *   - Item 3.b: Apt/Ste/Flr
     *   - Item 3.c: City or Town
     *   - Item 3.d: Province
     *   - Item 3.e: Postal Code
     *   - Item 3.f: Country
     * 
     * PARTE 8 - CONTACTO:
     *   - Item 3: Daytime Phone
     *   - Item 5: Email
     * 
     * NOTA: Los campos "Mailing Address" en Part 1, 3.2 y 5 son de la EMPRESA, no del cliente.
     */

    const mappingConfig = {
      // === PARTE 4 - PROCESSING INFORMATION (Nuevas preguntas de PreValidationFormContent.js) ===
      '¿Dónde procesará la visa el beneficiario?': {
        idPatterns: ['processing_type', 'visa_processing'],
        keywords: ['dónde procesará', 'proceso consular', 'ajuste de estatus']
      },
      '1.a. Ciudad o Pueblo': {
        idPatterns: ['consular_city', 'part4_1a_city'],
        keywords: ['ciudad o pueblo', '1.a', 'consular']
      },
      '1.c. País': {
        idPatterns: ['consular_country', 'part4_1c_country'],
        keywords: ['1.c', 'país', 'consular']
      },
      '2.b. País de residencia actual del beneficiario': {
        idPatterns: ['foreign_residence_country', 'part4_2b'],
        keywords: ['2.b', 'residencia actual', 'país de residencia']
      },
      '3.a. Número y Nombre de la Calle': {
        idPatterns: ['foreign_street', 'part4_street', 'beneficiary_foreign_street'],
        keywords: ['3.a', 'número y nombre', 'calle', 'street number']
      },
      '3.b. Apartamento': {
        idPatterns: ['foreign_apt', 'part4_apt', 'beneficiary_foreign_apt'],
        keywords: ['3.b', 'apartamento', 'apt', 'suite']
      },
      '3.c. Ciudad': {
        idPatterns: ['foreign_city', 'part4_city', 'beneficiary_foreign_city'],
        keywords: ['3.c', 'ciudad', 'city']
      },
      '3.d. Provincia': {
        idPatterns: ['foreign_province', 'part4_province', 'beneficiary_foreign_province'],
        keywords: ['3.d', 'provincia', 'province', 'state']
      },
      '3.e. Código Postal': {
        idPatterns: ['foreign_postal', 'part4_postal', 'beneficiary_foreign_postal'],
        keywords: ['3.e', 'código postal', 'postal code', 'zip']
      },
      '3.f. País': {
        idPatterns: ['foreign_country', 'part4_country', 'beneficiary_foreign_country'],
        keywords: ['3.f', 'país', 'country']
      },
      
      // === PARTE 3 - BENEFICIARIO ===
      // Nuevos nombres de preguntas (actualizados en PreValidationFormContent.js)
      '8. USCIS Online Account Number (si aplica)': {
        idPatterns: ['beneficiary_uscis_online', 'uscis_online', 'uscis_account'],
        keywords: ['uscis online', 'cuenta en línea de uscis', 'uscis account', '8.']
      },
      '7. Número de Seguro Social de EE.UU. (si aplica)': {
        idPatterns: ['beneficiary_ssn'],
        keywords: ['seguro social', 'ssn', 'social security', '7.']
      },
      'A-Number del Beneficiario': {
        idPatterns: ['beneficiary_a_number', 'a_number', 'alien_number'],
        keywords: ['a-number', 'alien', 'registro de extranjero', 'beneficiario']
      },
      
      // === MAILING ADDRESS DEL BENEFICIARIO (Part 3, Section 2) ===
      '2.b. Street Number and Name (Beneficiario)': {
        idPatterns: ['beneficiary_street', 'mailing_street_beneficiario', '2.b'],
        keywords: ['street number and name', 'calle', 'beneficiario', '2.b']
      },
      '2.c. Suite/Apt/Floor Number (Beneficiario)': {
        idPatterns: ['beneficiary_apt', 'mailing_apt_beneficiario', '2.c'],
        keywords: ['suite', 'apt', 'floor', 'beneficiario', '2.c']
      },
      '2.d. City or Town (Beneficiario)': {
        idPatterns: ['beneficiary_city', 'mailing_city_beneficiario', '2.d'],
        keywords: ['city', 'town', 'ciudad', 'beneficiario', '2.d']
      },
      '2.e. State (Beneficiario)': {
        idPatterns: ['beneficiary_state', 'mailing_state_beneficiario', '2.e'],
        keywords: ['state', 'estado', 'beneficiario', '2.e']
      },
      '2.f. ZIP Code (Beneficiario)': {
        idPatterns: ['beneficiary_zip', 'mailing_zip_beneficiario', '2.f'],
        keywords: ['zip code', 'código postal', 'beneficiario', '2.f']
      },
      '2.h. Province (Beneficiario)': {
        idPatterns: ['beneficiary_province', 'mailing_province_beneficiario', '2.h'],
        keywords: ['province', 'provincia', 'beneficiario', '2.h']
      },
      '2.g. Postal Code (Beneficiario)': {
        idPatterns: ['beneficiary_postal', 'mailing_postal_beneficiario', '2.g'],
        keywords: ['postal code', 'código postal', 'beneficiario', '2.g']
      },
      '2.i. Country (Beneficiario)': {
        idPatterns: ['beneficiary_country', 'mailing_country_beneficiario', '2.i'],
        keywords: ['country', 'país', 'beneficiario', '2.i']
      },
      
      // === CONTACTO ===
      'Email del Beneficiario': {
        idPatterns: ['contact_email', 'email', 'correo', 'beneficiary_email'],
        keywords: ['email', 'correo electrónico', 'e-mail', 'beneficiario']
      },
      'Número de Contacto': {
        idPatterns: ['contact_phone', 'phone', 'telefono', 'daytime_phone', 'beneficiary_phone'],
        keywords: ['teléfono', 'phone', 'número de contacto', 'contacto']
      },
      
      // === COMPATIBILIDAD CON NOMBRES ANTIGUOS (por si acaso) ===
      'Número de cuenta USCIS': {
        idPatterns: ['beneficiary_uscis_online', 'uscis_online', 'uscis_account'],
        keywords: ['uscis online', 'cuenta en línea de uscis', 'uscis account']
      },
      'Número de Seguro Social': {
        idPatterns: ['beneficiary_ssn'],
        keywords: ['seguro social', 'ssn', 'social security']
      },
      'Código A (Alien Registration Number)': {
        idPatterns: ['beneficiary_a_number', 'a_number', 'alien_number'],
        keywords: ['a-number', 'alien', 'registro de extranjero']
      },
      'Dirección - Calle y Número': {
        idPatterns: ['beneficiary_address_street', 'foreign_street', 'part4_street'],
        keywords: ['calle y número', 'dirección actual', 'street']
      },
      'Dirección - Apartamento/Suite': {
        idPatterns: ['beneficiary_address_apt', 'foreign_apt'],
        keywords: ['apartamento', 'suite', 'apt']
      },
      'Dirección - Ciudad': {
        idPatterns: ['beneficiary_address_city', 'foreign_city'],
        keywords: ['ciudad']
      },
      'Dirección - Estado': {
        idPatterns: ['beneficiary_address_state', 'foreign_state', 'foreign_province'],
        keywords: ['estado', 'provincia', 'state', 'province']
      },
      'Dirección - Código Postal (ZIP)': {
        idPatterns: ['beneficiary_address_zip', 'foreign_zip', 'foreign_postal'],
        keywords: ['código postal', 'zip', 'postal']
      },
      'Dirección - Provincia': {
        idPatterns: ['beneficiary_address_state', 'foreign_province'],
        keywords: ['provincia', 'province']
      },
      'Dirección - Código Postal': {
        idPatterns: ['beneficiary_address_zip', 'foreign_postal'],
        keywords: ['código postal', 'postal code']
      },
      'Dirección - País': {
        idPatterns: ['beneficiary_address_country', 'foreign_country'],
        keywords: ['país', 'country']
      },
      'Correo Electrónico': {
        idPatterns: ['contact_email', 'email', 'correo'],
        keywords: ['email', 'correo electrónico', 'e-mail']
      },
      'Número de Teléfono': {
        idPatterns: ['contact_phone', 'phone', 'telefono', 'daytime_phone'],
        keywords: ['teléfono', 'phone', 'número de contacto']
      },
      
      // === PARTE 8 - CONTACTO (Nuevos nombres) ===
      '5. Dirección de Email': {
        idPatterns: ['contact_email', 'email', 'correo', 'beneficiary_email'],
        keywords: ['email', 'dirección de email', 'correo']
      },
      '3. Teléfono de Día': {
        idPatterns: ['contact_phone', 'phone', 'telefono', 'daytime_phone'],
        keywords: ['teléfono de día', 'daytime phone', 'contacto']
      },
      
      // === PARTE 3 - A-Number ===
      '8. Número de Registro de Extranjero (A-Number)': {
        idPatterns: ['beneficiary_a_number', 'a_number', 'alien_number'],
        keywords: ['a-number', 'alien', 'registro de extranjero', '8.']
      },
      
      // === PARTE 7 - FAMILIA (Persona 1-6) ===
      '1.a. Apellido (Persona 1)': {
        idPatterns: ['person1_family_name', 'person_1_lastname'],
        keywords: ['apellido', 'persona 1', 'family name']
      },
      '1.b. Nombre (Persona 1)': {
        idPatterns: ['person1_given_name', 'person_1_firstname'],
        keywords: ['nombre', 'persona 1', 'given name']
      },
      '1.c. Segundo Nombre (Persona 1)': {
        idPatterns: ['person1_middle_name', 'person_1_middlename'],
        keywords: ['segundo nombre', 'persona 1', 'middle name']
      },
      '2. Fecha de Nacimiento (Persona 1)': {
        idPatterns: ['person1_dob', 'person_1_birthdate'],
        keywords: ['fecha de nacimiento', 'persona 1', 'date of birth']
      },
      '3. País de Nacimiento (Persona 1)': {
        idPatterns: ['person1_country_birth', 'person_1_country'],
        keywords: ['país de nacimiento', 'persona 1', 'country of birth']
      },
      '4. Relación (Persona 1)': {
        idPatterns: ['person1_relationship', 'person_1_relation'],
        keywords: ['relación', 'persona 1', 'relationship']
      },
      // Personas 2-6 con patrones similares
      '7.a. Apellido (Persona 2)': {
        idPatterns: ['person2_family_name', 'person_2_lastname'],
        keywords: ['apellido', 'persona 2']
      },
      '7.b. Nombre (Persona 2)': {
        idPatterns: ['person2_given_name', 'person_2_firstname'],
        keywords: ['nombre', 'persona 2']
      },
      '10. Relación (Persona 2)': {
        idPatterns: ['person2_relationship', 'person_2_relation'],
        keywords: ['relación', 'persona 2']
      },
      '13.a. Apellido (Persona 3)': {
        idPatterns: ['person3_family_name', 'person_3_lastname'],
        keywords: ['apellido', 'persona 3']
      },
      '13.b. Nombre (Persona 3)': {
        idPatterns: ['person3_given_name', 'person_3_firstname'],
        keywords: ['nombre', 'persona 3']
      },
      '16. Relación (Persona 3)': {
        idPatterns: ['person3_relationship', 'person_3_relation'],
        keywords: ['relación', 'persona 3']
      }
    };

    // Create flattened array of all questions from all sections
    const allQuestions = [];
    sections.forEach(section => {
      if (section.questions && Array.isArray(section.questions)) {
        allQuestions.push(...section.questions);
      }
    });

    // Process each submission answer
    let mappedCount = 0;
    submissionAnswers.forEach(({ question, answer }) => {
      if (!answer || answer === 'N/A' || answer.trim() === '') return;
      
      // MATCH DIRECTO: Buscar la pregunta exacta en el template
      const exactMatch = allQuestions.find(q => q.question === question);
      if (exactMatch) {
        mappedAnswers[exactMatch.id] = answer;
        mappedCount++;
        console.log(`✓ Mapped (exact): "${question}" → ${exactMatch.id} = "${answer}"`);
        
        // CASO ESPECIAL: SSN se pregunta en dos lugares (Parte 1, ítem 7 y Parte 3, ítem 9)
        if (question === '7. Número de Seguro Social de EE.UU. (si aplica)') {
          // Buscar también la pregunta 9 de SSN en Parte 3
          const ssnQuestion9 = allQuestions.find(q => q.question === '9. Número de Seguro Social de EE.UU. (si aplica)');
          if (ssnQuestion9) {
            mappedAnswers[ssnQuestion9.id] = answer;
            mappedCount++;
            console.log(`✓ Mapped (duplicate SSN): "9. SSN" → ${ssnQuestion9.id} = "${answer}"`);
          }
        }
        
        return;
      }
      
      // Fallback al método anterior si no hay match exacto
      const config = mappingConfig[question];
      if (!config) {
        console.log(`⚠ No mapping for: ${question}`);
        return;
      }
      
      // Try to find by ID pattern first
      let targetId = findQuestionByIdPattern(config.idPatterns);
      
      // If not found by ID, try by keywords
      if (!targetId) {
        targetId = findQuestionByKeywords(config.keywords);
      }
      
      if (targetId) {
        mappedAnswers[targetId] = answer;
        mappedCount++;
        console.log(`✓ Mapped (fallback): "${question}" → ${targetId} = "${answer}"`);
      } else {
        console.log(`✗ No target found for: "${question}"`);
      }
    });
    
    if (Object.keys(mappedAnswers).length > 0) {
      setAnswers(prev => ({ ...prev, ...mappedAnswers }));
      toast.success(`${mappedCount} respuestas pre-llenadas del cliente`);
    } else {
      toast.info('No se pudieron mapear las respuestas automáticamente');
    }
  };

  // Handler for chat data extraction
  const handleChatDataExtracted = (extractedData) => {
    // Map extracted data to form questions with intelligent matching
    const updates = {};
    
    // Helper function to match question with extracted field
    const matchQuestion = (question, extractedKey, value) => {
      const qLower = question.toLowerCase();
      const key = extractedKey.toLowerCase();
      
      // Exact priority matching - most specific first
      const exactMatches = {
        // Nombres
        'apellidos': () => {
          return (qLower.includes('apellido') && !qLower.includes('otro')) || 
                 (qLower.includes('last name') && !qLower.includes('other'));
        },
        'nombres': () => {
          return (qLower.includes('nombres') && !qLower.includes('apellido') && !qLower.includes('otro') && !qLower.includes('completo')) ||
                 (qLower.includes('first name') && !qLower.includes('other'));
        },
        'nombre_completo': () => {
          return (qLower.includes('nombre completo') && !qLower.includes('alfabeto')) ||
                 qLower.includes('full name') ||
                 qLower.includes('nombre legal');
        },
        
        // Fechas
        'fecha_nacimiento': () => {
          return (qLower.includes('fecha') && qLower.includes('nacimiento')) ||
                 qLower.includes('date of birth') ||
                 qLower.includes('birth date');
        },
        'fecha_expedicion': () => {
          return (qLower.includes('fecha') && (qLower.includes('expedición') || qLower.includes('emisión'))) ||
                 qLower.includes('issue date');
        },
        'fecha_expiracion': () => {
          return (qLower.includes('fecha') && qLower.includes('expiración')) ||
                 qLower.includes('expiration date') ||
                 qLower.includes('vencimiento');
        },
        
        // Países y nacionalidad
        'pais_nacimiento': () => {
          return (qLower.includes('país') && qLower.includes('nacimiento')) ||
                 qLower.includes('country of birth') ||
                 qLower.includes('lugar de nacimiento');
        },
        'nacionalidad': () => {
          return qLower.includes('nacionalidad') || 
                 qLower.includes('nationality') ||
                 qLower.includes('citizenship');
        },
        'pais_emision': () => {
          return (qLower.includes('país') && (qLower.includes('emisión') || qLower.includes('expedición'))) ||
                 qLower.includes('country of issue');
        },
        
        // Dirección
        'direccion': () => {
          return (qLower.includes('dirección') || qLower.includes('address') || qLower.includes('calle')) &&
                 !qLower.includes('ciudad') && !qLower.includes('estado') && !qLower.includes('código postal');
        },
        'ciudad': () => {
          return qLower.includes('ciudad') || (qLower.includes('city') && !qLower.includes('state'));
        },
        'estado': () => {
          return (qLower.includes('estado') && !qLower.includes('unidos')) || 
                 qLower.includes('state') ||
                 qLower.includes('provincia');
        },
        'codigo_postal': () => {
          return qLower.includes('código postal') || 
                 qLower.includes('zip') ||
                 qLower.includes('postal code');
        },
        
        // Contacto
        'telefono': () => {
          return qLower.includes('teléfono') || 
                 qLower.includes('phone') ||
                 qLower.includes('celular');
        },
        'email': () => {
          return qLower.includes('email') || 
                 qLower.includes('correo') ||
                 qLower.includes('e-mail');
        },
        
        // Documentos
        'numero_pasaporte': () => {
          return (qLower.includes('pasaporte') || qLower.includes('passport')) &&
                 qLower.includes('número');
        },
        'numero_documento': () => {
          return qLower.includes('número de documento') ||
                 qLower.includes('document number');
        },
        
        // Otros
        'ssn': () => {
          return qLower.includes('ssn') || 
                 qLower.includes('social security') ||
                 qLower.includes('seguro social');
        },
        'a_number': () => {
          return qLower.includes('a-number') || 
                 qLower.includes('alien number') ||
                 qLower.includes('número de extranjero');
        },
        'genero': () => {
          return qLower.includes('género') || 
                 qLower.includes('sexo') ||
                 qLower.includes('gender') ||
                 qLower.includes('sex');
        },
        'estatus_migratorio': () => {
          return qLower.includes('estatus') && qLower.includes('migratorio') ||
                 qLower.includes('immigration status');
        }
      };
      
      // Check if this extracted key matches this question
      const matchFunc = exactMatches[key];
      return matchFunc ? matchFunc() : false;
    };
    
    // For each extracted field
    Object.entries(extractedData).forEach(([extractedKey, value]) => {
      if (!value) return;
      
      // Find ALL questions that match this field (we'll keep the most specific match)
      const matches = [];
      sections.forEach(section => {
        section.questions?.forEach(q => {
          if (matchQuestion(q.question, extractedKey, value)) {
            matches.push({
              questionId: q.id,
              question: q.question,
              priority: q.question.length // Longer questions are usually more specific
            });
          }
        });
      });
      
      // If we found matches, use the most specific one (longest question text)
      if (matches.length > 0) {
        matches.sort((a, b) => b.priority - a.priority);
        updates[matches[0].questionId] = value;
      }
    });
    
    // Update answers state
    setAnswers(prev => ({ ...prev, ...updates }));
  };

  const toggleSection = (index) => {
    setExpandedSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const shouldShowQuestion = (question) => {
    if (!question.conditional_logic) return true;
    
    const dependsOn = question.conditional_logic.depends_on;
    const showWhen = question.conditional_logic.show_when;
    const currentValue = answers[dependsOn];
    
    if (Array.isArray(showWhen)) {
      return showWhen.includes(currentValue);
    }
    return currentValue === showWhen;
  };

  const sections = template?.questions?.sections || [];
  
  const calculateProgress = () => {
    let answered = 0;
    let total = 0;
    
    sections.forEach(section => {
      section.questions?.forEach(q => {
        if (shouldShowQuestion(q)) {
          total++;
          if (answers[q.id] && answers[q.id].trim()) {
            answered++;
          }
        }
      });
    });
    
    return total > 0 ? Math.round((answered / total) * 100) : 0;
  };

  const handleSubmit = async () => {
    // Build answers array
    const answersArray = [];
    sections.forEach(section => {
      section.questions?.forEach(q => {
        if (answers[q.id] && shouldShowQuestion(q)) {
          answersArray.push({
            question: q.question,
            answer: answers[q.id]
          });
        }
      });
    });

    if (answersArray.length === 0) {
      toast.error('Por favor responda al menos una pregunta');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('template_id', templateId);
      formData.append('answers_json', JSON.stringify(answersArray));
      if (clientName) {
        formData.append('client_name', clientName);
      }

      const response = await axios.post(`${BACKEND_URL}/api/uscis-forms/fill`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'blob'
      });

      // Download the file
      const contentType = response.headers['content-type'];
      const fileType = response.headers['x-file-type'] || (contentType.includes('html') ? 'html' : 'pdf');
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.form_code}_filled.${fileType}`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('Formulario generado exitosamente');
    } catch (error) {
      console.error('Error generating form:', error);
      
      // Try to get more detailed error message
      let errorMessage = 'Error al generar el formulario';
      if (error.response?.data) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          // If not JSON, keep default message
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Function to translate answers to English on-demand
  const handleTranslateToEnglish = async () => {
    // Build answers dictionary
    const answersDict = {};
    sections.forEach(section => {
      section.questions?.forEach(q => {
        if (answers[q.id] && shouldShowQuestion(q)) {
          answersDict[q.question] = answers[q.id];
        }
      });
    });

    if (Object.keys(answersDict).length === 0) {
      toast.error('No hay respuestas para traducir');
      return;
    }

    setTranslating(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/uscis-forms/translate-answers`, {
        form_id: templateId,
        answers: answersDict
      }, { headers });

      if (response.data.success) {
        setTranslatedAnswers(response.data.translated_answers);
        setShowTranslatedView(true);
        toast.success(`Traducción completada: ${response.data.translation_count} campos traducidos`);
      }
    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Error al traducir las respuestas');
    } finally {
      setTranslating(false);
    }
  };

  // Function to apply translated answers and download
  const handleDownloadWithTranslation = async () => {
    if (!translatedAnswers) {
      toast.error('Primero traduzca las respuestas');
      return;
    }

    // Build answers array from translated answers
    const answersArray = Object.entries(translatedAnswers).map(([question, answer]) => ({
      question,
      answer
    }));

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('template_id', templateId);
      formData.append('answers_json', JSON.stringify(answersArray));
      if (clientName) {
        formData.append('client_name', clientName);
      }

      const response = await axios.post(`${BACKEND_URL}/api/uscis-forms/fill`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'blob'
      });

      // Download the file
      const contentType = response.headers['content-type'];
      const fileType = response.headers['x-file-type'] || (contentType.includes('html') ? 'html' : 'pdf');
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.form_code}_filled_EN.${fileType}`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success('Formulario traducido descargado exitosamente');
      setShowTranslatedView(false);
    } catch (error) {
      console.error('Error generating translated form:', error);
      toast.error('Error al generar el formulario traducido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!shareData.client_name) {
      toast.error('Por favor ingrese el nombre del cliente');
      return;
    }

    setCreatingShare(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/uscis-forms/shared-forms`, {
        template_id: templateId,
        client_name: shareData.client_name,
        client_email: shareData.client_email,
        expires_in_days: shareData.expires_in_days
      }, { headers });

      const url = `${window.location.origin}/uscis-form/${response.data.token}`;
      setShareLink(url);
      
      // Try to copy to clipboard, but don't fail if it's blocked
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace creado y copiado al portapapeles');
      } catch (clipboardError) {
        // Clipboard API blocked or not available
        toast.success('Enlace creado. Use el botón "Copiar" para copiar al portapapeles');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
      toast.error('Error al crear el enlace');
    } finally {
      setCreatingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success('Enlace copiado al portapapeles');
    } catch (error) {
      // Fallback: Select the text for manual copy
      const tempInput = document.createElement('input');
      tempInput.value = shareLink;
      document.body.appendChild(tempInput);
      tempInput.select();
      tempInput.setSelectionRange(0, 99999); // For mobile devices
      
      try {
        document.execCommand('copy');
        toast.success('Enlace copiado al portapapeles');
      } catch (err) {
        toast.error('No se pudo copiar. Por favor copie el enlace manualmente');
      }
      
      document.body.removeChild(tempInput);
    }
  };

  const renderQuestion = (question) => {
    if (!shouldShowQuestion(question)) return null;

    const value = answers[question.id] || '';
    
    const commonProps = {
      value,
      onChange: (e) => handleAnswerChange(question.id, e.target.value),
      className: "bg-navy-light border-navy-light text-white placeholder:text-gray-500"
    };

    switch (question.type) {
      case 'header':
        // Render section header/divider (no input needed)
        return (
          <div className="py-3 px-4 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
            <span className="text-indigo-300 font-semibold text-sm tracking-wide">{question.question}</span>
          </div>
        );
      
      case 'textarea':
        return (
          <Textarea 
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            rows={3} 
            placeholder={question.hint || ''} 
            className="bg-navy-light border-navy-light text-white placeholder:text-gray-500 min-h-[80px] focus:bg-navy-light" 
            style={{ backgroundColor: '#1e293b', color: 'white' }}
          />
        );
      
      case 'select':
        return (
          <Select value={value} onValueChange={(v) => handleAnswerChange(question.id, v)}>
            <SelectTrigger className="bg-navy-light border-navy-light text-white">
              <SelectValue placeholder="Seleccione una opción" />
            </SelectTrigger>
            <SelectContent className="bg-navy-secondary border-navy-light">
              {question.options?.map((opt, i) => (
                <SelectItem key={i} value={opt} className="text-white hover:bg-navy-light">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'yes_no':
        return (
          <div className="flex gap-4">
            <Button
              type="button"
              variant={value === 'Sí' ? 'default' : 'outline'}
              onClick={() => handleAnswerChange(question.id, 'Sí')}
              className={value === 'Sí' ? 'bg-green-600 hover:bg-green-700' : 'border-navy-light text-gray-400'}
            >
              Sí
            </Button>
            <Button
              type="button"
              variant={value === 'No' ? 'default' : 'outline'}
              onClick={() => handleAnswerChange(question.id, 'No')}
              className={value === 'No' ? 'bg-red-600 hover:bg-red-700' : 'border-navy-light text-gray-400'}
            >
              No
            </Button>
          </div>
        );
      
      case 'date':
        return <Input {...commonProps} type="date" />;
      
      case 'email':
        return <Input {...commonProps} type="email" placeholder={question.hint || 'correo@ejemplo.com'} />;
      
      default:
        return <Input {...commonProps} placeholder={question.hint || ''} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gold-primary" />
      </div>
    );
  }

  // Mode selection screen
  if (!fillMode) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full mb-4">
            <Badge className="bg-indigo-500 text-white">{template?.form_code}</Badge>
          </div>
          <h1 className="text-3xl font-bold text-white">{template?.name}</h1>
          <p className="text-xl text-gray-400">¿Cómo quieres llenar tu formulario?</p>
        </div>

        {/* Mode Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* Chat Mode */}
          <button
            onClick={() => setFillMode('chat')}
            className="group relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-left hover:scale-105 transition-all duration-300 border-2 border-transparent hover:border-white/20 shadow-lg hover:shadow-2xl"
          >
            <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              💬 Con Asistente de IA
            </h3>
            <p className="text-white/80 mb-6">
              Mónica te guiará paso a paso. Puedes subir fotos de tus documentos para extraer información automáticamente.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle className="h-4 w-4 text-green-300" />
                <span className="text-sm">Guía paso a paso</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle className="h-4 w-4 text-green-300" />
                <span className="text-sm">Escanea documentos</span>
              </div>
            </div>
          </button>

          {/* Manual Mode */}
          <button
            onClick={() => setFillMode('manual')}
            className="group relative bg-navy-secondary border-2 border-navy-light rounded-xl p-6 text-left hover:scale-105 transition-all duration-300 hover:border-gold-primary/50 shadow-lg hover:shadow-2xl"
          >
            <div className="absolute top-4 right-4 w-12 h-12 bg-gold-primary/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileEdit className="h-6 w-6 text-gold-primary" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              📝 Llenar Manualmente
            </h3>
            <p className="text-gray-400 mb-6">
              Completa el formulario por tu cuenta, sección por sección.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="h-4 w-4 text-gold-primary" />
                <span className="text-sm">Control total</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="h-4 w-4 text-gold-primary" />
                <span className="text-sm">A tu ritmo</span>
              </div>
            </div>
          </button>
        </div>

        {/* Back Button */}
        <div className="flex justify-center mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/uscis-forms')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Chat Mode View
  if (fillMode === 'chat') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setFillMode(null)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cambiar Modo
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-indigo-500 text-white">{template?.form_code}</Badge>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-400">{calculateProgress()}% completado</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{template?.name}</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setFillMode('manual')}
              className="border-gray-600 text-gray-400 hover:bg-gray-600/20"
            >
              <FileEdit className="h-4 w-4 mr-2" />
              Modo Manual
            </Button>
          </div>
        </div>

        {/* Chat + Preview Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Chat Assistant */}
          <ChatAssistant
            templateId={templateId}
            templateName={template?.name}
            formCode={template?.form_code}
            onDataExtracted={handleChatDataExtracted}
          />

          {/* Right: Data Preview */}
          <Card className="bg-navy-secondary border-navy-light">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-gold-primary" />
                Datos Recopilados ({calculateProgress()}%)
              </CardTitle>
              <Progress value={calculateProgress()} className="h-2 bg-navy-light mt-2" />
            </CardHeader>
            <CardContent className="space-y-4 max-h-[520px] overflow-y-auto">
              {sections.map((section, sectionIndex) => (
                <div key={section.id || sectionIndex} className="space-y-2">
                  <h3 className="font-medium text-gray-300 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-400">
                      {sectionIndex + 1}
                    </div>
                    {section.name}
                  </h3>
                  <div className="ml-8 space-y-1">
                    {section.questions?.map((question, qIndex) => {
                      if (!shouldShowQuestion(question)) return null;
                      const value = answers[question.id];
                      return (
                        <div key={question.id || qIndex} className="text-sm">
                          <span className="text-gray-500">{question.question}</span>
                          {value ? (
                            <div className="flex items-center gap-2 mt-1">
                              <CheckCircle className="h-3 w-3 text-green-400" />
                              <span className="text-gray-300">{value}</span>
                            </div>
                          ) : (
                            <div className="text-gray-600 mt-1">...</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => setShareModalOpen(true)}
            className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartir con Cliente
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || calculateProgress() === 0}
            className="bg-gold-primary hover:bg-gold-dark text-navy-primary font-medium px-8"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Generar Formulario
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Manual Mode View (original form)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setFillMode(null)}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cambiar Modo
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-blue-500/20 text-blue-400">{template?.form_code}</Badge>
              <Badge className="bg-purple-500/20 text-purple-400">{template?.visa_category}</Badge>
              {template?.visa_subcategory && (
                <Badge className="bg-green-500/20 text-green-400">{template.visa_subcategory}</Badge>
              )}
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-400">{calculateProgress()}% completado</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{template?.name}</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
            className={editMode 
              ? "bg-amber-500 text-white hover:bg-amber-600" 
              : "border-amber-500 text-amber-400 hover:bg-amber-500/20"
            }
            data-testid="edit-mode-toggle"
          >
            <Pencil className="h-4 w-4 mr-2" />
            {editMode ? 'Salir de Edición' : 'Editar Cuestionario'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFillMode('chat')}
            className="border-indigo-500 text-indigo-400 hover:bg-indigo-500/20"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Modo Asistente
          </Button>
          <Button
            variant="outline"
            onClick={() => setShareModalOpen(true)}
            className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartir con Cliente
          </Button>
        </div>
      </div>

      {/* Edit Mode Banner */}
      {editMode && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-amber-200 font-medium">Modo Edición Activo</p>
            <p className="text-amber-300/70 text-sm">Haz clic en el ícono de basura junto a cualquier pregunta para eliminarla del cuestionario.</p>
          </div>
        </div>
      )}

      {/* Progress */}
      <Card className="bg-navy-secondary border-navy-light">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Progreso del Formulario</span>
            <span className="text-gold-primary font-medium">{calculateProgress()}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2 bg-navy-light" />
        </CardContent>
      </Card>

      {/* Client Name */}
      <Card className="bg-navy-secondary border-navy-light">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <User className="h-5 w-5 text-gold-primary" />
            <div className="flex-1">
              <Label className="text-gray-300">Nombre del Cliente (Opcional)</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500 mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, sectionIndex) => (
          <Card key={section.id || sectionIndex} className="bg-navy-secondary border-navy-light overflow-hidden">
            <button
              onClick={() => toggleSection(sectionIndex)}
              className="w-full flex items-center justify-between p-4 hover:bg-navy-light/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold-primary/20 flex items-center justify-center">
                  <span className="text-gold-primary font-medium">{sectionIndex + 1}</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-white">{section.name}</h3>
                  {section.description && (
                    <p className="text-sm text-gray-500">{section.description}</p>
                  )}
                </div>
              </div>
              {expandedSections[sectionIndex] ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections[sectionIndex] && (
              <CardContent className="pt-0 pb-6 space-y-6">
                {section.questions?.map((question, qIndex) => {
                  const rendered = renderQuestion(question);
                  if (!rendered) return null;
                  
                  // For header type, render without label wrapper
                  if (question.type === 'header') {
                    return (
                      <div key={question.id || qIndex} className="relative group">
                        {editMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmDeleteQuestion(sectionIndex, question)}
                            className="absolute -right-2 -top-2 h-7 w-7 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            data-testid={`delete-question-${question.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {rendered}
                      </div>
                    );
                  }
                  
                  return (
                    <div key={question.id || qIndex} className="space-y-2 relative group">
                      {editMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDeleteQuestion(sectionIndex, question)}
                          className="absolute -right-2 -top-2 h-7 w-7 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          data-testid={`delete-question-${question.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Label className="text-gray-300 flex items-center gap-2">
                        {question.question}
                        {question.required && <span className="text-red-400">*</span>}
                      </Label>
                      {rendered}
                      {question.hint && question.type !== 'textarea' && question.type !== 'text' && (
                        <p className="text-xs text-gray-500">{question.hint}</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        {submissionId && (
          <Button
            onClick={handleSaveChanges}
            disabled={saving || submitting}
            variant="outline"
            className="border-green-500 text-green-400 hover:bg-green-500/20 font-medium px-6 py-6"
            data-testid="save-changes-btn"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        )}
        
        {/* Translate to English Button */}
        <Button
          onClick={handleTranslateToEnglish}
          disabled={translating || submitting}
          variant="outline"
          className="border-blue-500 text-blue-400 hover:bg-blue-500/10 font-medium px-6 py-6"
        >
          {translating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Traduciendo...
            </>
          ) : (
            <>
              <Languages className="h-5 w-5 mr-2" />
              Traducir a Inglés
            </>
          )}
        </Button>
        
        <Button
          onClick={handleSubmit}
          disabled={submitting || saving}
          className="bg-gold-primary hover:bg-gold-dark text-navy-primary font-medium px-8 py-6"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generando formulario...
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              Generar y Descargar Formulario
            </>
          )}
        </Button>
      </div>

      {/* Translation Preview Modal */}
      <Dialog open={showTranslatedView} onOpenChange={setShowTranslatedView}>
        <DialogContent className="bg-navy-secondary border-navy-light max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Languages className="h-5 w-5 text-blue-400" />
              Vista Previa - Traducción a Inglés
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Revise la traducción antes de descargar el PDF. Los cambios solo afectan la descarga, no el formulario guardado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {translatedAnswers && Object.entries(translatedAnswers).map(([question, answer], index) => (
              <div key={index} className="p-3 bg-navy-light rounded-lg">
                <p className="text-gray-400 text-sm mb-1">{question}</p>
                <p className="text-white">{answer || <span className="text-gray-500 italic">Sin respuesta</span>}</p>
              </div>
            ))}
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTranslatedView(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDownloadWithTranslation}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF Traducido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="bg-navy-secondary border-navy-light">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Share2 className="h-5 w-5 text-gold-primary" />
              Compartir Formulario con Cliente
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Cree un enlace para que su cliente pueda llenar el formulario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nombre del Cliente *</Label>
              <Input
                value={shareData.client_name}
                onChange={(e) => setShareData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Ej: Juan Pérez"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Email del Cliente (Opcional)</Label>
              <Input
                type="email"
                value={shareData.client_email}
                onChange={(e) => setShareData(prev => ({ ...prev, client_email: e.target.value }))}
                placeholder="cliente@email.com"
                className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Días de Validez</Label>
              <Select 
                value={shareData.expires_in_days.toString()} 
                onValueChange={(v) => setShareData(prev => ({ ...prev, expires_in_days: parseInt(v) }))}
              >
                <SelectTrigger className="bg-navy-light border-navy-light text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-navy-secondary border-navy-light">
                  <SelectItem value="7" className="text-white">7 días</SelectItem>
                  <SelectItem value="14" className="text-white">14 días</SelectItem>
                  <SelectItem value="30" className="text-white">30 días</SelectItem>
                  <SelectItem value="60" className="text-white">60 días</SelectItem>
                  <SelectItem value="90" className="text-white">90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shareLink && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-medium">Enlace creado exitosamente</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={shareLink}
                    readOnly
                    className="bg-navy-light border-navy-light text-white text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyShareLink}
                    className="border-green-500 text-green-400 hover:bg-green-500/20"
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Comparte este enlace con tu cliente para que llene el formulario
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShareModalOpen(false);
                setShareLink('');
              }}
              className="border-gray-600 text-gray-400"
            >
              Cerrar
            </Button>
            {!shareLink && (
              <Button
                onClick={handleCreateShareLink}
                disabled={creatingShare}
                className="bg-gold-primary hover:bg-gold-dark text-navy-primary"
              >
                {creatingShare ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Crear Enlace
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Question Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-navy-secondary border-navy-light">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Eliminar Pregunta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Estás a punto de eliminar la pregunta:
              <span className="block mt-2 p-3 bg-navy-light rounded-lg text-gray-300 italic">
                "{questionToDelete?.questionText}"
              </span>
              <span className="block mt-3 text-amber-400">
                Esta acción no se puede deshacer. La pregunta se eliminará permanentemente del cuestionario.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-navy-light border-navy-light text-gray-300 hover:bg-navy-light/80"
              disabled={deletingQuestion}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              disabled={deletingQuestion}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="confirm-delete-question"
            >
              {deletingQuestion ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Sí, Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default USCISFormsFill;
