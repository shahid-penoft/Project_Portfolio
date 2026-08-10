import db from './configs/db.js';

const migrateContactSettings = async () => {
    try {
        console.log('Starting contact_settings migration...');

        // 1. Create the table
        await db.query(`
            CREATE TABLE IF NOT EXISTS contact_settings (
                id INT PRIMARY KEY DEFAULT 1,
                data JSON NOT NULL,
                section_visibility JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CHECK (id = 1)
            )
        `);
        console.log('contact_settings table created or already exists.');

        // 2. Fetch existing contact data from site_settings
        const [rows] = await db.query(`
            SELECT setting_key, setting_value FROM site_settings 
            WHERE setting_key IN (
                'contact_page_title', 'contact_page_subtitle',
                'office_address', 'office_map_url',
                'contact_landline', 'contact_whatsapp', 'contact_phone',
                'email_general', 'email_support',
                'social_facebook', 'social_instagram', 'social_youtube', 'social_linkedin', 'social_x'
            )
        `);

        // Convert to map
        const settingsMap = rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});

        // 3. Build the structured JSON payload
        const data = {
            pageHeader: {
                title: settingsMap.contact_page_title || 'Connect With Us',
                subtitle: settingsMap.contact_page_subtitle || 'Reach out for enquiries, support, or to share your thoughts. We are here to listen and engage with every constituent.',
            },
            officeInfo: {
                office_address: settingsMap.office_address || '',
                office_map_url: settingsMap.office_map_url || '',
            },
            contactNumbers: {
                contact_landline: settingsMap.contact_landline || '',
                contact_whatsapp: settingsMap.contact_whatsapp || '',
                contact_phone: settingsMap.contact_phone || '',
            },
            emailAddresses: {
                email_general: settingsMap.email_general || '',
                email_support: settingsMap.email_support || '',
            },
            socialMedia: {
                social_facebook: settingsMap.social_facebook || '',
                social_instagram: settingsMap.social_instagram || '',
                social_youtube: settingsMap.social_youtube || '',
                social_linkedin: settingsMap.social_linkedin || '',
                social_x: settingsMap.social_x || '',
            }
        };

        const section_visibility = {
            'page-header': 'both',
            'office-info': 'both',
            'contact-numbers': 'both',
            'email-addresses': 'both',
            'social-media': 'both'
        };

        // 4. Insert or Update
        await db.query(`
            INSERT INTO contact_settings (id, data, section_visibility)
            VALUES (1, ?, ?)
            ON DUPLICATE KEY UPDATE
                data = VALUES(data),
                section_visibility = VALUES(section_visibility),
                updated_at = CURRENT_TIMESTAMP
        `, [JSON.stringify(data), JSON.stringify(section_visibility)]);

        console.log('contact_settings seeded successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
};

migrateContactSettings();
