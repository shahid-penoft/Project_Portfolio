import pool from './configs/db.js';

const queries = [
  `CREATE TABLE IF NOT EXISTS cm_fund_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  `CREATE TABLE IF NOT EXISTS cm_fund_document_types (
    id VARCHAR(60) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    requirement ENUM('Mandatory','Optional') DEFAULT 'Optional',
    status ENUM('Active','Inactive') DEFAULT 'Active',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );`,

  `CREATE TABLE IF NOT EXISTS cm_fund_category_document_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    doc_id VARCHAR(60) NOT NULL,
    requirement ENUM('Mandatory','Optional') DEFAULT 'Optional',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES cm_fund_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (doc_id) REFERENCES cm_fund_document_types(id) ON DELETE CASCADE,
    UNIQUE KEY uq_cat_doc (category_id, doc_id)
  );`,

  `CREATE TABLE IF NOT EXISTS cm_fund_requests (
    id VARCHAR(30) PRIMARY KEY,
    applicant_name VARCHAR(200) NOT NULL,
    applicant_phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    aadhaar_number VARCHAR(20),
    ration_card_number VARCHAR(50),
    local_body_id INT UNSIGNED,
    ward_id INT UNSIGNED,
    address_line1 VARCHAR(300) NOT NULL,
    address_line2 VARCHAR(300),
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) DEFAULT 'Kerala',
    pincode VARCHAR(10) NOT NULL,
    category_id INT UNSIGNED,
    sub_category VARCHAR(200),
    priority ENUM('Normal','Urgent','Critical') DEFAULT 'Normal',
    amount_requested DECIMAL(12,2) NOT NULL,
    approved_amount DECIMAL(12,2),
    description TEXT NOT NULL,
    bank_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(15) NOT NULL,
    branch VARCHAR(200) NOT NULL,
    account_holder_name VARCHAR(200) NOT NULL,
    recommended_by VARCHAR(100) NOT NULL,
    recommender_name VARCHAR(200),
    recommender_contact VARCHAR(20),
    remarks TEXT,
    status ENUM('Draft','Submitted','Under Review','Document Pending','Approved','Rejected','Disbursed') DEFAULT 'Submitted',
    submitted_by_id INT UNSIGNED,
    assigned_officer_id INT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE SET NULL,
    FOREIGN KEY (ward_id) REFERENCES local_body_wards(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES cm_fund_categories(id),
    FOREIGN KEY (submitted_by_id) REFERENCES admin_users(id),
    FOREIGN KEY (assigned_officer_id) REFERENCES admin_users(id)
  );`,

  `CREATE TABLE IF NOT EXISTS cm_fund_request_documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(30) NOT NULL,
    doc_type_id VARCHAR(60) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    original_filename VARCHAR(300),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES cm_fund_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (doc_type_id) REFERENCES cm_fund_document_types(id)
  );`,

  `CREATE TABLE IF NOT EXISTS cm_fund_timeline_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(30) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    actor_id INT UNSIGNED,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES cm_fund_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES admin_users(id)
  );`
];

const DEFAULT_CATEGORIES = [
  "Cancer Treatment",
  "Dialysis / Kidney Disease",
  "Heart Surgery",
  "Accident Victim",
  "Physical Disability",
  "Death of Breadwinner",
  "Natural Disaster Relief",
  "Home Construction",
  "Marriage Assistance",
  "Education Support",
  "Others"
];

const DEFAULT_DOCUMENTS = [
  { id: "doc_med_cert", name: "Medical Certificate", description: "Certificate issued by a registered medical practitioner stating treatment details", requirement: "Mandatory" },
  { id: 'application_form', name: 'Application Letter', description: 'Formal request letter from applicant', requirement: 'Mandatory' },
  { id: "doc_mla_rec", name: "MLA Recommendation", description: "Recommendation letter from the MLA office", requirement: "Mandatory" },
  { id: "doc_inc_cert", name: "Income Certificate", description: "Certificate issued by Tahsildar stating annual family income (Limit: Rs. 2 Lakhs)", requirement: "Mandatory" },
  { id: "doc_bank_pass", name: "Bank Passbook Copy", description: "Copy of the front page of applicant's bank passbook showing IFSC and A/C No.", requirement: "Mandatory" },
  { id: "doc_aadhaar", name: "Aadhaar Card", description: "Copy of UIDAI Aadhaar card of the applicant", requirement: "Mandatory" },
  { id: "doc_hosp_rep", name: "Hospital Report / Treatment Plan", description: "Detailed hospital report or treatment plan from treating oncologist/specialist", requirement: "Optional" },
  { id: "doc_rec_med_reps", name: "Recent Medical Reports", description: "Diagnostic, lab or imaging reports supporting the clinical condition", requirement: "Optional" },
  { id: "doc_prescription", name: "Prescription & Bills", description: "Doctor's prescriptions and original hospital bill estimates", requirement: "Optional" },
  { id: "doc_photo", name: "Photograph", description: "Passport size photograph of the applicant", requirement: "Optional" },
  { id: "doc_discharge_sum", name: "Discharge Summary", description: "Summary report provided at the time of discharge from hospital", requirement: "Optional" },
  { id: "doc_own_cert", name: "Ownership Certificate", description: "Certificate of land/building ownership from Village Officer", requirement: "Mandatory" },
  { id: "doc_land_tax", name: "Land Tax Receipt", description: "Latest receipt of land tax paid to the Revenue Department", requirement: "Mandatory" },
  { id: "doc_bld_estimate", name: "Building Estimate", description: "Detailed estimate of repair or construction cost by a licensed engineer", requirement: "Mandatory" },
  { id: "doc_photographs", name: "Site Photographs", description: "Photos of damaged house or property showing clear impact", requirement: "Optional" },
  { id: "doc_poss_cert", name: "Possession Certificate", description: "Possession certificate from Village Officer", requirement: "Optional" },
  { id: "doc_fir_copy", name: "FIR Copy", description: "First Information Report copy registered at the police station", requirement: "Optional" },
  { id: "doc_death_cert", name: "Death Certificate", description: "Death certificate of breadwinner issued by the local registrar", requirement: "Mandatory" },
  { id: "doc_marriage_cert", name: "Marriage Invitation / Certificate", description: "Marriage registration certificate or formal wedding invitation card", requirement: "Optional" },
  { id: "doc_disability_cert", name: "Disability Certificate", description: "Certificate indicating percentage of disability issued by Medical Board", requirement: "Mandatory" },
  { id: "doc_birth_cert", name: "Birth Certificate", description: "Official birth certificate of the applicant", requirement: "Mandatory" },
  { id: "doc_ration_card", name: "Ration Card copy", description: "Copy of the Ration Card (showing category details BPL/APL)", requirement: "Optional" },
  { id: "doc_caste_cert", name: "Caste Certificate", description: "Community/Caste certificate issued by Tahsildar for SC/ST/OBC verification", requirement: "Optional" },
  { id: "doc_res_proof", name: "Residence Certificate", description: "Certificate of residency issued by Village Officer", requirement: "Optional" },
  { id: "doc_school_bonafide", name: "School/College Bonafide", description: "Bonafide student certificate issued by school Principal or College Dean", requirement: "Optional" },
  { id: "doc_course_fee", name: "Course Fee Structure", description: "Official fee details breakdown from the educational institution", requirement: "Optional" },
  { id: "doc_postmortem", name: "Postmortem Report", description: "Postmortem summary report in case of accidental death", requirement: "Optional" },
  { id: "doc_any_other", name: "Any Other Supporting Document", description: "Any other custom supporting certificates or documents", requirement: "Optional" }
];

const DEFAULT_CATEGORY_CONFIG = {
  "Cancer Treatment": {
    "doc_med_cert": "Mandatory",
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_hosp_rep": "Mandatory",
    "doc_rec_med_reps": "Optional",
    "doc_prescription": "Optional"
  },
  "Dialysis / Kidney Disease": {
    "doc_med_cert": "Mandatory",
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_hosp_rep": "Optional",
    "doc_prescription": "Mandatory"
  },
  "Heart Surgery": {
    "doc_med_cert": "Mandatory",
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_hosp_rep": "Mandatory"
  },
  "Accident Victim": {
    "doc_med_cert": "Mandatory",
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_fir_copy": "Mandatory",
    "doc_discharge_sum": "Optional"
  },
  "Physical Disability": {
    "doc_med_cert": "Mandatory",
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_disability_cert": "Mandatory"
  },
  "Death of Breadwinner": {
    "doc_death_cert": "Mandatory",
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_postmortem": "Optional"
  },
  "Natural Disaster Relief": {
    "application_form": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_photographs": "Mandatory"
  },
  "Home Construction": {
    "doc_app_letter": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_own_cert": "Mandatory",
    "doc_land_tax": "Mandatory",
    "doc_bld_estimate": "Optional"
  },
  "Marriage Assistance": {
    "doc_app_letter": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_marriage_cert": "Mandatory"
  },
  "Education Support": {
    "doc_app_letter": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_school_bonafide": "Mandatory",
    "doc_course_fee": "Optional"
  },
  "Others": {
    "doc_app_letter": "Mandatory",
    "doc_inc_cert": "Mandatory",
    "doc_aadhaar": "Mandatory",
    "doc_bank_pass": "Mandatory",
    "doc_any_other": "Optional"
  }
};

async function run() {
  try {
    for (const q of queries) {
      await pool.query(q);
      console.log('Executed query successfully.');
    }
    
    // Seed Categories
    console.log('Seeding categories...');
    let order = 1;
    for (const cat of DEFAULT_CATEGORIES) {
      await pool.query(
        'INSERT IGNORE INTO cm_fund_categories (name, sort_order) VALUES (?, ?)',
        [cat, order++]
      );
    }

    // Seed Documents
    console.log('Seeding documents...');
    let docOrder = 1;
    for (const doc of DEFAULT_DOCUMENTS) {
      await pool.query(
        'INSERT IGNORE INTO cm_fund_document_types (id, name, description, requirement, sort_order) VALUES (?, ?, ?, ?, ?)',
        [doc.id, doc.name, doc.description, doc.requirement, docOrder++]
      );
    }

    // Seed Configs
    console.log('Seeding category-document configs...');
    const [dbCategories] = await pool.query('SELECT id, name FROM cm_fund_categories');
    const catMap = {};
    dbCategories.forEach(c => catMap[c.name] = c.id);

    let configOrder = 1;
    for (const [catName, config] of Object.entries(DEFAULT_CATEGORY_CONFIG)) {
      const catId = catMap[catName];
      if (catId) {
        for (const [docId, requirement] of Object.entries(config)) {
          await pool.query(
            'INSERT IGNORE INTO cm_fund_category_document_config (category_id, doc_id, requirement, sort_order) VALUES (?, ?, ?, ?)',
            [catId, docId, requirement, configOrder++]
          );
        }
      }
    }

    console.log('All migrations executed!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    process.exit();
  }
}

run();
