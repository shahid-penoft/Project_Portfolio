/**
 * DEV SEED — seed_teams_log.js
 * Inserts the 20 canonical mock log entries into admin_activity_logs.
 * DO NOT run in production.
 *
 * Usage: node seed_teams_log.js
 */
import db from './configs/db.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMySQLDatetime = (isoStr) =>
    new Date(isoStr).toISOString().slice(0, 19).replace('T', ' ');

const ENTRIES = [
    { timestamp: '2026-07-09T10:32:00', userName: 'Anjali Nair',    action: 'Created',           module: 'Complaints',     details: "Filed new complaint — Road Damage near Kothamangalam Junction",              resource: 'complaints/124',                  severity: 'info'    },
    { timestamp: '2026-07-09T09:15:00', userName: 'Mohammed Ali',   action: 'Updated',           module: 'CM Funds',       details: "Updated CMDRF application status to 'Disbursed' — Dialysis Support",      resource: 'cm-funds/89',                     severity: 'success' },
    { timestamp: '2026-07-09T08:45:00', userName: 'Priya Menon',    action: 'Deleted',           module: 'Letters',        details: "Deleted letter draft — NOC Community Hall Ward 12",                        resource: 'letters/draft/56',                severity: 'error'   },
    { timestamp: '2026-07-08T22:10:00', userName: 'Ranjith Kumar',  action: 'Logged In',         module: 'Authentication', details: "Admin login successful from new device",                                    resource: 'auth/login',                      severity: 'neutral' },
    { timestamp: '2026-07-08T18:30:00', userName: 'Anjali Nair',    action: 'Created',           module: 'Governing Body', details: "Added new member — Ramachandran K. Ward 3 Kothamangalam GP",              resource: 'governing-bodies/panchayat/members', severity: 'info' },
    { timestamp: '2026-07-08T16:00:00', userName: 'Mohammed Ali',   action: 'Updated',           module: 'Settings',       details: "Changed dropdown options for Complaint Categories",                        resource: 'settings/dropdowns/12',           severity: 'warning' },
    { timestamp: '2026-07-08T14:20:00', userName: 'Priya Menon',    action: 'Created',           module: 'Public Issue',   details: "Filed public issue — Water Supply Disruption in Kuttampuzha",             resource: 'issues/new',                      severity: 'info'    },
    { timestamp: '2026-07-08T11:55:00', userName: null,             action: 'Auto-Archived',     module: 'Complaints',     details: "Auto-archived 15 complaints older than 90 days",                          resource: 'system/archive',                  severity: 'neutral', ip: '127.0.0.1', ua: 'System' },
    { timestamp: '2026-07-08T09:30:00', userName: 'Ranjith Kumar',  action: 'Updated',           module: 'Projects',       details: "Updated project status — Kothamangalam Market Renovation",               resource: 'projects/47',                     severity: 'success' },
    { timestamp: '2026-07-07T21:00:00', userName: 'Anjali Nair',    action: 'Logged Out',        module: 'Authentication', details: "Admin logout",                                                             resource: 'auth/logout',                     severity: 'neutral' },
    { timestamp: '2026-07-07T17:45:00', userName: 'Mohammed Ali',   action: 'Created',           module: 'Ideas',          details: "Submitted new idea — Smart Street Lighting for Kothamangalam",           resource: 'ideas/203',                       severity: 'info'    },
    { timestamp: '2026-07-07T15:20:00', userName: 'Priya Menon',    action: 'Deleted',           module: 'Dropdowns',      details: "Deleted dropdown option 'Other' from Complaint Categories",              resource: 'settings/dropdowns/8/items',      severity: 'error'   },
    { timestamp: '2026-07-07T13:10:00', userName: null,             action: 'Permission Changed', module: 'Roles',         details: "Updated role 'Editor' — added 'complaints.delete' permission",           resource: 'settings/roles/3',                severity: 'warning', ip: '127.0.0.1', ua: 'System' },
    { timestamp: '2026-07-07T11:00:00', userName: 'Ranjith Kumar',  action: 'Created',           module: 'CSR',            details: "Added new CSR organisation — Green Earth Foundation",                    resource: 'csr/organisations/new',           severity: 'info'    },
    { timestamp: '2026-07-07T08:30:00', userName: 'Anjali Nair',    action: 'Updated',           module: 'Home',           details: "Updated hero section banner and CTA text",                               resource: 'home/hero',                       severity: 'success' },
    { timestamp: '2026-07-06T19:45:00', userName: 'Mohammed Ali',   action: 'Created',           module: 'Templates',      details: "Created new email template — CMDRF Acknowledgement",                     resource: 'settings/templates/new',          severity: 'info'    },
    { timestamp: '2026-07-06T16:30:00', userName: 'Priya Menon',    action: 'Archived',          module: 'Events',         details: "Archived past event — Kothamangalam Festival 2026",                     resource: 'events/archive/56',               severity: 'neutral' },
    { timestamp: '2026-07-06T14:00:00', userName: 'Ranjith Kumar',  action: 'Updated',           module: 'User Management',details: "Changed role of user 'sneha@example.com' from Viewer to Editor",       resource: 'settings/users/12',               severity: 'warning' },
    { timestamp: '2026-07-06T10:15:00', userName: null,             action: 'Backup Completed',  module: 'System',         details: "Automated daily database backup completed — 1.2 GB",                     resource: 'system/backup',                   severity: 'success', ip: '127.0.0.1', ua: 'System' },
    { timestamp: '2026-07-06T07:00:00', userName: 'Anjali Nair',    action: 'Created',           module: 'Quick Addition', details: "Quick draft saved — CM Funds application for Sarada Devi",             resource: 'quick-addition/cm-funds',         severity: 'info'    },
];

