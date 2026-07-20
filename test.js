import 'dotenv/config';
import db from './configs/db.js';

async function test() {
  try {
    const [rows] = await db.query('SHOW COLUMNS FROM governing_representatives');
    console.log(rows.filter(r => r.Field.includes('whatsapp')));
    
    const [reps] = await db.query('SELECT * FROM governing_representatives LIMIT 5');
    console.log(reps.map(r => ({ id: r.id, name: r.name, whatsapp_number: r.whatsapp_number })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
