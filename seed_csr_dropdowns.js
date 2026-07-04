import pool from './configs/db.js';

async function seedCSRDropdowns() {
    try {
        console.log('Seeding CSR Dropdown options...');

        const insert = async (row) => {
            const [res] = await pool.query(
                `INSERT IGNORE INTO mla_dropdown_lists
                    (\`key\`, module, sub_category, label, value, parent_id, sort_order, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.key, row.module, row.subCategory ?? null,
                    row.label, row.value, row.parentId ?? null,
                    row.sortOrder ?? 0, row.status ?? 'Active'
                ]
            );
            return res.insertId;
        };

        const moduleName = 'CSR';

        // 1. CSR Focus Domains
        const domains = [
            'Education & Skill', 'Health & Sanitation', 'Environment', 
            'Women Empowerment', 'Infrastructure', 'Others'
        ];
        for (let i = 0; i < domains.length; i++) {
            await insert({
                key: 'csr_focus_domain', module: moduleName, subCategory: 'Focus Domains',
                label: domains[i], value: domains[i], sortOrder: i + 1
            });
        }
        console.log('✓ CSR Focus Domains seeded.');

        // 2. CSR Status
        const statuses = [
            'Active', 'In Discussion', 'Proposal Sent', 'Approved', 
            'Funding Received', 'Project Running', 'Completed', 'Inactive'
        ];
        for (let i = 0; i < statuses.length; i++) {
            await insert({
                key: 'csr_status', module: moduleName, subCategory: 'Status',
                label: statuses[i], value: statuses[i], sortOrder: i + 1
            });
        }
        console.log('✓ CSR Status seeded.');

        // 3. CSR Org Type
        const orgTypes = ['Corporate', 'PSU', 'Trust/NGO', 'MSME', 'Other'];
        for (let i = 0; i < orgTypes.length; i++) {
            await insert({
                key: 'csr_org_type', module: moduleName, subCategory: 'Organisation Types',
                label: orgTypes[i], value: orgTypes[i], sortOrder: i + 1
            });
        }
        console.log('✓ CSR Organisation Types seeded.');

        // 4. CSR Report Type
        const reportTypes = ['Utilisation', 'Progress', 'Completion', 'Annual', 'Impact', 'Proposal', 'Quarterly', 'Audit'];
        for (let i = 0; i < reportTypes.length; i++) {
            await insert({
                key: 'csr_report_type', module: moduleName, subCategory: 'Report Types',
                label: reportTypes[i], value: reportTypes[i], sortOrder: i + 1
            });
        }
        console.log('✓ CSR Report Types seeded.');

        // 5. CSR Follow-up Type
        const followupTypes = ['Call', 'Meeting', 'Email', 'Site Visit', 'Other'];
        for (let i = 0; i < followupTypes.length; i++) {
            await insert({
                key: 'csr_followup_type', module: moduleName, subCategory: 'Follow-up Types',
                label: followupTypes[i], value: followupTypes[i], sortOrder: i + 1
            });
        }
        console.log('✓ CSR Follow-up Types seeded.');

        // 6. State and District
        const statesData = [
            {
                name: 'Kerala',
                districts: ['Ernakulam', 'Thrissur', 'Thiruvananthapuram', 'Kozhikode', 'Kottayam', 'Alappuzha', 'Kollam']
            },
            {
                name: 'Karnataka',
                districts: ['Bengaluru Urban', 'Mysuru', 'Dakshina Kannada']
            },
            {
                name: 'Tamil Nadu',
                districts: ['Chennai', 'Coimbatore', 'Madurai']
            }
        ];

        let stateOrder = 1;
        for (const state of statesData) {
            const stateId = await insert({
                key: 'state_district', module: moduleName, subCategory: 'States',
                label: state.name, value: state.name, sortOrder: stateOrder++
            });

            if (stateId) {
                let districtOrder = 1;
                for (const district of state.districts) {
                    await insert({
                        key: 'state_district', module: moduleName, subCategory: 'Districts',
                        label: district, value: district, parentId: stateId, sortOrder: districtOrder++
                    });
                }
            } else {
                // If IGNORE bypassed insertion, it might already exist. We should fetch its ID.
                const [existing] = await pool.query(
                    'SELECT id FROM mla_dropdown_lists WHERE \`key\` = ? AND module = ? AND value = ?',
                    ['state_district', moduleName, state.name]
                );
                if (existing.length > 0) {
                    const existingStateId = existing[0].id;
                    let districtOrder = 1;
                    for (const district of state.districts) {
                        await insert({
                            key: 'state_district', module: moduleName, subCategory: 'Districts',
                            label: district, value: district, parentId: existingStateId, sortOrder: districtOrder++
                        });
                    }
                }
            }
        }
        console.log('✓ States and Districts seeded.');

        const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM mla_dropdown_lists WHERE module = ?', [moduleName]);
        console.log(`\n✅ CSR Dropdown seeding complete. Total CSR rows: ${total}`);

    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        process.exit();
    }
}

seedCSRDropdowns();
