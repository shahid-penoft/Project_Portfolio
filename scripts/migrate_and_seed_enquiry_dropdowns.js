import pool from '../configs/db.js';

async function migrateAndSeed() {
  const connection = await pool.getConnection();
  try {
    console.log('Starting Enquiries migration and dropdown seeding...');

    // 1. Alter status column from ENUM to VARCHAR(100)
    console.log('Altering contact_enquiries.status to VARCHAR(100)...');
    await connection.query(`
      ALTER TABLE contact_enquiries 
      MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'New'
    `);

    // 2. Standardize casing for existing statuses
    console.log('Standardizing existing status values...');
    await connection.query(`UPDATE contact_enquiries SET status = 'New' WHERE status = 'new'`);
    await connection.query(`UPDATE contact_enquiries SET status = 'Read' WHERE status = 'read'`);
    await connection.query(`UPDATE contact_enquiries SET status = 'Resolved' WHERE status = 'resolved'`);

    // 3. Alter category column from ENUM to VARCHAR(100)
    console.log('Altering contact_enquiries.category to VARCHAR(100)...');
    await connection.query(`
      ALTER TABLE contact_enquiries 
      MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'General'
    `);

    // Standardize category values to title case
    await connection.query(`UPDATE contact_enquiries SET category = 'General' WHERE LOWER(category) = 'general'`);
    await connection.query(`UPDATE contact_enquiries SET category = 'Membership' WHERE LOWER(category) = 'membership'`);
    await connection.query(`UPDATE contact_enquiries SET category = 'Local Issues' WHERE LOWER(category) = 'local issues'`);
    await connection.query(`UPDATE contact_enquiries SET category = 'Submit Ideas' WHERE LOWER(category) = 'submit ideas'`);
    await connection.query(`UPDATE contact_enquiries SET category = 'Submit Opinions' WHERE LOWER(category) = 'submit opinions'`);

    // 4. Add composite index on status and created_at if not exists
    console.log('Adding index idx_enquiries_status_created...');
    const [existingIndexes] = await connection.query(`SHOW INDEX FROM contact_enquiries WHERE Key_name = 'idx_enquiries_status_created'`);
    if (existingIndexes.length === 0) {
      await connection.query(`
        ALTER TABLE contact_enquiries 
        ADD INDEX idx_enquiries_status_created (status, created_at)
      `);
      console.log('✓ Index idx_enquiries_status_created created.');
    } else {
      console.log('Index idx_enquiries_status_created already exists.');
    }

    // 5. Seed default dropdowns into mla_dropdown_lists
    console.log('Seeding enquiry_status options into mla_dropdown_lists...');
    const defaultStatuses = [
      { label: 'New', value: 'New', color: 'slate', is_default: 1, sort_order: 1 },
      { label: 'Read', value: 'Read', color: 'blue', is_default: 0, sort_order: 2 },
      { label: 'In Progress', value: 'In Progress', color: 'amber', is_default: 0, sort_order: 3 },
      { label: 'Resolved', value: 'Resolved', color: 'green', is_default: 0, sort_order: 4 },
      { label: 'Closed', value: 'Closed', color: 'gray', is_default: 0, sort_order: 5 },
    ];

    for (const s of defaultStatuses) {
      const [existing] = await connection.query(
        `SELECT id FROM mla_dropdown_lists WHERE \`key\` = 'enquiry_status' AND value = ? LIMIT 1`,
        [s.value]
      );
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, color, sort_order, is_default, status)
           VALUES ('enquiry_status', 'Enquiries', 'Status Labels', ?, ?, ?, ?, ?, 'Active')`,
          [s.label, s.value, s.color, s.sort_order, s.is_default]
        );
        console.log(`✓ Seeded enquiry_status: ${s.label}`);
      }
    }

    console.log('Seeding enquiry_category options into mla_dropdown_lists...');
    const defaultCategories = [
      { label: 'General', value: 'General', is_default: 1, sort_order: 1 },
      { label: 'Membership', value: 'Membership', is_default: 0, sort_order: 2 },
      { label: 'Local Issues', value: 'Local Issues', is_default: 0, sort_order: 3 },
      { label: 'Submit Ideas', value: 'Submit Ideas', is_default: 0, sort_order: 4 },
      { label: 'Submit Opinions', value: 'Submit Opinions', is_default: 0, sort_order: 5 },
      { label: 'Other', value: 'Other', is_default: 0, sort_order: 6 },
    ];

    for (const c of defaultCategories) {
      const [existing] = await connection.query(
        `SELECT id FROM mla_dropdown_lists WHERE \`key\` = 'enquiry_category' AND value = ? LIMIT 1`,
        [c.value]
      );
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, sort_order, is_default, status)
           VALUES ('enquiry_category', 'Enquiries', 'Categories', ?, ?, ?, ?, 'Active')`,
          [c.label, c.value, c.sort_order, c.is_default]
        );
        console.log(`✓ Seeded enquiry_category: ${c.label}`);
      }
    }

    console.log('All migrations and seedings completed successfully!');
  } catch (err) {
    console.error('Error during migration and seeding:', err);
    throw err;
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrateAndSeed();
