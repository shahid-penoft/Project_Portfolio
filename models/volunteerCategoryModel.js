import pool from '../configs/db.js';

const mapRow = (r) => ({
    id:         r.id,
    title:      r.title,
    sector:     r.sector      || 'Health & Medical',
    desc:       r.description || '',
    iconName:   r.icon_name   || 'Users',
    colorTheme: r.color_theme || 'purple',
    sortOrder:  r.sort_order  || 0,
    createdAt:  r.created_at  || null,
});

/**
 * Fetch all volunteer activity categories ordered by sort_order ASC.
 */
export const fetchAllCategories = async () => {
    const [rows] = await pool.query(
        `SELECT * FROM volunteer_categories ORDER BY sort_order ASC, id ASC`
    );
    return rows.map(mapRow);
};

/**
 * Fetch single category by id.
 */
export const fetchCategoryById = async (id) => {
    const [[row]] = await pool.query(`SELECT * FROM volunteer_categories WHERE id = ?`, [id]);
    return row ? mapRow(row) : null;
};

/**
 * Insert a new volunteer activity category.
 * sort_order defaults to MAX(sort_order) + 1 so it always appends.
 */
export const insertCategory = async ({ title, sector, desc, iconName, colorTheme }) => {
    const [[{ maxOrder }]] = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM volunteer_categories`
    );
    const [result] = await pool.query(
        `INSERT INTO volunteer_categories (title, sector, description, icon_name, color_theme, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            title,
            sector     || 'Health & Medical',
            desc,
            iconName   || 'Users',
            colorTheme || 'purple',
            maxOrder + 1,
        ]
    );
    return fetchCategoryById(result.insertId);
};

/**
 * Update an existing volunteer category (partial update).
 */
export const updateCategoryById = async (id, { title, sector, desc, iconName, colorTheme }) => {
    const fields = [];
    const values = [];

    if (title      !== undefined) { fields.push('title = ?');       values.push(title); }
    if (sector     !== undefined) { fields.push('sector = ?');      values.push(sector); }
    if (desc       !== undefined) { fields.push('description = ?'); values.push(desc); }
    if (iconName   !== undefined) { fields.push('icon_name = ?');   values.push(iconName); }
    if (colorTheme !== undefined) { fields.push('color_theme = ?'); values.push(colorTheme); }

    if (fields.length === 0) return fetchCategoryById(id);

    values.push(id);
    await pool.query(`UPDATE volunteer_categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return fetchCategoryById(id);
};

/**
 * Delete a volunteer category by id.
 */
export const deleteCategoryById = async (id) => {
    await pool.query(`DELETE FROM volunteer_categories WHERE id = ?`, [id]);
    return true;
};

/**
 * Batch-update sort_order for reordering.
 * orderedIds: number[] — IDs in the desired new order (first = sort_order 1, etc.)
 */
export const reorderCategories = async (orderedIds) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < orderedIds.length; i++) {
            await conn.query(
                `UPDATE volunteer_categories SET sort_order = ? WHERE id = ?`,
                [i + 1, orderedIds[i]]
            );
        }
        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};
