import pool from './configs/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function seedProjectStatusDropdown() {
    try {
        console.log('--- Seeding Project Status Dropdown Options ---');
        
        const statuses = [
            { label: 'In Progress', value: 'In Progress', color: '#f59e0b', sort_order: 1 },
            { label: 'Completed',   value: 'Completed',   color: '#16a34a', sort_order: 2 },
            { label: 'Upcoming',    value: 'Upcoming',    color: '#3b82f6', sort_order: 3 },
            { label: 'On Hold',     value: 'On Hold',     color: '#6b7280', sort_order: 4 },
            { label: 'Active',      value: 'Active',      color: '#10b981', sort_order: 5 },
            { label: 'Dropped',     value: 'Dropped',     color: '#dc2626', sort_order: 6 },
        ];

        for (const st of statuses) {
            const [rows] = await pool.query(
                'SELECT id FROM mla_dropdown_lists WHERE `key` = ? AND value = ?',
                ['project_status', st.value]
            );

            if (rows.length === 0) {
                await pool.query(
                    `INSERT INTO mla_dropdown_lists (\`key\`, \`module\`, \`sub_category\`, \`label\`, \`value\`, \`color\`, \`sort_order\`, \`status\`)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['project_status', 'Projects', 'Status Labels', st.label, st.value, st.color, st.sort_order, 'Active']
                );
                console.log(`+ Inserted status: ${st.label}`);
            } else {
                await pool.query(
                    `UPDATE mla_dropdown_lists SET \`module\` = ?, \`color\` = ?, \`sort_order\` = ? WHERE id = ?`,
                    ['Projects', st.color, st.sort_order, rows[0].id]
                );
                console.log(`✓ Updated status: ${st.label}`);
            }
        }

        console.log('✅ Project Status dropdown options seeded successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

seedProjectStatusDropdown();
