import db from './configs/db.js';

async function run() {
  try {
    // 1. Insert Kothamangalam Block
    const [blockRes] = await db.query(`INSERT INTO local_bodies (name, description, population, area) VALUES ('Kothamangalam Block', 'Kothamangalam Block Panchayat', '100000', '100')`);
    const blockId = blockRes.insertId;

    // 2. Insert Ernakulam District
    const [distRes] = await db.query(`INSERT INTO local_bodies (name, description, population, area) VALUES ('Ernakulam District', 'Ernakulam District Panchayat', '1000000', '1000')`);
    const distId = distRes.insertId;

    // 3. Update the recently created members to point to these new local bodies
    await db.query(`UPDATE governing_representatives SET local_body_id = ? WHERE governing_body_type = 'BLOCK_PANCHAYAT'`, [blockId]);
    await db.query(`UPDATE governing_representatives SET local_body_id = ? WHERE governing_body_type = 'DISTRICT_PANCHAYAT'`, [distId]);

    console.log('Successfully added Block/District local bodies and migrated members.');
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
