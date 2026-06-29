import fs from 'fs';

const ideasCtrl = fs.readFileSync('./controllers/ideasController.js', 'utf-8');

// Replace variations of 'idea'
let suggestionsCtrl = ideasCtrl
  .replace(/idea/g, 'suggestion')
  .replace(/Idea/g, 'Suggestion')
  .replace(/IDEA/g, 'SUGGESTION');

fs.writeFileSync('./controllers/suggestionsController.js', suggestionsCtrl);

const ideasRoute = fs.readFileSync('./routes/ideasRoutes.js', 'utf-8');

let suggestionsRoute = ideasRoute
  .replace(/idea/g, 'suggestion')
  .replace(/Idea/g, 'Suggestion')
  .replace(/IDEA/g, 'SUGGESTION');

fs.writeFileSync('./routes/suggestionsRoutes.js', suggestionsRoute);

console.log('Controllers and routes duplicated successfully.');
