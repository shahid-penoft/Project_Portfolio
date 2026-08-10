import db from '../configs/db.js';

// ─── Helper ──────────────────────────────────────────────────────────────────
// Allowed section keys for the visibility filter
const ALL_SECTION_IDS = ['page-header', 'office-info', 'contact-numbers', 'email-addresses', 'social-media'];

/**
 * Filter section_visibility for a specific site.
 * site = 'portfolio' | 'mlaconnect' | 'all' (admin uses 'all')
 */
function filterForSite(sectionVisibility, site) {
    if (site === 'all') return { sectionVisibility };

    // For public sites, only return visibility config if it matches the site or is 'both'
    const filteredVisibility = {};
    for (const id of ALL_SECTION_IDS) {
        const vis = (sectionVisibility || {})[id] || 'both';
        if (vis === 'both' || vis === site) {
            filteredVisibility[id] = vis;
        } else {
            filteredVisibility[id] = 'none'; // Mark as hidden for this site
        }
    }

    return { sectionVisibility: filteredVisibility };
}

// ─── GET /api/contact-settings ────────────────────────────────────────────────
// @desc  Fetch contact page settings (public)
// @query ?site=portfolio|mlaconnect|all
// @access Public
export const getContactSettings = async (req, res) => {
    try {
        const site = req.query.site || 'portfolio';

        const [rows] = await db.query('SELECT * FROM contact_settings WHERE id = 1');

        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {},
                section_visibility: {},
            });
        }

        const row = rows[0];
        const rawData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const rawVis = typeof row.section_visibility === 'string' ? JSON.parse(row.section_visibility) : row.section_visibility;

        const { sectionVisibility } = filterForSite(rawVis, site);

        return res.status(200).json({
            success: true,
            data: rawData,
            section_visibility: sectionVisibility,
            updated_at: row.updated_at,
        });
    } catch (error) {
        console.error('[contactSettingsController.getContactSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─── PUT /api/contact-settings ────────────────────────────────────────────────
// @desc  Update / upsert all contact page settings
// @access Private (Admin)
export const updateContactSettings = async (req, res) => {
    try {
        const { data, section_visibility } = req.body;

        if (!data) {
            return res.status(400).json({ success: false, message: 'data is required' });
        }

        const dataJson = typeof data === 'string' ? data : JSON.stringify(data);
        const visibilityJson = typeof section_visibility === 'string' ? section_visibility : JSON.stringify(section_visibility || {});

        await db.query(`
            INSERT INTO contact_settings (id, data, section_visibility)
            VALUES (1, ?, ?)
            ON DUPLICATE KEY UPDATE
                data               = VALUES(data),
                section_visibility = VALUES(section_visibility),
                updated_at         = CURRENT_TIMESTAMP
        `, [dataJson, visibilityJson]);

        return res.status(200).json({ success: true, message: 'Contact settings saved successfully.' });
    } catch (error) {
        console.error('[contactSettingsController.updateContactSettings]', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};
