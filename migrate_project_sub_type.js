import pool from './configs/db.js';
import dotenv from 'dotenv';
dotenv.config();

const subtypes = [
    { value: 'MP Projects', label: 'MP Projects', sort_order: 1 },
    { value: 'Ministerial Projects', label: 'Ministerial Projects', sort_order: 2 },
    { value: 'Panchayat Projects', label: 'Panchayat Projects', sort_order: 3 },
    { value: 'Municipality Projects', label: 'Municipality Projects', sort_order: 4 },
    { value: 'Central Govt Projects', label: 'Central Govt Projects', sort_order: 5 },
    { value: 'State Govt Projects', label: 'State Govt Projects', sort_order: 6 },
    { value: 'Party Projects', label: 'Party Projects', sort_order: 7 },
    { value: 'Special Projects', label: 'Special Projects', sort_order: 8 }
];

async function migrate() {
    try {
        console.log('Connecting to database...');
        
        // 1. Add project_sub_type column if it doesn't exist
        try {
            await pool.query('ALTER TABLE projects ADD COLUMN project_sub_type VARCHAR(100) NULL AFTER project_type');
            console.log('✅ Added project_sub_type column to projects table.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️ project_sub_type column already exists. Skipping...');
            } else {
                throw e;
            }
        }

        // 2. Seed dropdown options for 'project_sub_type_portfolio'
        const key = 'project_sub_type_portfolio';
        const module = 'Projects';
        
        for (const subtype of subtypes) {
            const [rows] = await pool.query('SELECT id FROM mla_dropdown_lists WHERE `key` = ? AND value = ?', [key, subtype.value]);
            if (rows.length === 0) {
                await pool.query(
                    'INSERT INTO mla_dropdown_lists (`key`, `module`, `label`, `value`, `sort_order`) VALUES (?, ?, ?, ?, ?)',
                    [key, module, subtype.label, subtype.value, subtype.sort_order]
                );
                console.log(`✅ Seeded subtype: ${subtype.value}`);
            } else {
                console.log(`⚠️ Subtype ${subtype.value} already exists.`);
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
