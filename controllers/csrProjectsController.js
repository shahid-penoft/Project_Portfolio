import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

const logActivity = async (conn, user_name, action) => {
    const finalUserName = user_name || 'Admin';
    const words = finalUserName.trim().split(/\s+/);
    const initials = words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : finalUserName.slice(0, 2).toUpperCase();
    await conn.query(
        `INSERT INTO csr_activities (user_name, action, time_label, initials) VALUES (?,?, 'Just now', ?)`,
        [finalUserName, action, initials]
    );
};

// ── GET /api/csr/organisations/:id/projects ──────────────────
export const getCSROrgProjects = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT
                cpl.id              AS link_id,
                cpl.project_id,
                cpl.allocated_amount,
                cpl.spent_amount,
                cpl.status          AS link_status,
                cpl.notes,
                cpl.created_at,
                p.title             AS project_title,
                p.status            AS project_status,
                p.start_date        AS project_start_date,
                p.budget            AS project_budget,
                p.spent             AS project_spent,
                s.name              AS project_sector
             FROM csr_project_links cpl
             JOIN projects p ON p.id = cpl.project_id
             LEFT JOIN sectors s ON s.id = p.sector_id
             WHERE cpl.csr_org_id = ?
             ORDER BY cpl.created_at DESC`,
            [id]
        );
        return successResponse(res, { data: { data: rows } }, 'CSR org projects fetched.');
    } catch (err) {
        console.error('[getCSROrgProjects]', err);
        return errorResponse(res, 'Server error.');
    }
};

// ── POST /api/csr/organisations/:id/projects ─────────────────
export const linkCSROrgProject = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id: csr_org_id } = req.params;
        const { project_id, allocated_amount = 0, status = 'Proposal', notes } = req.body;

        if (!project_id) return errorResponse(res, 'project_id is required.', 400);

        // Validate org exists
        const [orgs] = await db.query('SELECT id, name FROM csr_organisations WHERE id = ? AND deleted = 0', [csr_org_id]);
        if (!orgs.length) return errorResponse(res, 'CSR organisation not found.', 404);

        // Validate project exists
        const [projects] = await db.query('SELECT id, title FROM projects WHERE id = ?', [project_id]);
        if (!projects.length) return errorResponse(res, 'Project not found.', 404);

        // Check no duplicate link
        const [existing] = await db.query(
            'SELECT id FROM csr_project_links WHERE csr_org_id = ? AND project_id = ?',
            [csr_org_id, project_id]
        );
        if (existing.length) return errorResponse(res, 'This project is already linked to the organisation.', 409);

        const amount = Math.max(0, Number(allocated_amount) || 0);

        await conn.beginTransaction();

        // Create link
        const [result] = await conn.query(
            `INSERT INTO csr_project_links (csr_org_id, project_id, allocated_amount, status, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [csr_org_id, project_id, amount, status, notes || null]
        );

        // Create budget allocation in project
        await conn.query(
            `INSERT INTO project_budget_allocations (project_id, csr_org_id, fund_source, category, amount)
             VALUES (?, ?, ?, 'CSR Fund', ?)`,
            [project_id, csr_org_id, orgs[0].name, amount]
        );

        // Update project.budget
        if (amount > 0) {
            await conn.query(
                'UPDATE projects SET budget = budget + ? WHERE id = ?',
                [amount, project_id]
            );
        }

        await logActivity(conn, req.admin?.full_name,
            `linked project '${projects[0].title}' to '${orgs[0].name}' (₹${amount})`);
        await conn.commit();

        const [newRows] = await db.query('SELECT * FROM csr_project_links WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: { data: newRows[0] } }, 'Project linked.', 201);
    } catch (err) {
        await conn.rollback();
        console.error('[linkCSROrgProject]', err);
        return errorResponse(res, 'Server error linking project.');
    } finally {
        conn.release();
    }
};

// ── PATCH /api/csr/organisations/:id/projects/:linkId ────────
export const updateCSROrgProjectLink = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id: csr_org_id, linkId } = req.params;
        const { allocated_amount, status, notes } = req.body;

        const [links] = await db.query(
            'SELECT * FROM csr_project_links WHERE id = ? AND csr_org_id = ?',
            [linkId, csr_org_id]
        );
        if (!links.length) return errorResponse(res, 'Link not found.', 404);

        const link = links[0];
        const currentSpent = Number(link.spent_amount) || 0;
        const newAmount = allocated_amount !== undefined ? Math.max(0, Number(allocated_amount)) : Number(link.allocated_amount);

        if (allocated_amount !== undefined && newAmount < currentSpent) {
            return errorResponse(res, `Cannot reduce allocation below ₹${currentSpent.toLocaleString('en-IN')}, which has already been spent by this project.`, 400);
        }

        const delta = newAmount - Number(link.allocated_amount);

        await conn.beginTransaction();

        await conn.query(
            `UPDATE csr_project_links
             SET allocated_amount = ?, status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = NOW()
             WHERE id = ?`,
            [newAmount, status || null, notes !== undefined ? notes : null, linkId]
        );

        // Update the corresponding allocation
        if (delta !== 0) {
            await conn.query(
                `UPDATE project_budget_allocations
                 SET amount = amount + ?
                 WHERE project_id = ? AND csr_org_id = ?
                 LIMIT 1`,
                [delta, link.project_id, csr_org_id]
            );
            // Update project budget
            await conn.query(
                'UPDATE projects SET budget = GREATEST(COALESCE(spent, 0), budget + ?) WHERE id = ?',
                [delta, link.project_id]
            );
        }

        await conn.commit();
        const [updated] = await db.query('SELECT * FROM csr_project_links WHERE id = ?', [linkId]);
        return successResponse(res, { data: { data: updated[0] } }, 'Link updated.');
    } catch (err) {
        await conn.rollback();
        console.error('[updateCSROrgProjectLink]', err);
        return errorResponse(res, 'Server error updating link.');
    } finally {
        conn.release();
    }
};

