import pool from './configs/db.js';

// Migration: Add file_name and file_size_kb to the four media tables.
// Uses separate ALTER statements per column to avoid IF NOT EXISTS limitation in MySQL.
// Safe to re-run: errors for already-existing columns are caught and ignored.

const alterations = [
    // ── issue_media ──────────────────────────────────────────────────────
    `ALTER TABLE issue_media ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER caption`,
    `ALTER TABLE issue_media ADD COLUMN file_size_kb INT UNSIGNED DEFAULT NULL AFTER file_name`,
    `UPDATE issue_media SET file_name = caption WHERE file_name IS NULL AND caption IS NOT NULL`,

    // ── complaint_media ──────────────────────────────────────────────────
    `ALTER TABLE complaint_media ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER caption`,
    `ALTER TABLE complaint_media ADD COLUMN file_size_kb INT UNSIGNED DEFAULT NULL AFTER file_name`,
    `UPDATE complaint_media SET file_name = caption WHERE file_name IS NULL AND caption IS NOT NULL`,

    // ── idea_media ───────────────────────────────────────────────────────
    `ALTER TABLE idea_media ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER caption`,
    `ALTER TABLE idea_media ADD COLUMN file_size_kb INT UNSIGNED DEFAULT NULL AFTER file_name`,
    `UPDATE idea_media SET file_name = caption WHERE file_name IS NULL AND caption IS NOT NULL`,

    // ── suggestion_media ─────────────────────────────────────────────────
    `ALTER TABLE suggestion_media ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER caption`,
    `ALTER TABLE suggestion_media ADD COLUMN file_size_kb INT UNSIGNED DEFAULT NULL AFTER file_name`,
    `UPDATE suggestion_media SET file_name = caption WHERE file_name IS NULL AND caption IS NOT NULL`,
];

async function run() {
    let ok = 0, skipped = 0;
    for (const q of alterations) {
        try {
            await pool.query(q);
            console.log('OK :', q.trim().slice(0, 70));
            ok++;
        } catch (err) {
            // ER_DUP_FIELDNAME = column already exists — safe to skip
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('SKIP (already exists):', q.trim().slice(0, 70));
                skipped++;
            } else {
                console.error('ERROR:', err.message);
                console.error('  Query:', q.trim().slice(0, 100));
            }
        }
    }
    console.log(`\nDone. ${ok} executed, ${skipped} skipped (already existed).`);
    process.exit();
}

run();
