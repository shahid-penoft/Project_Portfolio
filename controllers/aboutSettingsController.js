import db from '../configs/db.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

// ─── Helper ──────────────────────────────────────────────────────────────────
// Allowed section keys for the visibility filter
const ALL_SECTION_IDS = ['page-header', 'hero', 'journey', 'entrepreneurship', 'vision-mission', 'beliefs', 'recognitions'];

/**
 * Filter section_order and section_visibility for a specific site.
 * site = 'portfolio' | 'mlaconnect' | 'all' (admin uses 'all')
 */
function filterForSite(sectionOrder, sectionVisibility, site) {
    if (site === 'all') return { sectionOrder, sectionVisibility };

    const filtered = (sectionOrder || ALL_SECTION_IDS).filter((id) => {
        const vis = (sectionVisibility || {})[id] || 'both';
        return vis === 'both' || vis === site;
    });

    return { sectionOrder: filtered, sectionVisibility };
}

// ─── GET /api/about-settings ──────────────────────────────────────────────────
// @desc  Fetch about page settings (public)
// @query ?site=portfolio|mlaconnect|all
// @access Public
export const getAboutSettings = async (req, res) => {
    try {
        const site = req.query.site || 'portfolio';

        const [rows] = await db.query('SELECT * FROM about_settings WHERE id = 1');

        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {},
                section_order: ALL_SECTION_IDS,
                section_visibility: {},
            });
        }

        const row = rows[0];
        const rawData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const rawOrder = typeof row.section_order === 'string' ? JSON.parse(row.section_order) : row.section_order;
        const rawVis = typeof row.section_visibility === 'string' ? JSON.parse(row.section_visibility) : row.section_visibility;

        const { sectionOrder, sectionVisibility } = filterForSite(rawOrder, rawVis, site);

        return res.status(200).json({
            success: true,
            data: rawData,
            section_order: sectionOrder,
            section_visibility: sectionVisibility,
            updated_at: row.updated_at,
        });
    } catch (error) {
        console.error('[aboutSettingsController.getAboutSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─── PUT /api/about-settings ──────────────────────────────────────────────────
// @desc  Update / upsert all about page settings
// @access Private (Admin)
export const updateAboutSettings = async (req, res) => {
    try {
        const { data, section_order, section_visibility } = req.body;

        if (!data) {
            return res.status(400).json({ success: false, message: 'data is required' });
        }

        const dataJson       = typeof data              === 'string' ? data              : JSON.stringify(data);
        const orderJson      = typeof section_order     === 'string' ? section_order     : JSON.stringify(section_order     || ALL_SECTION_IDS);
        const visibilityJson = typeof section_visibility === 'string' ? section_visibility : JSON.stringify(section_visibility || {});

        await db.query(`
            INSERT INTO about_settings (id, data, section_order, section_visibility)
            VALUES (1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                data               = VALUES(data),
                section_order      = VALUES(section_order),
                section_visibility = VALUES(section_visibility),
                updated_at         = CURRENT_TIMESTAMP
        `, [dataJson, orderJson, visibilityJson]);

        return res.status(200).json({ success: true, message: 'About settings saved successfully.' });
    } catch (error) {
        console.error('[aboutSettingsController.updateAboutSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─── POST /api/about-settings/upload-image ────────────────────────────────────
// @desc  Upload a section image (hero / entrepreneurship / beliefs)
// @body  FormData: { section: string, file: File }
// @access Private (Admin)
export const uploadSectionImage = async (req, res) => {
    try {
        // Run multer to handle the upload (S3 or local depending on env)
        await runMulter(uploadImage, req, res);

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // S3 upload returns req.file.location; local upload returns req.file.path
        const url = req.file.location || `/uploads/${req.file.filename}`;

        return res.status(200).json({
            success: true,
            message: 'Image uploaded successfully.',
            url,
        });
    } catch (error) {
        console.error('[aboutSettingsController.uploadSectionImage]', error);
        return res.status(500).json({ success: false, message: 'Image upload failed.' });
    }
};
