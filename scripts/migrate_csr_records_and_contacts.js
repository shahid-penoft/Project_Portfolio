import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const db = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
});

async function migrate() {
    try {
        console.log('Migrating CSR organisations & contacts tables...');

        // 1. Add created_by & updated_by to csr_organisations
        try {
            await db.query(`ALTER TABLE csr_organisations ADD COLUMN created_by INT UNSIGNED DEFAULT NULL;`);
            console.log('✓ column created_by added to csr_organisations.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column created_by already exists on csr_organisations.');
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE csr_organisations ADD COLUMN updated_by INT UNSIGNED DEFAULT NULL;`);
            console.log('✓ column updated_by added to csr_organisations.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column updated_by already exists on csr_organisations.');
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE csr_organisations ADD INDEX idx_csr_org_created_by (created_by);`);
            console.log('✓ index idx_csr_org_created_by added.');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') console.log('✓ index idx_csr_org_created_by already exists.');
        }

        try {
            await db.query(`ALTER TABLE csr_organisations ADD INDEX idx_csr_org_updated_by (updated_by);`);
            console.log('✓ index idx_csr_org_updated_by added.');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') console.log('✓ index idx_csr_org_updated_by already exists.');
        }

        // 2. Add contact fields to csr_organisation_contacts
        try {
            await db.query(`ALTER TABLE csr_organisation_contacts ADD COLUMN alternate_phone VARCHAR(50) DEFAULT NULL;`);
            console.log('✓ column alternate_phone added to csr_organisation_contacts.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column alternate_phone already exists on csr_organisation_contacts.');
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE csr_organisation_contacts ADD COLUMN alternate_email VARCHAR(255) DEFAULT NULL;`);
            console.log('✓ column alternate_email added to csr_organisation_contacts.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column alternate_email already exists on csr_organisation_contacts.');
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE csr_organisation_contacts ADD COLUMN remarks TEXT DEFAULT NULL;`);
            console.log('✓ column remarks added to csr_organisation_contacts.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column remarks already exists on csr_organisation_contacts.');
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE csr_organisation_contacts ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0;`);
            console.log('✓ column is_primary added to csr_organisation_contacts.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column is_primary already exists on csr_organisation_contacts.');
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE csr_organisation_contacts ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;`);
            console.log('✓ column updated_at added to csr_organisation_contacts.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column updated_at already exists on csr_organisation_contacts.');
            else throw e;
        }

        console.log('✅ CSR migration completed successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

migrate();
