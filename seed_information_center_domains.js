import pool from './configs/db.js';

const DOMAIN_KEY    = 'information_center_domain';
const DOMAIN_MODULE = 'Website';
const DOMAIN_SUB    = 'Information Center';

const domains = [
  { label: 'Agriculture',    value: 'Agriculture',    color: '#16a34a' },
  { label: 'Health',         value: 'Health',         color: '#dc2626' },
  { label: 'Education',      value: 'Education',      color: '#2563eb' },
  { label: 'Infrastructure', value: 'Infrastructure', color: '#d97706' },
  { label: 'Social Welfare', value: 'Social Welfare', color: '#7c3aed' },
  { label: 'Announcements',  value: 'Announcements',  color: '#ea580c' },
  { label: 'Government',     value: 'Government',     color: '#0891b2' },
  { label: 'Other',          value: 'Other',          color: '#6b7280' },
];

const seed = async () => {
  try {
    console.log(`[InformationCenterDomains] Checking for key "${DOMAIN_KEY}"…`);
    const [existing] = await pool.query(
      'SELECT COUNT(*) as cnt FROM mla_dropdown_lists WHERE `key` = ?',
      [DOMAIN_KEY]
    );

    if (existing[0].cnt > 0) {
      console.log(`[InformationCenterDomains] Key "${DOMAIN_KEY}" already seeded (${existing[0].cnt} rows). Skipping.`);
      process.exit(0);
    }

    for (let i = 0; i < domains.length; i++) {
      const d = domains[i];
      await pool.query(
        `INSERT INTO mla_dropdown_lists
           (\`key\`, module, sub_category, label, value, color, sort_order, status, parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', NULL)`,
        [DOMAIN_KEY, DOMAIN_MODULE, DOMAIN_SUB, d.label, d.value, d.color, i + 1]
      );
      console.log(`  + ${d.label}`);
    }

    console.log(`[InformationCenterDomains] Seeded ${domains.length} domains. Done.`);
    process.exit(0);
  } catch (err) {
    console.error('[InformationCenterDomains] Seed failed:', err);
    process.exit(1);
  }
};

seed();
