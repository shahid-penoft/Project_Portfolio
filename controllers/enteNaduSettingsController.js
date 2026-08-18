import db from '../configs/db.js';

const ALL_SECTION_IDS = ['page-header', 'overview', 'structure', 'impact-metrics', 'sectors', 'projects', 'achievements', 'media-gallery', 'testimonials'];

function filterForSite(sectionOrder, sectionVisibility, site) {
    if (site === 'all') return { sectionOrder, sectionVisibility };
    const filtered = (sectionOrder || ALL_SECTION_IDS).filter((id) => {
        const vis = (sectionVisibility || {})[id] || 'both';
        return vis === 'both' || vis === site;
    });
    return { sectionOrder: filtered, sectionVisibility };
}

// ─── GET /api/ente-nadu-settings ──────────────────────────────────────────────
export const getEnteNaduSettings = async (req, res) => {
    try {
        const site = req.query.site || 'portfolio';
        const [rows] = await db.query('SELECT * FROM ente_nadu_settings WHERE id = 1');

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
        const pageVisibility = (rawVis || {})['page-header'] || (rawData || {}).page_visibility || 'both';

        return res.status(200).json({
            success: true,
            data: rawData,
            section_order: sectionOrder,
            section_visibility: sectionVisibility,
            page_visibility: pageVisibility,
            is_visible_on_site: pageVisibility === 'both' || pageVisibility === site,
            updated_at: row.updated_at,
        });
    } catch (error) {
        console.error('[enteNaduSettingsController.getEnteNaduSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─── PUT /api/ente-nadu-settings ──────────────────────────────────────────────
export const updateEnteNaduSettings = async (req, res) => {
    try {
        const { data, section_order, section_visibility, page_visibility } = req.body;
        if (!data) return res.status(400).json({ success: false, message: 'data is required' });

        let parsedVis = typeof section_visibility === 'string' ? JSON.parse(section_visibility) : (section_visibility || {});
        if (page_visibility) {
            parsedVis['page-header'] = page_visibility;
        }

        const dataJson       = typeof data === 'string' ? data : JSON.stringify(data);
        const orderJson      = typeof section_order === 'string' ? section_order : JSON.stringify(section_order || ALL_SECTION_IDS);
        const visibilityJson = JSON.stringify(parsedVis);

        await db.query(`
            INSERT INTO ente_nadu_settings (id, data, section_order, section_visibility)
            VALUES (1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                data               = VALUES(data),
                section_order      = VALUES(section_order),
                section_visibility = VALUES(section_visibility),
                updated_at         = CURRENT_TIMESTAMP
        `, [dataJson, orderJson, visibilityJson]);

        return res.status(200).json({ success: true, message: 'Ente Nadu settings saved successfully.' });
    } catch (error) {
        console.error('[enteNaduSettingsController.updateEnteNaduSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};
