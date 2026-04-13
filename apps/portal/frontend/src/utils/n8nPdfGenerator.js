import { jsPDF } from 'jspdf';

/**
 * Generate a professional PDF report from N8N eligibility data
 * @param {Object} report - The N8N report data
 * @param {Object} user - User information
 * @returns {Object} - Success status and message
 */
export const generateN8nReportPDF = async (report, user) => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let yPosition = margin;

    // Helper function to add a new page if needed
    const checkPageBreak = (neededSpace = 20) => {
      if (yPosition + neededSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to wrap text
    const wrapText = (text, maxWidth) => {
      return pdf.splitTextToSize(text, maxWidth);
    };

    // Helper function to add section with background
    const addSection = (title, content, color = '#f59e0b') => {
      checkPageBreak(40);
      
      // Section header with colored background
      pdf.setFillColor(color);
      pdf.rect(margin, yPosition, contentWidth, 10, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin + 3, yPosition + 7);
      yPosition += 12;
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      // Add content
      if (typeof content === 'string') {
        const lines = wrapText(content, contentWidth - 6);
        lines.forEach(line => {
          checkPageBreak(7);
          pdf.text(line, margin + 3, yPosition);
          yPosition += 5;
        });
      } else if (Array.isArray(content)) {
        content.forEach((item, index) => {
          checkPageBreak(10);
          const bullet = `${index + 1}. `;
          const text = wrapText(item, contentWidth - 10);
          pdf.text(bullet, margin + 3, yPosition);
          pdf.text(text[0], margin + 10, yPosition);
          yPosition += 5;
          
          // Handle wrapped lines
          for (let i = 1; i < text.length; i++) {
            checkPageBreak(5);
            pdf.text(text[i], margin + 10, yPosition);
            yPosition += 5;
          }
        });
      }
      
      yPosition += 5;
    };

    // ========== PAGE 1: HEADER AND GENERAL INFO ==========
    
    // URPE Logo/Header
    pdf.setFillColor(0, 0, 0);
    pdf.rect(0, 0, pageWidth, 25, 'F');
    pdf.setTextColor(255, 193, 7);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('URPE', margin, 17);
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Integral Services', margin + 30, 17);
    yPosition = 35;

    // Document Title
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Reporte de Elegibilidad EB-2 NIW', margin, yPosition);
    yPosition += 10;

    // User Info
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Para: ${report.nombreCompleto || 'Cliente'}`, margin, yPosition);
    yPosition += 7;
    pdf.setFontSize(10);
    pdf.text(`Ocupación: ${report.ocupacion || 'N/A'}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Fecha: ${report.fecha || new Date().toLocaleDateString('es-ES')}`, margin, yPosition);
    yPosition += 10;

    // Status Badge
    const badgeColor = report.badgeColor || '#f59e0b';
    const rgb = hexToRgb(badgeColor);
    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    pdf.rect(margin, yPosition, 60, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(report.estadoElegibilidad || 'En Evaluación', margin + 5, yPosition + 7);
    yPosition += 20;

    // ========== PROYECTO NIW ==========
    if (report.proyectoTitulo) {
      addSection(
        '🎯 PROYECTO DE INTERÉS NACIONAL',
        null,
        '#f59e0b'
      );
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const titleLines = wrapText(report.proyectoTitulo, contentWidth - 6);
      titleLines.forEach(line => {
        checkPageBreak(7);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 6;
      });
      yPosition += 3;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const descLines = wrapText(report.proyectoDescripcion, contentWidth - 6);
      descLines.forEach(line => {
        checkPageBreak(5);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 5;
      });
      
      if (report.proyectoImpacto) {
        yPosition += 5;
        checkPageBreak(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Impacto Esperado:', margin + 3, yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        const impactLines = wrapText(report.proyectoImpacto, contentWidth - 6);
        impactLines.forEach(line => {
          checkPageBreak(5);
          pdf.text(line, margin + 3, yPosition);
          yPosition += 5;
        });
      }
      
      yPosition += 8;
    }

    // ========== PATENTE ==========
    if (report.patenteTitulo) {
      addSection(
        '🏆 PATENTE PROPUESTA',
        null,
        '#3b82f6'
      );
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const titleLines = wrapText(report.patenteTitulo, contentWidth - 6);
      titleLines.forEach(line => {
        checkPageBreak(7);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 6;
      });
      yPosition += 3;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const descLines = wrapText(report.patenteDescripcion, contentWidth - 6);
      descLines.forEach(line => {
        checkPageBreak(5);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 5;
      });
      
      if (report.patenteEnfoque) {
        yPosition += 5;
        checkPageBreak(8);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`Enfoque USPTO: ${report.patenteEnfoque}`, margin + 3, yPosition);
        yPosition += 5;
      }
      
      yPosition += 8;
    }

    // ========== LIBRO ==========
    if (report.libroTitulo) {
      addSection(
        '📚 LIBRO ESTRATÉGICO',
        null,
        '#8b5cf6'
      );
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const titleLines = wrapText(report.libroTitulo, contentWidth - 6);
      titleLines.forEach(line => {
        checkPageBreak(7);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 6;
      });
      yPosition += 3;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const descLines = wrapText(report.libroDescripcion, contentWidth - 6);
      descLines.forEach(line => {
        checkPageBreak(5);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 5;
      });
      
      if (report.libroCapitulos && report.libroCapitulos.length > 0) {
        yPosition += 5;
        checkPageBreak(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Estructura del Libro:', margin + 3, yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        
        report.libroCapitulos.forEach((chapter, index) => {
          checkPageBreak(7);
          const lines = wrapText(`${index + 1}. ${chapter}`, contentWidth - 10);
          lines.forEach(line => {
            checkPageBreak(5);
            pdf.text(line, margin + 6, yPosition);
            yPosition += 5;
          });
        });
      }
      
      yPosition += 8;
    }

    // ========== APP ==========
    if (report.appNombre) {
      addSection(
        '📱 APLICACIÓN MÓVIL',
        null,
        '#10b981'
      );
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${report.appNombre} - ${report.appPlataformas || 'Multiplataforma'}`, margin + 3, yPosition);
      yPosition += 7;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const descLines = wrapText(report.appDescripcion, contentWidth - 6);
      descLines.forEach(line => {
        checkPageBreak(5);
        pdf.text(line, margin + 3, yPosition);
        yPosition += 5;
      });
      
      if (report.appCaracteristicas && report.appCaracteristicas.length > 0) {
        yPosition += 5;
        checkPageBreak(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Características Clave:', margin + 3, yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        
        report.appCaracteristicas.forEach((feature, index) => {
          checkPageBreak(7);
          const lines = wrapText(`• ${feature}`, contentWidth - 10);
          lines.forEach(line => {
            checkPageBreak(5);
            pdf.text(line, margin + 6, yPosition);
            yPosition += 5;
          });
        });
      }
      
      yPosition += 8;
    }

    // ========== PUNTOS FUERTES ==========
    if (report.puntosFuertes && report.puntosFuertes.length > 0) {
      addSection(
        '✅ PUNTOS FUERTES',
        report.puntosFuertes,
        '#10b981'
      );
    }

    // ========== ÁREAS A FORTALECER ==========
    if (report.areasAFortalecer && report.areasAFortalecer.length > 0) {
      addSection(
        '⚠️ ÁREAS A FORTALECER',
        report.areasAFortalecer,
        '#f97316'
      );
    }

    // ========== RECOMENDACIONES ==========
    if (report.recomendaciones && report.recomendaciones.length > 0) {
      addSection(
        '💡 RECOMENDACIONES ESTRATÉGICAS',
        report.recomendaciones,
        '#f59e0b'
      );
    }

    // ========== PRÓXIMOS PASOS ==========
    if (report.proximosPasos && report.proximosPasos.length > 0) {
      addSection(
        '➡️ PRÓXIMOS PASOS',
        report.proximosPasos,
        '#3b82f6'
      );
    }

    // ========== FOOTER ==========
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Página ${i} de ${pageCount} | URPE Integral Services | Reporte generado el ${new Date().toLocaleDateString('es-ES')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = `Reporte_Elegibilidad_${report.nombreCompleto?.replace(/\s+/g, '_') || 'Cliente'}_${Date.now()}.pdf`;
    
    console.log('Attempting to save PDF with filename:', fileName);
    console.log('PDF pages:', pdf.internal.getNumberOfPages());
    
    try {
      pdf.save(fileName);
      console.log('PDF save command executed successfully');
    } catch (saveError) {
      console.error('Error in pdf.save():', saveError);
      throw saveError;
    }

    return {
      success: true,
      message: 'Reporte descargado exitosamente'
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: `Error al generar el PDF: ${error.message}`
    };
  }
};

// Helper function to convert hex color to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 245, g: 158, b: 11 };
};
