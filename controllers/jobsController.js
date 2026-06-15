import pool from '../configs/db.js';
import { successResponse, errorResponse, slugify } from '../utils/helpers.js';
import { runMulter, uploadJobDocuments } from '../configs/multerS3.js';

// ─── HELPER: Auto-expire jobs ──────────────────────────────
const updateExpiredJobs = async () => {
    try {
        await pool.query("UPDATE jobs SET status = 'expired' WHERE deadline < CURDATE() AND status = 'active'");
    } catch (e) {
        console.error('Failed to auto-expire jobs:', e);
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/jobs
//  Public — paginated, search, filter
// ─────────────────────────────────────────────────────────────
export const getJobs = async (req, res) => {
    // Check for expired jobs first
    await updateExpiredJobs();

    const { search, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    try {
        let where = 'WHERE 1=1';
        const params = [];

        if (status) {
            where += ' AND status = ?';
            params.push(status);
        }

        if (search) {
            const like = `%${search}%`;
            where += ' AND (title LIKE ? OR employer LIKE ?)';
            params.push(like, like);
        }

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM jobs ${where}`, params);

        const [rows] = await pool.query(
            `SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Parse JSON fields
        const formattedRows = rows.map(row => ({
            ...row,
            qualifications: typeof row.qualifications === 'string' ? JSON.parse(row.qualifications || '[]') : row.qualifications || [],
            requirements: typeof row.requirements === 'string' ? JSON.parse(row.requirements || '[]') : row.requirements || [],
            responsibilities: typeof row.responsibilities === 'string' ? JSON.parse(row.responsibilities || '[]') : row.responsibilities || [],
        }));

        return successResponse(res, {
            data: formattedRows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Jobs fetched successfully.');
    } catch (err) {
        console.error('[getJobs]', err);
        return errorResponse(res, 'Failed to fetch jobs.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/jobs/:idOrSlug
//  Public
// ─────────────────────────────────────────────────────────────
export const getJobByIdOrSlug = async (req, res) => {
    const { idOrSlug } = req.params;
    await updateExpiredJobs();

    try {
        const query = isNaN(idOrSlug)
            ? 'SELECT * FROM jobs WHERE slug = ?'
            : 'SELECT * FROM jobs WHERE id = ?';

        const [[job]] = await pool.query(query, [idOrSlug]);

        if (!job) return errorResponse(res, 'Job not found.', 404);

        job.qualifications = typeof job.qualifications === 'string' ? JSON.parse(job.qualifications || '[]') : job.qualifications || [];
        job.requirements = typeof job.requirements === 'string' ? JSON.parse(job.requirements || '[]') : job.requirements || [];
        job.responsibilities = typeof job.responsibilities === 'string' ? JSON.parse(job.responsibilities || '[]') : job.responsibilities || [];

        return successResponse(res, { data: job }, 'Job fetched successfully.');
    } catch (err) {
        console.error('[getJobByIdOrSlug]', err);
        return errorResponse(res, 'Failed to fetch job.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/jobs
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const createJob = async (req, res) => {
    const { title, employer, location, salary, type, status, deadline, posted_date, description, qualifications, requirements, responsibilities } = req.body;

    if (!title || !employer || !location || !deadline) {
        return errorResponse(res, 'Title, employer, location, and deadline are required.', 400);
    }

    try {
        const baseSlug = slugify(title);
        let slug = baseSlug;
        let count = 1;

        while (true) {
            const [[existing]] = await pool.query('SELECT id FROM jobs WHERE slug = ?', [slug]);
            if (!existing) break;
            slug = `${baseSlug}-${count++}`;
        }

        const [[{ maxId }]] = await pool.query('SELECT MAX(id) as maxId FROM jobs');
        const nextId = (maxId || 0) + 1;
        const jobRef = `JOB-${400 + nextId}`; // Starting from JOB-401 for legacy match

        const [result] = await pool.query(
            `INSERT INTO jobs (job_ref, slug, title, employer, location, salary, type, status, deadline, posted_date, description, qualifications, requirements, responsibilities)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                jobRef, slug, title, employer, location, salary || null, type || 'Full Time', status || 'active', deadline, posted_date || new Date(),
                description || null,
                JSON.stringify(qualifications || []),
                JSON.stringify(requirements || []),
                JSON.stringify(responsibilities || [])
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: row }, 'Job created successfully.', 201);
    } catch (err) {
        console.error('[createJob]', err);
        return errorResponse(res, 'Failed to create job.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/jobs/:id
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const updateJob = async (req, res) => {
    const { id } = req.params;
    const { title, employer, location, salary, type, status, deadline, posted_date, description, qualifications, requirements, responsibilities } = req.body;

    if (!title || !employer || !location || !deadline) {
        return errorResponse(res, 'Title, employer, location, and deadline are required.', 400);
    }

    try {
        const [[existing]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
        if (!existing) return errorResponse(res, 'Job not found.', 404);

        let slug = existing.slug;
        if (title !== existing.title) {
            const baseSlug = slugify(title);
            slug = baseSlug;
            let count = 1;
            while (true) {
                const [[duplicate]] = await pool.query('SELECT id FROM jobs WHERE slug = ? AND id != ?', [slug, id]);
                if (!duplicate) break;
                slug = `${baseSlug}-${count++}`;
            }
        }

        await pool.query(
            `UPDATE jobs SET slug = ?, title = ?, employer = ?, location = ?, salary = ?, type = ?, status = ?, deadline = ?, posted_date = ?, description = ?, qualifications = ?, requirements = ?, responsibilities = ?
             WHERE id = ?`,
            [
                slug, title, employer, location, salary || null, type, status, deadline, posted_date, description || null,
                JSON.stringify(qualifications || []),
                JSON.stringify(requirements || []),
                JSON.stringify(responsibilities || []),
                id
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
        return successResponse(res, { data: row }, 'Job updated successfully.');
    } catch (err) {
        console.error('[updateJob]', err);
        return errorResponse(res, 'Failed to update job.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/jobs/:id
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const deleteJob = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM jobs WHERE id = ?', [id]);
        if (!result.affectedRows) return errorResponse(res, 'Job not found.', 404);
        return successResponse(res, {}, 'Job deleted successfully.');
    } catch (err) {
        console.error('[deleteJob]', err);
        return errorResponse(res, 'Failed to delete job.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/jobs/:id/apply
//  Public (Multipart)
// ─────────────────────────────────────────────────────────────
export const submitApplication = async (req, res) => {
    try {
        await runMulter(uploadJobDocuments, req, res);

        const { id } = req.params; // job id or slug? Wait, the route is /:id/apply but job id from form is the slug/job_ref. Wait, let's use the actual numeric id or job_ref.
        // Let's resolve the job first
        const query = isNaN(id) ? 'SELECT id FROM jobs WHERE job_ref = ? OR slug = ?' : 'SELECT id FROM jobs WHERE id = ?';
        const [[job]] = await pool.query(query, [id, id]);

        if (!job) {
            return errorResponse(res, 'Job not found.', 404);
        }

        const { applicantName, email, phone, ward, experience, coverLetter } = req.body;

        if (!applicantName || !phone) {
            return errorResponse(res, 'Name and phone are required.', 400);
        }

        let documents = [];
        if (req.files && req.files.length > 0) {
            documents = req.files.map(file => ({
                name: file.originalname,
                url: file.location || file.path // S3 location
            }));
        }

        // Generate Reference ID
        const refId = `APP-${Math.floor(1000 + Math.random() * 9000)}`;

        const [result] = await pool.query(
            `INSERT INTO job_applications (reference_id, job_id, constituent_id, applicant_name, email, phone, ward, experience, cover_letter, documents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                refId, job.id, req.constituent?.id || null, applicantName, email || null, phone, ward || null, experience || null, coverLetter || null,
                JSON.stringify(documents)
            ]
        );

        return successResponse(res, { reference_id: refId }, 'Application submitted successfully.', 201);
    } catch (err) {
        console.error('[submitApplication]', err);
        return errorResponse(res, 'Failed to submit application.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/jobs/:id/applications
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const getJobApplications = async (req, res) => {
    const { id } = req.params;
    try {
        const [applications] = await pool.query(
            'SELECT * FROM job_applications WHERE job_id = ? ORDER BY submitted_at DESC',
            [id]
        );
        
        const formatted = applications.map(app => ({
            ...app,
            documents: typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || []
        }));

        return successResponse(res, { data: formatted }, 'Applications fetched successfully.');
    } catch (err) {
        console.error('[getJobApplications]', err);
        return errorResponse(res, 'Failed to fetch applications.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/jobs/my-applications
//  Constituent Auth — returns applications for the logged-in constituent
// ─────────────────────────────────────────────────────────────
export const getMyApplications = async (req, res) => {
    try {
        const [applications] = await pool.query(
            `SELECT ja.*, j.title AS job_title, j.employer, j.slug AS job_slug, j.status AS job_status
             FROM job_applications ja
             JOIN jobs j ON ja.job_id = j.id
             WHERE ja.constituent_id = ?
             ORDER BY ja.submitted_at DESC`,
            [req.constituent.id]
        );

        const formatted = applications.map(app => ({
            ...app,
            documents: typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || []
        }));

        return successResponse(res, { data: formatted }, 'Applications fetched successfully.');
    } catch (err) {
        console.error('[getMyApplications]', err);
        return errorResponse(res, 'Failed to fetch your applications.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/jobs/all-applications
//  Admin Auth — returns all applications across all jobs
// ─────────────────────────────────────────────────────────────
export const getAllApplications = async (req, res) => {
    try {
        const { status, job_id } = req.query;
        let where = 'WHERE 1=1';
        const params = [];

        if (status) {
            where += ' AND ja.status = ?';
            params.push(status);
        }

        if (job_id) {
            where += ' AND ja.job_id = ?';
            params.push(job_id);
        }

        const [applications] = await pool.query(
            `SELECT ja.*, j.title AS job_title, j.employer, j.slug AS job_slug
             FROM job_applications ja
             JOIN jobs j ON ja.job_id = j.id
             ${where}
             ORDER BY ja.submitted_at DESC`,
            params
        );

        const formatted = applications.map(app => ({
            ...app,
            documents: typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || []
        }));

        return successResponse(res, { data: formatted }, 'Applications fetched successfully.');
    } catch (err) {
        console.error('[getAllApplications]', err);
        return errorResponse(res, 'Failed to fetch applications.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/jobs/applications/:id
//  Admin Auth — fetch a single application by ID
// ─────────────────────────────────────────────────────────────
export const getApplicationById = async (req, res) => {
    try {
        const { id } = req.params;
        const [applications] = await pool.query(
            `SELECT ja.*, j.title AS job_title, j.employer, j.slug AS job_slug, j.status AS job_status
             FROM job_applications ja
             JOIN jobs j ON ja.job_id = j.id
             WHERE ja.id = ?`,
            [id]
        );

        if (applications.length === 0) {
            return errorResponse(res, 'Application not found.', 404);
        }

        const app = applications[0];
        app.documents = typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || [];

        return successResponse(res, { data: app }, 'Application fetched successfully.');
    } catch (err) {
        console.error('[getApplicationById]', err);
        return errorResponse(res, 'Failed to fetch application.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/jobs/applications/:id/status
//  Admin Auth — update the status of a single application
// ─────────────────────────────────────────────────────────────
export const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return errorResponse(res, 'Status is required.', 400);
        }

        const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected'];
        if (!validStatuses.includes(status)) {
            return errorResponse(res, 'Invalid status.', 400);
        }

        const [result] = await pool.query(
            'UPDATE job_applications SET status = ? WHERE id = ?',
            [status, id]
        );

        if (result.affectedRows === 0) {
            return errorResponse(res, 'Application not found.', 404);
        }

        return successResponse(res, {}, 'Application status updated successfully.');
    } catch (err) {
        console.error('[updateApplicationStatus]', err);
        return errorResponse(res, 'Failed to update application status.');
    }
};
