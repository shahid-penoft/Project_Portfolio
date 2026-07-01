import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

const CATEGORY_MAP = {
    "Religious Sites": ["Church", "Temple", "Mosque", "Shrine", "Chapel", "Monastery", "Synagogue"],
    "Water Bodies":    ["Lake", "Pond", "River", "Waterfall", "Beach", "Canal", "Reservoir"],
    "Public Places":   ["Park", "Garden", "Town Square", "Market", "Playground", "Amphitheatre"],
    "Government":      ["Office", "Court", "Police Station", "Fire Station", "Panchayat", "Secretariat"],
    "Educational":     ["School", "College", "University", "Library", "Research Centre", "Vocational Institute"],
    "Tourist Spots":   ["Museum", "Monument", "Fort", "Heritage Site", "Zoo", "Botanical Garden"],
    "Healthcare":      ["Hospital", "Clinic", "Pharmacy", "Health Centre", "Dispensary"],
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // 1. Create geo_categories table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS geo_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                parent_id INT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES geo_categories(id) ON DELETE CASCADE
            )
        `);
        console.log('Table "geo_categories" verified/created.');

        // 2. Check if data is already seeded
        const [rows] = await connection.query(`SELECT count(*) as count FROM geo_categories`);
        if (rows[0].count === 0) {
            console.log('Seeding initial geo categories...');
            for (const [parentName, subCategories] of Object.entries(CATEGORY_MAP)) {
                const [parentResult] = await connection.query(
                    `INSERT INTO geo_categories (name, parent_id) VALUES (?, NULL)`,
                    [parentName]
                );
                const parentId = parentResult.insertId;

                for (const subName of subCategories) {
                    await connection.query(
                        `INSERT INTO geo_categories (name, parent_id) VALUES (?, ?)`,
                        [subName, parentId]
                    );
                }
            }
            console.log('Seed completed successfully.');
        } else {
            console.log('Categories already exist, skipping seed.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
