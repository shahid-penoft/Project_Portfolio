import pool from '../configs/db.js';

const mainRoles = [
    'President',
    'Vice President',
    'Ward Member',
    'Councilor',
    'Chairperson',
    'Vice Chairperson',
    'Block Member',
    'Standing Committee Chairman',
    'District Panchayat Member'
];

const additionalRoles = [
    'Finance Standing Committee Chairman',
    'Development Standing Committee Chairman',
    'Welfare Standing Committee Chairman',
    'Health and Education Standing Committee Chairman',
    'Member, Finance Standing Committee',
    'Member, Development Standing Committee',
    'Member, Welfare Standing Committee',
    'Member, Health and Education Standing Committee'
];

const seedDropdowns = async () => {
    console.log('Starting seed for governing bodies dropdowns...');

    try {
        // Seed main designations
        for (let i = 0; i < mainRoles.length; i++) {
            const role = mainRoles[i];
            
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
                        i + 1,
                        'Active'
                    ]
                );
                console.log(`Inserted Main Designation: ${role}`);
            } else {
                console.log(`Already exists Main Designation: ${role}`);
            }
        }

        // Seed additional roles
        for (let i = 0; i < additionalRoles.length; i++) {
            const role = additionalRoles[i];
            
            const [existing] = await pool.query(
                'SELECT id FROM mla_dropdown_lists WHERE `key` = ? AND value = ?',
                ['governing_additional_roles', role]
            );

            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO mla_dropdown_lists 
                    (\`key\`, module, sub_category, label, value, sort_order, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'governing_additional_roles',
                        'Governing Bodies',
                        'System-wide',
                        role,
                        role,
                        i + 1,
                        'Active'
                    ]
                );
                console.log(`Inserted Additional Role: ${role}`);
            } else {
                console.log(`Already exists Additional Role: ${role}`);
            }
        }
        
        console.log('Seed completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
};

seedDropdowns();
