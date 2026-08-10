import pool from '../configs/db.js';

async function updateEmailTemplates() {
  try {
    const newContent = `Hi {name},\n\nYour {module} Update: {date}\nTracking ID: {reference_no}\nStatus: {status}\n\nOffice of Kothamangalam MLA`;
    const newSubject = `Update on your {module} [{reference_no}]`;

    const [result] = await pool.query(
      `UPDATE message_templates 
       SET content = ?, subject = ? 
       WHERE type = 'email'`,
      [newContent, newSubject]
    );

    console.log(`✅ Updated ${result.affectedRows} email template(s) in message_templates table.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update email templates in DB:', err.message);
    process.exit(1);
  }
}

updateEmailTemplates();
