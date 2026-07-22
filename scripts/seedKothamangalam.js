/**
 * seedKothamangalam.js
 * ─────────────────────────────────────────────────────────────
 * Seeds "Kothamangalam Full with SMS content.xlsx" (June sheet)
 * into the database across three tables:
 *   - cm_fund_requests  (General / CMDRF / T-Grants / MLA Fund)
 *   - issues            (Public Issue)
 *   - complaints        (Complaints)
 *
 * Usage:
 *   node scripts/seedKothamangalam.js
 *   node scripts/seedKothamangalam.js --dry-run   (print rows, no insert)
 */

import xlsx from 'xlsx';
import db from '../configs/db.js';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const EXCEL_PATH = 'c:/Users/WorkSpace-Penoft/Documents/Project_Portfolio/Kothamangalam Full with SMS content.xlsx';
const SHEET_NAME = 'June';
const DRY_RUN = process.argv.includes('--dry-run');

// ─────────────────────────────────────────────────────────────
// GP NORMALIZATION MAP
// Maps raw Excel GP values → canonical local_bodies.name
// ─────────────────────────────────────────────────────────────
const GP_NORMALIZE = {
  'kavalngad':              'Kavalangad',
  'kavalangad':             'Kavalangad',
  'kuttampuzha':            'Kuttampuzha',
  'kuttampuzha ':           'Kuttampuzha',
  'kothamangalam municipality': 'Kothamangalam Municipality',
  'municipality':           'Kothamangalam Municipality',
  'municipalitty':          'Kothamangalam Municipality',
  'municipality ':          'Kothamangalam Municipality',
  'MUNICIPALITY':           'Kothamangalam Municipality',
  'pindimana':              'Pindimana',
  'varappetty':             'Varapetty',      // DB: 'Varapetty'
  'varappetty ':            'Varapetty',
  'keerampara':             'Keerampara',
  'pallarimangalam':        'Pallarimangalam',
  // Nellikkuzhi variants → DB stores as 'Nellikuzhy'
  'nellikkuzhi':            'Nellikuzhy',
  'nellikkuzhi ':           'Nellikuzhy',
  'nellikkuzhy':            'Nellikuzhy',
  'nellikkuzhy ':           'Nellikuzhy',
  'nellikuzhi':             'Nellikuzhy',
  'nellikuzhy':             'Nellikuzhy',
  // Kottappady variants → DB stores as 'Kottapady'
  'kottappady':             'Kottapady',      // DB: 'Kottapady'
  'kottappady ':            'Kottapady',
  'kottapady':              'Kottapady',
  // Paingottoor — not in DB yet, will seed with local_body_id = NULL
  'paingottoor':            'Paingottoor',
  'paingottoor ':           'Paingottoor',
};

function normalizeGP(raw) {
  if (!raw) return null;
  const key = raw.toString().trim().toLowerCase();
  return GP_NORMALIZE[key] || GP_NORMALIZE[raw.toString().trim()] || null;
}

// ─────────────────────────────────────────────────────────────
// APPLICATION TYPE MAP  (Excel → DB value)
// ─────────────────────────────────────────────────────────────
const APP_TYPE_MAP = {
  'general application': 'General',
  'cmdrf application':   'CMDRF',
  't- grantz':           'T-Grants',
  'mla fund':            'MLA Fund',
};

function mapAppType(raw) {
  if (!raw) return null;
  return APP_TYPE_MAP[raw.trim().toLowerCase()] || null;
}

// ─────────────────────────────────────────────────────────────
// STATUS MAPS
// ─────────────────────────────────────────────────────────────
function mapCMFStatus(raw) {
  if (!raw) return 'Under Review';
  const s = raw.trim().toLowerCase();
  if (s === 'closed') return 'Approved';
  return 'Under Review';
}

function mapIssueComplaintStatus(raw) {
  if (!raw) return 'Under Review';
  const s = raw.trim().toLowerCase();
  if (s === 'closed') return 'Resolved';
  return 'In Progress';
}

// ─────────────────────────────────────────────────────────────
// EXCEL DATE SERIAL → JS Date → 'YYYY-MM-DD'
// ─────────────────────────────────────────────────────────────
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') {
    return new Date().toISOString().split('T')[0];
  }
  // Excel epoch: Dec 30, 1899
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return date.toISOString().split('T')[0];
}

