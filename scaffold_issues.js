import fs from 'fs';
import path from 'path';

const basePath = process.cwd();

const replacements = [
    { from: /complainant_name/g, to: 'submitter_name' },
    { from: /complainant_type/g, to: 'submitter_type' }, // if it exists
    { from: /complaints/g, to: 'issues' },
    { from: /complaint/g, to: 'issue' },
    { from: /Complaints/g, to: 'Issues' },
    { from: /Complaint/g, to: 'Issue' },
    { from: /COMP-/g, to: 'ISSUE-' },
    { from: /COMPLAINT/g, to: 'ISSUE' }
];

function convertFile(src, dest) {
    const srcPath = path.join(basePath, src);
    const destPath = path.join(basePath, dest);
    
    let content = fs.readFileSync(srcPath, 'utf8');
    
    for (const {from, to} of replacements) {
        content = content.replace(from, to);
    }
    
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`Converted ${src} -> ${dest}`);
}

convertFile('controllers/complaintsController.js', 'controllers/issuesController.js');
convertFile('routes/complaintsRoutes.js', 'routes/issuesRoutes.js');
