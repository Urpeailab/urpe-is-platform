import { jsPDF } from 'jspdf';

export const generateSimpleN8nPDF = (report, user) => {
  try {
    console.log('Starting simple PDF generation');
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;
    
    // Helper to add new page if needed
    const checkNewPage = (space = 20) => {
      if (y + space > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };
    
    // Helper to wrap text
    const addWrappedText = (text, maxWidth, fontSize = 10) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach(line => {
        checkNewPage(7);
        doc.text(line, margin, y);
        y += 6;
      });
    };
    
    console.log('Adding header...');
    
    // Header with black background
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 193, 7);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('URPE', margin, 20);
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Integral Services', margin + 35, 20);
    
    y = 45;
    
    console.log('Adding title...');
    
    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Elegibilidad EB-2 NIW', margin, y);
    y += 15;
    
    // User info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    if (report.nombreCompleto) {
      doc.text(`Para: ${report.nombreCompleto}`, margin, y);
      y += 8;
    }
    
    doc.setFontSize(11);
    if (report.ocupacion) {
      doc.text(`Ocupación: ${report.ocupacion}`, margin, y);
      y += 7;
    }
    
    if (report.fecha) {
      doc.text(`Fecha: ${report.fecha}`, margin, y);
      y += 7;
    }
    
    // Status badge
    if (report.estadoElegibilidad) {
      const badgeColor = report.badgeColor || '#f59e0b';
      const rgb = hexToRgb(badgeColor);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(margin, y, 70, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(report.estadoElegibilidad, margin + 5, y + 7);
      y += 18;
    }
    
    doc.setTextColor(0, 0, 0);
    
    console.log('Adding sections...');
    
    // Function to add section
    const addSection = (title, content, color = [245, 158, 11]) => {
      checkNewPage(30);
      
      // Section header
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 3, y + 7);
      y += 14;
      
      // Content
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (typeof content === 'string') {
        addWrappedText(content, pageWidth - 2 * margin - 6, 10);
      } else if (Array.isArray(content)) {
        content.forEach((item, index) => {
          checkNewPage(10);
          const bullet = `${index + 1}. `;
          const lines = doc.splitTextToSize(item, pageWidth - 2 * margin - 15);
          doc.text(bullet, margin + 3, y);
          
          lines.forEach((line, lineIndex) => {
            if (lineIndex > 0) checkNewPage(6);
            doc.text(line, margin + 10, y);
            y += 6;
          });
        });
      }
      
      y += 8;
    };
    
    // Add all sections
    if (report.proyectoTitulo) {
      addSection('PROYECTO DE INTERÉS NACIONAL', null);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      addWrappedText(report.proyectoTitulo, pageWidth - 2 * margin - 6, 11);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(report.proyectoDescripcion, pageWidth - 2 * margin - 6, 10);
      
      if (report.proyectoImpacto) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Impacto Esperado:', margin + 3, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        addWrappedText(report.proyectoImpacto, pageWidth - 2 * margin - 6, 10);
      }
      y += 8;
    }
    
    if (report.patenteTitulo) {
      addSection('PATENTE PROPUESTA', null, [59, 130, 246]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      addWrappedText(report.patenteTitulo, pageWidth - 2 * margin - 6, 11);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(report.patenteDescripcion, pageWidth - 2 * margin - 6, 10);
      y += 8;
    }
    
    if (report.libroTitulo) {
      addSection('LIBRO ESTRATÉGICO', null, [139, 92, 246]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      addWrappedText(report.libroTitulo, pageWidth - 2 * margin - 6, 11);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(report.libroDescripcion, pageWidth - 2 * margin - 6, 10);
      
      if (report.libroCapitulos && report.libroCapitulos.length > 0) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Capítulos:', margin + 3, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        report.libroCapitulos.forEach((cap, idx) => {
          checkNewPage(8);
          const lines = doc.splitTextToSize(`${idx + 1}. ${cap}`, pageWidth - 2 * margin - 10);
          lines.forEach(line => {
            checkNewPage(6);
            doc.text(line, margin + 6, y);
            y += 6;
          });
        });
      }
      y += 8;
    }
    
    if (report.appNombre) {
      addSection('APLICACIÓN MÓVIL', null, [16, 185, 129]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${report.appNombre} - ${report.appPlataformas || 'Multiplataforma'}`, margin + 3, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(report.appDescripcion, pageWidth - 2 * margin - 6, 10);
      
      if (report.appCaracteristicas && report.appCaracteristicas.length > 0) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Características:', margin + 3, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        report.appCaracteristicas.forEach(feat => {
          checkNewPage(8);
          const lines = doc.splitTextToSize(`• ${feat}`, pageWidth - 2 * margin - 10);
          lines.forEach(line => {
            checkNewPage(6);
            doc.text(line, margin + 6, y);
            y += 6;
          });
        });
      }
      y += 8;
    }
    
    if (report.puntosFuertes && report.puntosFuertes.length > 0) {
      addSection('PUNTOS FUERTES', report.puntosFuertes, [16, 185, 129]);
    }
    
    if (report.areasAFortalecer && report.areasAFortalecer.length > 0) {
      addSection('ÁREAS A FORTALECER', report.areasAFortalecer, [249, 115, 22]);
    }
    
    if (report.recomendaciones && report.recomendaciones.length > 0) {
      addSection('RECOMENDACIONES ESTRATÉGICAS', report.recomendaciones);
    }
    
    if (report.proximosPasos && report.proximosPasos.length > 0) {
      addSection('PRÓXIMOS PASOS', report.proximosPasos, [59, 130, 246]);
    }
    
    console.log('Adding footer...');
    
    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${pageCount} | URPE Integral Services | ${new Date().toLocaleDateString('es-ES')}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
    
    console.log('Saving PDF...');
    
    // Save
    const fileName = `Reporte_Elegibilidad_${report.nombreCompleto?.replace(/\s+/g, '_') || 'Cliente'}_${Date.now()}.pdf`;
    doc.save(fileName);
    
    console.log('PDF saved successfully!');
    
    return {
      success: true,
      message: 'Reporte descargado exitosamente'
    };
    
  } catch (error) {
    console.error('Error in simple PDF generation:', error);
    console.error('Stack:', error.stack);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
};

// Helper function
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 245, g: 158, b: 11 };
};
