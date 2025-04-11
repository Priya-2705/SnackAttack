import PDFDocument from 'pdfkit';

export const generateRecipePDF = (recipe) => {
  const doc = new PDFDocument();
  
  // Header
  doc.fontSize(20).text(recipe.title, { align: 'center' });
  doc.moveDown();

  // Ingredients
  doc.fontSize(16).text('Ingredients:');
  recipe.ingredients.forEach(ingredient => {
    doc.fontSize(12).text(`• ${ingredient}`);
  });
  doc.moveDown();

  // Directions
  doc.fontSize(16).text('Directions:');
  recipe.directions.forEach((step, index) => {
    doc.fontSize(12).text(`${index + 1}. ${step}`);
  });
  doc.moveDown();

  // Nutrition
  doc.fontSize(16).text('Nutritional Information:');
  doc.fontSize(12).text(`Calories: ${recipe.nutritionalInfo?.calories || 'N/A'}`);
  doc.text(`Protein: ${recipe.nutritionalInfo?.protein || 'N/A'}g`);
  doc.text(`Carbs: ${recipe.nutritionalInfo?.carbs || 'N/A'}g`);
  doc.text(`Fat: ${recipe.nutritionalInfo?.fat || 'N/A'}g`);

  return doc;
};