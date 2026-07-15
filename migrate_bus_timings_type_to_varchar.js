import pool from './configs/db.js';

async function migrate() {
    try {
        console.log('Altering bus_timings table...');
        await pool.query(`
            ALTER TABLE bus_timings 
            MODIFY COLUMN type VARCHAR(255) NOT NULL;
        `);
        console.log('✓ Column type changed to VARCHAR(255).');

        console.log('Seeding Bus Types into mla_dropdown_lists...');
        
        const insert = async (row) => {
            const [res] = await pool.query(
                `INSERT IGNORE INTO mla_dropdown_lists
                    (\`key\`, module, sub_category, label, value, color, sort_order, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.key, row.module, row.subCategory ?? null,
                    row.label, row.value,
                    row.color ?? null, row.sortOrder ?? 0, row.status ?? 'Active'
                ]
            );
            return res.insertId;
        };

        const busTypes = [
            { label: 'KSRTC', value: 'KSRTC', color: 'success', sortOrder: 1 },
            { label: 'Private', value: 'Private', color: 'info', sortOrder: 2 },
            { label: 'Other State Gov', value: 'Other State Gov', color: 'warning', sortOrder: 3 }
        ];

        for (const type of busTypes) {
            await insert({
                key: 'bus_type',
                module: 'Website',
                subCategory: 'Bus Timings',
                ...type
            });
        }
        
        console.log('✓ Bus types seeded into dropdown lists.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
