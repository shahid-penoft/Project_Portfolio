import db from './configs/db.js';

const migrateJobs = async () => {
    try {
        console.log('Starting Jobs Migration...');

        // 1. Create jobs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                job_ref     VARCHAR(20) UNIQUE,
                slug        VARCHAR(255) UNIQUE NOT NULL,
                title       VARCHAR(255) NOT NULL,
                employer    VARCHAR(255) NOT NULL,
                location    VARCHAR(255) NOT NULL,
                salary      VARCHAR(255),
                type        ENUM('Full Time','Part Time','Part Time / Full Time','Contract','Internship') DEFAULT 'Full Time',
                status      ENUM('active','expired') DEFAULT 'active',
                deadline    DATE NOT NULL,
                posted_date DATE NOT NULL DEFAULT (CURDATE()),
                description TEXT,
                qualifications  JSON,
                requirements    JSON,
                responsibilities JSON,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ jobs table created');

        // 2. Create job_applications table
        await db.query(`
            CREATE TABLE IF NOT EXISTS job_applications (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                reference_id   VARCHAR(20) UNIQUE,
                job_id         INT NOT NULL,
                constituent_id INT,
                applicant_name VARCHAR(255) NOT NULL,
                email          VARCHAR(255),
                phone          VARCHAR(30) NOT NULL,
                ward           VARCHAR(100),
                experience     VARCHAR(100),
                cover_letter   TEXT,
                documents      JSON,
                status         ENUM('pending','reviewed','shortlisted','rejected') DEFAULT 'pending',
                submitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ job_applications table created');

        console.log('Jobs Migration Completed Successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrateJobs();
