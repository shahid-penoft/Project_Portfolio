import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadDocument, uploadImage } from '../configs/multerS3.js';

// Get all settings
export const getAllSettings = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT setting_key, setting_value, description FROM site_settings');
        // Transform array to key-value object for easier frontend use
        const settingsMap = rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});
        return successResponse(res, { data: settingsMap }, 'Settings fetched successfully.');
    } catch (err) {
        console.error('[getAllSettings]', err);
        return errorResponse(res, 'Server error fetching settings.');
    }
};

// Update multiple settings at once
export const updateSettings = async (req, res) => {
    const { settings } = req.body; // Expecting { "key1": "value1", "key2": "value2" }

    if (!settings || typeof settings !== 'object') {
        return errorResponse(res, 'Invalid settings data provided.', 400);
    }

    try {
        const keys = Object.keys(settings);
        if (keys.length === 0) {
            return successResponse(res, null, 'No settings to update.');
        }

        // We use a transaction to ensure all or none are updated
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            for (const key of keys) {
                await connection.query(
                    'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [key, settings[key], settings[key]]
                );
            }

            await connection.commit();
            return successResponse(res, null, 'Settings updated successfully.');
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('[updateSettings]', err);
        return errorResponse(res, 'Server error updating settings.');
    }
};

// Upload Manifesto PDF and update settings
export const uploadManifestoPDF = async (req, res) => {
    try {
        await runMulter(uploadDocument, req, res);

        if (!req.file) {
            return errorResponse(res, 'No file uploaded.', 400);
        }

        const pdfUrl = req.file.location || `/uploads/${req.file.filename}`;
        
        // Update or Insert the manifesto_pdf_url setting
        await db.query(`
            INSERT INTO site_settings (setting_key, setting_value, description)
            VALUES ('manifesto_pdf_url', ?, 'URL to the downloadable Manifesto PDF')
            ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP
        `, [pdfUrl, pdfUrl]);

        return successResponse(res, { url: pdfUrl }, 'Manifesto PDF uploaded and updated successfully.');
    } catch (err) {
        console.error('[uploadManifestoPDF]', err);
        return errorResponse(res, err.message || 'Server error uploading Manifesto PDF.');
    }
};

// Upload Template Image
export const uploadSettingImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);

        if (!req.file) {
            return errorResponse(res, 'No image file uploaded.', 400);
        }

        const imageUrl = req.file.location || `/uploads/${req.file.filename}`;
        
        return successResponse(res, { url: imageUrl }, 'Image uploaded successfully.');
    } catch (err) {
        console.error('[uploadSettingImage]', err);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};

const DEFAULT_LAUNCH_CONFIG = {
    enabled: false,
    launchId: "launch-2026-v1",
    productName: "Kothamangalam MLA Connect",
    title: "Introducing our new Digital Experience",
    description: "Experience the next generation of our platform.",
    buttonText: "Launch Now",
    logoUrl: "",
    backgroundImage: ""
};

// Get Product Launch Configuration (Public)
export const getProductLaunchConfig = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT setting_value FROM site_settings WHERE setting_key = 'product_launch_config'");
        if (rows.length === 0 || !rows[0].setting_value) {
            return successResponse(res, { data: DEFAULT_LAUNCH_CONFIG }, 'Default product launch configuration retrieved.');
        }

        let parsedConfig = DEFAULT_LAUNCH_CONFIG;
        try {
            parsedConfig = typeof rows[0].setting_value === 'string'
                ? JSON.parse(rows[0].setting_value)
                : rows[0].setting_value;
        } catch (e) {
            console.error('[getProductLaunchConfig] JSON parse error:', e);
        }

        return successResponse(res, { data: { ...DEFAULT_LAUNCH_CONFIG, ...parsedConfig } }, 'Product launch configuration retrieved.');
    } catch (err) {
        console.error('[getProductLaunchConfig]', err);
        return errorResponse(res, 'Server error fetching product launch configuration.');
    }
};

// Update Product Launch Configuration (Admin)
export const updateProductLaunchConfig = async (req, res) => {
    try {
        const config = req.body.config || req.body;
        if (!config || typeof config !== 'object') {
            return errorResponse(res, 'Invalid product launch configuration provided.', 400);
        }

        const serializedConfig = JSON.stringify(config);

        await db.query(`
            INSERT INTO site_settings (setting_key, setting_value, description)
            VALUES ('product_launch_config', ?, 'Product Launch Gate configuration')
            ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP
        `, [serializedConfig, serializedConfig]);

        return successResponse(res, { data: config }, 'Product launch configuration updated successfully.');
    } catch (err) {
        console.error('[updateProductLaunchConfig]', err);
        return errorResponse(res, 'Server error updating product launch configuration.');
    }
};

