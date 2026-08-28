import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import db from '../configs/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local body sheet to database mapping
const LOCAL_BODY_MAP = {
  'KOTTAPPADY': {
    name: 'Kottapady',
    localBodyId: 19,
    type: 'GRAM_PANCHAYAT'
  },
  'PINDIMANA': {
    name: 'Pindimana',
    localBodyId: 8,
    type: 'GRAM_PANCHAYAT'
  },
  'KUTTAMPUZHA': {
    name: 'Kuttampuzha',
    localBodyId: 5,
    type: 'GRAM_PANCHAYAT'
  },
  'KEERAMPARA': {
    name: 'Keerampara',
    localBodyId: 3,
    type: 'GRAM_PANCHAYAT'
  },
  'MUNICIPALITY': {
    name: 'Kothamangalam Municipality',
    localBodyId: 1,
    type: 'MUNICIPALITY'
  },
  'NELLIKUZHI': {
    name: 'Nellikuzhy',
    localBodyId: 6,
    type: 'GRAM_PANCHAYAT'
  },
  'VARAPPETTY': {
    name: 'Varapetty',
    localBodyId: 27,
    type: 'GRAM_PANCHAYAT'
  },
  'PALLARIMANGALAM': {
    name: 'Pallarimangalam',
    localBodyId: 7,
    type: 'GRAM_PANCHAYAT'
  },
  'KAVALANGAD': {
    name: 'Kavalangad',
    localBodyId: 2,
    type: 'GRAM_PANCHAYAT'
  }
};

// Role & Standing Committee translation helper
function resolveRole(rawPosition, isMunicipality) {
  const pos = (rawPosition || '').toString().trim();
  
  if (/^president$/i.test(pos)) {
    return { roleId: 107, additionalRoles: [] };
  }
  if (/^vice\s*president$/i.test(pos)) {
    return { roleId: 108, additionalRoles: [] };
  }
  if (/^chairperson$/i.test(pos)) {
    return { roleId: 111, additionalRoles: [] };
  }
  if (/^vice\s*chairperson$/i.test(pos)) {
    return { roleId: 112, additionalRoles: [] };
  }
  if (/^ക്ഷേമം$/i.test(pos)) {
    return {
      roleId: isMunicipality ? 110 : 109,
      additionalRoles: ['Welfare Standing Committee Chairman']
    };
  }
  if (/^വികസനം$/i.test(pos)) {
    return {
      roleId: isMunicipality ? 110 : 109,
      additionalRoles: ['Development Standing Committee Chairman']
    };
  }
  if (/^ആരോഗ്യം/i.test(pos) || /^ആക്ഷ\s*ാഗ്യം/i.test(pos)) {
    return {
      roleId: isMunicipality ? 110 : 109,
      additionalRoles: ['Health and Education Standing Committee Chairman']
    };
  }
  if (/^പൊതുമരാമത്ത്/i.test(pos)) {
    return {
      roleId: isMunicipality ? 110 : 109,
      additionalRoles: ['Public Works Standing Committee Chairman']
    };
  }
  if (/^വിദ്യാഭ്യാസം/i.test(pos)) {
    return {
      roleId: isMunicipality ? 110 : 109,
      additionalRoles: ['Education Standing Committee Chairman']
    };
  }

  // Default: Ward Member or Councilor
  return {
    roleId: isMunicipality ? 110 : 109,
    additionalRoles: []
  };
}

// Clean phone numbers
function formatPhoneNumber(raw) {
  if (!raw) return null;
  const digits = raw.toString().replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length > 0) {
    return `+91${digits.slice(-10)}`;
  }
  return null;
}

// Clean party name
function normalizeParty(raw) {
  if (!raw) return null;
  const p = raw.toString().trim().toUpperCase();
  if (p.includes('UDF')) return 'UDF';
  if (p.includes('LDF')) return 'LDF';
  if (p.includes('BJP')) return 'BJP';
  return p;
}

