import pool from './configs/db.js';

async function test() {
    const title = 'test';
    const category = 'test cat';
    const priority = 'Medium';
    const status = 'Pending';
    const description = 'test desc';
    const location = 'loc';
    const address = 'add';
    const internal_note = 'note';
    const complainant_name = 'comp';
    const phone = 'phone';
    const alternative_phone = 'alt';
    const email = 'email';
    const local_body_id = null;
    const ward_id = null;
    const department = 'New Dept 1, New Dept 2';
    const date_filed = '2026-07-19';
    const id = 1;

    try {
        const [result] = await pool.query(`
            UPDATE suggestions SET
              title = COALESCE(?, title),
              category = COALESCE(?, category),
              priority = COALESCE(?, priority),
              status = COALESCE(?, status),
              description = COALESCE(?, description),
              location = COALESCE(?, location),
              address = COALESCE(?, address),
              internal_note = COALESCE(?, internal_note),
              complainant_name = COALESCE(?, complainant_name),
              phone = COALESCE(?, phone),
              alternative_phone = COALESCE(?, alternative_phone),
              email = COALESCE(?, email),
              local_body_id = COALESCE(?, local_body_id),
              ward_id = COALESCE(?, ward_id),
              department = COALESCE(?, department),
              date_filed = COALESCE(?, date_filed)
            WHERE id = ?
        `, [
            title, category, priority, status, description, location, address, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed, id,
        ]);
        console.log('Update result:', result);

        const [[suggestion]] = await pool.query('SELECT department FROM suggestions WHERE id = 1');
        console.log('Updated suggestion:', suggestion);
    } catch(e) { console.error(e); }
    process.exit(0);
}

test();
