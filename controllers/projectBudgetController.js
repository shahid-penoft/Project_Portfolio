import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getBudgetEntries = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM project_budget_entries WHERE project_id = ? ORDER BY created_at DESC', [id]);
        return successResponse(res, { data: rows }, 'Budget entries fetched.');
    } catch (err) {
        console.error('[getBudgetEntries]', err);
        return errorResponse(res, 'Server error fetching budget entries.');
    }
};

export const addBudgetEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, amount, period, csr_org_id } = req.body;

        if (!category || !String(category).trim() || amount === undefined || isNaN(parseFloat(amount))) {
            return errorResponse(res, 'Category and a valid amount are required.', 400);
        }

        const safeCategory = String(category).trim().slice(0, 150);
        const safeAmount = parseFloat(amount) || 0;
        const safePeriod = period ? String(period).trim().slice(0, 50) : null;

        const [result] = await db.query(
            `INSERT INTO project_budget_entries (project_id, csr_org_id, category, amount, period)
             VALUES (?, ?, ?, ?, ?)`,
            [id, csr_org_id || null, safeCategory, safeAmount, safePeriod]
        );

        // Update total spent in projects table
        await db.query(`UPDATE projects SET spent = COALESCE(spent, 0) + ? WHERE id = ?`, [safeAmount, id]);

        // If CSR-funded, update spent_amount in csr_project_links
        if (csr_org_id) {
            await db.query(
                `UPDATE csr_project_links SET spent_amount = COALESCE(spent_amount, 0) + ? WHERE csr_org_id = ? AND project_id = ?`,
                [safeAmount, csr_org_id, id]
            );
        }

        const [rows] = await db.query('SELECT * FROM project_budget_entries WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Budget entry added.', 201);
    } catch (err) {
        console.error('[addBudgetEntry]', err);
        return errorResponse(res, 'Server error adding budget entry.');
    }
};

export const deleteBudgetEntry = async (req, res) => {
    try {
        const { id, bid } = req.params;
        
        // Find amount to subtract from total spent
        const [entry] = await db.query('SELECT amount FROM project_budget_entries WHERE id = ? AND project_id = ?', [bid, id]);
        if (!entry.length) return errorResponse(res, 'Budget entry not found.', 404);

        await db.query('DELETE FROM project_budget_entries WHERE id = ?', [bid]);
        
        // Update total spent in projects table
        await db.query(`UPDATE projects SET spent = GREATEST(0, COALESCE(spent, 0) - ?) WHERE id = ?`, [entry[0].amount, id]);

        return successResponse(res, {}, 'Budget entry deleted.');
    } catch (err) {
        console.error('[deleteBudgetEntry]', err);
        return errorResponse(res, 'Server error deleting budget entry.');
    }
};

// ── Allocations ────────────────────────────────────────────────────────

export const addBudgetAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { fund_source, category, amount, period, csr_org_id } = req.body;

        if (!category || !String(category).trim() || amount === undefined || isNaN(parseFloat(amount))) {
            return errorResponse(res, 'Category and a valid amount are required.', 400);
        }

        const safeFundSource = fund_source ? String(fund_source).trim().slice(0, 150) : null;
        const safeCategory = String(category).trim().slice(0, 150);
        const safeAmount = parseFloat(amount) || 0;
        const safePeriod = period ? String(period).trim().slice(0, 50) : null;

        const [result] = await db.query(
            `INSERT INTO project_budget_allocations (project_id, fund_source, csr_org_id, category, amount, period)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, safeFundSource, csr_org_id || null, safeCategory, safeAmount, safePeriod]
        );

        // Update total budget in projects table (sum of all allocations)
        await db.query(`UPDATE projects SET budget = COALESCE(budget, 0) + ? WHERE id = ?`, [safeAmount, id]);

        const [rows] = await db.query(
            `SELECT ba.*, co.name AS csr_org_name, co.type AS csr_org_type, co.status AS csr_org_status 
             FROM project_budget_allocations ba 
             LEFT JOIN csr_organisations co ON ba.csr_org_id = co.id 
             WHERE ba.id = ?`,
            [result.insertId]
        );
        return successResponse(res, { data: rows[0] }, 'Budget allocation added.', 201);
    } catch (err) {
        console.error('[addBudgetAllocation]', err);
        return errorResponse(res, 'Server error adding budget allocation.');
    }
};

export const deleteBudgetAllocation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id, aid } = req.params;
        
        // Find allocation details
        const [entry] = await db.query('SELECT * FROM project_budget_allocations WHERE id = ? AND project_id = ?', [aid, id]);
        if (!entry.length) return errorResponse(res, 'Budget allocation not found.', 404);

        const alloc = entry[0];
        const allocated = Number(alloc.amount) || 0;

        await conn.beginTransaction();

        // Check if tied to CSR Partner
        if (alloc.csr_org_id) {
            const [links] = await conn.query(
                'SELECT * FROM csr_project_links WHERE project_id = ? AND csr_org_id = ?',
                [id, alloc.csr_org_id]
            );
            if (links.length) {
                const link = links[0];
                const spent = Number(link.spent_amount) || 0;

                if (spent > 0) {
                    // Safe close logic (Rule 3)
                    const unspent = Math.max(0, allocated - spent);
                    await conn.query(
                        `UPDATE project_budget_allocations
                         SET amount = ?
                         WHERE id = ?`,
                        [spent, aid]
                    );
                    await conn.query(
                        `UPDATE csr_project_links
                         SET status = 'Closed', allocated_amount = ?, updated_at = NOW()
                         WHERE id = ?`,
                        [spent, link.id]
                    );
                    if (unspent > 0) {
                        await conn.query(
                            `UPDATE projects SET budget = GREATEST(COALESCE(spent, 0), budget - ?) WHERE id = ?`,
                            [unspent, id]
                        );
                    }
                    await conn.commit();
                    return successResponse(res, { action: 'closed', retained_amount: spent, released_amount: unspent }, `CSR allocation closed. ₹${spent.toLocaleString('en-IN')} retained and ₹${unspent.toLocaleString('en-IN')} released.`);
                } else {
                    // spent == 0: Clean hard delete of link as well
                    await conn.query('DELETE FROM csr_project_links WHERE id = ?', [link.id]);
                }
            }
        }

        // Standard delete for direct/scheme allocations or 0-spent CSR allocations
        await conn.query('DELETE FROM project_budget_allocations WHERE id = ?', [aid]);
        await conn.query(`UPDATE projects SET budget = GREATEST(COALESCE(spent, 0), budget - ?) WHERE id = ?`, [allocated, id]);

        await conn.commit();
        return successResponse(res, { action: 'deleted', released_amount: allocated }, 'Budget allocation deleted.');
    } catch (err) {
        await conn.rollback();
        console.error('[deleteBudgetAllocation]', err);
        return errorResponse(res, 'Server error deleting budget allocation.');
    } finally {
        conn.release();
    }
};
