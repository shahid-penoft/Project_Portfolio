import pool from './configs/db.js';

const insert = async (row) => {
  const [res] = await pool.query(
    `INSERT IGNORE INTO mla_dropdown_lists
       (\`key\`, module, sub_category, label, value, parent_id, color, sort_order, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.key, row.module, row.subCategory ?? null,
      row.label, row.value, row.parentId ?? null,
      row.color ?? null, row.sortOrder ?? 0, row.status ?? 'Active',
    ]
  );
  return res.insertId;
};

// ── 1. Kerala Districts ────────────────────────────────────────────
const KERALA_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam',   'Pathanamthitta', 'Alappuzha',
  'Kottayam',           'Idukki',   'Ernakulam',       'Thrissur',
  'Palakkad',           'Malappuram','Kozhikode',      'Wayanad',
  'Kannur',             'Kasaragod',
];

// ── 2. CM Fund Recommenders ────────────────────────────────────────
const CM_FUND_RECOMMENDERS = [
  { label: 'MLA Office',              value: 'MLA Office'              },
  { label: 'Gram Panchayat',          value: 'Gram Panchayat'          },
  { label: 'Municipal Councillor',    value: 'Municipal Councillor'    },
  { label: 'Block Panchayat',         value: 'Block Panchayat'         },
  { label: 'Other',                   value: 'Other'                   },
];

async function seed() {
  try {
    console.log('Seeding cm_fund_district…');
    let sortOrder = 1;
    for (const district of KERALA_DISTRICTS) {
      await insert({
        key: 'cm_fund_district',
        module: 'CM Funds',
        subCategory: 'Form Fields',
        label: district,
        value: district,
        sortOrder: sortOrder++,
      });
    }
    console.log(`✓ ${KERALA_DISTRICTS.length} districts seeded.`);

    console.log('Seeding cm_fund_recommender…');
    sortOrder = 1;
    for (const rec of CM_FUND_RECOMMENDERS) {
      await insert({
        key: 'cm_fund_recommender',
        module: 'CM Funds',
        subCategory: 'Form Fields',
        label: rec.label,
        value: rec.value,
        sortOrder: sortOrder++,
      });
    }
    console.log(`✓ ${CM_FUND_RECOMMENDERS.length} recommender options seeded.`);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM mla_dropdown_lists WHERE \`key\` IN ('cm_fund_district','cm_fund_recommender')`
    );
    console.log(`\n✅ Done. Total rows inserted: ${total}`);
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    process.exit();
  }
}

seed();