// Realistic UA strings by user
const UA_MAP = {
    'Anjali Nair':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mohammed Ali':  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Priya Menon':   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Ranjith Kumar': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.0.0',
};

const IP_MAP = {
    'Anjali Nair':   '192.168.1.45',
    'Mohammed Ali':  '192.168.1.32',
    'Priya Menon':   '192.168.1.78',
    'Ranjith Kumar': '192.168.1.15',
};

const seed = async () => {
    const conn = await db.getConnection();
    try {
        console.log('🌱 Starting seed_teams_log...');

        // Fetch real admin_user_id values
        const [users] = await conn.query('SELECT id, full_name FROM admin_users');
        const userIdMap = {};
        users.forEach(u => { userIdMap[u.full_name] = u.id; });

        // Check if already seeded to avoid duplicates
        const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM admin_activity_logs');
        if (Number(cnt) > 0) {
            console.log(`ℹ️  admin_activity_logs already has ${cnt} rows. Skipping seed.`);
            process.exit(0);
        }

        await conn.beginTransaction();

        for (const e of ENTRIES) {
            const adminUserId = e.userName ? (userIdMap[e.userName] ?? null) : null;
            const ip = e.ip ?? (e.userName ? IP_MAP[e.userName] : '127.0.0.1') ?? '127.0.0.1';
            const ua = e.ua ?? (e.userName ? UA_MAP[e.userName] : 'System') ?? 'System';

            await conn.query(
                `INSERT INTO admin_activity_logs
                 (admin_user_id, action, module, details, severity, ip_address, user_agent, resource, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [adminUserId, e.action, e.module, e.details, e.severity, ip, ua, e.resource, toMySQLDatetime(e.timestamp)]
            );
        }

        await conn.commit();
        console.log(`✅ Seeded ${ENTRIES.length} log entries into admin_activity_logs.`);
        process.exit(0);
    } catch (err) {
        await conn.rollback();
        console.error('❌ Seed failed:', err);
        process.exit(1);
    } finally {
        conn.release();
    }
};

seed();
