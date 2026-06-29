const fs = require('fs');
let c = fs.readFileSync('controllers/ideasController.js', 'utf8');
c = c.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('controllers/ideasController.js', c);
console.log('Fixed ideasController.js');