async function seed() {
  console.log('===============================================================');
  console.log('🚀 Starting Seeding: Kothamangalam Constituency Members');
  console.log('===============================================================');

  // 1. Purge existing directory / governing body contents as requested
  console.log('\n🗑️  Step 1: Removing all existing governing body data...');
  await db.query('DELETE FROM governing_body_activity_logs');
  console.log('   - Cleared governing_body_activity_logs');
  await db.query('DELETE FROM governing_body_staffs');
  console.log('   - Cleared governing_body_staffs');
  await db.query('DELETE FROM governing_representatives');
  console.log('   - Cleared governing_representatives');
  console.log('✅ Purge complete!\n');

  // 2. Pre-fetch all wards for fast lookup
  const [wardsList] = await db.query('SELECT id, local_body_id, ward_no, place_name FROM local_body_wards');
  const wardMap = new Map();
  for (const w of wardsList) {
    const key = `${w.local_body_id}_${w.ward_no}`;
    wardMap.set(key, w);
  }
  console.log(`📋 Cached ${wardsList.length} wards from database for fast mapping.`);

  // 3. Read Excel workbook
  const excelPath = path.resolve(__dirname, '../../Kothamanagalam Constituency Members Lists.xlsx');
  console.log(`\n📖 Reading Excel file: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);

  let totalProcessed = 0;
  let totalInserted = 0;
  const statsPerBody = {};

  // 4. Iterate over each sheet
  for (const sheetName of workbook.SheetNames) {
    const mapping = LOCAL_BODY_MAP[sheetName.trim().toUpperCase()];
    if (!mapping) {
      console.warn(`⚠️ Warning: No local body mapping found for sheet "${sheetName}". Skipping.`);
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rawRows.length < 3) {
      console.warn(`⚠️ Sheet "${sheetName}" has insufficient rows.`);
      continue;
    }

    // Header row is index 1
    const headers = rawRows[1].map(h => (h || '').toString().trim().toUpperCase());
    const nameIdx = headers.findIndex(h => h.includes('NAME') && !h.includes('HOUSE'));
    const houseIdx = headers.findIndex(h => h.includes('HOUSE'));
    const mobileIdx = headers.findIndex(h => h.includes('MOBILE') || h.includes('PHONE'));
    const wardIdx = headers.findIndex(h => h.includes('WARD'));
    const posIdx = headers.findIndex(h => h.includes('POSITION') || h.includes('ROLE'));
    const partyIdx = headers.findIndex(h => h.includes('PARTY'));

    console.log(`\n📍 Processing Sheet: ${sheetName} -> ${mapping.name} (Local Body ID: ${mapping.localBodyId})`);

    const isMunicipality = mapping.type === 'MUNICIPALITY';
    let sheetInserted = 0;

    // Data rows start from index 2
    for (let r = 2; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0 || !row[nameIdx]) continue;

      const rawName = row[nameIdx]?.toString().trim();
      if (!rawName) continue;

      const rawHouse = houseIdx !== -1 ? row[houseIdx]?.toString().trim() : '';
      const rawMobile = mobileIdx !== -1 ? row[mobileIdx]?.toString().trim() : '';
      const rawWard = wardIdx !== -1 ? row[wardIdx]?.toString().trim() : '';
      const rawPos = posIdx !== -1 ? row[posIdx]?.toString().trim() : '';
      const rawParty = partyIdx !== -1 ? row[partyIdx]?.toString().trim() : '';

      const { roleId, additionalRoles } = resolveRole(rawPos, isMunicipality);
      const phone = formatPhoneNumber(rawMobile);
      const party = normalizeParty(rawParty);
      const houseName = rawHouse || null;

      // Find matching ward in DB
      const wardKey = `${mapping.localBodyId}_${rawWard}`;
      const wardRecord = wardMap.get(wardKey);
      const wardId = wardRecord ? wardRecord.id : null;

      if (!wardId) {
        console.warn(`   ⚠️ Ward "${rawWard}" not found in DB for Local Body ${mapping.name}`);
      }

      // Insert representative
      const [insertResult] = await db.query(`
        INSERT INTO governing_representatives (
          governing_body_type, local_body_id, ward_id, name, role_id, party,
          phone, house_name, additional_roles, status, bookmarked, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        mapping.type,
        mapping.localBodyId,
        wardId,
        rawName,
        roleId,
        party,
        phone,
        houseName,
        additionalRoles.length > 0 ? JSON.stringify(additionalRoles) : null,
        'Active',
        0,
        0
      ]);

      // Add audit log
      await db.query(`
        INSERT INTO governing_body_activity_logs (governing_body_id, text)
        VALUES (?, ?)
      `, [insertResult.insertId, `Member initialized from official constituency list.`]);

      sheetInserted++;
      totalInserted++;
      totalProcessed++;
    }

    statsPerBody[mapping.name] = sheetInserted;
    console.log(`   ✅ Inserted ${sheetInserted} members for ${mapping.name}`);
  }

  // 5. Final Report
  console.log('\n===============================================================');
  console.log('🎉 SEEDING SUMMARY');
  console.log('===============================================================');
  console.table(statsPerBody);
  console.log(`Total Members Seeded: ${totalInserted} / ${totalProcessed}`);

  const [verifyCount] = await db.query('SELECT COUNT(*) as c FROM governing_representatives WHERE is_deleted = 0');
  const [partyCount] = await db.query('SELECT party, COUNT(*) as c FROM governing_representatives GROUP BY party');
  console.log(`Active Representatives in Database: ${verifyCount[0].c}`);
  console.log('Representatives by Party:');
  console.table(partyCount);

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeder encountered an error:', err);
  process.exit(1);
});
