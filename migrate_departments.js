import pool from './configs/db.js';

async function migrate() {
    const connection = await pool.getConnection();
    try {
        console.log('Starting migration...');
        const tables = ['complaints', 'issues', 'ideas', 'suggestions'];

        for (const table of tables) {
            console.log(`Processing table: ${table}`);
            
            // 1. Get the foreign key name
            const [fks] = await connection.query(`
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = 'department_id'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [table]);

            if (fks.length > 0) {
                const fkName = fks[0].CONSTRAINT_NAME;
                console.log(`Dropping FK ${fkName} on ${table}...`);
                await connection.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${fkName}`);
            }

            // 2. Fetch the current data to map department_id to department name
            const [rows] = await connection.query(`
                SELECT t.id, d.name 
                FROM ${table} t
                JOIN departments d ON t.department_id = d.id
                WHERE t.department_id IS NOT NULL
            `);

            // 3. Alter the column type to VARCHAR
            console.log(`Altering department_id to department VARCHAR(255) in ${table}...`);
            await connection.query(`ALTER TABLE ${table} CHANGE department_id department VARCHAR(255) DEFAULT NULL`);

            // 4. Update the rows with the department names
            if (rows.length > 0) {
                console.log(`Updating ${rows.length} rows in ${table} with department names...`);
                for (const row of rows) {
                    await connection.query(`UPDATE ${table} SET department = ? WHERE id = ?`, [row.name, row.id]);
                }
            }
            console.log(`Table ${table} migration complete.\n`);
        }

        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrate();
