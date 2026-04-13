import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateReportPDF = async (userName, profession) => {
  try {
    // Get the report content
    const reportElement = document.getElementById('eligibility-report-content');
    
    if (!reportElement) {
      throw new Error('Report content not found');
    }

    // Show loading indicator
    const originalContent = reportElement.style.display;
    
    // Create canvas from HTML
    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#000000',
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Generate filename
    const fileName = `URPE_Eligibility_Report_${userName.replace(/\s+/g, '_')}_${profession.replace(/\s+/g, '_')}.pdf`;
    
    // Save PDF
    pdf.save(fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return { success: false, error: error.message };
  }
};
