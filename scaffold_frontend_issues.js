import fs from 'fs';
import path from 'path';

const basePath = path.join(process.cwd(), '../Portfolio_challange_frontend_B12_Team_A');

const replacements = [
    { from: /complainant_name/g, to: 'submitter_name' },
    { from: /complainant_type/g, to: 'submitter_type' },
    { from: /complaints/g, to: 'issues' },
    { from: /complaint/g, to: 'issue' },
    { from: /Complaints/g, to: 'Issues' },
    { from: /Complaint/g, to: 'Issue' },
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

convertFile('src/api/complaints.js', 'src/api/issues.js');
