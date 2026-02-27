/**
 * scripts/seedDummyEvents.js
 * Seeds dummy events, content, and media for testing gallery endpoints.
 */
import db from '../configs/db.js';

async function run() {
    console.log('🌱 Starting dummy events seed...\n');

    // ── 1. Fetch existing lookups ───────────────────────────────
    const [[lbRows], [sectorRows], [etRows]] = await Promise.all([
        db.query('SELECT id, name FROM local_bodies LIMIT 5'),
        db.query('SELECT id, name FROM sectors LIMIT 5'),
        db.query('SELECT id, type_name FROM event_types LIMIT 5'),
    ]);

    console.log(`Found: ${lbRows.length} local bodies, ${sectorRows.length} sectors, ${etRows.length} event types`);

    // ── 2. If missing lookups, create them ─────────────────────
    let lb1 = lbRows[0]?.id, lb2 = lbRows[1]?.id;
    let sec1 = sectorRows[0]?.id, sec2 = sectorRows[1]?.id;
    let et1 = etRows[0]?.id, et2 = etRows[1]?.id;

    if (!lb1) {
        const [r1] = await db.query("INSERT IGNORE INTO local_bodies (name) VALUES ('Thrissur Municipal Corporation')");
        const [r2] = await db.query("INSERT IGNORE INTO local_bodies (name) VALUES ('Palakkad Municipality')");
        lb1 = r1.insertId || (await db.query("SELECT id FROM local_bodies WHERE name='Thrissur Municipal Corporation'"))[0][0]?.id;
        lb2 = r2.insertId || (await db.query("SELECT id FROM local_bodies WHERE name='Palakkad Municipality'"))[0][0]?.id;
        console.log('✅ Created local bodies');
    }

    if (!sec1) {
        const [r1] = await db.query("INSERT IGNORE INTO sectors (name, display_order) VALUES ('Education', 0)");
        const [r2] = await db.query("INSERT IGNORE INTO sectors (name, display_order) VALUES ('Health', 1)");
        sec1 = r1.insertId || (await db.query("SELECT id FROM sectors WHERE name='Education'"))[0][0]?.id;
        sec2 = r2.insertId || (await db.query("SELECT id FROM sectors WHERE name='Health'"))[0][0]?.id;
        console.log('✅ Created sectors');
    }

    if (!et1) {
        const [r1] = await db.query("INSERT IGNORE INTO event_types (type_name) VALUES ('Community Meetup')");
        const [r2] = await db.query("INSERT IGNORE INTO event_types (type_name) VALUES ('Awareness Drive')");
        et1 = r1.insertId || (await db.query("SELECT id FROM event_types WHERE type_name='Community Meetup'"))[0][0]?.id;
        et2 = r2.insertId || (await db.query("SELECT id FROM event_types WHERE type_name='Awareness Drive'"))[0][0]?.id;
        console.log('✅ Created event types');
    }

    // ── 3. Seed events ─────────────────────────────────────────
    const events = [
        {
            event_name: 'Annual Education Summit 2024',
            event_date: '2024-03-15', event_time: '09:00:00', event_time_to: '16:00:00',
            venue: 'Community Hall, Thrissur',
            short_description: 'A major summit to review education outcomes and plan the next academic year.',
            status: 'past', event_type_id: et1, local_body_id: lb1, sector_id: sec1,
        },
        {
            event_name: 'Health Awareness Drive – Palakkad',
            event_date: '2024-07-22', event_time: '08:00:00', event_time_to: '12:00:00',
            venue: 'Town Square, Palakkad',
            short_description: 'Free health checkups and awareness camps for all residents.',
            status: 'past', event_type_id: et2, local_body_id: lb2, sector_id: sec2,
        },
        {
            event_name: 'Smart City Infrastructure Workshop',
            event_date: '2025-01-10', event_time: '10:00:00', event_time_to: '14:00:00',
            venue: 'Municipal Auditorium, Thrissur',
            short_description: 'Workshop on digital infrastructure and smart city planning initiatives.',
            status: 'past', event_type_id: et1, local_body_id: lb1, sector_id: null,
        },
        {
            event_name: 'Women Empowerment Seminar',
            event_date: '2025-03-08', event_time: '09:30:00', event_time_to: '17:00:00',
            venue: 'District Community Center',
            short_description: "Seminar celebrating International Women's Day with skill workshops.",
            status: 'past', event_type_id: et2, local_body_id: null, sector_id: sec1,
        },
        {
            event_name: 'Community Tree Plantation Drive',
            event_date: '2025-06-05', event_time: '07:00:00', event_time_to: '10:00:00',
            venue: 'Riverside Park, Thrissur',
            short_description: 'World Environment Day initiative — planting 1000 saplings across the ward.',
            status: 'past', event_type_id: et1, local_body_id: lb1, sector_id: null,
        },
        {
            event_name: 'Youth Leadership Conference 2025',
            event_date: '2025-09-20', event_time: '10:00:00', event_time_to: '18:00:00',
            venue: 'Town Hall, Palakkad',
            short_description: 'Annual youth leadership conference — inspiring the next generation of civic leaders.',
            status: 'past', event_type_id: et2, local_body_id: lb2, sector_id: sec1,
        },
        {
            event_name: 'Digital Literacy Workshop 2026',
            event_date: '2026-01-15', event_time: '10:00:00', event_time_to: '15:00:00',
            venue: 'Public Library, Thrissur',
            short_description: 'Teaching basic digital skills to senior citizens and homemakers.',
            status: 'past', event_type_id: et1, local_body_id: lb1, sector_id: sec1,
        },
        {
            event_name: 'Health Screening Camp – Thrissur',
            event_date: '2026-03-01', event_time: '08:00:00', event_time_to: '13:00:00',
            venue: 'Ward 7 School Ground, Thrissur',
            short_description: 'Free blood pressure, sugar, and eye screening camps for ward residents.',
            status: 'upcoming', event_type_id: et2, local_body_id: lb1, sector_id: sec2,
        },
        {
            event_name: 'Sector Development Review Meeting',
            event_date: '2026-04-10', event_time: '09:00:00', event_time_to: '12:00:00',
            venue: 'Conference Room, Municipality Office',
            short_description: 'Quarterly review of sector-wise development goals with local representatives.',
            status: 'upcoming', event_type_id: et1, local_body_id: lb2, sector_id: null,
        },
        {
            event_name: 'Annual Cultural Festival',
            event_date: '2026-05-20', event_time: '16:00:00', event_time_to: '22:00:00',
            venue: 'Community Open Stage, Palakkad',
            short_description: 'Celebrating local culture with folk art, music, and food from across the region.',
            status: 'upcoming', event_type_id: et1, local_body_id: lb2, sector_id: null,
        },
    ];


    const eventIds = [];
    for (const ev of events) {
        const [r] = await db.query(
            `INSERT INTO events (event_name, event_date, event_time, event_time_to, venue, short_description, status, event_type_id, local_body_id, sector_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ev.event_name, ev.event_date, ev.event_time, ev.event_time_to ?? null, ev.venue, ev.short_description, ev.status, ev.event_type_id ?? null, ev.local_body_id ?? null, ev.sector_id ?? null]
        );
        eventIds.push(r.insertId);
        console.log(`  ✅ Event "${ev.event_name}" (id: ${r.insertId})`);
    }

    // ── 4. Seed event_content ──────────────────────────────────
    const contents = [
        [eventIds[0], 1, 'The Annual Education Summit 2024 gathered over 500 educators, officials, and parents to discuss academic progress in the region.'],
        [eventIds[0], 2, 'Key outcomes included a new scholarship fund and a commitment to digital classrooms in 20 rural schools.'],
        [eventIds[1], 1, 'The Health Awareness Drive reached over 1200 residents, providing free consultations and distributing medicines.'],
        [eventIds[2], 1, 'The Smart City Workshop highlighted plans for IoT sensors for traffic and waste management across Thrissur.'],
        [eventIds[3], 1, 'Women from various sectors participated in skill training, financial literacy, and leadership development sessions.'],
        [eventIds[4], 1, 'Over 200 volunteers joined hands to plant 1000+ trees along the riverside, contributing to a greener Thrissur.'],
        [eventIds[5], 1, 'Youth leaders from 15 local bodies gathered to discuss civic responsibility and environmental sustainability.'],
    ];
    for (const [event_id, content_order, paragraph_text] of contents) {
        await db.query(
            'INSERT INTO event_content (event_id, content_order, paragraph_text) VALUES (?, ?, ?)',
            [event_id, content_order, paragraph_text]
        );
    }
    console.log('\n  ✅ Event content seeded');

    // ── 5. Seed event_media (photos + videos) ──────────────────
    // Using placeholder public image URLs from Unsplash (for demo purposes)
    const photos = [
        [eventIds[0], 'photo', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800', 'Opening ceremony of Education Summit 2024'],
        [eventIds[0], 'photo', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800', 'Panel discussion on digital education'],
        [eventIds[1], 'photo', 'https://images.unsplash.com/photo-1576765608622-067973a79f53?w=800', 'Free health checkup at Palakkad camp'],
        [eventIds[1], 'photo', 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800', 'Medical team conducting screenings'],
        [eventIds[2], 'photo', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800', 'Smart city infrastructure presentation'],
        [eventIds[3], 'photo', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800', 'Women empowerment workshop session'],
        [eventIds[3], 'photo', 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=800', 'Certificate distribution ceremony'],
        [eventIds[4], 'photo', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800', 'Tree plantation drive at riverside'],
        [eventIds[4], 'photo', 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800', 'Volunteers with saplings'],
        [eventIds[5], 'photo', 'https://images.unsplash.com/photo-1544928147-79a2dbc1f670?w=800', 'Youth leaders at conference'],
        [eventIds[6], 'photo', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800', 'Digital literacy class in progress'],
        [eventIds[7], 'photo', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800', 'Health screening camp setup'],
    ];

    const videos = [
        [eventIds[0], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Education Summit highlights reel'],
        [eventIds[1], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Health camp awareness drive video'],
        [eventIds[3], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Women empowerment seminar highlights'],
        [eventIds[5], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Youth conference recap video'],
        [eventIds[9], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Cultural festival announcement'],
    ];

    for (const [event_id, media_type, file_url, caption] of [...photos, ...videos]) {
        await db.query(
            'INSERT INTO event_media (event_id, media_type, file_url, caption) VALUES (?, ?, ?, ?)',
            [event_id, media_type, file_url, caption]
        );
    }
    console.log(`  ✅ ${photos.length} photos and ${videos.length} videos seeded\n`);

    console.log(`\n🎉 Done! Seeded ${events.length} events with content and media.`);
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
