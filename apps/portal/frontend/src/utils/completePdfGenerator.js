import { jsPDF } from 'jspdf';

export const generateCompletePDF = (data, user) => {
  try {
    console.log('Starting complete PDF generation with enhanced design');
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;
    
    // Helper to add new page if needed
    const checkNewPage = (space = 20) => {
      if (y + space > pageHeight - margin - 15) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };
    
    // Helper to wrap text
    const addWrappedText = (text, maxWidth, fontSize = 10, lineHeight = 5) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text || '', maxWidth);
      lines.forEach(line => {
        checkNewPage(lineHeight + 2);
        doc.text(line, margin, y);
        y += lineHeight;
      });
    };
    
    // Helper to draw rounded rectangle
    const drawRoundedBox = (x, y, width, height, radius, fillColor, borderColor = null) => {
      if (fillColor) {
        doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        doc.roundedRect(x, y, width, height, radius, radius, 'F');
      }
      if (borderColor) {
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, width, height, radius, radius, 'S');
      }
    };
    
    // Helper for section header with gradient-like effect
    const addSectionHeader = (title, icon, color) => {
      checkNewPage(20);
      
      // Background box with shadow effect
      doc.setFillColor(240, 240, 240);
      drawRoundedBox(margin - 2, y - 2, contentWidth + 4, 14, 2, [250, 250, 250]);
      
      // Main header box
      drawRoundedBox(margin, y, contentWidth, 12, 2, color, [color[0] - 20, color[1] - 20, color[2] - 20]);
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${icon} ${title}`, margin + 4, y + 8);
      
      y += 16;
      doc.setTextColor(0, 0, 0);
    };
    
    // Helper for info box
    const addInfoBox = (content, bgColor, borderColor, icon = '') => {
      checkNewPage(15);
      
      const boxPadding = 3;
      const boxWidth = contentWidth;
      
      // Calculate height based on content
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(content, boxWidth - boxPadding * 2 - 5);
      const boxHeight = (lines.length * 5) + boxPadding * 2;
      
      checkNewPage(boxHeight + 5);
      
      // Draw box
      drawRoundedBox(margin, y, boxWidth, boxHeight, 2, bgColor, borderColor);
      
      // Add content
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      let textY = y + boxPadding + 4;
      lines.forEach(line => {
        doc.text((icon ? icon + ' ' : '') + line, margin + boxPadding + 2, textY);
        textY += 5;
        icon = ''; // Only show icon on first line
      });
      
      y += boxHeight + 4;
    };
    
    // === MODERN HEADER ===
    // Black background with yellow accent
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Yellow accent bar
    doc.setFillColor(255, 193, 7);
    doc.rect(0, 35, pageWidth, 3, 'F');
    
    // URPE Logo
    doc.setTextColor(255, 193, 7);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('URPE', margin, 23);
    
    // Tagline
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text('Integral Services', margin + 40, 23);
    
    // Subtitle
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text('EB-2 NIW Excellence', pageWidth - margin - 40, 23);
    
    y = 50;
    
    // === TITLE WITH DECORATIVE ELEMENT ===
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Elegibilidad', margin, y);
    y += 8;
    doc.setFontSize(20);
    doc.setTextColor(255, 193, 7);
    doc.text('EB-2 NIW', margin, y);
    
    // Decorative line
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(1);
    doc.line(margin, y + 2, margin + 35, y + 2);
    
    y += 12;
    doc.setTextColor(0, 0, 0);
    
    // === USER INFO CARD ===
    checkNewPage(30);
    
    // Info box background
    drawRoundedBox(margin, y, contentWidth, 25, 3, [250, 250, 250], [220, 220, 220]);
    
    let infoY = y + 6;
    
    // User name with icon
    if (data.nombreCompleto) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Para: ${data.nombreCompleto}`, margin + 4, infoY);
      infoY += 7;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    // Occupation
    if (data.ocupacion) {
      doc.text(`Ocupacion: ${data.ocupacion}`, margin + 4, infoY);
      infoY += 6;
    }
    
    // Date
    const fecha = data.fecha || new Date().toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Fecha: ${fecha}`, margin + 4, infoY);
    
    // Status badge on the right
    if (data.estadoElegibilidad) {
      const badgeColor = data.badgeColor || '#10b981';
      const rgb = hexToRgb(badgeColor);
      
      const badgeWidth = 45;
      const badgeX = pageWidth - margin - badgeWidth - 4;
      const badgeY = y + 8;
      
      drawRoundedBox(badgeX, badgeY, badgeWidth, 9, 2, [rgb.r, rgb.g, rgb.b]);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(data.estadoElegibilidad, badgeX + badgeWidth/2, badgeY + 6, { align: 'center' });
    }
    
    y += 30;
    doc.setTextColor(0, 0, 0);
    
    // === PROBABILITY OF SUCCESS SECTION ===
    if (data.probabilidadActual && data.probabilidadConServicios) {
      addSectionHeader('TU PROBABILIDAD DE EXITO', '', [255, 193, 7]);
      
      // Subtitle
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Analisis basado en ${data.casosAnalizados?.toLocaleString() || '1,500'} casos similares procesados`, margin, y);
      y += 8;
      
      // Three columns for probability display
      const colWidth = contentWidth / 3;
      
      // Current Probability (Orange)
      drawRoundedBox(margin, y, colWidth - 3, 25, 2, [255, 237, 213], [251, 146, 60]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12);
      doc.text('Actual', margin + colWidth/2 - 3, y + 6, { align: 'center' });
      doc.setFontSize(20);
      doc.text(`${data.probabilidadActual}%`, margin + colWidth/2 - 3, y + 17, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Sin servicios', margin + colWidth/2 - 3, y + 22, { align: 'center' });
      
      // Increment (Green gradient)
      const midCol = margin + colWidth;
      drawRoundedBox(midCol, y, colWidth - 3, 25, 2, [220, 252, 231], [34, 197, 94]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text('Incremento', midCol + colWidth/2 - 3, y + 6, { align: 'center' });
      doc.setFontSize(20);
      doc.text(`+${data.incremento}%`, midCol + colWidth/2 - 3, y + 17, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Con URPE', midCol + colWidth/2 - 3, y + 22, { align: 'center' });
      
      // With Services (Green)
      const rightCol = margin + colWidth * 2;
      drawRoundedBox(rightCol, y, colWidth, 25, 2, [220, 252, 231], [34, 197, 94]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text('Con Servicios', rightCol + colWidth/2, y + 6, { align: 'center' });
      doc.setFontSize(20);
      doc.text(`${data.probabilidadConServicios}%`, rightCol + colWidth/2, y + 17, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Muy Alto!', rightCol + colWidth/2, y + 22, { align: 'center' });
      
      y += 32;
      doc.setTextColor(0, 0, 0);
    }
    
    // === PROFILE ANALYSIS SECTION ===
    if (data.analisisPerfil || data.resumenPerfil) {
      addSectionHeader('ANALISIS DE TU PERFIL', '', [75, 85, 99]);
      
      // Summary
      const summary = data.analisisPerfil?.resumen || data.resumenPerfil;
      if (summary) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text('Resumen:', margin, y);
        y += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        addWrappedText(summary, contentWidth, 10, 5);
        y += 3;
      }
      
      // Two column layout for strengths and attention areas
      const colWidth = (contentWidth - 4) / 2;
      const startY = y;
      
      // Competitive Advantages (Left column)
      const ventajas = data.analisisPerfil?.ventajasCompetitivas || data.puntosFuertes;
      if (ventajas && ventajas.length > 0) {
        checkNewPage(35);
        const leftY = y;
        
        // Green box
        const boxHeight = Math.min(ventajas.length * 7 + 10, 60);
        drawRoundedBox(margin, leftY, colWidth, boxHeight, 2, [220, 252, 231], [34, 197, 94]);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(22, 163, 74);
        doc.text('+ Ventajas Competitivas', margin + 3, leftY + 6);
        
        let itemY = leftY + 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        
        ventajas.forEach((ventaja, idx) => {
          if (itemY + 6 > leftY + boxHeight - 2) return; // Don't overflow box
          const shortText = ventaja.length > 50 ? ventaja.substring(0, 47) + '...' : ventaja;
          doc.text(`• ${shortText}`, margin + 5, itemY);
          itemY += 6;
        });
      }
      
      // Requires Attention (Right column)
      const requiereAtencion = data.analisisPerfil?.requiereAtencion || data.areasAFortalecer;
      if (requiereAtencion && requiereAtencion.length > 0) {
        const rightY = startY;
        
        // Orange box
        const boxHeight = Math.min(requiereAtencion.length * 7 + 10, 60);
        const rightX = margin + colWidth + 4;
        drawRoundedBox(rightX, rightY, colWidth, boxHeight, 2, [254, 243, 199], [251, 146, 60]);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(249, 115, 22);
        doc.text('! Requiere Atencion', rightX + 3, rightY + 6);
        
        let itemY = rightY + 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        
        requiereAtencion.forEach((area, idx) => {
          if (itemY + 6 > rightY + boxHeight - 2) return; // Don't overflow box
          const shortText = area.length > 50 ? area.substring(0, 47) + '...' : area;
          doc.text(`• ${shortText}`, rightX + 5, itemY);
          itemY += 6;
        });
      }
      
      y += Math.max(
        ventajas && ventajas.length > 0 ? Math.min(ventajas.length * 7 + 10, 60) : 0,
        requiereAtencion && requiereAtencion.length > 0 ? Math.min(requiereAtencion.length * 7 + 10, 60) : 0
      ) + 6;
      
      doc.setTextColor(0, 0, 0);
    }
    
    // === CURRENT STRENGTHS ===
    if (data.fortalezasActuales && data.fortalezasActuales.length > 0) {
      const tieneForttalezas = data.fortalezasActuales.filter(f => f.tiene);
      if (tieneForttalezas.length > 0) {
        checkNewPage(30);
        
        doc.setFillColor(234, 179, 8);
        doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TUS FORTALEZAS', margin + 3, y + 7);
        y += 15;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        tieneForttalezas.forEach((fortaleza, idx) => {
          checkNewPage(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`${idx + 1}. ${fortaleza.nombre}`, margin, y);
          y += 6;
          
          if (fortaleza.descripcion) {
            doc.setFont('helvetica', 'normal');
            addWrappedText(fortaleza.descripcion, pageWidth - 2 * margin - 5, 9);
          }
          
          if (fortaleza.impacto) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.text(`Impacto: ${fortaleza.impacto}%`, margin + 5, y);
            y += 6;
          }
          y += 3;
        });
        y += 5;
      }
    }
    
    // === GROWTH OPPORTUNITIES ===
    // Note: The structure is oportunidadesCrecimiento[].servicios[] (not .items[])
    console.log('=== PDF GENERATION DEBUG ===');
    console.log('oportunidadesCrecimiento exists?', !!data.oportunidadesCrecimiento);
    console.log('Is array?', Array.isArray(data.oportunidadesCrecimiento));
    console.log('Length:', data.oportunidadesCrecimiento?.length);
    
    // Calculate total opportunities (servicios)
    const totalOportunidades = data.oportunidadesCrecimiento?.reduce((total, cat) => 
      total + (cat.servicios?.length || 0), 0
    );
    console.log('Total servicios/oportunidades:', totalOportunidades);
    
    if (data.oportunidadesCrecimiento && Array.isArray(data.oportunidadesCrecimiento) && totalOportunidades > 0) {
      console.log('>>> RENDERING OPORTUNIDADES section with', totalOportunidades, 'opportunities');
      addSectionHeader('OPORTUNIDADES DE CRECIMIENTO', '', [239, 68, 68]);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`${totalOportunidades} servicios recomendados para aumentar tu probabilidad de exito`, margin, y);
      y += 10;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Flatten all servicios from all categories and sort by impact
      const allServicios = data.oportunidadesCrecimiento.flatMap(cat => cat.servicios || []);
      
      // Sort by impact percentage (descending)
      allServicios.sort((a, b) => {
        const getNumericImpact = (str) => {
          const match = str?.match(/\d+/);
          return match ? parseInt(match[0]) : 0;
        };
        return getNumericImpact(b.impactoPorcentaje) - getNumericImpact(a.impactoPorcentaje);
      });
      
      // Render each servicio
      allServicios.forEach((servicio, idx) => {
        checkNewPage(18);
        
        // Determine priority color
        const priorityColor = 
          servicio.prioridad === 'Critica' ? [239, 68, 68] :
          servicio.prioridad === 'Alta' ? [249, 115, 22] :
          servicio.prioridad === 'Media' ? [234, 179, 8] : [107, 114, 128];
        
        // Item box
        const itemHeight = 15;
        drawRoundedBox(margin, y, contentWidth, itemHeight, 2, [240, 253, 244], [187, 247, 208]);
        
        // Number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(22, 163, 74);
        doc.text(`${idx + 1}.`, margin + 3, y + 5);
        
        // Service name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const nameMaxWidth = contentWidth - 35;
        const serviceName = servicio.nombre.length > 60 ? servicio.nombre.substring(0, 57) + '...' : servicio.nombre;
        doc.text(serviceName, margin + 10, y + 5);
        
        // Impact badge
        if (servicio.impactoPorcentaje) {
          const impactText = servicio.impactoPorcentaje;
          const impactWidth = doc.getTextWidth(impactText) + 4;
          const impactX = pageWidth - margin - impactWidth - 3;
          
          drawRoundedBox(impactX, y + 2, impactWidth, 5, 1, priorityColor);
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(impactText, impactX + 2, y + 5);
        }
        
        // Description
        if (servicio.descripcion) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          const shortDesc = servicio.descripcion.length > 110 ? servicio.descripcion.substring(0, 107) + '...' : servicio.descripcion;
          const descLines = doc.splitTextToSize(shortDesc, contentWidth - 10);
          let descY = y + 10;
          descLines.slice(0, 2).forEach(line => { // Max 2 lines
            doc.text(line, margin + 10, descY);
            descY += 3.5;
          });
        }
        
        y += itemHeight + 3;
      });
      
      y += 5;
    } else {
      console.log('>>> NO OPORTUNIDADES to render');
    }
    
    // === URPE SERVICES SECTION ===
    addSectionHeader('SERVICIOS DE URPE', '', [147, 51, 234]);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Nuestro equipo de expertos te acompanara en cada etapa de tu proceso EB-2 NIW', margin, y);
    y += 10;
    
    const services = [
      {
        title: 'Analisis de Elegibilidad',
        description: 'Evaluacion completa de tu perfil y probabilidad de exito',
        icon: '1.'
      },
      {
        title: 'Preparacion de Documentacion',
        description: 'Compilacion y revision de todos los documentos necesarios',
        icon: '2.'
      },
      {
        title: 'Redaccion de Peticion',
        description: 'Elaboracion profesional del formulario I-140 y carta de soporte',
        icon: '3.'
      },
      {
        title: 'Cartas de Recomendacion',
        description: 'Estrategia y redaccion de cartas de expertos independientes',
        icon: '4.'
      },
      {
        title: 'Revision Legal',
        description: 'Verificacion por abogados especializados en inmigracion',
        icon: '5.'
      },
      {
        title: 'Soporte Post-Presentacion',
        description: 'Seguimiento y respuesta a cualquier RFE (Request for Evidence)',
        icon: '6.'
      }
    ];
    
    const serviceColWidth = (contentWidth - 4) / 2;
    let serviceRow = 0;
    
    services.forEach((service, idx) => {
      const isLeft = idx % 2 === 0;
      const boxX = isLeft ? margin : margin + serviceColWidth + 4;
      const boxY = y;
      
      if (!isLeft && serviceRow > 0) {
        // Don't draw right column if we just started a new row
      } else if (!isLeft) {
        // Right column, same Y
      } else {
        // Left column, check for new page
        checkNewPage(22);
      }
      
      // Service box
      drawRoundedBox(boxX, boxY, serviceColWidth, 18, 2, [245, 243, 255], [167, 139, 250]);
      
      // Icon and title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(109, 40, 217);
      doc.text(`${service.icon} ${service.title}`, boxX + 3, boxY + 6);
      
      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(service.description, serviceColWidth - 8);
      let lineY = boxY + 11;
      lines.forEach(line => {
        doc.text(line, boxX + 3, lineY);
        lineY += 4;
      });
      
      if (!isLeft) {
        y += 20;
        serviceRow++;
      }
    });
    
    // Add final row spacing if odd number of services
    if (services.length % 2 !== 0) {
      y += 20;
    }
    
    y += 5;
    doc.setTextColor(0, 0, 0);
    
    // === PERSONALIZED RECOMMENDATIONS ===
    if (data.recomendacionesPersonalizadas && data.recomendacionesPersonalizadas.length > 0) {
      checkNewPage(30);
      
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RECOMENDACIONES PERSONALIZADAS', margin + 3, y + 7);
      y += 15;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      data.recomendacionesPersonalizadas.forEach((rec, idx) => {
        checkNewPage(15);
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}. ${rec.titulo}`, margin, y);
        y += 7;
        
        doc.setFont('helvetica', 'normal');
        if (rec.descripcion) {
          addWrappedText(rec.descripcion, pageWidth - 2 * margin - 5, 10);
        }
        
        if (rec.razon) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.text('Por que es importante:', margin + 5, y);
          y += 5;
          addWrappedText(rec.razon, pageWidth - 2 * margin - 10, 9);
          doc.setFontSize(10);
        }
        
        if (rec.prioridad) {
          doc.setFont('helvetica', 'bold');
          doc.text(`Prioridad: ${rec.prioridad}`, margin + 5, y);
          y += 6;
        }
        y += 5;
      });
      y += 5;
    }
    
    // === STRATEGIC RECOMMENDATIONS (from report) ===
    if (data.recomendaciones && data.recomendaciones.length > 0) {
      checkNewPage(30);
      
      doc.setFillColor(245, 158, 11);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RECOMENDACIONES ESTRATEGICAS', margin + 3, y + 7);
      y += 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      data.recomendaciones.forEach((rec, idx) => {
        checkNewPage(10);
        const lines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 2 * margin - 5);
        lines.forEach(line => {
          checkNewPage(6);
          doc.text(line, margin, y);
          y += 6;
        });
        y += 3;
      });
      y += 5;
    }
    
    // === PROJECT SECTIONS (National Interest, Patent, Book, App) ===
    if (data.proyectoTitulo) {
      checkNewPage(30);
      
      doc.setFillColor(245, 158, 11);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PROYECTO DE INTERES NACIONAL', margin + 3, y + 7);
      y += 14;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      addWrappedText(data.proyectoTitulo, pageWidth - 2 * margin - 6, 11);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(data.proyectoDescripcion, pageWidth - 2 * margin - 6, 10);
      
      if (data.proyectoImpacto) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Impacto Esperado:', margin + 3, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        addWrappedText(data.proyectoImpacto, pageWidth - 2 * margin - 6, 10);
      }
      y += 8;
    }
    
    if (data.patenteTitulo) {
      checkNewPage(30);
      
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PATENTE PROPUESTA', margin + 3, y + 7);
      y += 14;
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      addWrappedText(data.patenteTitulo, pageWidth - 2 * margin - 6, 11);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(data.patenteDescripcion, pageWidth - 2 * margin - 6, 10);
      y += 8;
    }
    
    if (data.libroTitulo) {
      checkNewPage(30);
      
      doc.setFillColor(139, 92, 246);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('LIBRO ESTRATEGICO', margin + 3, y + 7);
      y += 14;
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      addWrappedText(data.libroTitulo, pageWidth - 2 * margin - 6, 11);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(data.libroDescripcion, pageWidth - 2 * margin - 6, 10);
      
      if (data.libroCapitulos && data.libroCapitulos.length > 0) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Capitulos:', margin + 3, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        data.libroCapitulos.forEach((cap, idx) => {
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
    
    if (data.appNombre) {
      checkNewPage(30);
      
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('APLICACION MOVIL', margin + 3, y + 7);
      y += 14;
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${data.appNombre} - ${data.appPlataformas || 'Multiplataforma'}`, margin + 3, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      addWrappedText(data.appDescripcion, pageWidth - 2 * margin - 6, 10);
      
      if (data.appCaracteristicas && data.appCaracteristicas.length > 0) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Caracteristicas:', margin + 3, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        data.appCaracteristicas.forEach(feat => {
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
    
    // === NEXT STEPS ===
    if (data.proximosPasos && data.proximosPasos.length > 0) {
      checkNewPage(30);
      
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PROXIMOS PASOS', margin + 3, y + 7);
      y += 15;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      data.proximosPasos.forEach((paso, idx) => {
        checkNewPage(10);
        const lines = doc.splitTextToSize(`${idx + 1}. ${paso}`, pageWidth - 2 * margin - 5);
        lines.forEach(line => {
          checkNewPage(6);
          doc.text(line, margin, y);
          y += 6;
        });
        y += 3;
      });
    }
    
    // === MODERN FOOTER ON ALL PAGES ===
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
      
      // Footer content
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      
      // Left: Company name
      doc.text('URPE Integral Services', margin, pageHeight - 12);
      
      // Center: Date
      doc.text(
        new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }),
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
      
      // Right: Page number
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${i} / ${pageCount}`,
        pageWidth - margin,
        pageHeight - 12,
        { align: 'right' }
      );
      
      // Confidential notice
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text(
        'Documento confidencial - Solo para uso del solicitante',
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }
    
    // === SAVE PDF ===
    const userName = (data.nombreCompleto || user?.name || 'Cliente').replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `URPE_Reporte_Elegibilidad_${userName}_${dateStr}.pdf`;
    doc.save(fileName);
    
    console.log('Enhanced PDF saved successfully!');
    
    return {
      success: true,
      message: '✅ Reporte completo descargado exitosamente'
    };
    
  } catch (error) {
    console.error('Error in complete PDF generation:', error);
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
