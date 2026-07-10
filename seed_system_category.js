import pool from './configs/db.js';

const seedData = [
  {
    key: 'system_category',
    module: 'General / System',
    sub_category: 'System-wide',
    items: [
      {
        name: 'Public Infrastructure',
        children: [
          { name: 'Roads & Bridges' },
          { name: 'Street Lighting' },
          { name: 'Water Supply' },
          { name: 'Public Transport' }
        ]
      },
      {
        name: 'Public Health',
        children: [
          { name: 'Waste Management' },
          { name: 'Hospitals & Clinics' },
          { name: 'Sanitation' }
        ]
      },
      {
        name: 'Welfare Schemes',
        children: [
          { name: 'Pension' },
          { name: 'Ration Cards' },
          { name: 'Housing' }
        ]
      },
      {
        name: 'Administrative',
        children: [
          { name: 'Certificate Delays' },
          { name: 'Land Records' },
          { name: 'Taxation' }
        ]
      },
      {
        name: 'Law & Order',
        children: [
          { name: 'Police' },
          { name: 'Traffic' },
          { name: 'Fire & Safety' }
        ]
      }
    ]
  }
];

const insertTreeItems = async (connection, items, key, module, subCategory, status, parentId = null) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = item.name || item.label || '';
    const value = item.value || label;
    const sortOrder = item.sort_order !== undefined ? item.sort_order : (i + 1) * 10;

    const [result] = await connection.query(
      `INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, parent_id, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [key, module, subCategory || null, label, value, parentId, sortOrder, status]
    );

    const newId = result.insertId;

    if (item.children && Array.isArray(item.children) && item.children.length > 0) {
      await insertTreeItems(connection, item.children, key, module, subCategory, status, newId);
    }
  }
};

async function runSeed() {
  const connection = await pool.getConnection();
  try {
    for (const data of seedData) {
      const [[existing]] = await connection.query('SELECT id FROM mla_dropdown_lists WHERE `key` = ? LIMIT 1', [data.key]);
      if (existing) {
        console.log(`Key ${data.key} already exists, skipping...`);
        continue;
      }
      console.log(`Seeding ${data.key}...`);
      await insertTreeItems(connection, data.items, data.key, data.module, data.sub_category, 'Active');
    }
    console.log('Seeding system categories complete!');
  } catch (err) {
    console.error(err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runSeed();
