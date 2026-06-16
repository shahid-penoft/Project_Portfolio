import pool from './configs/db.js';
import fs from 'fs';

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tourism_attractions (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                slug            VARCHAR(255) UNIQUE NOT NULL,
                title           VARCHAR(255) NOT NULL,
                description     TEXT,
                image           VARCHAR(500),
                location        VARCHAR(255),
                category        VARCHAR(100) DEFAULT 'Other',
                map_url         VARCHAR(500),
                opening_time    VARCHAR(10),
                closing_time    VARCHAR(10),
                days_open       JSON,
                published_by    VARCHAR(100) DEFAULT 'MLA Office',
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('Created tourism_attractions table');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tourism_suggestions (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                title           VARCHAR(255) NOT NULL,
                description     TEXT,
                location        VARCHAR(255),
                map_url         VARCHAR(500),
                opening_time    VARCHAR(10),
                closing_time    VARCHAR(10),
                days_open       JSON,
                image_url       VARCHAR(500),
                submitter_name  VARCHAR(255),
                status          ENUM('pending','approved','rejected') DEFAULT 'pending',
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created tourism_suggestions table');

        // Append to schema.sql
        const appendSql = `

-- Tourism Attractions (admin-managed)
CREATE TABLE IF NOT EXISTS tourism_attractions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    image           VARCHAR(500),
    location        VARCHAR(255),
    category        VARCHAR(100) DEFAULT 'Other',
    map_url         VARCHAR(500),
    opening_time    VARCHAR(10),
    closing_time    VARCHAR(10),
    days_open       JSON,
    published_by    VARCHAR(100) DEFAULT 'MLA Office',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tourism Suggestions (from SuggestPlaceModal — constituent submissions)
CREATE TABLE IF NOT EXISTS tourism_suggestions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    location        VARCHAR(255),
    map_url         VARCHAR(500),
    opening_time    VARCHAR(10),
    closing_time    VARCHAR(10),
    days_open       JSON,
    image_url       VARCHAR(500),
    submitter_name  VARCHAR(255),
    status          ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
        fs.appendFileSync('schema.sql', appendSql);
        console.log('Appended to schema.sql');
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
migrate();