function excelDateToMySQLDatetime(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

// ─────────────────────────────────────────────────────────────
// ID GENERATORS — Mirrors cmFundsController.generateAppId()
// ─────────────────────────────────────────────────────────────
async function generateCMFId(prefix, counter) {
  return `${prefix}${counter.toString().padStart(3, '0')}`;
}

async function getNextCMFCounter(prefix) {
  const [[row]] = await db.query(
    `SELECT id FROM cm_fund_requests WHERE id LIKE ? ORDER BY CAST(SUBSTR(id, ?) AS UNSIGNED) DESC LIMIT 1`,
    [`${prefix}%`, prefix.length + 1]
  );
  if (!row) return 1;
  const lastNum = parseInt(row.id.replace(prefix, ''), 10);
  return isNaN(lastNum) ? 1 : lastNum + 1;
}

async function getNextIssueCounter() {
  const [[{ maxSeq }]] = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(reference_no, 3) AS UNSIGNED)), 0) as maxSeq FROM issues WHERE reference_no LIKE 'P-%'`
  );
  return parseInt(maxSeq, 10) + 1;
}

async function getNextComplaintCounter() {
  const [[{ maxSeq }]] = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(reference_no, 3) AS UNSIGNED)), 0) as maxSeq FROM complaints WHERE reference_no LIKE 'C-%'`
  );
  return parseInt(maxSeq, 10) + 1;
}

