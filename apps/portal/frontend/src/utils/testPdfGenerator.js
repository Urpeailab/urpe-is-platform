import { jsPDF } from 'jspdf';

export const testSimplePDF = () => {
  try {
    console.log('Creating test PDF...');
    const doc = new jsPDF();
    
    console.log('Adding text...');
    doc.text('Hello world!', 10, 10);
    
    console.log('Saving PDF...');
    doc.save('test.pdf');
    
    console.log('PDF saved successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error in test PDF:', error);
    return { success: false, error: error.message };
  }
};
