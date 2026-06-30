import fs from 'fs';
import path from 'path';
import pool from './configs/db.js';

const runMigration = async () => {
    try {
        const sql = fs.readFileSync(path.join(process.cwd(), 'schema_issues.sql'), 'utf8');
        
        // pool.query doesn't support multiple statements by default unless multipleStatements: true is set in createPool
        // We can split by ';' and execute one by one
        const statements = sql.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            console.log(`Executing: ${stmt.substring(0, 50)}...`);
            await pool.query(stmt);
        }
        
        console.log('Successfully created issues tables!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

runMigration();
