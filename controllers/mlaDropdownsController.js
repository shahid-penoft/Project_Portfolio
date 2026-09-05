import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CASCADE_MAP — shared constant for all cascade-aware operations
//  Maps each dropdown key to the consuming table and column.
//  deletedCol: the soft-delete flag column name used in that table.
// ─────────────────────────────────────────────────────────────────────────────
const CASCADE_MAP = {
    // Shared System-wide Category (Complaints, Issues, Ideas, Suggestions)
    system_category: [
        { table: 'complaints', col: 'category', module: 'Complaints', deletedCol: 'is_deleted' },
        { table: 'issues', col: 'category', module: 'Public Issues', deletedCol: 'is_deleted' },
        { table: 'ideas', col: 'category', module: 'Ideas', deletedCol: 'is_deleted' },
        { table: 'suggestions', col: 'category', module: 'Suggestions', deletedCol: 'is_deleted' },
    ],
    // Complaints
    complaint_priority: { table: 'complaints', col: 'priority', module: 'Complaints', deletedCol: 'is_deleted' },
    complaint_status: { table: 'complaints', col: 'status', module: 'Complaints', deletedCol: 'is_deleted' },
    // Issues
    issue_priority: { table: 'issues', col: 'priority', module: 'Issues', deletedCol: 'is_deleted' },
    issue_status: { table: 'issues', col: 'status', module: 'Issues', deletedCol: 'is_deleted' },
    // Ideas
    idea_priority: { table: 'ideas', col: 'priority', module: 'Ideas', deletedCol: 'is_deleted' },
    idea_status: { table: 'ideas', col: 'status', module: 'Ideas', deletedCol: 'is_deleted' },
    // Suggestions
    suggestion_priority: { table: 'suggestions', col: 'priority', module: 'Suggestions', deletedCol: 'is_deleted' },
    suggestion_status: { table: 'suggestions', col: 'status', module: 'Suggestions', deletedCol: 'is_deleted' },
    // CSR
    csr_status: { table: 'csr_organisations', col: 'status', module: 'CSR', deletedCol: 'deleted' },
    csr_org_type: { table: 'csr_organisations', col: 'type', module: 'CSR', deletedCol: 'deleted' },
    csr_followup_type: { table: 'csr_followups', col: 'type', module: 'CSR', deletedCol: null },
    csr_report_type: { table: 'csr_reports', col: 'type', module: 'CSR', deletedCol: null },
    // Projects
    project_sub_type_portfolio: { table: 'projects', col: 'project_sub_type', module: 'Projects', deletedCol: null },
    // CM Funds
    cm_fund_category: { table: 'cm_fund_requests', col: 'category', module: 'CM Funds', deletedCol: 'is_deleted' },
    cmfund_status: { table: 'cm_fund_requests', col: 'status', module: 'CM Funds', deletedCol: 'is_deleted' },
    cm_fund_district: { table: 'cm_fund_requests', col: 'district', module: 'CM Funds', deletedCol: 'is_deleted' },
    cm_fund_recommender: { table: 'cm_fund_requests', col: 'recommended_by', module: 'CM Funds', deletedCol: 'is_deleted' },
    // Governing Bodies
    governing_designation: { table: 'governing_body_staffs', col: 'designation', module: 'Governing Bodies', deletedCol: null },
    governing_additional_roles: { table: 'governing_representatives', col: 'additional_roles', module: 'Governing Bodies', deletedCol: 'is_deleted', isJson: true },
    // Information Center
    information_center_domain: { table: 'information_posts', col: 'domains', module: 'Information Center', deletedCol: null, isJson: true },
    // CSR (Additional)
    csr_focus_domain: { table: 'csr_organisations', col: 'domains', module: 'CSR', deletedCol: 'deleted', isJson: true },
    // Generics (Used globally but tracked where most critical)
    state_district: { table: 'local_bodies', col: 'district', module: 'System', deletedCol: null },
    // Enquiries
    enquiry_status: { table: 'contact_enquiries', col: 'status', module: 'Enquiries', deletedCol: 'is_deleted' },
    enquiry_category: { table: 'contact_enquiries', col: 'category', module: 'Enquiries', deletedCol: 'is_deleted' },
};

