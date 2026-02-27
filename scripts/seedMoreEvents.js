/**
 * scripts/seedMoreEvents.js
 * Seeds 10 more dummy events with content and media.
 */
import db from '../configs/db.js';

async function run() {
    console.log('🌱 Seeding 10 more events...\n');

    const [[lbRows], [sectorRows], [etRows]] = await Promise.all([
        db.query('SELECT id FROM local_bodies LIMIT 5'),
        db.query('SELECT id FROM sectors LIMIT 5'),
        db.query('SELECT id FROM event_types LIMIT 5'),
    ]);

    const lb1 = lbRows[0]?.id, lb2 = lbRows[1]?.id, lb3 = lbRows[2]?.id;
    const sec1 = sectorRows[0]?.id, sec2 = sectorRows[1]?.id, sec3 = sectorRows[2]?.id;
    const et1 = etRows[0]?.id, et2 = etRows[1]?.id;

    const events = [
        {
            event_name: 'Road Safety Awareness Campaign',
            event_date: '2024-01-20', event_time: '08:00:00', event_time_to: '11:00:00',
            venue: 'NH 544, Thrissur Bypass',
            short_description: 'Campaign promoting road safety, helmet usage, and lane discipline for commuters.',
            status: 'past', event_type_id: et2, local_body_id: lb1, sector_id: null,
        },
        {
            event_name: 'Farmers\' Market & Agri Expo 2024',
            event_date: '2024-04-14', event_time: '07:00:00', event_time_to: '19:00:00',
            venue: 'District Agricultural Office, Palakkad',
            short_description: 'Two-day expo connecting farmers with buyers, featuring organic produce and modern farming techniques.',
            status: 'past', event_type_id: et1, local_body_id: lb2, sector_id: sec3,
        },
        {
            event_name: 'Senior Citizens\' Wellness Day',
            event_date: '2024-06-01', event_time: '09:00:00', event_time_to: '13:00:00',
            venue: 'Ward Community Hall, Thrissur',
            short_description: 'Dedicated health and wellness day for senior citizens — yoga, health talks, and free checkups.',
            status: 'past', event_type_id: et2, local_body_id: lb1, sector_id: sec2,
        },
        {
            event_name: 'Water Conservation Workshop',
            event_date: '2024-09-10', event_time: '10:00:00', event_time_to: '14:00:00',
            venue: 'Municipal Office Conference Hall',
            short_description: 'Workshop on rainwater harvesting, groundwater recharge, and sustainable water usage for households.',
            status: 'past', event_type_id: et1, local_body_id: lb3, sector_id: null,
        },
        {
            event_name: 'MSME Development Seminar',
            event_date: '2024-11-15', event_time: '10:00:00', event_time_to: '17:00:00',
            venue: 'Business Facilitation Centre, Palakkad',
            short_description: 'Seminar supporting micro and small enterprises with funding, licensing, and digital marketing guidance.',
            status: 'past', event_type_id: et1, local_body_id: lb2, sector_id: sec1,
        },
        {
            event_name: 'Anti-Drug Awareness Drive',
            event_date: '2025-02-26', event_time: '09:00:00', event_time_to: '12:00:00',
            venue: 'Govt. Higher Secondary School, Thrissur',
            short_description: 'Awareness campaign for students and parents on the dangers of substance abuse.',
            status: 'past', event_type_id: et2, local_body_id: lb1, sector_id: sec1,
        },
        {
            event_name: 'Plastic-Free Ward Initiative Launch',
            event_date: '2025-04-22', event_time: '07:30:00', event_time_to: '10:00:00',
            venue: 'Ward 12 Market Area, Thrissur',
            short_description: 'Launch of the plastic-free ward initiative with clean-up drives and distribution of cloth bags.',
            status: 'past', event_type_id: et1, local_body_id: lb1, sector_id: null,
        },
        {
            event_name: 'Children\'s Sports & Talent Fest',
            event_date: '2025-12-25', event_time: '09:00:00', event_time_to: '18:00:00',
            venue: 'Sports Complex, Palakkad',
            short_description: 'Annual fest for children featuring sports, drawing, dance, and science competitions.',
            status: 'upcoming', event_type_id: et1, local_body_id: lb2, sector_id: sec1,
        },
        {
            event_name: 'IT Job Fair 2026',
            event_date: '2026-02-14', event_time: '10:00:00', event_time_to: '17:00:00',
            venue: 'Government Engineering College, Thrissur',
            short_description: 'Job fair for engineering graduates and IT professionals — 30+ companies participating.',
            status: 'past', event_type_id: et2, local_body_id: lb1, sector_id: sec1,
        },
        {
            event_name: 'Monsoon Preparedness Meeting',
            event_date: '2026-05-30', event_time: '09:00:00', event_time_to: '11:30:00',
            venue: 'Panchayat Meeting Hall',
            short_description: 'Pre-monsoon coordination between officials, NDRF, and local volunteers for disaster preparedness.',
            status: 'upcoming', event_type_id: et1, local_body_id: lb3, sector_id: null,
        },
    ];

    const eventIds = [];
    for (const ev of events) {
        const [r] = await db.query(
            `INSERT INTO events (event_name, event_date, event_time, event_time_to, venue, short_description, status, event_type_id, local_body_id, sector_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ev.event_name, ev.event_date, ev.event_time, ev.event_time_to ?? null,
            ev.venue, ev.short_description, ev.status,
            ev.event_type_id ?? null, ev.local_body_id ?? null, ev.sector_id ?? null]
        );
        eventIds.push(r.insertId);
        console.log(`  ✅ "${ev.event_name}" (id: ${r.insertId})`);
    }

    // Photos for the new events
    const photos = [
        [eventIds[0], 'photo', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800', 'Road safety awareness event on the bypass'],
        [eventIds[1], 'photo', 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800', 'Farmers displaying organic produce at the expo'],
        [eventIds[1], 'photo', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800', 'Modern farming techniques demonstration'],
        [eventIds[2], 'photo', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800', 'Yoga session for senior citizens'],
        [eventIds[3], 'photo', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Rainwater harvesting model at workshop'],
        [eventIds[4], 'photo', 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800', 'MSME seminar panel discussion'],
        [eventIds[5], 'photo', 'https://images.unsplash.com/photo-1509390144018-eebeab9b7f3d?w=800', 'Anti-drug awareness session at school'],
        [eventIds[6], 'photo', 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800', 'Plastic-free ward launch event with cloth bags'],
        [eventIds[7], 'photo', 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=800', 'Children participating in sports at the fest'],
        [eventIds[8], 'photo', 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800', 'IT job fair entrance and company stalls'],
        [eventIds[8], 'photo', 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800', 'Job seekers interacting with recruiters'],
        [eventIds[9], 'photo', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800', 'Monsoon preparedness meeting with officials'],
    ];

    const videos = [
        [eventIds[0], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Road safety campaign highlights'],
        [eventIds[1], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Farmers market expo walkthrough'],
        [eventIds[5], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Anti-drug awareness drive video'],
        [eventIds[8], 'video', 'https://www.w3schools.com/html/mov_bbb.mp4', 'IT job fair recap'],
    ];

    for (const [event_id, media_type, file_url, caption] of [...photos, ...videos]) {
        await db.query(
            'INSERT INTO event_media (event_id, media_type, file_url, caption) VALUES (?, ?, ?, ?)',
            [event_id, media_type, file_url, caption]
        );
    }

    console.log(`\n  ✅ ${photos.length} photos and ${videos.length} videos seeded`);
    console.log(`\n🎉 Done! 10 more events seeded successfully.`);
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
