import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting Phase 1 migration for Other Offices...');

        // 1.1 Add missing columns and 1.2 Change notes column to TEXT
        console.log('Altering governing_representatives table...');
        
        const alterQueries = [
            'ALTER TABLE governing_representatives ADD COLUMN officer_email VARCHAR(255)',
            'ALTER TABLE governing_representatives ADD COLUMN services JSON',
            'ALTER TABLE governing_representatives ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0',
            'ALTER TABLE governing_representatives ADD COLUMN deleted_at DATETIME NULL',
            'ALTER TABLE governing_representatives MODIFY COLUMN notes TEXT'
        ];

        for (const q of alterQueries) {
            try {
                await pool.query(q);
                console.log(`Executed: ${q}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column already exists, skipping: ${q}`);
                } else {
                    console.error(`Error executing: ${q}`, err.message);
                }
            }
        }

        // 1.3 Seed "Other Office" designations
        console.log('Seeding Other Office designations...');
        const roles = [
            'Medical Superintendent', 'Block Development Officer',
            'Municipal Secretary', 'Circle Inspector',
            'Sub-Registrar', 'Tahsildar'
        ];

        for (let i = 0; i < roles.length; i++) {
            const role = roles[i];
            
            const [existing] = await pool.query(
                'SELECT id FROM mla_dropdown_lists WHERE `key` = ? AND value = ?',
                ['governing_designation', role]
            );

            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO mla_dropdown_lists 
                    (\`key\`, module, sub_category, label, value, sort_order, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'governing_designation',
                        'Governing Bodies',
                        'System-wide',
                        role,
                        role,
                        100 + i, // use a high sort_order to append them
                        'Active'
                    ]
                );
                console.log(`Inserted Designation: ${role}`);
            } else {
                console.log(`Already exists Designation: ${role}`);
            }
        }

        console.log('Phase 1 Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
