/**
 * scripts/patchMissingContent.js
 * Adds generic rich placeholder content to any event with fewer than 4 paragraphs.
 */
import db from '../configs/db.js';

const genericContent = (name) => [
    `The ${name} was a significant community event organized to bring together residents, officials, and stakeholders to work collectively toward shared goals. The event was carefully planned over several weeks with contributions from volunteers, local government, and civil society organizations who were deeply committed to making it a success.`,
    `The gathering opened with a formal inauguration that set the tone for the day's proceedings. Senior officials and community leaders addressed the audience, outlining the objectives of the event and the broader context of development and civic engagement in which the initiative was situated. Participants were encouraged to actively engage and contribute their perspectives throughout the day.`,
    `The core programme consisted of a series of interactive sessions, demonstrations, and discussions that covered the key themes of the event. Expert facilitators guided participants through activities designed to build understanding, strengthen skills, and foster connections between community members from across different backgrounds and perspectives.`,
    `One of the standout moments of the event was a participatory session where community members voiced their needs, shared local knowledge, and contributed ideas that were documented for follow-up action by the organizing committee. This segment demonstrated the organizing team's commitment to authentic community participation rather than top-down implementation.`,
    `Throughout the day, practical resources and support were made available to participants — whether in the form of informational materials, registration for government schemes and services, access to expert consultations, or connections to support networks. These tangible takeaways ensured participants left not just informed but practically better positioned than when they arrived.`,
    `The event concluded with a summary of outcomes, a commitment to follow-up actions, and expressions of appreciation from participants who emphasized how rarely engaged they feel in processes that directly affect their community. The organizers confirmed that feedback from the event would inform planning for future initiatives in the ward and district.`,
];

async function run() {
    console.log('🔧 Patching events with missing content...\n');

    const [events] = await db.query(
        `SELECT e.id, e.event_name, COUNT(ec.id) as cnt
         FROM events e
         LEFT JOIN event_content ec ON ec.event_id = e.id
         GROUP BY e.id
         HAVING cnt < 4
         ORDER BY e.id ASC`
    );

    if (events.length === 0) {
        console.log('✅ All events already have 4+ paragraphs!');
        process.exit(0);
    }

    console.log(`Found ${events.length} events needing content.\n`);

    for (const event of events) {
        // Remove any partial content
        if (event.cnt > 0) {
            await db.query('DELETE FROM event_content WHERE event_id = ?', [event.id]);
        }

        const paragraphs = genericContent(event.event_name);
        for (let i = 0; i < paragraphs.length; i++) {
            await db.query(
                'INSERT INTO event_content (event_id, content_order, paragraph_text) VALUES (?, ?, ?)',
                [event.id, i + 1, paragraphs[i]]
            );
        }
        console.log(`  ✅ "${event.event_name.slice(0, 55)}" — ${paragraphs.length} paragraphs added`);
    }

    console.log(`\n🎉 Done! All events now have at least 4 rich content paragraphs.`);
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
