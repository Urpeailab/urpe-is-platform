import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PublicFormFill = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    fetchFormData();
  }, [token]);

  const fetchFormData = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/uscis-forms/public/form/${token}`);
      setFormData(response.data);
      
      // Initialize answers object based on questions
      if (response.data.questions) {
        const initialAnswers = {};
        const questions = response.data.questions;
        
        // Handle sections array format
        if (questions.sections && Array.isArray(questions.sections)) {
          questions.sections.forEach(section => {
            section.questions?.forEach(q => {
              initialAnswers[q.id] = '';
            });
          });
        } else {
          // Handle object format
          Object.values(questions).forEach(section => {
            if (section.questions) {
              section.questions.forEach(q => {
                initialAnswers[q.id] = '';
              });
            }
          });
        }
        setAnswers(initialAnswers);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading form:', error);
      toast.error(error.response?.data?.detail || 'Error al cargar el formulario');
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const getSections = () => {
    if (!formData?.questions) return [];
    
    // Handle both formats: questions.sections array or questions as object with section keys
    const questions = formData.questions;
    
    // Format 1: questions has a 'sections' array (from AI-generated questions)
    if (questions.sections && Array.isArray(questions.sections)) {
      return questions.sections.map((section, idx) => ({
        id: section.id || `section_${idx}`,
        title: section.name || section.title || `Sección ${idx + 1}`,
        description: section.description,
        questions: section.questions || []
      }));
    }
    
    // Format 2: questions is an object with section keys (older format)
    return Object.entries(questions).map(([key, section]) => ({
      id: key,
      title: section.title || key,
      questions: section.questions || []
    }));
  };

  // Check if a question should be shown based on conditional logic
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

  const sections = getSections();
  const currentSectionData = sections[currentSection];

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Format answers for submission
      const formattedAnswers = Object.entries(answers)
        .filter(([_, value]) => value && value.trim() !== '')
        .map(([questionId, answer]) => {
          // Find the question text
          let questionText = questionId;
          sections.forEach(section => {
            const q = section.questions.find(q => q.id === questionId);
            if (q) questionText = q.question;
          });
          return { question: questionText, answer };
        });

      await axios.post(`${BACKEND_URL}/api/uscis-forms/public/form/${token}/submit`, {
        client_name: formData?.client_name || '',
        client_email: answers.email || '',
        answers: formattedAnswers
      });

      setSubmitted(true);
      toast.success('Formulario enviado exitosamente');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar el formulario');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    const value = answers[question.id] || '';
    
    // Handle yes_no type with buttons
    if (question.type === 'yes_no') {
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
    }
    
    // Handle select type with dropdown
    if (question.type === 'select' && question.options?.length > 0) {
      return (
        <Select value={value} onValueChange={(val) => handleAnswerChange(question.id, val)}>
          <SelectTrigger className="bg-navy-light border-navy-light text-white">
            <SelectValue placeholder="Seleccione una opción" />
          </SelectTrigger>
          <SelectContent className="bg-navy-secondary border-navy-light">
            {question.options.map((opt, idx) => (
              <SelectItem key={idx} value={opt} className="text-white hover:bg-navy-light">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    // Handle textarea type
    if (question.type === 'textarea' || question.question?.toLowerCase().includes('descripción') || question.question?.toLowerCase().includes('explique')) {
      return (
        <Textarea
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          placeholder={question.placeholder || question.hint || 'Escriba su respuesta...'}
          className="bg-navy-light border-navy-light text-white placeholder:text-gray-500 min-h-[100px]"
        />
      );
    }
    
    // Handle date type
    if (question.type === 'date') {
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
        />
      );
    }
    
    // Handle email type
    if (question.type === 'email') {
      return (
        <Input
          type="email"
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          placeholder={question.placeholder || question.hint || 'correo@ejemplo.com'}
          className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
        />
      );
    }
    
    // Default: text input
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
        placeholder={question.placeholder || question.hint || 'Escriba su respuesta'}
        className="bg-navy-light border-navy-light text-white placeholder:text-gray-500"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gold-primary mx-auto mb-4" />
          <p className="text-gray-300">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <Card className="bg-navy-secondary border-navy-light max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">No se pudo cargar el formulario</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy-primary flex items-center justify-center p-4">
        <Card className="bg-navy-secondary border-navy-light max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">¡Formulario Enviado!</h2>
            <p className="text-gray-300 mb-4">
              Gracias por completar el formulario {formData.form_code}.
            </p>
            <p className="text-sm text-gray-400">
              Un coordinador revisará su información y se pondrá en contacto si necesita alguna aclaración.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-primary flex flex-col">
      {/* Top Header Bar with Logo */}
      <div className="bg-navy-secondary border-b border-navy-light sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png" 
                alt="URPE Logo" 
                className="h-10 w-auto"
              />
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Formulario de Inmigración</p>
              <p className="text-gold-primary font-medium">{formData.form_code || 'USCIS'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {/* Form Header Card */}
        <Card className="bg-navy-secondary border-navy-light mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-white text-2xl mb-1">
                  {formData.name || formData.form_code}
                </CardTitle>
                {formData.client_name && (
                  <CardDescription className="text-gray-400 text-base">
                    Preparado para: <span className="text-gold-primary">{formData.client_name}</span>
                  </CardDescription>
                )}
              </div>
              <div className="bg-gold-primary/10 border border-gold-primary/30 rounded-lg px-3 py-1.5">
                <span className="text-gold-primary text-sm font-medium">En Progreso</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Sección {currentSection + 1} de {sections.length}</span>
            <span>{Math.round(((currentSection + 1) / sections.length) * 100)}% completado</span>
          </div>
          <div className="w-full bg-navy-light rounded-full h-2">
            <div 
              className="bg-gold-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentSection + 1) / sections.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Section */}
        {currentSectionData && (
          <Card className="bg-navy-secondary border-navy-light">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                {currentSectionData.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {currentSectionData.questions.map((question, idx) => {
                  // Skip questions that shouldn't be shown based on conditional logic
                  if (!shouldShowQuestion(question)) return null;
                  
                  return (
                    <div key={question.id || idx} className="space-y-2">
                      <Label className="text-gray-300">
                        {question.question}
                        {question.required && <span className="text-red-400 ml-1">*</span>}
                      </Label>
                      {renderQuestion(question)}
                      {question.help && (
                        <p className="text-xs text-gray-500">{question.help}</p>
                      )}
                    </div>
                  );
                })}

                {/* Navigation */}
                <div className="flex justify-between pt-6 border-t border-navy-light">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrev}
                    disabled={currentSection === 0}
                    className="border-navy-light text-gray-300 hover:bg-navy-light"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>

                  {currentSection === sections.length - 1 ? (
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar Formulario
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Section Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {sections.map((section, idx) => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(idx)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                idx === currentSection
                  ? 'bg-gold-primary text-navy-primary'
                  : idx < currentSection
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-navy-light text-gray-400 hover:bg-navy-secondary'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-navy-secondary border-t border-navy-light mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} URPE Immigration Services. Todos los derechos reservados.</p>
            <p>Documento confidencial • No compartir sin autorización</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicFormFill;
