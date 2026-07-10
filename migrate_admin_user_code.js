import db from './configs/db.js';

const migrate = async () => {
    const conn = await db.getConnection();
    try {
        console.log('Starting migrate_admin_user_code migration...');

        // 1. Add the column (skip if already exists)
        const [cols] = await conn.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'admin_users'
              AND COLUMN_NAME  = 'user_code'
        `);

        if (cols.length === 0) {
            await conn.query(`
                ALTER TABLE admin_users
                ADD COLUMN user_code VARCHAR(20) DEFAULT NULL AFTER full_name
            `);
            console.log('✅ Column user_code added to admin_users.');
        } else {
            console.log('ℹ️  Column user_code already exists — skipping ADD.');
        }

        // 2. Back-fill NULL user_codes with generated codes
        await conn.query(`
            UPDATE admin_users
            SET user_code = CONCAT(UPPER(SUBSTR(full_name, 1, 3)), LPAD(id, 3, '0'))
            WHERE user_code IS NULL OR user_code = ''
        `);
        console.log('✅ user_code back-filled for existing admin_users.');

        // 3. Add unique constraint (skip if already exists)
        const [idxs] = await conn.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'admin_users'
              AND INDEX_NAME   = 'uq_user_code'
        `);

        if (idxs.length === 0) {
            await conn.query(`
                ALTER TABLE admin_users
                ADD UNIQUE KEY uq_user_code (user_code)
            `);
            console.log('✅ Unique index uq_user_code added.');
        } else {
            console.log('ℹ️  Unique index uq_user_code already exists — skipping.');
        }

        console.log('✅ migrate_admin_user_code completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        conn.release();
    }
};

migrate();
