import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────
//  Helper: build unlimited-depth recursive tree from flat rows
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

// ─────────────────────────────────────────────────────────────
// GET /api/mla/dropdowns
// Query: ?key=complaint_priority   → options for a specific key (forms)
// Query: ?module=Complaints        → all dropdowns for a module (manager)
// No query                         → full list (admin manager overview)
// ─────────────────────────────────────────────────────────────
export const getDropdowns = async (req, res) => {
    try {
        const { key, module, status } = req.query;

        if (key) {
            // ── Single-key fetch for forms (returns nested tree) ──
            const [rows] = await pool.query(
                `SELECT id, \`key\`, label, value, color, icon, sort_order, parent_id, status
                 FROM mla_dropdown_lists
                 WHERE \`key\` = ? AND status = 'Active'
                 ORDER BY sort_order ASC`,
                [key]
            );
            return res.json({ success: true, data: buildTree(rows) });
        }

        // ── Admin manager list — grouped by key ───────────────
        const conditions = [];
        const params = [];
        if (module && module !== 'All') { conditions.push('module = ?'); params.push(module); }
        if (status)                     { conditions.push('status = ?'); params.push(status); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // Fetch all rows, then group by key client-side for manager display
        const [rows] = await pool.query(
            `SELECT id, \`key\`, module, sub_category, label, value, color, icon, sort_order, parent_id, status, created_at, updated_at
             FROM mla_dropdown_lists
             ${where}
             ORDER BY module ASC, \`key\` ASC, sort_order ASC`,
            params
        );

// Group rows by key to produce "dropdown list" entries for the manager UI
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.key]) {
                grouped[r.key] = {
                    key: r.key,
                    module: r.module,
                    sub_category: r.sub_category,
                    status: r.status,
                    items: [],
                };
            }
            grouped[r.key].items.push(r);
        });

        // Helper to format key to label
        const keyToLabel = (k) => {
            return (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        };

        // Build nested items for each key group and enrich to match old schema expectations
        const result = Object.values(grouped).map(g => {
            const treeItems = buildTree(g.items);
            return {
                ...g,
                id: g.items[0]?.id || null, // Virtual ID using first item for toggling/editing
                name: keyToLabel(g.key),
                type: g.items.some(it => it.parent_id !== null) ? 'nested' : 'single',
                category: g.module,
                subcategory: g.sub_category,
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

// ─────────────────────────────────────────────────────────────
// GET /api/mla/dropdowns/:id
// ─────────────────────────────────────────────────────────────
export const getDropdownById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM mla_dropdown_lists WHERE id = ? OR \`key\` = ? ORDER BY sort_order ASC`,
            [id, id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Dropdown not found.' });
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[getDropdownById]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dropdown.' });
    }
};

// Helper function to recursively insert items in the tree
const insertTreeItems = async (connection, items, key, module, subCategory, status, parentId = null) => {
    const dbStatus = status === true || status === 'Active' ? 'Active' : 'Disabled';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = item.name || item.label || '';
        const value = item.value || label;
        const color = item.color || null;
        const icon = item.icon || null;
        const sortOrder = item.sort_order !== undefined ? item.sort_order : (i + 1) * 10;

        const [result] = await connection.query(
            `INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [key, module, subCategory || null, label, value, parentId, color, icon, sortOrder, dbStatus]
        );

        const newId = result.insertId;

        if (item.children && Array.isArray(item.children) && item.children.length > 0) {
            await insertTreeItems(connection, item.children, key, module, subCategory, status, newId);
        }
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/mla/dropdowns
// Creates a new dropdown item (or root of a new dropdown list)
// ─────────────────────────────────────────────────────────────
export const createDropdown = async (req, res) => {
    const connection = await pool.getConnection();
    let inTransaction = false;
    try {
        const { key, name, category, module, subcategory, sub_category, items, status } = req.body;

        // If it's a batch creation request (has items array)
        if (Array.isArray(items)) {
            const finalKey = key || (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const finalModule = category || module;
            const finalSubCategory = subcategory || sub_category;

            if (!finalKey || !finalModule) {
                return res.status(400).json({ success: false, message: 'Dropdown name (key) and category (module) are required.' });
            }

            await connection.beginTransaction();
            inTransaction = true;

            // Check if key already exists
            const [[existing]] = await connection.query('SELECT id FROM mla_dropdown_lists WHERE `key` = ? LIMIT 1', [finalKey]);
            if (existing) {
                await connection.rollback();
                inTransaction = false;
                return res.status(400).json({ success: false, message: `A dropdown with key "${finalKey}" already exists.` });
            }

            await insertTreeItems(connection, items, finalKey, finalModule, finalSubCategory, status);

            await connection.commit();
            inTransaction = false;
            return res.status(201).json({ success: true, message: 'Dropdown tree created successfully.' });
        }

        // Otherwise fallback to single item creation
        const { label, value, parent_id, color, icon, sort_order } = req.body;
        const singleKey = key;
        const singleModule = module;
        const singleSubCategory = sub_category;
        
        if (!singleKey || !singleModule || !label || !value) {
            return res.status(400).json({ success: false, message: 'key, module, label, and value are required.' });
        }

        let order = sort_order;
        if (order === undefined || order === null) {
            const [[{ maxOrder }]] = await connection.query(
                `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM mla_dropdown_lists WHERE \`key\` = ? AND parent_id ${parent_id ? '= ?' : 'IS NULL'}`,
                parent_id ? [singleKey, parent_id] : [singleKey]
            );
            order = maxOrder + 1;
        }

        const dbStatus = status === true || status === 'Active' ? 'Active' : 'Disabled';
        const [result] = await connection.query(
            `INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [singleKey, singleModule, singleSubCategory || null, label, value, parent_id || null, color || null, icon || null, order, dbStatus]
        );

        const [[row]] = await connection.query('SELECT * FROM mla_dropdown_lists WHERE id = ?', [result.insertId]);
        return res.status(201).json({ success: true, data: row });
    } catch (err) {
        if (inTransaction) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error('[createDropdown]', err);
        res.status(500).json({ success: false, message: 'Failed to create dropdown.' });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/mla/dropdowns/:id
// Updates a single dropdown item's metadata (or batch tree update)
// ─────────────────────────────────────────────────────────────
export const updateDropdown = async (req, res) => {
    const connection = await pool.getConnection();
    let inTransaction = false;
    try {
        const { id } = req.params;
        const { key, name, category, module, subcategory, sub_category, items, status } = req.body;

        // If it's a batch update request (has items array)
        if (Array.isArray(items)) {
            // Find existing key of the group by querying the id (which is g.items[0].id)
            const [[firstItem]] = await connection.query('SELECT `key` FROM mla_dropdown_lists WHERE id = ? LIMIT 1', [id]);
            if (!firstItem) {
                return res.status(404).json({ success: false, message: 'Dropdown not found.' });
            }
            const oldKey = firstItem.key;
            const finalKey = key || oldKey;
            const finalModule = category || module;
            const finalSubCategory = subcategory || sub_category;

            await connection.beginTransaction();
            inTransaction = true;

            // Delete all existing items belonging to oldKey
            await connection.query('DELETE FROM mla_dropdown_lists WHERE `key` = ?', [oldKey]);

            // Insert new items tree
            await insertTreeItems(connection, items, finalKey, finalModule, finalSubCategory, status);

            await connection.commit();
            inTransaction = false;
            return res.json({ success: true, message: 'Dropdown tree updated successfully.' });
        }

        // Otherwise fallback to single item update
        const { label, value, color, icon, sort_order, parent_id } = req.body;
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
        if (inTransaction) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error('[updateDropdown]', err);
        res.status(500).json({ success: false, message: 'Failed to update dropdown.' });
    } finally {
        connection.release();
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/mla/dropdowns/reorder
// Body: { items: [{ id, sort_order }] }
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// DELETE /api/mla/dropdowns/:id
// Deletes item + all its children (via CASCADE)
// ─────────────────────────────────────────────────────────────
export const deleteDropdown = async (req, res) => {
    try {
        const { id } = req.params;
        let result;
        if (isNaN(Number(id))) {
            // Delete entire group by key string
            [result] = await pool.query('DELETE FROM mla_dropdown_lists WHERE `key` = ?', [id]);
        } else {
            // Delete single item by ID
            [result] = await pool.query('DELETE FROM mla_dropdown_lists WHERE id = ?', [id]);
        }
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Item not found.' });
        return res.json({ success: true, message: 'Item(s) deleted.' });
    } catch (err) {
        console.error('[deleteDropdown]', err);
        res.status(500).json({ success: false, message: 'Failed to delete dropdown item.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/mla/dropdowns/:id/toggle
// Toggle active/disabled status
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// GET /api/mla/dropdowns/impact
// ?key=complaint_priority&value=Critical
// Returns count of records using a specific dropdown value
// ─────────────────────────────────────────────────────────────
export const getDropdownImpact = async (req, res) => {
    try {
        const { key, value } = req.query;
        if (!key || !value) return res.status(400).json({ success: false, message: 'key and value are required.' });

        const keyMap = {
            complaint_priority:  { table: 'complaints',  col: 'priority' },
            complaint_status:    { table: 'complaints',  col: 'status'   },
            complaint_category:  { table: 'complaints',  col: 'category' },
            issue_priority:      { table: 'issues',      col: 'priority' },
            issue_status:        { table: 'issues',      col: 'status'   },
            issue_category:      { table: 'issues',      col: 'category' },
            idea_priority:       { table: 'ideas',       col: 'priority' },
            idea_status:         { table: 'ideas',       col: 'status'   },
            idea_category:       { table: 'ideas',       col: 'category' },
            suggestion_priority: { table: 'suggestions', col: 'priority' },
            suggestion_status:   { table: 'suggestions', col: 'status'   },
            suggestion_category: { table: 'suggestions', col: 'category' },
        };

        const mapping = keyMap[key];
        if (!mapping) return res.json({ success: true, data: { count: 0 } });

        const [[{ count }]] = await pool.query(
            `SELECT COUNT(*) AS count FROM \`${mapping.table}\` WHERE \`${mapping.col}\` = ? AND is_deleted = 0`,
            [value]
        );

        return res.json({ success: true, data: { key, value, count, module: mapping.table } });
    } catch (err) {
        console.error('[getDropdownImpact]', err);
        res.status(500).json({ success: false, message: 'Failed to get impact count.' });
    }
};