// ── DELETE /api/csr/organisations/:id/projects/:linkId ───────
export const removeCSROrgProjectLink = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id: csr_org_id, linkId } = req.params;
        const [links] = await db.query(
            `SELECT cpl.*, p.title AS project_title, o.name AS org_name
             FROM csr_project_links cpl
             JOIN projects p ON p.id = cpl.project_id
             JOIN csr_organisations o ON o.id = cpl.csr_org_id
             WHERE cpl.id = ? AND cpl.csr_org_id = ?`,
            [linkId, csr_org_id]
        );
        if (!links.length) return errorResponse(res, 'Link not found.', 404);

        const link = links[0];
        const allocated = Number(link.allocated_amount) || 0;
        const spent = Number(link.spent_amount) || 0;

        await conn.beginTransaction();

        if (spent <= 0) {
            // Unspent: Safe to completely remove
            await conn.query('DELETE FROM csr_project_links WHERE id = ?', [linkId]);
            await conn.query(
                'DELETE FROM project_budget_allocations WHERE project_id = ? AND csr_org_id = ? LIMIT 1',
                [link.project_id, csr_org_id]
            );
            if (allocated > 0) {
                await conn.query(
                    'UPDATE projects SET budget = GREATEST(COALESCE(spent, 0), budget - ?) WHERE id = ?',
                    [allocated, link.project_id]
                );
            }
            await logActivity(conn, req.admin?.full_name,
                `removed CSR partnership for project '${link.project_title}' from '${link.org_name}' (₹${allocated} released)`);
            await conn.commit();
            return successResponse(res, { data: { action: 'deleted', released_amount: allocated } }, 'Project link removed and allocation released.');
        } else {
            // Spent > 0: Rule 3 - Close link and release only the unspent amount
            const unspent = Math.max(0, allocated - spent);

            // Update link status to 'Closed' and set allocated_amount to spent
            await conn.query(
                `UPDATE csr_project_links
                 SET status = 'Closed', allocated_amount = ?, updated_at = NOW()
                 WHERE id = ?`,
                [spent, linkId]
            );

            // Update corresponding budget allocation amount to spent
            await conn.query(
                `UPDATE project_budget_allocations
                 SET amount = ?
                 WHERE project_id = ? AND csr_org_id = ?
                 LIMIT 1`,
                [spent, link.project_id, csr_org_id]
            );

            // Deduct only unspent amount from project budget
            if (unspent > 0) {
                await conn.query(
                    'UPDATE projects SET budget = GREATEST(COALESCE(spent, 0), budget - ?) WHERE id = ?',
                    [unspent, link.project_id]
                );
            }

            await logActivity(conn, req.admin?.full_name,
                `closed CSR partnership for project '${link.project_title}' with '${link.org_name}' (₹${spent} utilised, ₹${unspent} released)`);
            await conn.commit();
            return successResponse(res, { data: { action: 'closed', retained_amount: spent, released_amount: unspent } }, `Project partnership closed. ₹${spent.toLocaleString('en-IN')} retained in historical budget and ₹${unspent.toLocaleString('en-IN')} unspent released.`);
        }
    } catch (err) {
        await conn.rollback();
        console.error('[removeCSROrgProjectLink]', err);
        return errorResponse(res, 'Server error removing link.');
    } finally {
        conn.release();
    }
};

// ── GET /api/projects/:id/csr-funders ─────────────────────────
export const getProjectCSRFunders = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT
                cpl.id              AS link_id,
                cpl.csr_org_id,
                cpl.allocated_amount,
                cpl.spent_amount,
                cpl.status          AS link_status,
                cpl.notes,
                o.name              AS org_name,
                o.type              AS org_type,
                o.status            AS org_status,
                o.responsible_person,
                o.email,
                o.phone
             FROM csr_project_links cpl
             JOIN csr_organisations o ON o.id = cpl.csr_org_id
             WHERE cpl.project_id = ? AND o.deleted = 0
             ORDER BY cpl.allocated_amount DESC`,
            [id]
        );
        return successResponse(res, { data: { data: rows } }, 'CSR funders fetched.');
    } catch (err) {
        console.error('[getProjectCSRFunders]', err);
        return errorResponse(res, 'Server error.');
    }
};
