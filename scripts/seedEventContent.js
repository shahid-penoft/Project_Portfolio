/**
 * scripts/seedEventContent.js
 * Adds rich long-form content paragraphs to the 10 most recently seeded events.
 */
import db from '../configs/db.js';

async function run() {
    console.log('📝 Seeding rich content for recent events...\n');

    // Get the 10 most recent events (the ones just seeded)
    const [recent] = await db.query(
        `SELECT id, event_name FROM events ORDER BY id DESC LIMIT 10`
    );

    // Reverse so index 0 = oldest of the 10 (Road Safety), 9 = newest (Monsoon)
    recent.reverse();

    const contentMap = {
        // Road Safety Awareness Campaign
        0: [
            `The Road Safety Awareness Campaign organized on January 20, 2024 marked a significant milestone in our community's effort to address the growing concern of road accidents in and around Thrissur. The event drew participation from over 800 commuters, students, and residents who gathered at the NH 544 bypass stretch to witness live demonstrations, participate in pledge drives, and engage with traffic safety officials.`,
            `The campaign was inaugurated by the District Collector alongside senior police officials and members of the Road Safety Council. Participants were educated on the importance of wearing helmets, following lane discipline, using seatbelts, and avoiding mobile phone usage while driving. Street plays performed by local youth groups effectively conveyed the consequences of reckless driving and drunk driving.`,
            `A key highlight of the event was the interactive stall set up by the Motor Vehicles Department, where citizens could learn about traffic rules, penalty systems, and safe driving practices. Volunteers distributed over 2,000 reflective stickers and pamphlets in both Malayalam and English covering the key road safety guidelines. Schools participated through essay and poster competitions on the theme "Safe Roads, Safe Lives."`,
            `The organizers also announced the installation of additional road signage, speed bumps near school zones, and improved pedestrian crossings along the bypass as follow-up measures. A pledge was taken by all participants to promote responsible driving and spread road safety awareness in their communities.`,
        ],

        // Farmers' Market & Agri Expo 2024
        1: [
            `The Farmers' Market and Agricultural Expo 2024 held at the District Agricultural Office in Palakkad on April 14, 2024 was a landmark event that brought together over 150 farmers, agricultural scientists, entrepreneurs, and government officials under one roof. The expo spanned two days and served as a much-needed platform for farmers to showcase their produce, connect with buyers, and learn about advancements in modern agriculture.`,
            `The event opened with an address by the District Agriculture Officer who emphasized the government's commitment to doubling farmer income through technology adoption, fair pricing mechanisms, and cooperative farming. The expo featured dedicated zones for organic produce, horticulture, floriculture, spice farming, and farm equipment.`,
            `Live demonstrations were held on drip irrigation, mulching techniques, bio-pesticide preparation, and the use of drones in precision agriculture. Agri-tech startups showcased their mobile applications that help farmers track weather, soil conditions, and access real-time market prices. A soil testing lab was set up on-site where farmers could get free results within hours.`,
            `One of the most celebrated aspects of the expo was the direct farmer-to-consumer sessions where buyers from leading supermarkets and grocery chains met directly with farmers to negotiate supply contracts, eliminating intermediaries. The Women Farmers' Collective received a special recognition award for their contributions to organic vegetable cultivation in the region. The event concluded with a commitment from the government to host such expos quarterly going forward.`,
        ],

        // Senior Citizens' Wellness Day
        2: [
            `The Senior Citizens' Wellness Day organized on June 1, 2024 was a heartfelt initiative by the Ward Community Hall in Thrissur to honor and support the elderly population of the area. The event brought together over 300 senior citizens for a wholesome day of health awareness, recreation, and community bonding.`,
            `The morning session began with a gentle yoga and pranayama class led by certified yoga instructors who demonstrated breathing exercises and low-impact postures specifically designed for older adults. Participants were guided through calming meditation techniques to manage stress, anxiety, and insomnia — common challenges faced by the elderly.`,
            `A dedicated health checkup camp was organized in collaboration with a leading local hospital. Doctors and paramedics provided free screening for blood pressure, blood sugar, eye conditions, bone density, and dental health. Over 250 seniors availed themselves of these services, with follow-up consultations arranged for those needing further medical attention. Medicines were distributed free of charge to those with chronic conditions under the State's senior citizen welfare scheme.`,
            `The afternoon session featured cultural performances by a local arts group, followed by a memory-stimulation activity workshop using puzzles, music, and storytelling. The event also facilitated enrollment of eligible participants into various government schemes for senior citizens, including pension benefits, travel concessions, and home care support. Attendees expressed overwhelming appreciation for the initiative and requested that such events be organized at least twice a year.`,
        ],

        // Water Conservation Workshop
        3: [
            `The Water Conservation Workshop held on September 10, 2024 at the Municipal Office Conference Hall brought together civic engineers, environmental activists, homemakers, students, and local government officials to address the urgent need for sustainable water management in the region. With rainfall patterns becoming increasingly unpredictable, the workshop underscored the need for community-level interventions.`,
            `The workshop opened with a sobering presentation on the declining groundwater table across Kerala's panchayat regions, citing data from the State Groundwater Department. Experts explained how unchecked construction, deforestation, and overuse of borewells are contributing to water scarcity. Participants were shown visual comparisons of water table levels from the past two decades, making the urgency very tangible.`,
            `Three expert sessions covered the practical implementation of rainwater harvesting systems for individual homes, recharge pits for apartment complexes, and canal restoration projects at the ward level. Engineers demonstrated affordable models of rooftop rainwater collection units that can be installed at costs as low as ₹5,000 for a standard household. Participants were provided a step-by-step guide to applying for government subsidies for water conservation infrastructure.`,
            `A field visit was organized for 40 participants to a nearby ward that had successfully implemented community-level rainwater harvesting, resulting in a measurable rise in groundwater level over two years. The workshop concluded with the formation of a Ward Water Committee tasked with drafting a five-year water conservation plan and monitoring progress through quarterly reviews.`,
        ],

        // MSME Development Seminar
        4: [
            `The MSME Development Seminar conducted on November 15, 2024 at the Business Facilitation Centre in Palakkad was a pivotal event for the region's small business ecosystem. Over 200 micro, small, and medium enterprise owners, startup founders, and aspiring entrepreneurs gathered for a day-long program focused on empowering businesses with the tools, knowledge, and networks needed to grow.`,
            `The seminar was inaugural by the District Industries Centre Director, who outlined the government's recently enhanced credit guarantee schemes, collateral-free loan initiatives, and sector-specific support packages for MSMEs. Representatives from leading banks including SBI, Canara, and Kerala Financial Corporation were present to explain loan products, interest subvention schemes, and the MUDRA Loan programme for new entrepreneurs.`,
            `Dedicated sessions were held on GST compliance, digital bookkeeping, and e-commerce onboarding. A live demonstration showed entrepreneurs how to register their products on Amazon, Flipkart, and the Government-backed e-marketplace Gem. Participants were guided through the process of obtaining Udyam Registration, FSSAI certification, and ISO standards where relevant to their business sectors.`,
            `One of the most productive segments was a 90-minute mentorship networking session where established business leaders were paired with emerging entrepreneurs. Topics covered included pricing strategy, supply chain management, branding on a budget, and leveraging social media for customer acquisition. The day ended with 12 participants signing letters of intent with larger anchor buyers — a concrete outcome that underscored the seminar's real-world value.`,
        ],

        // Anti-Drug Awareness Drive
        5: [
            `The Anti-Drug Awareness Drive conducted at the Government Higher Secondary School, Thrissur on February 26, 2025 was a powerful and emotionally resonant campaign aimed at equipping students, parents, and teachers with the knowledge to identify, prevent, and respond to substance abuse among youth. The event drew attendance from over 600 students across three schools, accompanied by their teachers and parents.`,
            `The programme opened with a video presentation featuring testimonials from young people who had overcome addiction, followed by a talk by a clinical psychologist who explained the neurological and psychological impact of substance abuse. She addressed common misconceptions about drug use being a sign of weakness, emphasizing that addiction is a disease that requires compassion, treatment, and support rather than stigma.`,
            `Police officials from the Anti-Narcotics Cell explained the legal consequences of drug possession, peddling, and consumption, and how gangs target young people through social media platforms and peer pressure. Students were shown how to report suspicious behavior anonymously and how to seek help without fear. Role-playing activities helped students practice how to say no in social situations where they might be pressured to try substances.`,
            `A special parent-teacher session was held separately, guiding adults on warning signs of drug use, how to approach a conversation with their child, and where to access professional counseling support. The school announced the formation of an Anti-Drug Student Council with elected representatives who will continue peer awareness work throughout the year. Each student received a pledge card and an informational booklet to take home.`,
        ],

        // Plastic-Free Ward Initiative Launch
        6: [
            `The Plastic-Free Ward Initiative was formally launched on April 22, 2025, coinciding with World Earth Day, in the bustling market area of Ward 12, Thrissur. The launch event marked the beginning of a comprehensive, ward-level effort to eliminate single-use plastics from daily commerce and household consumption — a goal that the Ward Council had been planning meticulously for over six months.`,
            `The event began with a symbolic clean-up drive involving over 150 volunteers — including students, local traders, homemakers, and NSS units — who cleared plastic waste from the main market road and surrounding alleys. Within three hours, more than 400 kilograms of plastic waste was collected, sorted, and handed over to the district recycling facility. The visual impact of the collected waste formed a powerful backdrop for the press coverage that followed.`,
            `The Ward Councillor announced a set of binding rules that would phase out plastic carry bags, styrofoam containers, and single-use plastic cutlery from all shops and stalls in the ward over the next 60 days. Shopkeepers who had signed on to the initiative were felicitated and provided with branded jute bags at subsidized costs. A special sticker was designed for shops to display their commitment to the plastic-free pledge, creating social accountability.`,
            `The event also featured a live demonstration of how banana leaves, terracotta pots, and paper packaging can replace standard plastic containers in food businesses. Women's Self-Help Group members showcased eco-friendly cloth bags, leaf plates, and natural packaging materials they had produced — generating both applause and purchase orders on the spot. The initiative is expected to serve as a blueprint for scaling the plastic-free movement to all wards of the municipality.`,
        ],

        // Children's Sports & Talent Fest
        7: [
            `The Children's Sports and Talent Festival scheduled for December 25, 2025 at the Sports Complex in Palakkad is one of the most anticipated events in the annual calendar — a vibrant celebration of young talent, teamwork, competitive spirit, and creativity. This year's edition promises to be the biggest yet, with over 1,200 children registered across sports, arts, and science categories.`,
            `The sports segment will feature events including 100m sprint, relay races, long jump, shot put, kabaddi, football, cricket, and badminton organized across four age categories: under-8, under-11, under-14, and under-17. This year will also introduce wheelchair racing and adaptive sports for differently-abled children — a first in the history of this festival.`,
            `The talent pavilion will host competitions in classical and Western dance, Carnatic and instrumental music, drawing, clay modelling, and stand-up comedy. A new "Young Innovators" track has been added where children can present science projects, models, or app ideas to a panel of judges including engineers and educators. The winners of this track will be given a mentorship opportunity with a local STEM organization.`,
            `Local schools, self-help groups, and the Sports Authority of Kerala have collaborated to ensure that children from all economic backgrounds can participate without any registration fee. Trophies, medals, certificates, and scholarship awards will be distributed to top performers. The festival is not just about competition — it is a celebration of childhood, community, and the belief that every child carries a spark waiting to be kindled.`,
        ],

        // IT Job Fair 2026
        8: [
            `The IT Job Fair 2026, held on February 14, 2026 at the Government Engineering College campus in Thrissur, was the largest employment event the district had seen in recent years. Over 2,500 job seekers registered for the fair, which brought together 35 companies ranging from global IT multinationals to promising Kerala-based software startups.`,
            `The fair was inaugurated by the IT Secretary, Government of Kerala, who emphasized the state's vision of becoming a ₹1 lakh crore IT economy by 2030. He highlighted ongoing investments in technology parks across tier-2 cities and the government's priority to retain IT talent within Kerala rather than losing graduates to other metro cities.`,
            `Companies present at the fair included firms specializing in software development, cloud computing, cybersecurity, data science, embedded systems, and UI/UX design. On-spot interviews were conducted at dedicated company booths throughout the day, with hiring decisions communicated within 48 hours for most participants. Over 380 conditional offer letters were reportedly issued on the day itself — a record number for such an event in the region.`,
            `Resume-building workshops, mock interview sessions, and a panel discussion on "The Future of Work in the AI Era" were conducted in parallel to help candidates who were not immediately selected to improve their readiness. A special section was reserved for returning NRI professionals who wished to explore opportunities in Kerala's growing tech ecosystem. The event cemented Thrissur's reputation as a rising hub for technology talent and employment.`,
        ],

        // Monsoon Preparedness Meeting
        9: [
            `The Monsoon Preparedness Meeting convened on May 30, 2026 at the Panchayat Meeting Hall brought together a cross-functional team of government officials, National Disaster Response Force (NDRF) personnel, community volunteers, medical representatives, and local elected leaders. With Kerala's monsoons growing increasingly intense due to climate change, this annual coordination meeting has become a critical safety exercise for the region.`,
            `The meeting opened with a detailed meteorological briefing from the Regional Meteorological Department, which presented predictions for the 2026 southwest monsoon season. Forecasters projected above-normal rainfall and cautioned about heightened risks of flash floods, landslides in hilly borders of the district, and waterlogging in low-lying urban areas. The briefing was complemented by historical data on the 2018 and 2019 flood disasters that caused significant damage in the area.`,
            `Officials reviewed the status of monsoon-ready infrastructure including drainage desilting work, road repair, reinforcement of embankments, and preparation of flood relief camps. Twenty-three relief camps were identified and provisioned across the panchayat zone, each equipped with food rations, drinking water, medical kits, and emergency lighting. Dedicated hotline numbers and WhatsApp groups were established to enable rapid communication between officials and community volunteers.`,
            `Community-level disaster response teams were formed with training on first aid, water rescue, and emergency evacuation procedures. A mock drill was scheduled for the following weekend at a flood-prone locality to test coordination between all agencies. The meeting concluded with a collective commitment from all stakeholders to prioritize community safety and ensure that no life is lost to a preventable disaster this monsoon season.`,
        ],
    };

    let inserted = 0;
    for (const [indexStr, paragraphs] of Object.entries(contentMap)) {
        const idx = parseInt(indexStr);
        const event = recent[idx];
        if (!event) continue;

        for (let i = 0; i < paragraphs.length; i++) {
            await db.query(
                'INSERT INTO event_content (event_id, content_order, paragraph_text) VALUES (?, ?, ?)',
                [event.id, i + 1, paragraphs[i]]
            );
        }
        console.log(`  ✅ "${event.event_name}" — ${paragraphs.length} paragraphs added`);
        inserted += paragraphs.length;
    }

    console.log(`\n🎉 Done! Inserted ${inserted} rich content paragraphs across 10 events.`);
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
