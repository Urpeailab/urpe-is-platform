import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  FileText, 
  Loader2, 
  X,
  Printer,
  Download
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FormSummaryModal = ({ isOpen, onClose, submissionId }) => {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  
  const token = localStorage.getItem('admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen && submissionId) {
      fetchSummary();
    }
  }, [isOpen, submissionId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/uscis-forms/client-submissions/${submissionId}/html-summary`,
        { headers }
      );
      setSummaryData(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast.error('Error al cargar el resumen');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text, questionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => ({ ...prev, [questionId]: true }));
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [questionId]: false }));
      }, 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedItems(prev => ({ ...prev, [questionId]: true }));
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [questionId]: false }));
      }, 2000);
    }
  };

  const handleCopyAll = async () => {
    if (!summaryData) return;
    
    let fullText = `${summaryData.template_name}\nCliente: ${summaryData.client_name}\n\n`;
    
    summaryData.sections.forEach(section => {
      fullText += `=== ${section.name} ===\n`;
      section.questions.forEach(q => {
        fullText += `${q.question}: ${q.answer}\n`;
      });
      fullText += '\n';
    });
    
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success('Todas las respuestas copiadas');
    } catch (error) {
      toast.error('Error al copiar');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !summaryData) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${summaryData.template_name} - ${summaryData.client_name}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #1a1a2e;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #d4a373;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #1a1a2e;
            margin: 0;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            background: #1a1a2e;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 15px;
          }
          .question-row {
            display: flex;
            border-bottom: 1px solid #eee;
            padding: 10px 0;
          }
          .question-label {
            flex: 1;
            color: #666;
            font-size: 14px;
          }
          .question-answer {
            flex: 1;
            font-weight: 500;
            color: #1a1a2e;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${summaryData.template_name}</h1>
          <p><strong>Cliente:</strong> ${summaryData.client_name}</p>
          ${summaryData.client_email ? `<p><strong>Email:</strong> ${summaryData.client_email}</p>` : ''}
          <p><strong>Total de respuestas:</strong> ${summaryData.total_answers}</p>
        </div>
        
        ${summaryData.sections.map(section => `
          <div class="section">
            <div class="section-title">${section.name}</div>
            ${section.questions.map(q => `
              <div class="question-row">
                <div class="question-label">${q.question}</div>
                <div class="question-answer">${q.answer}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
        
        <div class="footer">
          <p>Generado por URPE Immigration Services</p>
          <p>Este documento es solo para referencia. Complete el formulario oficial en el sitio web correspondiente.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-navy-secondary border-navy-light max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-navy-light pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-primary/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-gold-primary" />
              </div>
              <div>
                <DialogTitle className="text-white text-xl">
                  Resumen de Respuestas
                </DialogTitle>
                {summaryData && (
                  <p className="text-gray-400 text-sm mt-1">
                    {summaryData.template_name} • {summaryData.client_name}
                  </p>
                )}
              </div>
            </div>
            {summaryData && (
              <Badge className="bg-gold-primary/20 text-gold-primary">
                {summaryData.total_answers} respuestas
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold-primary" />
          </div>
        ) : summaryData ? (
          <>
            {/* Action buttons */}
            <div className="flex gap-3 py-3 border-b border-navy-light">
              <Button
                onClick={handleCopyAll}
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Todo
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="border-green-500 text-green-400 hover:bg-green-500/20"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>

            {/* Info banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 my-3">
              <p className="text-blue-300 text-sm">
                💡 <strong>Tip:</strong> Haz clic en el botón de copiar junto a cada respuesta para copiarla al portapapeles. 
                Luego pégala en el formulario oficial.
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {summaryData.sections.map((section, sIdx) => (
                <div key={sIdx} className="bg-navy-light/50 rounded-lg overflow-hidden">
                  <div className="bg-navy-light px-4 py-3 border-b border-navy-light">
                    <h3 className="text-white font-medium">{section.name}</h3>
                    <p className="text-gray-500 text-xs mt-1">{section.questions.length} respuestas</p>
                  </div>
                  <div className="divide-y divide-navy-light/50">
                    {section.questions.map((q, qIdx) => (
                      <div 
                        key={q.id || qIdx} 
                        className="flex items-start gap-4 p-4 hover:bg-navy-light/30 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-400 text-sm mb-1">{q.question}</p>
                          <p className="text-white font-medium break-words">{q.answer}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(q.answer, q.id || `${sIdx}-${qIdx}`)}
                          className={`shrink-0 transition-all ${
                            copiedItems[q.id || `${sIdx}-${qIdx}`]
                              ? 'bg-green-500/20 text-green-400'
                              : 'text-gray-400 hover:text-white hover:bg-navy-light opacity-0 group-hover:opacity-100'
                          }`}
                          data-testid={`copy-answer-${sIdx}-${qIdx}`}
                        >
                          {copiedItems[q.id || `${sIdx}-${qIdx}`] ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-gray-400">No se encontraron datos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FormSummaryModal;
