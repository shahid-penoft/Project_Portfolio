import db from '../configs/db.js';

async function migrate() {
    try {
        console.log('🚀 Starting Local Bodies migration (v2)...');
        
        const [columns] = await db.query('SHOW COLUMNS FROM local_bodies');
        const columnNames = columns.map(c => c.Field);

        const newColumns = [
            { name: 'short_description', type: 'TEXT DEFAULT NULL' },
            { name: 'cover_image', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'population', type: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'area', type: 'VARCHAR(100) DEFAULT NULL' }
        ];

        for (const col of newColumns) {
            if (!columnNames.includes(col.name)) {
                console.log(`📡 Adding column: ${col.name}`);
                await db.query(`ALTER TABLE local_bodies ADD COLUMN ${col.name} ${col.type}`);
            } else {
                console.log(`✅ Column already exists: ${col.name}`);
            }
        }

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
