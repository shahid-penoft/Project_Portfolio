import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // Create table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ente_nadu_cards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                icon_name VARCHAR(100) DEFAULT 'Info',
                order_index INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Table "ente_nadu_cards" verified/created.');

        // Check if data exists
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM ente_nadu_cards');
        if (rows[0].count === 0) {
            const initialCards = [
                ['Karunyasparsham', 'Medical aid and emergency care for critically ill patients.', 'Activity'],
                ['Thanal', 'Affordable housing and shelter for economically weaker families.', 'Home'],
                ['Vidyan', 'Infrastructure support and scholarships for underprivileged students and schools.', 'GraduationCap'],
                ['Mahiladarshan', 'Women empowerment programs focused on livelihood, dignity, and gender equity.', 'Users']
            ];

            await connection.query(
                'INSERT INTO ente_nadu_cards (title, description, icon_name, order_index) VALUES ?',
                [initialCards.map((c, i) => [...c, i])]
            );
            console.log('Seeded initial Ente Nadu cards.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
