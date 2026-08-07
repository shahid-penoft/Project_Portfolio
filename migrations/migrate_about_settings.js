import db from '../configs/db.js';

const DEFAULT_ORDER = JSON.stringify([
    'page-header',
    'hero',
    'journey',
    'entrepreneurship',
    'vision-mission',
    'beliefs',
    'recognitions',
]);

const DEFAULT_VISIBILITY = JSON.stringify({
    'hero': 'both',
    'journey': 'both',
    'entrepreneurship': 'both',
    'vision-mission': 'both',
    'beliefs': 'both',
    'recognitions': 'both',
});

const DEFAULT_DATA = JSON.stringify({
    pageHeader: {
        title: 'About',
        subtitle: 'Unfolding the story of leadership, vision, and dedication that drives Kothamangalam toward a brighter future.',
    },
    heroData: {
        title: 'Overview',
        description: 'I am Shibu Theckumpuram, deeply honored to serve as the Member of Legislative Assembly for Kothamangalam Constituency. My journey has been driven by a singular purpose: to bring meaningful progress and ensure every voice in our community is heard. By focusing on sustainable development, transparent governance, and inclusive growth, I strive to make Kothamangalam a model constituency.',
        roles: [
            'MLA – Kothamangalam Constituency',
            'District President – Kerala Congress (Joseph)',
            'District Convenor – UDF Ernakulam',
            'Chairman – Ente Nadu Janakeeya Koottayma',
        ],
        buttons: [{ label: 'Explore My Journey', url: '#journey' }],
        imageUrl: null,
    },
    journeyData: {
        title: 'My Journey',
        description: 'From student activism to strategic district leadership, Shibu\'s political life is defined by integrity, accessibility, and reform-oriented work.',
    },
    entrepreneurshipData: {
        title: 'Entrepreneurship',
        description: 'Alongside his political career, Shibu Theckumpuram is a financial institution known for ethical business, financial inclusion, and public accountability. This unique blend of business leadership and public responsibility has allowed him to design and support scalable welfare programs and community-driven models.',
        quoteText: 'Business success must lead\nto community success',
        imageUrl: null,
    },
    visionMission: {
        title: 'Vision & Mission',
        visionTitle: 'My Vision',
        visionText: 'To build a modern, progressive, and self-reliant Kothamangalam where every citizen has access to world-class infrastructure, quality education, and equitable healthcare, fostering a community that thrives on innovation while preserving its rich cultural heritage.',
        missionTitle: 'My Mission',
        missionText: 'To implement transparent and inclusive governance, bridge the gap between policy and people, and execute sustainable development projects that elevate the standard of living for all residents, leaving no one behind.',
        coreValues: ['Transparency', 'Development', 'Integrity', 'Inclusivity'],
    },
    beliefsData: {
        title: 'Beliefs That Drive Me',
        beliefs: [
            'Politics should listen before it leads.',
            'Empowerment > Dependency.',
            'Social justice is not charity — it\'s a right.',
            'Local solutions matter most.',
            'Young voices and women\'s leadership are the future.',
        ],
        imageUrl: null,
    },
    recognitionsData: {
        title: 'Recognitions & Achievements',
        description: 'A testament to consistent dedication and impactful public service.',
    },
});

async function migrate() {
    try {
        console.log('Creating about_settings table...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS about_settings (
                id               INT          NOT NULL DEFAULT 1,
                data             JSON         NOT NULL,
                section_order    JSON         NOT NULL,
                section_visibility JSON       NOT NULL,
                updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('Table created (or already exists). Seeding default row...');

        // Insert only if the row doesn't exist yet
        await db.query(`
            INSERT IGNORE INTO about_settings (id, data, section_order, section_visibility)
            VALUES (1, ?, ?, ?)
        `, [DEFAULT_DATA, DEFAULT_ORDER, DEFAULT_VISIBILITY]);

        console.log('✅ about_settings migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
