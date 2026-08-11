import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CASCADE_MAP — shared constant for all cascade-aware operations
//  Maps each dropdown key to the consuming table and column.
//  deletedCol: the soft-delete flag column name used in that table.
// ─────────────────────────────────────────────────────────────────────────────
const CASCADE_MAP = {
    // Complaints
    complaint_priority:  { table: 'complaints',      col: 'priority',  module: 'Complaints',   deletedCol: 'is_deleted' },
    complaint_status:    { table: 'complaints',      col: 'status',    module: 'Complaints',   deletedCol: 'is_deleted' },
    complaint_category:  { table: 'complaints',      col: 'category',  module: 'Complaints',   deletedCol: 'is_deleted' },
    // Issues
    issue_priority:      { table: 'issues',          col: 'priority',  module: 'Issues',       deletedCol: 'is_deleted' },
    issue_status:        { table: 'issues',          col: 'status',    module: 'Issues',       deletedCol: 'is_deleted' },
    issue_category:      { table: 'issues',          col: 'category',  module: 'Issues',       deletedCol: 'is_deleted' },
    // Ideas
    idea_priority:       { table: 'ideas',           col: 'priority',  module: 'Ideas',        deletedCol: 'is_deleted' },
    idea_status:         { table: 'ideas',           col: 'status',    module: 'Ideas',        deletedCol: 'is_deleted' },
    idea_category:       { table: 'ideas',           col: 'category',  module: 'Ideas',        deletedCol: 'is_deleted' },
    // Suggestions
    suggestion_priority: { table: 'suggestions',     col: 'priority',  module: 'Suggestions',  deletedCol: 'is_deleted' },
    suggestion_status:   { table: 'suggestions',     col: 'status',    module: 'Suggestions',  deletedCol: 'is_deleted' },
    suggestion_category: { table: 'suggestions',     col: 'category',  module: 'Suggestions',  deletedCol: 'is_deleted' },
    // CSR
    csr_status:          { table: 'csr_organisations', col: 'status',  module: 'CSR',          deletedCol: 'deleted'    },
    csr_org_type:        { table: 'csr_organisations', col: 'type',    module: 'CSR',          deletedCol: 'deleted'    },
    csr_followup_type:   { table: 'csr_followups',     col: 'type',    module: 'CSR',          deletedCol: null         },
    csr_report_type:     { table: 'csr_reports',       col: 'type',    module: 'CSR',          deletedCol: null         },
    // Projects
    project_sub_type_portfolio: { table: 'projects', col: 'project_sub_type', module: 'Projects', deletedCol: null },
};

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
    const existingById  = {};  // id → value
    const existingByVal = {};  // lowerValue → value (original casing)
    for (const row of existingRows) {
        existingById[row.id]                     = row.value;
        existingByVal[row.value.toLowerCase()]   = row.value;
    }

    const newById  = {};  // id → value
    const newByVal = {};  // lowerValue → value
    for (const item of flatNew) {
        if (item.id) newById[item.id]             = item.value;
        newByVal[item.value.toLowerCase()]        = item.value;
    }

    const renames   = [];
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
//  Helper: get impact count for a single value in a cascade-mapped table
// ─────────────────────────────────────────────────────────────────────────────
async function getCascadeCount(connection, key, value) {
    const mapping = CASCADE_MAP[key];
    if (!mapping) return 0;
    const whereDeleted = mapping.deletedCol ? `AND \`${mapping.deletedCol}\` = 0` : '';
    const [[{ count }]] = await connection.query(
        `SELECT COUNT(*) AS count FROM \`${mapping.table}\` WHERE \`${mapping.col}\` = ? ${whereDeleted}`,
        [value]
    );
    return Number(count);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: execute cascade UPDATE for a rename
// ─────────────────────────────────────────────────────────────────────────────
async function applyCascadeRename(connection, key, oldValue, newValue) {
    const mapping = CASCADE_MAP[key];
    if (!mapping) return 0;
    const whereDeleted = mapping.deletedCol ? `AND \`${mapping.deletedCol}\` = 0` : '';
    const [result] = await connection.query(
        `UPDATE \`${mapping.table}\` SET \`${mapping.col}\` = ? WHERE \`${mapping.col}\` = ? ${whereDeleted}`,
        [newValue, oldValue]
    );
    return result.affectedRows;
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
    const dbStatus   = status === true || status === 'Active' ? 'Active' : 'Disabled';
    const dbParentId = parentId ? parseInt(parentId, 10) : 0;
    const seenValuesAtLevel = new Set();

    for (let i = 0; i < items.length; i++) {
        const item  = items[i];
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

        const color     = item.color     || null;
        const icon      = item.icon      || null;
        const sortOrder = item.sort_order !== undefined ? item.sort_order : (i + 1) * 10;
        const isDefault = item.is_default ? 1 : 0;

        let newId;
        try {
            const [result] = await connection.query(
                `INSERT INTO mla_dropdown_lists
                 (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, is_default, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [key, module, subCategory || null, label, value, dbParentId, color, icon, sortOrder, isDefault, dbStatus]
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
            // ── Single-key fetch for forms (returns nested tree) ──
            const [rows] = await pool.query(
                `SELECT id, \`key\`, label, value, color, icon, sort_order, is_default,
                        IFNULL(parent_id, 0) AS parent_id, status
                 FROM mla_dropdown_lists
                 WHERE \`key\` = ? AND status = 'Active'
                 ORDER BY sort_order ASC`,
                [key]
            );
            return res.json({ success: true, data: buildTree(rows) });
        }

        // ── Admin manager list — grouped by key ───────────────
        const conditions = [];
        const params     = [];
        if (module && module !== 'All') { conditions.push('module = ?'); params.push(module); }
        if (status)                     { conditions.push('status = ?'); params.push(status); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.query(
            `SELECT id, \`key\`, module, sub_category, label, value, color, icon,
                    sort_order, is_default, IFNULL(parent_id, 0) AS parent_id,
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

        const keyToLabel = (k) => (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const result = Object.values(grouped).map(g => {
            const treeItems = buildTree(g.items);
            return {
                ...g,
                id:          g.items[0]?.id || null,
                name:        keyToLabel(g.key),
                type:        g.items.some(it => it.parent_id && it.parent_id !== 0) ? 'nested' : 'single',
                category:    g.module,
                subcategory: g.sub_category,
                items:       treeItems,
                item_count:  g.items.length,
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
            const finalKey         = key || (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const finalModule      = category || module;
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
        const singleKey         = key;
        const singleModule      = module;
        const singleSubCategory = sub_category;
        const dbParentId        = parent_id ? parseInt(parent_id, 10) : 0;

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
        if (inTransaction) { try { await connection.rollback(); } catch (_) {} }
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
        const flatNew      = flattenItems(items);
        const existingVals = new Set(existingRows.map(r => r.value.toLowerCase()));
        const additions    = flatNew.map(i => i.value).filter(v => !existingVals.has(v.toLowerCase()));

        const mapping = CASCADE_MAP[finalKey];

        // Enrich renames with impact counts
        const enrichedRenames = await Promise.all(renames.map(async ({ oldValue, newValue }) => {
            const affectedCount = mapping ? await getCascadeCount(pool, finalKey, oldValue) : 0;
            return {
                oldValue,
                newValue,
                affectedCount,
                module: mapping?.module || null,
                table:  mapping?.table  || null,
                col:    mapping?.col    || null,
            };
        }));

        // Enrich deletions with impact counts
        const enrichedDeletions = await Promise.all(deletions.map(async (value) => {
            const affectedCount = mapping ? await getCascadeCount(pool, finalKey, value) : 0;
            return {
                value,
                affectedCount,
                module: mapping?.module || null,
                table:  mapping?.table  || null,
                col:    mapping?.col    || null,
            };
        }));

        const hasImpact = enrichedRenames.some(r => r.affectedCount > 0) ||
                          enrichedDeletions.some(d => d.affectedCount > 0);

        return res.json({
            success: true,
            data: {
                renames:   enrichedRenames,
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

            const oldKey          = firstItem.key;
            const finalKey        = key || oldKey;
            const finalModule     = category || module;
            const finalSubCategory = subcategory || sub_category;

            // Load existing rows BEFORE delete to compute diff
            const [existingRows] = await connection.query(
                'SELECT id, label, value FROM mla_dropdown_lists WHERE `key` = ?',
                [oldKey]
            );

            const { renames } = buildRenameAndDeleteDiff(existingRows, items);

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
                const { table, col, deletedCol } = CASCADE_MAP[finalKey];
                const whereDeleted = deletedCol ? `AND \`${deletedCol}\` = 0` : '';
                const [[defaultRow]] = await connection.query(
                    `SELECT value FROM mla_dropdown_lists WHERE \`key\` = ? AND is_default = 1 AND status = 'Active' LIMIT 1`,
                    [finalKey]
                );
                if (defaultRow?.value) {
                    const [sweep] = await connection.query(
                        `UPDATE \`${table}\` SET \`${col}\` = ? WHERE \`${col}\` = '' ${whereDeleted}`,
                        [defaultRow.value]
                    );
                    if (sweep.affectedRows > 0) {
                        console.info(`[updateDropdown] Empty-string sweep: key="${finalKey}" reset ${sweep.affectedRows} rows to default "${defaultRow.value}"`);
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
                const targetValue   = (value || label || itemRow.value).trim();
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
        if (inTransaction) { try { await connection.rollback(); } catch (_) {} }
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
        const { id }    = req.params;
        const forceDelete = req.query.force === 'true';

        if (!isNaN(Number(id))) {
            // Single item delete — check impact first
            const [[itemRow]] = await pool.query(
                'SELECT `key`, value, label FROM mla_dropdown_lists WHERE id = ?', [id]
            );

            if (itemRow && !forceDelete) {
                const mapping = CASCADE_MAP[itemRow.key];
                if (mapping) {
                    const affectedCount = await getCascadeCount(pool, itemRow.key, itemRow.value);
                    if (affectedCount > 0) {
                        return res.status(409).json({
                            success: false,
                            code:    'HAS_IMPACT',
                            message: `"${itemRow.label || itemRow.value}" is used by ${affectedCount} record(s) in ${mapping.module}. Pass ?force=true to delete anyway.`,
                            data: {
                                value:        itemRow.value,
                                affectedCount,
                                module:       mapping.module,
                                table:        mapping.table,
                                col:          mapping.col,
                            },
                        });
                    }
                }
            }

            const [result] = await pool.query('DELETE FROM mla_dropdown_lists WHERE id = ?', [id]);
            if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found.' });
            return res.json({ success: true, message: 'Item deleted. Existing records will show the value as unavailable.' });
        }

        // Delete entire group by key string
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

        const mapping = CASCADE_MAP[key];
        if (!mapping) return res.json({ success: true, data: { count: 0 } });

        const count = await getCascadeCount(pool, key, value);
        return res.json({ success: true, data: { key, value, count, module: mapping.module, table: mapping.table } });
    } catch (err) {
        console.error('[getDropdownImpact]', err);
        res.status(500).json({ success: false, message: 'Failed to get impact count.' });
    }
};
