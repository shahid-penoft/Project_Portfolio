
import pool from './configs/db.js';

async function setup() {
    try {
        console.log('Starting People System Setup...');

        // 1. Create People Table
        console.log('Creating people table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS people (
                id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                full_name       VARCHAR(150)    NOT NULL,
                mobile          VARCHAR(20)     NOT NULL,
                email           VARCHAR(200)    DEFAULT NULL,
                local_body_id   INT UNSIGNED    NOT NULL,
                ward_id         INT UNSIGNED    NOT NULL,
                house_name      VARCHAR(255)    DEFAULT NULL,
                house_no        VARCHAR(50)     DEFAULT NULL,
                voter_id        VARCHAR(50)     DEFAULT NULL,
                gender          ENUM('male', 'female', 'other') DEFAULT 'other',
                date_of_birth   DATE            DEFAULT NULL,
                is_active       BOOLEAN         NOT NULL DEFAULT 1,
                created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE CASCADE,
                FOREIGN KEY (ward_id) REFERENCES local_body_wards(id) ON DELETE CASCADE,
                INDEX idx_mobile (mobile),
                INDEX idx_location (local_body_id, ward_id)
            )
        `);

        // 2. Fetch all Local Bodies
        const [localBodies] = await pool.query('SELECT id, name FROM local_bodies');
        if (localBodies.length === 0) {
            console.log('No local bodies found to seed wards.');
            process.exit(0);
        }

        const WARD_PLACES = [
            'Market Junction', 'Temple Road', 'West Gate', 'East Gate', 'River Side',
            'Hill Side', 'Main Town', 'Station Road', 'Green Valley', 'Park Avenue',
            'Sree Nagar', 'Rose Villa', 'Lake View', 'Church View', 'South End',
            'North End', 'Central Square', 'Old Town', 'New colony', 'Seashore Road'
        ];

        const NAMES = [
            'Rahul Kumar', 'Sneha Nair', 'Arjun Das', 'Meera Menon', 'Vishnu Prasad',
            'Anjali S', 'Karthik Raja', 'Lakshmi Priya', 'Siddharth V', 'Priyanka R',
            'Abhijith K', 'Divya Nair', 'Manu Mohan', 'Soumya P', 'Nithin Das',
            'Reshma B', 'Akshay Kumar', 'Gouthami V', 'Pranav J', 'Kavya S'
        ];

        console.log(`Seeding wards and people for ${localBodies.length} local bodies...`);

        for (const lb of localBodies) {
            // Seed 5 wards per local body
            for (let i = 1; i <= 5; i++) {
                const wardNo = i.toString();
                const placeName = WARD_PLACES[Math.floor(Math.random() * WARD_PLACES.length)];

                try {
                    const [res] = await pool.query(
                        'INSERT IGNORE INTO local_body_wards (local_body_id, ward_no, place_name) VALUES (?, ?, ?)',
                        [lb.id, wardNo, `${lb.name} - ${placeName}`]
                    );

                    let wardId;
                    if (res.insertId) {
                        wardId = res.insertId;
                    } else {
                        const [[existing]] = await pool.query(
                            'SELECT id FROM local_body_wards WHERE local_body_id = ? AND ward_no = ?',
                            [lb.id, wardNo]
                        );
                        wardId = existing.id;
                    }

                    // Seed 3 people per ward
                    for (let j = 1; j <= 3; j++) {
                        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
                        const mobile = '9' + Math.floor(100000000 + Math.random() * 900000000);
                        const email = name.toLowerCase().replace(' ', '.') + Math.floor(Math.random() * 100) + '@example.com';
                        const gender = ['male', 'female', 'other'][Math.floor(Math.random() * 3)];

                        await pool.query(
                            `INSERT INTO people (full_name, mobile, email, local_body_id, ward_id, house_name, gender)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [name, mobile, email, lb.id, wardId, `House ${j}`, gender]
                        );
                    }
                } catch (wardErr) {
                    console.error(`Error seeding ward ${wardNo} for ${lb.name}:`, wardErr.message);
                }
            }
        }

        console.log('Setup completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal setup error:', err);
        process.exit(1);
    }
}

setup();
