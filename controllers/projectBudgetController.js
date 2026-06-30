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
        const { category, amount, period } = req.body;

        if (!category?.trim() || amount === undefined) {
            return errorResponse(res, 'Category and amount are required.', 400);
        }

        const [result] = await db.query(
            `INSERT INTO project_budget_entries (project_id, category, amount, period)
             VALUES (?, ?, ?, ?)`,
            [id, category.trim(), parseFloat(amount) || 0, period || null]
        );

        // Update total spent in projects table
        await db.query(`UPDATE projects SET spent = spent + ? WHERE id = ?`, [parseFloat(amount) || 0, id]);

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
        await db.query(`UPDATE projects SET spent = GREATEST(0, spent - ?) WHERE id = ?`, [entry[0].amount, id]);

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
        const { fund_source, category, amount, period } = req.body;

        if (!category?.trim() || amount === undefined) {
            return errorResponse(res, 'Category and amount are required.', 400);
        }

        const [result] = await db.query(
            `INSERT INTO project_budget_allocations (project_id, fund_source, category, amount, period)
             VALUES (?, ?, ?, ?, ?)`,
            [id, fund_source?.trim() || null, category.trim(), parseFloat(amount) || 0, period?.trim() || null]
        );

        // Update total budget in projects table (sum of all allocations)
        await db.query(`UPDATE projects SET budget = budget + ? WHERE id = ?`, [parseFloat(amount) || 0, id]);

        const [rows] = await db.query('SELECT * FROM project_budget_allocations WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Budget allocation added.', 201);
    } catch (err) {
        console.error('[addBudgetAllocation]', err);
        return errorResponse(res, 'Server error adding budget allocation.');
    }
};

export const deleteBudgetAllocation = async (req, res) => {
    try {
        const { id, aid } = req.params;
        
        // Find amount to subtract from total budget
        const [entry] = await db.query('SELECT amount FROM project_budget_allocations WHERE id = ? AND project_id = ?', [aid, id]);
        if (!entry.length) return errorResponse(res, 'Budget allocation not found.', 404);

        await db.query('DELETE FROM project_budget_allocations WHERE id = ?', [aid]);
        
        // Update total budget in projects table
        await db.query(`UPDATE projects SET budget = GREATEST(0, budget - ?) WHERE id = ?`, [entry[0].amount, id]);

        return successResponse(res, {}, 'Budget allocation deleted.');
    } catch (err) {
        console.error('[deleteBudgetAllocation]', err);
        return errorResponse(res, 'Server error deleting budget allocation.');
    }
};
