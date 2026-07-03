import pool from './configs/db.js';

// ─────────────────────────────────────────────────────────────
//  Helper: build nested recursive tree from flat rows
//  Returns array of root items, each with a `children` array.
// ─────────────────────────────────────────────────────────────
function buildTree(rows) {
    const map = {};
    rows.forEach(r => { map[r.id] = { ...r, children: [] }; });
    const roots = [];
    rows.forEach(r => {
        if (r.parent_id && map[r.parent_id]) {
            map[r.parent_id].children.push(map[r.id]);
        } else {
            roots.push(map[r.id]);
        }
    });
    return roots;
}

async function migrate() {
    try {
        // ── 1. Create table ───────────────────────────────────
        console.log('Creating mla_dropdown_lists table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mla_dropdown_lists (
                id           INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
                \`key\`      VARCHAR(100)   NOT NULL COMMENT 'e.g. complaint_priority, idea_status, complaint_category',
                module       VARCHAR(80)    NOT NULL COMMENT 'e.g. Complaints, Ideas, Issues, Suggestions, System',
                sub_category VARCHAR(80)    DEFAULT NULL COMMENT 'e.g. Form Fields, Status Labels, Categories',
                label        VARCHAR(150)   NOT NULL COMMENT 'Display name shown in UI',
                value        VARCHAR(150)   NOT NULL COMMENT 'Stored value in records',
                parent_id    INT UNSIGNED   DEFAULT NULL COMMENT 'Supports unlimited nesting via self-reference',
                color        VARCHAR(30)    DEFAULT NULL COMMENT 'Optional badge/indicator color (hex or CSS)',
                icon         VARCHAR(60)    DEFAULT NULL COMMENT 'Optional lucide icon name',
                sort_order   INT            DEFAULT 0,
                status       ENUM('Active', 'Disabled') DEFAULT 'Active',
                created_at   DATETIME       DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                FOREIGN KEY (parent_id) REFERENCES mla_dropdown_lists(id) ON DELETE CASCADE,
                INDEX idx_key_module (\`key\`, module),
                INDEX idx_parent (parent_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Table created.');

        // ── 2. Seed function ──────────────────────────────────
        const insert = async (row) => {
            const [res] = await pool.query(
                `INSERT IGNORE INTO mla_dropdown_lists
                    (\`key\`, module, sub_category, label, value, parent_id, color, sort_order, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.key, row.module, row.subCategory ?? null,
                    row.label, row.value, row.parentId ?? null,
                    row.color ?? null, row.sortOrder ?? 0, row.status ?? 'Active'
                ]
            );
            return res.insertId;
        };

        console.log('Seeding dropdown options...');

        // ── 3. Priority — Shared base (per-module keys) ───────
        const priorityModules = [
            { key: 'complaint_priority', module: 'Complaints' },
            { key: 'issue_priority',     module: 'Issues'     },
            { key: 'idea_priority',      module: 'Ideas'      },
            { key: 'suggestion_priority',module: 'Suggestions'},
        ];

        const priorityOptions = [
            { label: 'Low',      value: 'Low',      color: '#6b7280', sortOrder: 1 },
            { label: 'Medium',   value: 'Medium',   color: '#3b82f6', sortOrder: 2 },
            { label: 'High',     value: 'High',     color: '#f59e0b', sortOrder: 3 },
            { label: 'Critical', value: 'Critical', color: '#dc2626', sortOrder: 4 },
        ];

        for (const mod of priorityModules) {
            for (const opt of priorityOptions) {
                await insert({ ...mod, subCategory: 'Form Fields', ...opt });
            }
        }
        console.log('✓ Priority options seeded.');

        // ── 4. Status — Complaints & Issues (same lifecycle) ──
        const complaintIssueStatuses = [
            { label: 'Pending',       value: 'Pending',       color: '#f59e0b', sortOrder: 1 },
            { label: 'Under Process', value: 'Under Process', color: '#3b82f6', sortOrder: 2 },
            { label: 'Not Attended',  value: 'Not Attended',  color: '#dc2626', sortOrder: 3 },
            { label: 'Resolved',      value: 'Resolved',      color: '#16a34a', sortOrder: 4 },
            { label: 'Escalated',     value: 'Escalated',     color: '#8b5cf6', sortOrder: 5 },
        ];

        for (const opt of complaintIssueStatuses) {
            await insert({ key: 'complaint_status', module: 'Complaints', subCategory: 'Status Labels', ...opt });
            await insert({ key: 'issue_status',     module: 'Issues',     subCategory: 'Status Labels', ...opt });
        }

        // ── 5. Status — Ideas & Suggestions (different lifecycle) ─
        const ideaSuggestionStatuses = [
            { label: 'Pending',      value: 'Pending',      color: '#f59e0b', sortOrder: 1 },
            { label: 'Under Review', value: 'Under Review', color: '#3b82f6', sortOrder: 2 },
            { label: 'Approved',     value: 'Approved',     color: '#16a34a', sortOrder: 3 },
            { label: 'Rejected',     value: 'Rejected',     color: '#dc2626', sortOrder: 4 },
            { label: 'Implemented',  value: 'Implemented',  color: '#8b5cf6', sortOrder: 5 },
        ];

        for (const opt of ideaSuggestionStatuses) {
            await insert({ key: 'idea_status',       module: 'Ideas',       subCategory: 'Status Labels', ...opt });
            await insert({ key: 'suggestion_status', module: 'Suggestions', subCategory: 'Status Labels', ...opt });
        }
        console.log('✓ Status options seeded.');

        // ── 6. Categories — migrate from complaint_categories ─
        console.log('Migrating categories from existing tables...');

        // Complaints categories (from complaint_categories table)
        let [ccRows] = await pool.query('SELECT * FROM complaint_categories ORDER BY id ASC');
        if (ccRows.length === 0) {
            // Default fallback
            ccRows = [
                { name: 'Road & Transport' }, { name: 'Water & Sanitation' },
                { name: 'Electricity' },       { name: 'Public Safety' },
                { name: 'Health' },            { name: 'Education' },
                { name: 'Infrastructure' },    { name: 'Environment' },
                { name: 'Other' },
            ];
        }
        let so = 1;
        for (const cat of ccRows) {
            await insert({
                key: 'complaint_category', module: 'Complaints',
                subCategory: 'Categories', label: cat.name, value: cat.name, sortOrder: so++,
                status: cat.status === 'Inactive' ? 'Disabled' : 'Active',
            });
        }
        console.log(`✓ ${ccRows.length} complaint categories migrated.`);

        // Ideas categories — reuse complaint categories as defaults (same taxonomy)
        so = 1;
        for (const cat of ccRows) {
            await insert({
                key: 'idea_category', module: 'Ideas',
                subCategory: 'Categories', label: cat.name, value: cat.name, sortOrder: so++,
                status: cat.status === 'Inactive' ? 'Disabled' : 'Active',
            });
        }

        // Issues categories
        so = 1;
        for (const cat of ccRows) {
            await insert({
                key: 'issue_category', module: 'Issues',
                subCategory: 'Categories', label: cat.name, value: cat.name, sortOrder: so++,
                status: cat.status === 'Inactive' ? 'Disabled' : 'Active',
            });
        }

        // Suggestions categories
        so = 1;
        for (const cat of ccRows) {
            await insert({
                key: 'suggestion_category', module: 'Suggestions',
                subCategory: 'Categories', label: cat.name, value: cat.name, sortOrder: so++,
                status: cat.status === 'Inactive' ? 'Disabled' : 'Active',
            });
        }
        console.log('✓ All module categories migrated.');

        // ── 7. Summary ────────────────────────────────────────
        const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM mla_dropdown_lists');
        console.log(`\n✅ Migration complete. Total rows in mla_dropdown_lists: ${total}`);

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
