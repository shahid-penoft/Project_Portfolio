/**
 * Run migration 010: Create kothamangalam_settings and ente_nadu_settings tables.
 * Usage: node scripts/runMigration010.js
 */
import db from '../configs/db.js';

const SQL = `
CREATE TABLE IF NOT EXISTS kothamangalam_settings (
    id                 INT          NOT NULL DEFAULT 1,
    data               JSON         NOT NULL,
    section_order      JSON,
    section_visibility JSON,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ente_nadu_settings (
    id                 INT          NOT NULL DEFAULT 1,
    data               JSON         NOT NULL,
    section_order      JSON,
    section_visibility JSON,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
`;

(async () => {
    try {
        // Run each statement separately (mysql2 doesn't support multi-statement by default)
        await db.query(`
            CREATE TABLE IF NOT EXISTS kothamangalam_settings (
                id                 INT          NOT NULL DEFAULT 1,
                data               JSON         NOT NULL,
                section_order      JSON,
                section_visibility JSON,
                updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
        `);
        console.log('✅  kothamangalam_settings table ready.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS ente_nadu_settings (
                id                 INT          NOT NULL DEFAULT 1,
                data               JSON         NOT NULL,
                section_order      JSON,
                section_visibility JSON,
                updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
        `);
        console.log('✅  ente_nadu_settings table ready.');

        console.log('\n🎉  Migration 010 complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌  Migration 010 failed:', err.message);
        process.exit(1);
    }
})();
