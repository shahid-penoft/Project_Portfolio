import pool from './configs/db.js';

async function seed() {
  try {
    const [rows] = await pool.query("DESCRIBE mla_letters");
    const idRow = rows.find(r => r.Field === 'id');
    console.log('mla_letters.id type:', idRow.Type);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mla_letter_attachments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        letter_id ${idRow.Type} NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) DEFAULT 'attachment',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (letter_id) REFERENCES mla_letters(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Created mla_letter_attachments successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
