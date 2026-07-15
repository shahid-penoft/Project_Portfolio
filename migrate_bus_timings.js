import pool from './configs/db.js';

const migrate = async () => {
  try {
    console.log('Starting bus_timings migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bus_timings (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        type              ENUM('KSRTC','Private','Other State Gov') NOT NULL,
        departure_time    VARCHAR(5)    NOT NULL,
        departure_stand   VARCHAR(255)  NOT NULL,
        route             TEXT          NOT NULL,
        destination_time  VARCHAR(5)    NOT NULL,
        destination_stand VARCHAR(255)  NOT NULL,
        days              JSON          NOT NULL,
        reservation       TINYINT(1)    NOT NULL DEFAULT 1,
        created_by_name   VARCHAR(255)  DEFAULT NULL,
        updated_by_name   VARCHAR(255)  DEFAULT NULL,
        created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Check if empty to seed
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM bus_timings');
    if (rows[0].count === 0) {
      console.log('Seeding mock data...');
      const seedData = [
        ['KSRTC', '05:30', 'Kothamangalam KSRTC Depot', 'Kothamangalam → Perumbavoor → Aluva → Ernakulam', '08:15', 'Ernakulam Bus Terminal', JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']), 1],
        ['Private', '06:00', 'Kothamangalam Private Stand', 'Kothamangalam → Muvattupuzha → Kottayam', '08:30', 'Kottayam Bus Stand', JSON.stringify([]), 0],
        ['KSRTC', '07:00', 'Kothamangalam KSRTC Depot', 'Kothamangalam → Thodupuzha → Kumily', '10:45', 'Kumily Bus Stand', JSON.stringify(['Sun', 'Mon', 'Wed', 'Fri']), 1],
        ['Private', '08:30', 'Kothamangalam Private Stand', 'Kothamangalam → Kalady → Angamaly → Thrissur', '11:15', 'Thrissur Bus Stand', JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']), 0],
        ['KSRTC', '09:00', 'Kothamangalam KSRTC Depot', 'Kothamangalam → Munnar', '12:30', 'Munnar Bus Stand', JSON.stringify([]), 1],
        ['Other State Gov', '10:00', 'Kothamangalam KSRTC Depot', 'Kothamangalam → Coimbatore', '14:30', 'Coimbatore Bus Stand', JSON.stringify(['Mon', 'Wed', 'Fri']), 1]
      ];

      for (const row of seedData) {
        await pool.query(
          `INSERT INTO bus_timings (type, departure_time, departure_stand, route, destination_time, destination_stand, days, reservation, created_by_name, updated_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'System', 'System')`,
          row
        );
      }
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
