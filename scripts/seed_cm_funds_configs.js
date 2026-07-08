import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mla_admin'
};

const DEFAULT_DOCUMENTS = [
  { id: 'DOC001', name: 'Aadhaar Card', description: 'Copy of applicant Aadhaar card', status: 'Active' },
  { id: 'DOC002', name: 'Ration Card', description: 'Copy of Ration Card (BPL/APL)', status: 'Active' },
  { id: 'DOC003', name: 'Income Certificate', description: 'Recent income certificate from Village Office', status: 'Active' },
  { id: 'DOC004', name: 'Medical Certificate', description: 'Doctor certified medical condition and estimate', status: 'Active' },
  { id: 'DOC005', name: 'Bank Passbook', description: 'First page of bank passbook showing account details', status: 'Active' },
  { id: 'DOC006', name: 'FIR Copy', description: 'Copy of Police FIR for accidents/calamity', status: 'Active' },
  { id: 'DOC007', name: 'Death Certificate', description: 'In case of claim by dependents', status: 'Active' },
  { id: 'DOC008', name: 'MLA Recommendation', description: 'Recommendation letter from MLA', status: 'Active' }
];

const DEFAULT_CATEGORIES = [
  'Cancer Treatment',
  'Kidney/Dialysis Treatment',
  'Heart Surgery',
  'Accident Relief',
  'Natural Calamity',
  'Debt Relief'
];

const DEFAULT_CATEGORY_CONFIG = {
  'Cancer Treatment': { 'DOC001': 'Mandatory', 'DOC002': 'Mandatory', 'DOC004': 'Mandatory', 'DOC005': 'Mandatory', 'DOC008': 'Optional' },
  'Kidney/Dialysis Treatment': { 'DOC001': 'Mandatory', 'DOC002': 'Mandatory', 'DOC004': 'Mandatory', 'DOC005': 'Mandatory', 'DOC008': 'Optional' },
  'Heart Surgery': { 'DOC001': 'Mandatory', 'DOC002': 'Mandatory', 'DOC004': 'Mandatory', 'DOC005': 'Mandatory', 'DOC008': 'Optional' },
  'Accident Relief': { 'DOC001': 'Mandatory', 'DOC002': 'Mandatory', 'DOC004': 'Mandatory', 'DOC005': 'Mandatory', 'DOC006': 'Mandatory', 'DOC008': 'Optional' },
  'Natural Calamity': { 'DOC001': 'Mandatory', 'DOC002': 'Mandatory', 'DOC003': 'Mandatory', 'DOC005': 'Mandatory', 'DOC008': 'Optional' },
  'Debt Relief': { 'DOC001': 'Mandatory', 'DOC002': 'Mandatory', 'DOC003': 'Mandatory', 'DOC005': 'Mandatory', 'DOC008': 'Optional' }
};

async function seedCMFunds() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('Connected to database. Starting CM Funds seeding...');
    
    // Seed Documents
    for (const doc of DEFAULT_DOCUMENTS) {
      await connection.query(`
        INSERT IGNORE INTO cm_fund_document_types (id, name, description, status) 
        VALUES (?, ?, ?, ?)
      `, [doc.id, doc.name, doc.description, doc.status]);
    }
    console.log('Seeded documents successfully.');

    // Seed Categories
    for (const catName of DEFAULT_CATEGORIES) {
      await connection.query(`
        INSERT IGNORE INTO cm_fund_categories (name) VALUES (?)
      `, [catName]);
    }
    console.log('Seeded categories successfully.');

    // Get mapped Categories to IDs
    const [cats] = await connection.query(`SELECT id, name FROM cm_fund_categories`);
    const catMap = {};
    cats.forEach(c => catMap[c.name] = c.id);

    // Seed Category Configs
    for (const [catName, config] of Object.entries(DEFAULT_CATEGORY_CONFIG)) {
      const catId = catMap[catName];
      if (!catId) continue;

      for (const [docId, req] of Object.entries(config)) {
        // Upsert logic for config mapping
        await connection.query(`
          INSERT INTO cm_fund_category_documents (category_id, doc_type_id, requirement, display_order)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE requirement = VALUES(requirement)
        `, [catId, docId, req, 0]);
      }
    }
    console.log('Seeded category configs successfully.');

    console.log('✅ CM Funds seed completed successfully!');
  } catch (err) {
    console.error('Failed to seed CM Funds:', err);
  } finally {
    await connection.end();
  }
}

seedCMFunds();