// ─────────────────────────────────────────────────────────────
// MAIN SEED
// ─────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🚀 Starting Kothamangalam seeder${DRY_RUN ? ' [DRY RUN — no DB writes]' : ''}...`);

  // ── 1. Read Excel ──
  console.log(`📖 Reading: ${EXCEL_PATH}`);
  const workbook = xlsx.readFile(EXCEL_PATH);
  const ws = workbook.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`❌ Sheet "${SHEET_NAME}" not found. Available: ${workbook.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const rows = raw.slice(1); // skip header row
  console.log(`📋 Found ${rows.length} rows in sheet "${SHEET_NAME}"\n`);

  // ── 2. Load DB lookups ──
  console.log('🔍 Loading local_bodies from DB...');
  const [lbRows] = await db.query('SELECT id, name FROM local_bodies');
  const localBodyMap = {}; // canonical name (lowercase) → id
  lbRows.forEach(lb => { localBodyMap[lb.name.toLowerCase()] = lb.id; });
  console.log(`   Found ${lbRows.length} local bodies.`);

  console.log('🔍 Loading local_body_wards from DB...');
  const [wardRows] = await db.query('SELECT id, local_body_id, ward_no FROM local_body_wards');
  // Map: `${local_body_id}_${ward_no}` → ward_id
  const wardMap = {};
  wardRows.forEach(w => { wardMap[`${w.local_body_id}_${w.ward_no}`] = w.id; });
  console.log(`   Found ${wardRows.length} wards.`);

  // ── 3. Load ID counters ──
  console.log('🔢 Loading current ID counters...');
  const cmCounter = await getNextCMFCounter('CM-');
  const aCounter  = await getNextCMFCounter('A-');
  const pCounter  = await getNextIssueCounter();
  const cCounter  = await getNextComplaintCounter();
  console.log(`   CM-: next = CM-${cmCounter.toString().padStart(3,'0')}`);
  console.log(`   A-:  next = A-${aCounter.toString().padStart(3,'0')}`);
  console.log(`   P-:  next = P-${pCounter.toString().padStart(3,'0')}`);
  console.log(`   C-:  next = C-${cCounter.toString().padStart(3,'0')}\n`);

  // Mutable counters
  let counters = { CM: cmCounter, A: aCounter, P: pCounter, C: cCounter };

  // ── 4. Process rows ──
  const stats = {
    cmf:     { inserted: 0, skipped: 0, failed: 0 },
    issues:  { inserted: 0, skipped: 0, failed: 0 },
    complaints: { inserted: 0, skipped: 0, failed: 0 },
    empty:   0,
    gpMisses: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    // Raw fields
    const dateSerial  = row[1];
    const name        = (row[2] || '').toString().trim();
    const address     = (row[3] || '').toString().trim();
    const phone       = (row[4] || '').toString().trim();
    const gpRaw       = (row[5] || '').toString().trim();
    const wardNo      = row[6] ? parseInt(row[6], 10) : null;
    const purposeRaw  = (row[7] || '').toString().trim();
    const remarksRaw  = (row[8] || '').toString().trim();
    const typeRaw     = (row[9] || '').toString().trim();
    const statusRaw   = (row[11] || '').toString().trim();

    // Skip empty TYPE rows
    if (!typeRaw) {
      stats.empty++;
      continue;
    }

    // Skip if no name
    if (!name) {
      console.warn(`  ⚠️  Row ${rowNum}: No name found, skipping.`);
      continue;
    }

    // GP → local_body_id
    const canonicalGP = normalizeGP(gpRaw);
    let localBodyId = null;
    let wardId = null;

    if (canonicalGP) {
      localBodyId = localBodyMap[canonicalGP.toLowerCase()] || null;
      if (!localBodyId) {
        stats.gpMisses.push({ row: rowNum, raw: gpRaw, canonical: canonicalGP, reason: 'not in local_bodies table' });
      }
    } else if (gpRaw) {
      stats.gpMisses.push({ row: rowNum, raw: gpRaw, canonical: null, reason: 'no normalization match' });
    }

    if (localBodyId && wardNo) {
      wardId = wardMap[`${localBodyId}_${wardNo}`] || null;
    }

    const dateStr  = excelDateToISO(dateSerial);
    const datetimeStr = excelDateToMySQLDatetime(dateSerial);
    const title    = purposeRaw.substring(0, 150) || 'Legacy record';
    const desc     = purposeRaw || 'Legacy record imported from office register';
    const remarks  = remarksRaw || null;
    const city     = canonicalGP || 'Kothamangalam';

    // ────────────────────────────────────────────────────────
    // Route: CM Fund Requests
    // ────────────────────────────────────────────────────────
    const appType = mapAppType(typeRaw);
    if (appType) {
      const isCMDRF  = appType === 'CMDRF';
      const prefix   = isCMDRF ? 'CM-' : 'A-';
      const counterKey = isCMDRF ? 'CM' : 'A';
      const id = await generateCMFId(prefix, counters[counterKey]);

      const status = mapCMFStatus(statusRaw);

      if (DRY_RUN) {
        console.log(`  [DRY-RUN CMF] Row ${rowNum}: id=${id} | ${name} | ${appType} | ${status} | GP=${canonicalGP||'NULL'}`);
        counters[counterKey]++;
        stats.cmf.inserted++;
        continue;
      }

      try {
        await db.query(`
          INSERT IGNORE INTO cm_fund_requests
            (id, applicant_name, applicant_phone, alternate_phone,
             aadhaar_number, ration_card_number,
             local_body_id, ward_id,
             address_line1, city, district, state, pincode,
             application_type, category_id, sub_category,
             priority, amount_requested,
             description, application_title,
             bank_name, account_number, ifsc_code, branch, account_holder_name,
             recommended_by, recommender_name, recommender_contact,
             remarks, status,
             submitted_by_id, assigned_officer_id,
             created_at, updated_at)
          VALUES (?,?,?,NULL,NULL,NULL,?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,NULL,NULL,?,?)
        `, [
          id,
          name,
          phone,
          localBodyId,
          wardId,
          address.substring(0, 300),
          city,
          'Ernakulam',
          'Kerala',
          '686691',
          appType,
          'Normal',
          0.00,
          desc,
          title,
          'N/A',   // bank_name
          'N/A',   // account_number
          'N/A',   // ifsc_code
          'N/A',   // branch
          'N/A',   // account_holder_name
          'mla_office',
          remarks,
          status,
          datetimeStr,
          datetimeStr,
        ]);
        counters[counterKey]++;
        stats.cmf.inserted++;
      } catch (err) {
        console.error(`  ❌ Row ${rowNum} CMF insert failed: ${err.message}`);
        stats.cmf.failed++;
      }
      continue;
    }

    // ────────────────────────────────────────────────────────
    // Route: Public Issues
    // ────────────────────────────────────────────────────────
    if (typeRaw.toLowerCase() === 'public issue') {
      const refNo = `P-${counters.P.toString().padStart(3, '0')}`;
      const status = mapIssueComplaintStatus(statusRaw);

      if (DRY_RUN) {
        console.log(`  [DRY-RUN ISS] Row ${rowNum}: ref=${refNo} | ${name} | ${status} | GP=${canonicalGP||'NULL'}`);
        counters.P++;
        stats.issues.inserted++;
        continue;
      }

      try {
        await db.query(`
          INSERT IGNORE INTO issues
            (reference_no, title, description, category, priority, status,
             submitter_name, phone, alternative_phone, email,
             address, address_line1,
             local_body_id, ward_id, department,
             internal_note,
             constituent_user_id, filed_by_admin_id,
             date_filed, is_deleted,
             affected_by, latitude, longitude, location)
          VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,NULL,?,NULL,NULL,?,0,NULL,NULL,NULL,NULL)
        `, [
          refNo,
          title,
          desc,
          'Other',
          'Medium',
          status,
          name,
          phone,
          address.substring(0, 300),
          address.substring(0, 300),
          localBodyId,
          wardId,
          remarks,
          dateStr,
        ]);
        counters.P++;
        stats.issues.inserted++;
      } catch (err) {
        console.error(`  ❌ Row ${rowNum} Issue insert failed: ${err.message}`);
        stats.issues.failed++;
      }
      continue;
    }

    // ────────────────────────────────────────────────────────
    // Route: Complaints
    // ────────────────────────────────────────────────────────
    if (typeRaw.toLowerCase() === 'complaints') {
      const refNo = `C-${counters.C.toString().padStart(3, '0')}`;
      const status = mapIssueComplaintStatus(statusRaw);

      if (DRY_RUN) {
        console.log(`  [DRY-RUN COM] Row ${rowNum}: ref=${refNo} | ${name} | ${status} | GP=${canonicalGP||'NULL'}`);
        counters.C++;
        stats.complaints.inserted++;
        continue;
      }

      try {
        await db.query(`
          INSERT IGNORE INTO complaints
            (reference_no, title, description, category, priority, status,
             complainant_name, phone, alternative_phone, email,
             address, address_line1,
             local_body_id, ward_id, department,
             internal_note,
             constituent_user_id, filed_by_admin_id,
             date_filed, is_deleted,
             latitude, longitude, location)
          VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,NULL,?,NULL,NULL,?,0,NULL,NULL,NULL)
        `, [
          refNo,
          title,
          desc,
          'Other',
          'Medium',
          status,
          name,
          phone,
          address.substring(0, 300),
          address.substring(0, 300),
          localBodyId,
          wardId,
          remarks,
          dateStr,
        ]);
        counters.C++;
        stats.complaints.inserted++;
      } catch (err) {
        console.error(`  ❌ Row ${rowNum} Complaint insert failed: ${err.message}`);
        stats.complaints.failed++;
      }
      continue;
    }

    // Unknown TYPE
    console.warn(`  ⚠️  Row ${rowNum}: Unknown TYPE "${typeRaw}", skipping.`);
    stats.cmf.skipped++;
  }

  // ── 5. Summary ──
  console.log('\n─────────────────────────────────────────────────────');
  console.log('📊  SEED SUMMARY');
  console.log('─────────────────────────────────────────────────────');
  console.log(`✅  cm_fund_requests : ${stats.cmf.inserted} inserted | ${stats.cmf.skipped} skipped | ${stats.cmf.failed} failed`);
  console.log(`✅  issues           : ${stats.issues.inserted} inserted | ${stats.issues.skipped} skipped | ${stats.issues.failed} failed`);
  console.log(`✅  complaints       : ${stats.complaints.inserted} inserted | ${stats.complaints.skipped} skipped | ${stats.complaints.failed} failed`);
  console.log(`⏭   Empty TYPE rows  : ${stats.empty} skipped`);

  if (stats.gpMisses.length > 0) {
    console.log(`\n⚠️  GP Resolution Failures (local_body_id = NULL): ${stats.gpMisses.length} rows`);
    stats.gpMisses.forEach(m => {
      console.log(`   Row ${m.row}: "${m.raw}" → ${m.canonical || 'no match'} (${m.reason})`);
    });
  } else {
    console.log('\n✅  All GP values resolved successfully.');
  }

  const totalFailed = stats.cmf.failed + stats.issues.failed + stats.complaints.failed;
  if (totalFailed === 0) {
    console.log('\n🎉 Seeding completed successfully!');
  } else {
    console.log(`\n⚠️  Seeding completed with ${totalFailed} error(s). Check logs above.`);
  }
}

seed()
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
