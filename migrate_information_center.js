import pool from './configs/db.js';

const migrate = async () => {
  try {
    console.log('[InformationCenter] Starting migration...');

    // ─── 1. Main posts table ───────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS information_posts (
        id                      INT AUTO_INCREMENT PRIMARY KEY,
        title                   VARCHAR(500)  NOT NULL,
        category                VARCHAR(100)  DEFAULT NULL COMMENT 'First domain value (backward compat)',
        domains                 JSON          DEFAULT NULL COMMENT 'Array of domain strings',
        status                  ENUM('Draft','Scheduled','Published') NOT NULL DEFAULT 'Draft',
        web                     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Show on public website',
        rich_content            LONGTEXT      DEFAULT NULL COMMENT 'HTML body from RichTextEditor',
        tags_count              INT           NOT NULL DEFAULT 0 COMMENT 'Cached count of tags_list',
        tags_list               JSON          DEFAULT NULL COMMENT 'Array of tag strings',
        thumbnail_url           VARCHAR(1000) DEFAULT NULL,
        action_button_label     VARCHAR(255)  DEFAULT NULL,
        action_button_url       VARCHAR(1000) DEFAULT NULL,
        action_button_external  TINYINT(1)    NOT NULL DEFAULT 0,
        created_by_name         VARCHAR(255)  DEFAULT NULL,
        updated_by_name         VARCHAR(255)  DEFAULT NULL,
        created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_updated_at (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[InformationCenter] information_posts table ready.');

    // ─── 2. Attachments table ──────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS information_post_attachments (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        post_id     INT          NOT NULL,
        name        VARCHAR(500) NOT NULL COMMENT 'Original filename',
        size        VARCHAR(50)  DEFAULT NULL COMMENT 'Human-readable size e.g. 1.24 MB',
        mime_type   VARCHAR(100) DEFAULT NULL,
        url         VARCHAR(1000) NOT NULL COMMENT 'Path under /uploads/',
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ip_attachment_post FOREIGN KEY (post_id)
          REFERENCES information_posts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[InformationCenter] information_post_attachments table ready.');

    // ─── 3. Activity log table ─────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS information_post_activity (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        post_id     INT          NOT NULL,
        author_name VARCHAR(255) DEFAULT NULL,
        text        TEXT         NOT NULL,
        time        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ip_activity_post FOREIGN KEY (post_id)
          REFERENCES information_posts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[InformationCenter] information_post_activity table ready.');

    // ─── 4. Seed initial data from mockData ───────────────────
    const [existing] = await pool.query('SELECT COUNT(*) as count FROM information_posts');
    if (existing[0].count === 0) {
      console.log('[InformationCenter] Seeding mock data...');

      const seed = [
        {
          title: 'PM Kisan Samman Nidhi - New Registration Open for 2026',
          category: 'Agriculture',
          domains: JSON.stringify(['Agriculture']),
          status: 'Published',
          web: 1,
          rich_content: 'The Government of India has opened fresh registrations for the PM-KISAN scheme for 2026. Eligible farmers can now apply through the official portal or the nearest Common Service Centre. Under this scheme, eligible farmers receive Rs.6,000 per year in three equal instalments directly to their bank accounts.',
          tags_count: 3,
          tags_list: JSON.stringify(['kisan', 'subsidy', 'registration']),
          action_button_label: 'Apply Now',
          action_button_url: 'https://pmkisan.gov.in',
          action_button_external: 1,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Rajesh Kumar',
        },
        {
          title: 'Free Health Camp at Kothamangalam Taluk Hospital - 12 July',
          category: 'Health',
          domains: JSON.stringify(['Health']),
          status: 'Published',
          web: 1,
          rich_content: 'A free health check-up camp is being organised at Kothamangalam Taluk Hospital on 12 July 2026. The camp offers general health screenings, blood pressure monitoring, diabetes testing, and specialist consultations.',
          tags_count: 3,
          tags_list: JSON.stringify(['health', 'camp', 'free-checkup']),
          action_button_label: 'Learn More',
          action_button_url: 'https://kothamangalamhospital.kerala.gov.in',
          action_button_external: 0,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Priya Menon',
        },
        {
          title: 'Scholarship Applications Open - Kerala State Welfare Board',
          category: 'Education',
          domains: JSON.stringify(['Education']),
          status: 'Published',
          web: 0,
          rich_content: 'The Kerala State Welfare Board has announced scholarship applications for students from economically weaker sections. The scholarship covers tuition fees, books, and a monthly stipend.',
          tags_count: 3,
          tags_list: JSON.stringify(['scholarship', 'education', 'welfare']),
          action_button_label: 'Submit Application',
          action_button_url: 'https://welfareboard.kerala.gov.in/scholarship',
          action_button_external: 1,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Arun Nair',
        },
        {
          title: 'Road Widening Project - NH 85 Update',
          category: 'Infrastructure',
          domains: JSON.stringify(['Infrastructure']),
          status: 'Draft',
          web: 0,
          rich_content: 'The National Highway 85 road widening project has entered its second phase. The project aims to widen the road to four lanes, improving connectivity and reducing travel time.',
          tags_count: 3,
          tags_list: JSON.stringify(['infrastructure', 'NH85', 'road-widening']),
          action_button_label: null,
          action_button_url: null,
          action_button_external: 0,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Rajesh Kumar',
        },
        {
          title: 'MGNREGS Job Card Renewal - 2026-27',
          category: 'Social Welfare',
          domains: JSON.stringify(['Social Welfare']),
          status: 'Published',
          web: 1,
          rich_content: 'MGNREGS job card renewal for 2026-27 is now open. Beneficiaries must renew their job cards at their respective Gram Panchayat offices.',
          tags_count: 2,
          tags_list: JSON.stringify(['MGNREGS', 'job-card']),
          action_button_label: 'Know More',
          action_button_url: 'https://nregs.kerala.gov.in',
          action_button_external: 0,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Anjali Nair',
        },
        {
          title: 'Onam Bumper 2026 - Kerala Lottery Draw Announced',
          category: 'Announcements',
          domains: JSON.stringify(['Announcements']),
          status: 'Draft',
          web: 0,
          rich_content: 'The Kerala Government has announced the Onam Bumper Lottery 2026 draw. Tickets are available at all authorised lottery outlets across the state.',
          tags_count: 2,
          tags_list: JSON.stringify(['onam', 'lottery']),
          action_button_label: null,
          action_button_url: null,
          action_button_external: 0,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Kiran Babu',
        },
        {
          title: 'Ration Card Correction Camp - Ward-wise Schedule',
          category: 'Government',
          domains: JSON.stringify(['Government']),
          status: 'Published',
          web: 1,
          rich_content: 'Ration card correction camps will be held ward-wise across the constituency. Residents with discrepancies in their ration cards are encouraged to attend with supporting documents.',
          tags_count: 2,
          tags_list: JSON.stringify(['ration-card', 'correction']),
          action_button_label: 'View Schedule',
          action_button_url: 'https://civilsupplieskerala.gov.in',
          action_button_external: 0,
          created_by_name: 'Arun Nair',
          updated_by_name: 'Priya Menon',
        },
      ];

      for (const row of seed) {
        const [result] = await pool.query(
          `INSERT INTO information_posts
            (title, category, domains, status, web, rich_content, tags_count, tags_list,
             action_button_label, action_button_url, action_button_external,
             created_by_name, updated_by_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.title, row.category, row.domains, row.status, row.web,
            row.rich_content, row.tags_count, row.tags_list,
            row.action_button_label, row.action_button_url, row.action_button_external,
            row.created_by_name, row.updated_by_name,
          ]
        );

        // Seed one activity log entry per post
        await pool.query(
          `INSERT INTO information_post_activity (post_id, author_name, text) VALUES (?, ?, ?)`,
          [result.insertId, row.created_by_name, 'Post record created in system']
        );
      }

      console.log('[InformationCenter] Seed data inserted (7 posts).');
    } else {
      console.log(`[InformationCenter] Skipping seed — ${existing[0].count} post(s) already exist.`);
    }

    console.log('[InformationCenter] Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('[InformationCenter] Migration failed:', err);
    process.exit(1);
  }
};

migrate();
