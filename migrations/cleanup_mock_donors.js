import pool from '../configs/db.js';

const cleanup = async () => {
    try {
        console.log('🧹 Purging mock donor seed entries from MySQL blood_donors table...');
        const mockNames = [
            'Mathew Paul',
            'Fathima Beevi',
            'Subhash Chandran',
            'Jisha Varghese',
            'Kunjappan Tribal',
            'Rahul S. Nair',
        ];

        const [res] = await pool.query(
            'DELETE FROM blood_donors WHERE name IN (?)',
            [mockNames]
        );

        console.log(`✅ Deleted ${res.affectedRows} mock donor seed rows.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
        process.exit(1);
    }
};

cleanup();
