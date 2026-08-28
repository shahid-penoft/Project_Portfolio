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
        console.log('Checking & migrating csr_organisations compliance and document columns...');

        // 1. section_80g
        try {
            await db.query(`ALTER TABLE csr_organisations ADD COLUMN section_80g TINYINT(1) NOT NULL DEFAULT 0;`);
            console.log('✓ column section_80g added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column section_80g already exists.');
            else throw e;
        }

        // 2. fcra_registered
        try {
            await db.query(`ALTER TABLE csr_organisations ADD COLUMN fcra_registered TINYINT(1) NOT NULL DEFAULT 0;`);
            console.log('✓ column fcra_registered added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column fcra_registered already exists.');
            else throw e;
        }

        // 3. csr_policy
        try {
            await db.query(`ALTER TABLE csr_organisations ADD COLUMN csr_policy TINYINT(1) NOT NULL DEFAULT 0;`);
            console.log('✓ column csr_policy added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column csr_policy already exists.');
            else throw e;
        }

        // 4. documents
        try {
            await db.query(`ALTER TABLE csr_organisations ADD COLUMN documents JSON DEFAULT NULL;`);
            console.log('✓ column documents added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column documents already exists.');
            else throw e;
        }

        console.log('🎉 Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
