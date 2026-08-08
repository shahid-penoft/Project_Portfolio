import db from '../configs/db.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

const ALL_SECTION_IDS = ['page-header', 'overview', 'local-bodies', 'identities', 'visual-stories'];

function filterForSite(sectionOrder, sectionVisibility, site) {
    if (site === 'all') return { sectionOrder, sectionVisibility };
    const filtered = (sectionOrder || ALL_SECTION_IDS).filter((id) => {
        const vis = (sectionVisibility || {})[id] || 'both';
        return vis === 'both' || vis === site;
    });
    return { sectionOrder: filtered, sectionVisibility };
}

// ─── GET /api/kothamangalam-settings ──────────────────────────────────────────
export const getKothamangalamSettings = async (req, res) => {
    try {
        const site = req.query.site || 'portfolio';
        const [rows] = await db.query('SELECT * FROM kothamangalam_settings WHERE id = 1');

        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {},
                section_order: ALL_SECTION_IDS,
                section_visibility: {},
            });
        }

        const row = rows[0];
        const rawData  = typeof row.data               === 'string' ? JSON.parse(row.data)               : row.data;
        const rawOrder = typeof row.section_order      === 'string' ? JSON.parse(row.section_order)      : row.section_order;
        const rawVis   = typeof row.section_visibility === 'string' ? JSON.parse(row.section_visibility) : row.section_visibility;

        const { sectionOrder, sectionVisibility } = filterForSite(rawOrder, rawVis, site);

        return res.status(200).json({
            success: true,
            data: rawData,
            section_order: sectionOrder,
            section_visibility: sectionVisibility,
            updated_at: row.updated_at,
        });
    } catch (error) {
        console.error('[kothamangalamSettingsController.getKothamangalamSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─── PUT /api/kothamangalam-settings ──────────────────────────────────────────
export const updateKothamangalamSettings = async (req, res) => {
    try {
        const { data, section_order, section_visibility } = req.body;
        if (!data) return res.status(400).json({ success: false, message: 'data is required' });

        const dataJson       = typeof data               === 'string' ? data               : JSON.stringify(data);
        const orderJson      = typeof section_order      === 'string' ? section_order      : JSON.stringify(section_order      || ALL_SECTION_IDS);
        const visibilityJson = typeof section_visibility === 'string' ? section_visibility : JSON.stringify(section_visibility || {});

        await db.query(`
            INSERT INTO kothamangalam_settings (id, data, section_order, section_visibility)
            VALUES (1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                data               = VALUES(data),
                section_order      = VALUES(section_order),
                section_visibility = VALUES(section_visibility),
                updated_at         = CURRENT_TIMESTAMP
        `, [dataJson, orderJson, visibilityJson]);

        return res.status(200).json({ success: true, message: 'Kothamangalam settings saved successfully.' });
    } catch (error) {
        console.error('[kothamangalamSettingsController.updateKothamangalamSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─── POST /api/kothamangalam-settings/upload-image ────────────────────────────
export const uploadKothamangalamImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

        const url = req.file.location || `/uploads/${req.file.filename}`;
        return res.status(200).json({ success: true, message: 'Image uploaded successfully.', url });
    } catch (error) {
        console.error('[kothamangalamSettingsController.uploadKothamangalamImage]', error);
        return res.status(500).json({ success: false, message: 'Image upload failed.' });
    }
};
