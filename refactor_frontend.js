import fs from 'fs';
import path from 'path';

const basePath = path.join(process.cwd(), '../Portfolio_challange_frontend_B12_Team_A/src/mlaconnect/pages/issues');
const files = ['NewIssuePage.jsx', 'IssuesPage.jsx', 'IssueDetailPage.jsx'];

const replacements = [
    { from: /complaintsApi/g, to: 'issuesApi' },
    { from: /api\/complaints/g, to: 'api/issues' },
    { from: /complainant_name/g, to: 'submitter_name' },
    { from: /complainant/g, to: 'submitter' },
    { from: /complaint/g, to: 'issue' },
    { from: /Complaint/g, to: 'Issue' },
    { from: /COMPLAINT/g, to: 'ISSUE' }
];

for (const file of files) {
    const filePath = path.join(basePath, file);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    for (const {from, to} of replacements) {
        content = content.replace(from, to);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored ${file}`);
}