export function getCascadeMappings(key) {
    const raw = CASCADE_MAP[key];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: normalize module name aliases to DB canonical values
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeModuleName(mod) {
    if (!mod) return mod;
    const lower = mod.trim().toLowerCase();
    if (lower === 'applications' || lower === 'cm_funds' || lower === 'cm-funds' || lower === 'cm funds') {
        return 'CM Funds';
    }
    if (lower === 'issues' || lower === 'public_issues' || lower === 'public-issues' || lower === 'public issues') {
        return 'Issues';
    }
    if (lower === 'complaints') return 'Complaints';
    if (lower === 'ideas') return 'Ideas';
    if (lower === 'suggestions') return 'Suggestions';
    if (lower === 'projects') return 'Projects';
    if (lower === 'csr') return 'CSR';
    if (lower === 'governing bodies' || lower === 'governing-bodies' || lower === 'governing_bodies') return 'Governing Bodies';
    if (lower === 'website' || lower === 'website pages') return 'Website';
    if (lower === 'enquiries' || lower === 'enquiry') return 'Enquiries';
    return mod;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Helper: build unlimited-depth recursive tree from flat rows
// ─────────────────────────────────────────────────────────────────────────────
function buildTree(rows) {
    const map = {};
    rows.forEach(r => { map[r.id] = { ...r, children: [] }; });
    const roots = [];
    rows.forEach(r => {
        const pid = r.parent_id && r.parent_id !== 0 ? r.parent_id : null;
        if (pid && map[pid]) {
            map[pid].children.push(map[r.id]);
        } else {
            roots.push(map[r.id]);
        }
    });
    return roots;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: flatten a tree of items into a simple list of { value, label }
// ─────────────────────────────────────────────────────────────────────────────
function flattenItems(items) {
    const result = [];
    const traverse = (list) => {
        for (const item of list) {
            const label = item.name || item.label || '';
            const value = item.value || label;
            if (value) result.push({ label, value: value.trim(), id: item.id });
            if (item.children?.length) traverse(item.children);
        }
    };
    traverse(items);
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: compute rename and deletion diff between existing DB rows and new items.
//  Matches by DB id when available; falls back to value string matching.
//  Returns: { renames: [{oldValue, newValue}], deletions: [oldValue] }
// ─────────────────────────────────────────────────────────────────────────────
function buildRenameAndDeleteDiff(existingRows, newItems) {
    const flatNew = flattenItems(newItems);

    // Build lookup maps
    const existingById = {};  // id → value
    const existingByVal = {};  // lowerValue → value (original casing)
    for (const row of existingRows) {
        existingById[row.id] = row.value;
        existingByVal[row.value.toLowerCase()] = row.value;
    }

    const newById = {};  // id → value
    const newByVal = {};  // lowerValue → value
    for (const item of flatNew) {
        if (item.id) newById[item.id] = item.value;
        newByVal[item.value.toLowerCase()] = item.value;
    }

    const renames = [];
    const deletions = [];

    // Detect renames: existing id still in new list but with different value
    for (const row of existingRows) {
        const idStr = String(row.id);
        if (newById[idStr] !== undefined) {
            const newVal = newById[idStr];
            if (newVal.toLowerCase() !== row.value.toLowerCase()) {
                renames.push({ oldValue: row.value, newValue: newVal });
            }
        } else {
            // ID not in new list — check if the value itself disappeared entirely
            if (!newByVal[row.value.toLowerCase()]) {
                deletions.push(row.value);
            }
        }
    }

    return { renames, deletions };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: get impact count for a single value in a cascade-mapped table (supports multi-table)
// ─────────────────────────────────────────────────────────────────────────────
async function getCascadeCount(connection, key, value) {
    const mappings = getCascadeMappings(key);
    if (!mappings.length) return 0;
    let totalCount = 0;

    for (const mapping of mappings) {
        const whereDeleted = mapping.deletedCol ? `AND \`${mapping.deletedCol}\` = 0` : '';
        let query, params;
        if (mapping.isJson) {
            query = `SELECT COUNT(*) AS count FROM \`${mapping.table}\` WHERE JSON_CONTAINS(\`${mapping.col}\`, ?) ${whereDeleted}`;
            params = [JSON.stringify(value)];
        } else {
            query = `SELECT COUNT(*) AS count FROM \`${mapping.table}\` WHERE \`${mapping.col}\` = ? ${whereDeleted}`;
            params = [value];
        }

        const [[{ count }]] = await connection.query(query, params);
        totalCount += Number(count);
    }
    return totalCount;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: execute cascade UPDATE for a rename (supports multi-table)
// ─────────────────────────────────────────────────────────────────────────────
async function applyCascadeRename(connection, key, oldValue, newValue) {
    const mappings = getCascadeMappings(key);
    if (!mappings.length) return 0;
    let totalAffected = 0;

    for (const mapping of mappings) {
        const whereDeleted = mapping.deletedCol ? `AND \`${mapping.deletedCol}\` = 0` : '';

        if (mapping.isJson) {
            const [rows] = await connection.query(
                `SELECT id, \`${mapping.col}\` AS jsonCol FROM \`${mapping.table}\` WHERE JSON_CONTAINS(\`${mapping.col}\`, ?) ${whereDeleted}`,
                [JSON.stringify(oldValue)]
            );
            for (const row of rows) {
                let arr = [];
                try {
                    arr = typeof row.jsonCol === 'string' ? JSON.parse(row.jsonCol) : (row.jsonCol || []);
                } catch (e) { continue; }

                if (Array.isArray(arr)) {
                    const updatedArr = arr.map(v => v === oldValue ? newValue : v);
                    await connection.query(
                        `UPDATE \`${mapping.table}\` SET \`${mapping.col}\` = ? WHERE id = ?`,
                        [JSON.stringify(updatedArr), row.id]
                    );
                    totalAffected++;
                }
            }
        } else {
            const [result] = await connection.query(
                `UPDATE \`${mapping.table}\` SET \`${mapping.col}\` = ? WHERE \`${mapping.col}\` = ? ${whereDeleted}`,
                [newValue, oldValue]
            );
            totalAffected += result.affectedRows;
        }
    }
    return totalAffected;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Exported helper: get default value for a dropdown key
//  Used by complaint/issue/idea/suggestion controllers as a DB-driven fallback.
// ─────────────────────────────────────────────────────────────────────────────
export const getDropdownDefault = async (key) => {
    try {
        const [[row]] = await pool.query(
            `SELECT value FROM mla_dropdown_lists
             WHERE \`key\` = ? AND is_default = 1 AND status = 'Active'
             AND IFNULL(parent_id, 0) = 0
             LIMIT 1`,
            [key]
        );
        return row?.value || null;
    } catch {
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: recursively insert items into mla_dropdown_lists
// ─────────────────────────────────────────────────────────────────────────────
const insertTreeItems = async (connection, items, key, module, subCategory, status, parentId = 0) => {
    const dbStatus = status === true || status === 'Active' ? 'Active' : 'Disabled';
    const dbParentId = parentId ? parseInt(parentId, 10) : 0;
    const seenValuesAtLevel = new Set();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = item.name || item.label || '';
        const value = (item.value || label).trim();

        // Skip empties
        if (!value) continue;

        // Skip duplicates within this batch at the same level
        const lowerVal = value.toLowerCase();
        if (seenValuesAtLevel.has(lowerVal)) {
            console.warn(`[insertTreeItems] Skipping duplicate value "${value}" for key "${key}"`);
            continue;
        }
        seenValuesAtLevel.add(lowerVal);

        const color = item.color || null;
        const icon = item.icon || null;
        const sortOrder = item.sort_order !== undefined ? item.sort_order : (i + 1) * 10;
        const isDefault = item.is_default ? 1 : 0;

        const isSystem = item.is_system ? 1 : (value.toLowerCase() === 'draft' ? 1 : 0);

        let newId;
        try {
            const [result] = await connection.query(
                `INSERT INTO mla_dropdown_lists
                 (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, is_default, is_system, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [key, module, subCategory || null, label, value, dbParentId, color, icon, sortOrder, isDefault, isSystem, dbStatus]
            );
            newId = result.insertId;
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // DB-level unique constraint caught it — skip gracefully
                console.warn(`[insertTreeItems] DB duplicate skip: key="${key}" value="${value}" parent=${dbParentId}`);
                continue;
            }
            throw err;
        }

        if (item.children?.length) {
            await insertTreeItems(connection, item.children, key, module, subCategory, status, newId);
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mla/dropdowns
// Query: ?key=complaint_priority   → options for a specific key (forms)
// Query: ?module=Complaints        → all dropdowns for a module (manager)
// No query                         → full list (admin manager overview)
// ─────────────────────────────────────────────────────────────────────────────
export const getDropdowns = async (req, res) => {
    try {
        const { key, module, status } = req.query;

        if (key) {
            const KEY_ALIASES = {
                application_category:    'cm_fund_category',
                application_district:    'cm_fund_district',
                application_recommender: 'cm_fund_recommender',
                application_status:      'cmfund_status',
            };
            const targetKey = KEY_ALIASES[key] || key;

            // ── Single-key fetch for forms (returns nested tree) ──
            const [rows] = await pool.query(
                `SELECT id, \`key\`, label, value, color, icon, sort_order, is_default, is_system,
                        IFNULL(parent_id, 0) AS parent_id, status
                 FROM mla_dropdown_lists
                 WHERE \`key\` = ? AND status = 'Active'
                 ORDER BY sort_order ASC`,
                [targetKey]
            );
            return res.json({ success: true, data: buildTree(rows) });
        }

        // ── Admin manager list — grouped by key ───────────────
        const PEOPLES_CORNER_MODULES = ['Complaints', 'Issues', 'Ideas', 'Suggestions'];
        const DEPRECATED_LEGACY_KEYS = ['complaint_category', 'issue_category', 'idea_category', 'suggestion_category'];

        const conditions = [];
        const params = [];
        const targetModule = normalizeModuleName(module);

        // Always exclude deprecated legacy flat keys
        conditions.push(`\`key\` NOT IN (${DEPRECATED_LEGACY_KEYS.map(() => '?').join(', ')})`);
        params.push(...DEPRECATED_LEGACY_KEYS);

        if (targetModule && targetModule !== 'All') {
            if (PEOPLES_CORNER_MODULES.includes(targetModule)) {
                // People's Corner modules share system_category as their active category dropdown
                conditions.push('(module = ? OR `key` = ?)');
                params.push(targetModule, 'system_category');
            } else {
                conditions.push('module = ?');
                params.push(targetModule);
            }
        }
        if (status) { conditions.push('status = ?'); params.push(status); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.query(
            `SELECT id, \`key\`, module, sub_category, label, value, color, icon,
                    sort_order, is_default, is_system, IFNULL(parent_id, 0) AS parent_id,
                    status, created_at, updated_at
             FROM mla_dropdown_lists
             ${where}
             ORDER BY module ASC, \`key\` ASC, sort_order ASC`,
            params
        );

        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.key]) {
                grouped[r.key] = { key: r.key, module: r.module, sub_category: r.sub_category, status: r.status, items: [] };
            }
            grouped[r.key].items.push(r);
        });

        const FRIENDLY_KEY_LABELS = {
            system_category:     'Categories',
            cm_fund_category:    'Application Category',
            cm_fund_district:    'Application District',
            cm_fund_recommender: 'Application Recommender',
            cmfund_status:       'Application Status',
            enquiry_status:      'Enquiry Status',
            enquiry_category:    'Enquiry Category',
        };

        const keyToLabel = (k) => FRIENDLY_KEY_LABELS[k] || (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const result = Object.values(grouped).map(g => {
            const treeItems = buildTree(g.items);
            const isSharedCategory = g.key === 'system_category';
            return {
                ...g,
                id: g.items[0]?.id || null,
                name: keyToLabel(g.key),
                type: g.items.some(it => it.parent_id && it.parent_id !== 0) ? 'nested' : 'single',
                category: isSharedCategory && targetModule && targetModule !== 'All' ? targetModule : g.module,
                subcategory: isSharedCategory ? 'Categories' : (g.sub_category || 'General'),
                is_shared: isSharedCategory,
                items: treeItems,
                item_count: g.items.length,
            };
        });

        return res.json({ success: true, data: result, total: result.length });
    } catch (err) {
        console.error('[getDropdowns]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dropdowns.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mla/dropdowns/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getDropdownById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT id, \`key\`, module, sub_category, label, value, color, icon,
                    sort_order, is_default, IFNULL(parent_id, 0) AS parent_id, status
             FROM mla_dropdown_lists WHERE id = ? OR \`key\` = ? ORDER BY sort_order ASC`,
            [id, id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Dropdown not found.' });
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[getDropdownById]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dropdown.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mla/dropdowns
// Creates a new dropdown item (or root of a new dropdown list)
// ─────────────────────────────────────────────────────────────────────────────
export const createDropdown = async (req, res) => {
    const connection = await pool.getConnection();
    let inTransaction = false;
    try {
        const { key, name, category, module, subcategory, sub_category, items, status } = req.body;

        if (Array.isArray(items)) {
            const finalKey = key || (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const finalModule = normalizeModuleName(category || module);
            const finalSubCategory = subcategory || sub_category;

            if (!finalKey || !finalModule) {
                return res.status(400).json({ success: false, message: 'Dropdown name (key) and category (module) are required.' });
            }

            await connection.beginTransaction();
            inTransaction = true;

            // Check if key already exists
            const [[existing]] = await connection.query(
                'SELECT id FROM mla_dropdown_lists WHERE `key` = ? LIMIT 1', [finalKey]
            );
            if (existing) {
                await connection.rollback();
                inTransaction = false;
                return res.status(400).json({ success: false, message: `A dropdown with key "${finalKey}" already exists.` });
            }

            // Mark first item as default if none specified
            if (Array.isArray(items) && items.length > 0 && !items.some(it => it.is_default)) {
                items[0] = { ...items[0], is_default: 1 };
            }

            await insertTreeItems(connection, items, finalKey, finalModule, finalSubCategory, status, 0);

            await connection.commit();
            inTransaction = false;
            return res.status(201).json({ success: true, message: 'Dropdown tree created successfully.' });
        }

        // ── Single item creation ──
        const { label, value, parent_id, color, icon, sort_order } = req.body;
        const singleKey = key;
        const singleModule = module;
        const singleSubCategory = sub_category;
        const dbParentId = parent_id ? parseInt(parent_id, 10) : 0;

        if (!singleKey || !singleModule || !label || !value) {
            return res.status(400).json({ success: false, message: 'key, module, label, and value are required.' });
        }

        // Check for duplicate single item
        const targetVal = (value || label).trim();
        const [[existingItem]] = await connection.query(
            `SELECT id FROM mla_dropdown_lists WHERE \`key\` = ? AND LOWER(value) = LOWER(?) AND IFNULL(parent_id, 0) = ? LIMIT 1`,
            [singleKey, targetVal, dbParentId]
        );
        if (existingItem) {
            return res.status(400).json({ success: false, message: `An option with value "${targetVal}" already exists in this dropdown.` });
        }

        let order = sort_order;
        if (order === undefined || order === null) {
            const [[{ maxOrder }]] = await connection.query(
                `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM mla_dropdown_lists WHERE \`key\` = ? AND IFNULL(parent_id, 0) = ?`,
                [singleKey, dbParentId]
            );
            order = maxOrder + 1;
        }

        const dbStatus = status === true || status === 'Active' ? 'Active' : 'Disabled';
        const [result] = await connection.query(
            `INSERT INTO mla_dropdown_lists
             (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, is_default, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [singleKey, singleModule, singleSubCategory || null, label, value, dbParentId, color || null, icon || null, order, dbStatus]
        );

        const [[row]] = await connection.query('SELECT * FROM mla_dropdown_lists WHERE id = ?', [result.insertId]);
        return res.status(201).json({ success: true, data: row });
    } catch (err) {
        if (inTransaction) { try { await connection.rollback(); } catch (_) { } }
        console.error('[createDropdown]', err);
        res.status(500).json({ success: false, message: 'Failed to create dropdown.' });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mla/dropdowns/preview-update
// Dry-run: returns rename/deletion diffs + impact counts WITHOUT mutating data.
// Body: { id, key, items[] }
// ─────────────────────────────────────────────────────────────────────────────
export const previewDropdownUpdate = async (req, res) => {
    try {
        const { id, key: bodyKey, items } = req.body;

        if (!id) return res.status(400).json({ success: false, message: 'id is required.' });
        if (!Array.isArray(items)) return res.json({ success: true, data: { renames: [], deletions: [], additions: [], hasImpact: false } });

        // Resolve key
        const [[firstItem]] = await pool.query('SELECT `key` FROM mla_dropdown_lists WHERE id = ? LIMIT 1', [id]);
        if (!firstItem) return res.status(404).json({ success: false, message: 'Dropdown not found.' });

        const finalKey = bodyKey || firstItem.key;

        // Load all existing rows for this key
        const [existingRows] = await pool.query(
            'SELECT id, label, value FROM mla_dropdown_lists WHERE `key` = ?',
            [finalKey]
        );

        // Compute diff
        const { renames, deletions } = buildRenameAndDeleteDiff(existingRows, items);

        // Flatten new items to find additions (values not in existing)
        const flatNew = flattenItems(items);
        const existingVals = new Set(existingRows.map(r => r.value.toLowerCase()));
        const additions = flatNew.map(i => i.value).filter(v => !existingVals.has(v.toLowerCase()));

        const mappings = getCascadeMappings(finalKey);
        const primaryMapping = mappings[0] || null;

        // Enrich renames with impact counts across all mapped tables
        const enrichedRenames = await Promise.all(renames.map(async ({ oldValue, newValue }) => {
            const affectedCount = mappings.length ? await getCascadeCount(pool, finalKey, oldValue) : 0;
            return {
                oldValue,
                newValue,
                affectedCount,
                module: mappings.map(m => m.module).join(', ') || null,
                table: mappings.map(m => m.table).join(', ') || null,
                col: primaryMapping?.col || null,
            };
        }));

        // Enrich deletions with impact counts across all mapped tables
        const enrichedDeletions = await Promise.all(deletions.map(async (value) => {
            const affectedCount = mappings.length ? await getCascadeCount(pool, finalKey, value) : 0;
            return {
                value,
                affectedCount,
                module: mappings.map(m => m.module).join(', ') || null,
                table: mappings.map(m => m.table).join(', ') || null,
                col: primaryMapping?.col || null,
            };
        }));

        const hasImpact = enrichedRenames.some(r => r.affectedCount > 0) ||
            enrichedDeletions.some(d => d.affectedCount > 0);

        return res.json({
            success: true,
            data: {
                renames: enrichedRenames,
                deletions: enrichedDeletions,
                additions,
                hasImpact,
            },
        });
    } catch (err) {
        console.error('[previewDropdownUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to preview update.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/mla/dropdowns/:id
// Updates a dropdown list (batch tree update) or a single item.
// Batch path: cascades renames to consuming tables.
// ─────────────────────────────────────────────────────────────────────────────
export const updateDropdown = async (req, res) => {
    const connection = await pool.getConnection();
    let inTransaction = false;
    try {
        const { id } = req.params;
        const { key, name, category, module, subcategory, sub_category, items, status } = req.body;

        // ── Batch tree update ──────────────────────────────────────────────
        if (Array.isArray(items)) {
            const [[firstItem]] = await connection.query('SELECT `key` FROM mla_dropdown_lists WHERE id = ? LIMIT 1', [id]);
            if (!firstItem) return res.status(404).json({ success: false, message: 'Dropdown not found.' });

            const oldKey = firstItem.key;
            const finalKey = key || oldKey;

            // system_category must always remain anchored to General / System module
            const finalModule = finalKey === 'system_category'
                ? 'General / System'
                : normalizeModuleName(category || module);
            const finalSubCategory = finalKey === 'system_category'
                ? 'System-wide'
                : (subcategory || sub_category);

            // Load existing rows BEFORE delete to compute diff
            const [existingRows] = await connection.query(
                'SELECT id, label, value, is_system FROM mla_dropdown_lists WHERE `key` = ?',
                [oldKey]
            );

            const { renames, deletions } = buildRenameAndDeleteDiff(existingRows, items);

            // Prevent deletion or rename of system-protected items (e.g. Draft)
            for (const row of existingRows) {
                if (row.is_system || row.value.toLowerCase() === 'draft') {
                    if (deletions.some(d => d.toLowerCase() === row.value.toLowerCase())) {
                        return res.status(400).json({
                            success: false,
                            message: `"${row.label || row.value}" is a system-protected item and cannot be removed.`
                        });
                    }
                    if (renames.some(r => r.oldValue.toLowerCase() === row.value.toLowerCase())) {
                        return res.status(400).json({
                            success: false,
                            message: `"${row.label || row.value}" is a system-protected item and cannot be renamed.`
                        });
                    }
                }
            }

            await connection.beginTransaction();
            inTransaction = true;

            // Delete all existing items for oldKey
            await connection.query('DELETE FROM mla_dropdown_lists WHERE `key` = ?', [oldKey]);

            // Ensure exactly one item marked as default
            const flatNew = flattenItems(items);
            if (flatNew.length > 0 && !items.some(it => it.is_default)) {
                items[0] = { ...items[0], is_default: 1 };
            }

            // Insert new items
            await insertTreeItems(connection, items, finalKey, finalModule, finalSubCategory, status, 0);

            // Cascade renames to consuming tables (for mapped keys only)
            if (CASCADE_MAP[finalKey]) {
                for (const { oldValue, newValue } of renames) {
                    const affected = await applyCascadeRename(connection, finalKey, oldValue, newValue);
                    if (affected > 0) {
                        console.info(`[updateDropdown] Cascade rename: key="${finalKey}" "${oldValue}"→"${newValue}" affected ${affected} rows`);
                    }
                }

                // ── Empty-string sweep ───────────────────────────────────────────
                // Records left with status='' from the ENUM era are never caught by
                // cascade renames (which target specific old values). This sweep
                // auto-heals them on every dropdown save by setting '' → default.
                const mappings = getCascadeMappings(finalKey);
                const [[defaultRow]] = await connection.query(
                    `SELECT value FROM mla_dropdown_lists WHERE \`key\` = ? AND is_default = 1 AND status = 'Active' LIMIT 1`,
                    [finalKey]
                );
                if (defaultRow?.value) {
                    for (const mapping of mappings) {
                        const whereDeleted = mapping.deletedCol ? `AND \`${mapping.deletedCol}\` = 0` : '';
                        const [sweep] = await connection.query(
                            `UPDATE \`${mapping.table}\` SET \`${mapping.col}\` = ? WHERE \`${mapping.col}\` = '' ${whereDeleted}`,
                            [defaultRow.value]
                        );
                        if (sweep.affectedRows > 0) {
                            console.info(`[updateDropdown] Empty-string sweep: key="${finalKey}" table="${mapping.table}" reset ${sweep.affectedRows} rows to default "${defaultRow.value}"`);
                        }
                    }
                }
            }

            await connection.commit();
            inTransaction = false;
            return res.json({ success: true, message: 'Dropdown tree updated successfully.' });
        }

        // ── Single item update ────────────────────────────────────────────
        const { label, value, color, icon, sort_order, parent_id } = req.body;

        if (label || value) {
            const [[itemRow]] = await connection.query(
                'SELECT `key`, IFNULL(parent_id, 0) AS parent_id, label, value FROM mla_dropdown_lists WHERE id = ?',
                [id]
            );
            if (itemRow) {
                const targetValue = (value || label || itemRow.value).trim();
                const targetParentId = parent_id !== undefined ? (parent_id ? parseInt(parent_id, 10) : 0) : itemRow.parent_id;
                const [[dup]] = await connection.query(
                    `SELECT id FROM mla_dropdown_lists WHERE \`key\` = ? AND id != ? AND LOWER(value) = LOWER(?) AND IFNULL(parent_id, 0) = ? LIMIT 1`,
                    [itemRow.key, id, targetValue, targetParentId]
                );
                if (dup) {
                    return res.status(400).json({ success: false, message: `An option with value "${targetValue}" already exists in this dropdown.` });
                }
            }
        }

        const dbStatus = status !== undefined ? (status === true || status === 'Active' ? 'Active' : 'Disabled') : undefined;

        const [result] = await connection.query(
            `UPDATE mla_dropdown_lists SET
                label        = COALESCE(?, label),
                value        = COALESCE(?, value),
                color        = COALESCE(?, color),
                icon         = COALESCE(?, icon),
                sort_order   = COALESCE(?, sort_order),
                status       = COALESCE(?, status),
                parent_id    = COALESCE(?, parent_id),
                sub_category = COALESCE(?, sub_category)
             WHERE id = ?`,
            [label, value, color, icon, sort_order, dbStatus, parent_id, sub_category, id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found.' });

        const [[row]] = await connection.query('SELECT * FROM mla_dropdown_lists WHERE id = ?', [id]);
        return res.json({ success: true, data: row });
    } catch (err) {
        if (inTransaction) { try { await connection.rollback(); } catch (_) { } }
        console.error('[updateDropdown]', err);
        res.status(500).json({ success: false, message: 'Failed to update dropdown.' });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/mla/dropdowns/reorder
// Body: { items: [{ id, sort_order }] }
// ─────────────────────────────────────────────────────────────────────────────
export const reorderDropdowns = async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ success: false, message: 'items array is required.' });
        }
        const updates = items.map(({ id, sort_order }) =>
            pool.query('UPDATE mla_dropdown_lists SET sort_order = ? WHERE id = ?', [sort_order, id])
        );
        await Promise.all(updates);
        return res.json({ success: true, message: `${items.length} items reordered.` });
    } catch (err) {
        console.error('[reorderDropdowns]', err);
        res.status(500).json({ success: false, message: 'Failed to reorder.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/mla/dropdowns/:id
// Deletes item + all its children.
// Requires ?force=true if value is in use by consuming tables.
// Without ?force=true, returns 409 with impact data so frontend can prompt.
// ─────────────────────────────────────────────────────────────────────────────
export const deleteDropdown = async (req, res) => {
    try {
        const { id } = req.params;
        const forceDelete = req.query.force === 'true';

        if (!isNaN(Number(id))) {
            // Single item delete — check impact and system lock first
            const [[itemRow]] = await pool.query(
                'SELECT `key`, value, label, is_system FROM mla_dropdown_lists WHERE id = ?', [id]
            );

            if (!itemRow) return res.status(404).json({ success: false, message: 'Item not found.' });

            if (itemRow.is_system) {
                return res.status(400).json({
                    success: false,
                    message: `"${itemRow.label || itemRow.value}" is a system-protected status and cannot be deleted.`
                });
            }

            if (!forceDelete) {
                const mappings = getCascadeMappings(itemRow.key);
                if (mappings.length) {
                    const affectedCount = await getCascadeCount(pool, itemRow.key, itemRow.value);
                    if (affectedCount > 0) {
                        const moduleNames = mappings.map(m => m.module).join(', ');
                        return res.status(409).json({
                            success: false,
                            code: 'HAS_IMPACT',
                            message: `"${itemRow.label || itemRow.value}" is used by ${affectedCount} record(s) in ${moduleNames}. Pass ?force=true to delete anyway.`,
                            data: {
                                value: itemRow.value,
                                affectedCount,
                                module: moduleNames,
                                table: mappings.map(m => m.table).join(', '),
                                col: mappings[0]?.col || null,
                            },
                        });
                    }
                }
            }

            const [result] = await pool.query('DELETE FROM mla_dropdown_lists WHERE id = ?', [id]);
            if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found.' });
            return res.json({ success: true, message: 'Item deleted. Existing records will show the value as unavailable.' });
        }

        // Delete entire group by key string - check if contains system items
        const [sysRows] = await pool.query('SELECT id, value FROM mla_dropdown_lists WHERE `key` = ? AND is_system = 1', [id]);
        if (sysRows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This dropdown contains system-protected options (e.g. Draft) and cannot be deleted.'
            });
        }

        const [result] = await pool.query('DELETE FROM mla_dropdown_lists WHERE `key` = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found.' });
        return res.json({ success: true, message: 'Item(s) deleted.' });
    } catch (err) {
        console.error('[deleteDropdown]', err);
        res.status(500).json({ success: false, message: 'Failed to delete dropdown item.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/mla/dropdowns/:id/toggle
// Toggle active/disabled status for all items in a key group
// ─────────────────────────────────────────────────────────────────────────────
export const toggleDropdownStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [[row]] = await pool.query('SELECT `key`, status FROM mla_dropdown_lists WHERE id = ?', [id]);
        if (!row) return res.status(404).json({ success: false, message: 'Item not found.' });

        const newStatus = row.status === 'Active' ? 'Disabled' : 'Active';
        await pool.query('UPDATE mla_dropdown_lists SET status = ? WHERE `key` = ?', [newStatus, row.key]);

        return res.json({ success: true, data: { id: Number(id), status: newStatus } });
    } catch (err) {
        console.error('[toggleDropdownStatus]', err);
        res.status(500).json({ success: false, message: 'Failed to toggle status.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mla/dropdowns/impact
// ?key=complaint_priority&value=Critical
// Returns count of records using a specific dropdown value
// ─────────────────────────────────────────────────────────────────────────────
export const getDropdownImpact = async (req, res) => {
    try {
        const { key, value } = req.query;
        if (!key || !value) return res.status(400).json({ success: false, message: 'key and value are required.' });

        const mappings = getCascadeMappings(key);
        if (!mappings.length) return res.json({ success: true, data: { count: 0 } });

        const count = await getCascadeCount(pool, key, value);
        return res.json({
            success: true,
            data: {
                key,
                value,
                count,
                module: mappings.map(m => m.module).join(', '),
                table: mappings.map(m => m.table).join(', ')
            }
        });
    } catch (err) {
        console.error('[getDropdownImpact]', err);
        res.status(500).json({ success: false, message: 'Failed to get impact count.' });
    }
};
