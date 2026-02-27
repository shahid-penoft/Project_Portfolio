import db from '../configs/db.js';

const richContent = (topic, paras) => `
<h2>${topic}</h2>
${paras.map(p => `<p>${p}</p>`).join('\n')}
<h3>Key Highlights</h3>
<ul>
  <li>Strong community engagement and grassroots support</li>
  <li>Focus on sustainable and inclusive development</li>
  <li>Transparent governance with measurable outcomes</li>
  <li>Collaboration with local bodies and state institutions</li>
</ul>
<p>The efforts undertaken reflect a deep commitment to the overall progress of the constituency and its people. Every initiative is planned with long-term impact in mind, ensuring that future generations inherit a better, more equitable society.</p>
`;

const pressReleasePosts = [
    {
        title: 'MLA Inaugurates New Road Connectivity Project in Kothamangalam',
        content: 'A major road expansion project connecting three panchayats was inaugurated today, improving transport for over 12,000 residents.',
        rich_content: richContent('Connectivity for Growth', [
            'The long-pending demand for proper road infrastructure in the region has finally been addressed with the inauguration of the new connectivity project. The initiative spans over 14 kilometres and links three key panchayat areas, significantly reducing travel time.',
            'Local contractors and workers have been prioritised in the construction effort, ensuring the project contributes to the local economy as well. The project was completed under budget and ahead of schedule, a testament to effective planning and execution.',
            'Residents, trade associations, and farmers have all expressed satisfaction with the improved access. Agricultural produce can now reach markets faster, reducing wastage and increasing incomes for the farming community.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/road-pr/800/500',
        video_url: null,
        published_at: '2025-03-15',
        is_featured: 1,
    },
    {
        title: 'District-Level Meeting on Digital Literacy Held Under MLA\'s Chairmanship',
        content: 'A district-wide digital literacy drive was launched to empower youth and women with technology skills for employment.',
        rich_content: richContent('Bridging the Digital Divide', [
            'A high-level meeting was convened to fast-track the district digital literacy mission, bringing together educators, NGOs, and government officials. The session outlined a roadmap for training over 5,000 individuals by year end.',
            'Special emphasis was placed on women and out-of-school youth, who have historically been underserved in technology education. Dedicated training centres will be established in all major gram panchayats.',
            'Partnerships with tech companies and state skill development agencies have been formalised to provide certified training and placement support. The initiative is expected to generate significant employment and self-employment opportunities.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/digital-pr/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-04-02',
        is_featured: 0,
    },
    {
        title: 'MLA Hands Over Keys of New Government School Building',
        content: 'A newly constructed school building with 12 classrooms and a digital lab was handed over to the Panchayat education committee.',
        rich_content: richContent('Education First', [
            'The new school building, constructed at a cost of ₹2.4 crore under the state infrastructure fund, was formally handed over today. The facility features modern classrooms, a digital laboratory, a library, and accessible restrooms.',
            'The old building had been in a dilapidated state for over a decade, posing risks to students and teachers alike. The new structure was built using earthquake-resistant materials to ensure long-term durability.',
            'Parents and teachers association representatives welcomed the development and pledged to work together to improve attendance and learning outcomes in the school. Smart boards will be installed in all classrooms by the next academic year.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/school-pr/800/500',
        video_url: null,
        published_at: '2025-05-10',
        is_featured: 1,
    },
    {
        title: 'Flood Relief Camps Established Along Periyar River Catchment Area',
        content: 'Following heavy monsoon flooding, relief operations were launched with 4 camps serving over 800 displaced families.',
        rich_content: richContent('Resilience in the Face of Disaster', [
            'Unprecedented rainfall triggered flooding along the Periyar river catchment zone, affecting six villages and displacing hundreds of families. Relief camps were swiftly established at community halls and schools.',
            'Medical teams, food distribution units, and trauma counsellors were deployed within hours of the flooding. Coordination between district administration and the MLA\'s office ensured a smooth and humane response.',
            'Post-flood rehabilitation measures including house repair grants were announced for affected families. A long-term flood resilience plan is being drawn up in consultation with engineering experts and the state water authority.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/flood-pr/800/500',
        video_url: null,
        published_at: '2025-06-18',
        is_featured: 0,
    },
    {
        title: 'Inauguration of Women\'s Self-Help Group Cooperative Store',
        content: 'A cooperative retail outlet run entirely by women SHG members was inaugurated, creating sustainable livelihoods for 60 women.',
        rich_content: richContent('Empowering Women Entrepreneurs', [
            'A landmark cooperative store owned and operated by women self-help group members was opened in the heart of Kothamangalam town. The store stocks locally produced goods, handlooms, and organic products.',
            'The initiative was backed by a seed fund facilitated through the state Kudumbashree mission and supplemented by MLA constituency development funds. Training in accounting, inventory management, and customer service was provided.',
            'The cooperative model ensures that profits are shared equitably among all SHG members, providing a steady income supplement for 60 families. Plans are underway to launch an online store to reach a broader market.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/shg-pr/800/500',
        video_url: null,
        published_at: '2025-07-04',
        is_featured: 1,
    },
    {
        title: 'Free Health Camp Conducted for Tribal Community in Neriamangalam Range',
        content: 'Over 350 tribal community members received free health screenings, medicines, and specialist consultations during a two-day camp.',
        rich_content: richContent('Healthcare Without Borders', [
            'A comprehensive two-day free health camp was organised deep in the Neriamangalam forest range, bringing medical services directly to the tribal communities who rarely have access to urban hospitals.',
            'Specialists in ophthalmology, orthopaedics, gynaecology, and general medicine attended. Over 350 people were examined and over 200 received medicines free of charge. Three patients were referred for immediate surgical care.',
            'Mobile health van services will now make quarterly visits to the area. Plans are in place to construct a permanent health sub-centre within the tribal settlement zone to ensure year-round access to primary healthcare.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/health-pr/800/500',
        video_url: null,
        published_at: '2025-08-20',
        is_featured: 0,
    },
    {
        title: 'Solar Street Light Installation Completed in 18 Wards',
        content: 'Energy-efficient solar street lights have been installed across 18 wards, reducing power costs and improving night safety.',
        rich_content: richContent('Green Energy for All', [
            'The installation of 450 solar-powered LED street lights across 18 wards marks a significant step in the constituency\'s green energy transition. The project reduces reliance on the grid and virtually eliminates electricity bills for street lighting.',
            'Community feedback on dark spots and accident-prone zones was incorporated in the placement planning. Installation was prioritised in areas with vulnerable populations including tribal settlements and women\'s hostels.',
            'The solar lights are equipped with dusk-to-dawn sensors and have a lifespan of over 8 years. A local cooperative has been trained to maintain the units, creating additional employment while ensuring long-term functionality.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/solar-pr/800/500',
        video_url: null,
        published_at: '2025-09-05',
        is_featured: 1,
    },
    {
        title: 'MLA Tables Petition for Heritage Status for Kothamangalam Palace',
        content: 'A formal petition was submitted to the State Heritage Commission to grant protected status to the historic Kothamangalam Palace.',
        rich_content: richContent('Preserving Cultural Legacy', [
            'A detailed petition backed by historical documentation, architectural surveys, and community resolutions was submitted to the Kerala State Heritage Commission seeking Grade I heritage protection for the Kothamangalam Palace.',
            'The palace, dating back to the 18th century, has served as a cultural landmark and community gathering space for generations. However, years of neglect have taken a toll on the structure, and several portions are at risk of collapse.',
            'If heritage status is granted, restoration funds and conservation expertise can be mobilised through central government schemes. Local tourism is expected to significantly benefit from a restored and well-maintained heritage site.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/heritage-pr/800/500',
        video_url: null,
        published_at: '2025-10-12',
        is_featured: 0,
    },
    {
        title: 'Drinking Water Supply Extended to 4 Unserviced Tribal Hamlets',
        content: 'Pipeline extension work completed to bring clean piped water to four remote hamlets for the first time in their history.',
        rich_content: richContent('Clean Water — A Right, Not a Privilege', [
            'Four tribal hamlets in the upper ranges of the constituency have received piped drinking water supply for the first time, ending decades of dependence on seasonal streams and unreliable bore wells.',
            'The pipeline extension project was sanctioned under the Jal Jeevan Mission and expedited with MLA-level intervention at the district water authority. Over 480 families now have access to treated, piped drinking water.',
            'Women, who previously spent hours fetching water from distant sources, are the primary beneficiaries of this development. The project also includes overhead tanks, water meters, and a chlorination unit.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/water-pr/800/500',
        video_url: null,
        published_at: '2025-11-08',
        is_featured: 1,
    },
    {
        title: 'Annual Budget Session: MLA Presents Constituency Development Report',
        content: 'The MLA presented a comprehensive development report for 2024–25 highlighting over 85 completed projects across multiple sectors.',
        rich_content: richContent('Accountability and Transparency', [
            'During the annual budget session, a comprehensive constituency development report was tabled, detailing all development initiatives undertaken during 2024–25. The report covers 85+ projects spanning infrastructure, education, health, water, and livelihoods.',
            'Expenditure transparency is central to the report format, with project-wise cost breakdowns and outcome assessments. Third-party audits were conducted for projects above ₹50 lakh.',
            'Community feedback was solicited through ward-level Grama Sabhas and incorporated into the planning for the upcoming fiscal year. Digital dashboards tracking project progress have been made publicly accessible through the constituency website.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/budget-pr/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2026-01-20',
        is_featured: 1,
    },
];

const interviewPosts = [
    {
        title: 'Exclusive Interview: MLA on the Future of Kothamangalam\'s Infrastructure',
        content: 'In an in-depth conversation, the MLA discusses upcoming road, bridge, and public transport developments planned for the next 3 years.',
        rich_content: richContent('Building for Tomorrow', [
            'In this exclusive interview, the MLA outlined a comprehensive vision for modernising the infrastructure of Kothamangalam over the next three years. Key projects include the widening of the NH junction approach road and construction of two new bridges.',
            '"Infrastructure is the backbone of economic activity. Without good roads and bridges, no amount of investment in education or health will reach its true potential," the MLA stated during the interview.',
            'The interview also touched on plans to lobby for a dedicated bus terminal and improved public transport connectivity, reducing dependence on private vehicles and cutting carbon emissions across the constituency.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/infra-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-02-14',
        is_featured: 1,
    },
    {
        title: 'Q&A Session: MLA on Agricultural Reform and Farmer Welfare Schemes',
        content: 'Farmers from across the constituency gathered for a candid Q&A session where the MLA addressed concerns about crop insurance, market access, and irrigation.',
        rich_content: richContent('Standing with the Farmer', [
            'A town hall-style Q&A session was held at the agricultural training centre, with over 200 farmers in attendance. The MLA addressed a wide range of concerns, from delays in crop insurance claims to the need for better irrigation infrastructure.',
            '"Every farmer\'s concern is a concern of mine. I take these issues to the floor of the legislature and to the offices of the relevant departments until they are resolved," the MLA assured the gathering.',
            'The session resulted in the formation of a farmer grievance monitoring committee with a direct line to the MLA\'s office. Follow-up meetings will be held quarterly to track resolution of outstanding issues.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/farm-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-03-22',
        is_featured: 0,
    },
    {
        title: 'Media Interaction: MLA Speaks on Climate Resilience Planning',
        content: 'The MLA shared insights on initiatives to make the constituency more resilient to climate change events such as floods, droughts, and landslides.',
        rich_content: richContent('Adapting to a Changing Climate', [
            'In a detailed media interaction, the MLA outlined the constituency\'s emerging climate resilience plan. Kothamangalam faces heightened risk from both flood and drought conditions due to its unique topography and changing rainfall patterns.',
            'The plan includes construction of check dams to recharge groundwater, reforestation of bare hillsides, and installation of early warning systems in flood-vulnerable zones. Community-level disaster response teams are being trained.',
            '"We must act now, or our children will bear the cost of our inaction. Climate adaptation is not optional — it is survival," the MLA emphasised during the interaction.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/climate-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-04-10',
        is_featured: 1,
    },
    {
        title: 'Youth Interaction Programme: MLA Engages College Students',
        content: 'College students from 6 institutions participated in an interactive session with the MLA covering education, career, and the role of youth in democracy.',
        rich_content: richContent('The Voice of the Future Generation', [
            'A vibrant youth interaction programme was held at the district youth centre, bringing together students from six higher education institutions. Topics ranged from career guidance and entrepreneurship to civic engagement and environmental responsibility.',
            'The MLA urged students to think beyond personal career goals and consider their role in shaping the community. "Public service, in whatever form, whether in government or civil society, is among the noblest pursuits," the MLA said.',
            'A youth advisory panel was announced to give students a formal channel to present ideas and concerns to the constituency office. Selected proposals will receive mentorship and seed support through development funds.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/youth-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-05-28',
        is_featured: 0,
    },
    {
        title: 'Interview: Women in Politics — MLA on Representation and Challenges',
        content: 'An in-depth interview exploring the journey and challenges of political representation, and efforts to bring more women into governance.',
        rich_content: richContent('Breaking Barriers in Democracy', [
            'In a candid and reflective interview, the MLA spoke about the challenges and rewards of serving in the legislative assembly and advocating for the constituents. Special focus was placed on the importance of gender representation in local governance.',
            '"When women are at the table, different issues are raised, different priorities are set. Panchayat-level women\'s representation has changed the development agenda at the grassroots level," the MLA noted.',
            'Initiatives to support women candidates at ward and panchayat level — including training, mentorship, and financial support — were outlined. The goal is to see 50% women representation across all local bodies.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/women-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-06-30',
        is_featured: 1,
    },
    {
        title: 'Television Interview: Development Report Card for 2024-25',
        content: 'The MLA reviewed major achievements and ongoing challenges in a prime-time television interview covering the full development agenda.',
        rich_content: richContent('A Year in Review', [
            'Appearing on the regional prime-time news programme, the MLA presented a detailed report card covering the major developments and shortcomings of the past year. Key achievements discussed include the solar street light project, tribal health camps, and road connectivity upgrades.',
            'The interview also addressed controversies and setbacks honestly, including delays in land acquisition for the new township bypass road. "Transparency about challenges is as important as celebrating achievements," the MLA maintained.',
            'Viewers were encouraged to submit feedback and suggestions through a newly launched constituency portal. The MLA committed to addressing the top 10 citizen-submitted concerns in the coming quarter.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/tv-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-07-25',
        is_featured: 0,
    },
    {
        title: 'Podcast Interview: Ecotourism as an Economic Model for Forest Margins',
        content: 'The MLA joined a popular environment podcast to discuss how ecotourism can create livelihoods while protecting fragile ecosystems.',
        rich_content: richContent('Ecology Meets Economy', [
            'In a wide-ranging podcast discussion on sustainable development, the MLA outlined plans to develop eco-friendly tourism circuits in the forest-margin regions of the constituency. The plan integrates community-run homestays, guided nature walks, and cultural experiences.',
            '"The forest is not an obstacle to development — it is the foundation of it. If we protect biodiversity, we are protecting livelihoods and water security for generations," the MLA explained.',
            'A pilot ecotourism project has already been launched in partnership with the forest department and tribal communities. Revenue sharing models have been designed to ensure 70% of proceeds go directly to resident communities.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/eco-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-08-15',
        is_featured: 1,
    },
    {
        title: 'Press Club Interaction: MLA on Governance, Accountability and RTI',
        content: 'The MLA spoke with press club members on government transparency, the role of the media, and citizen rights under the RTI Act.',
        rich_content: richContent('Democracy Demands Transparency', [
            'At the district press club\'s monthly interaction, the MLA addressed questions on government accountability, information access, and the media\'s role in democratic governance. The discussion was frank, wide-ranging, and at times contentious.',
            '"A healthy press is indispensable to democracy. Criticism of public figures and institutions must not only be tolerated — it must be welcomed," the MLA stated, drawing applause from the journalists present.',
            'The MLA announced that the constituency office will release a monthly public expenditure bulletin and publish all development fund allocations online to ensure maximum transparency. A dedicated RTI facilitation desk will also be established.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/press-int/800/500',
        video_url: null,
        published_at: '2025-09-18',
        is_featured: 0,
    },
    {
        title: 'University Seminar Address: MLA on Public Policy and Citizen Participation',
        content: 'The MLA delivered a keynote address at a university seminar on evidence-based policy making and citizen-led governance initiatives.',
        rich_content: richContent('Policy Meets People', [
            'Invited as the keynote speaker at the state university\'s annual public policy seminar, the MLA delivered an address focused on the importance of citizen participation in the policy cycle, from needs assessment to implementation review.',
            'Using constituency-level initiatives as case studies, the MLA demonstrated how community consultations, ward-level Grama Sabhas, and digital feedback mechanisms can produce better development outcomes.',
            '"Good policy is not made in isolation. It is co-created with the people it is meant to serve," the MLA emphasised, urging future graduates to pursue careers in public administration and civic engagement.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/univ-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-10-30',
        is_featured: 1,
    },
    {
        title: 'Year-End Interview: Vision for Kothamangalam in 2026 and Beyond',
        content: 'The MLA reflects on the year gone by and shares an ambitious vision for Kothamangalam\'s growth across infrastructure, education, health, and environment.',
        rich_content: richContent('Looking Ahead with Purpose', [
            'In an extensive year-end interview, the MLA reflected on the milestones of the outgoing year and shared a detailed vision for Kothamangalam\'s future. The vision document covers six key sectors: infrastructure, education, health, livelihoods, environment, and digital governance.',
            '"The year behind us was one of resilience — floods, challenges, rebounds. The year ahead must be one of ambition — infrastructure projects, job creation, and digital transformation," the MLA said.',
            'Specific targets for 2026 were shared, including completing 12 major road projects, achieving 100% piped water coverage, and launching five new women-led cooperatives. Regular public progress reviews will be held to maintain accountability.',
        ]),
        thumbnail_url: 'https://picsum.photos/seed/yearend-int/800/500',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        published_at: '2025-12-28',
        is_featured: 1,
    },
];

async function seed() {
    console.log('🌱 Seeding media posts...\n');

    // Fetch sections
    const [sections] = await db.query('SELECT id, section_name FROM media_sections ORDER BY id');
    if (!sections.length) { console.error('❌ No sections found. Seed sections first.'); process.exit(1); }

    const sectionMap = {};
    sections.forEach(s => { sectionMap[s.section_name] = s.id; });
    console.log('Sections:', sections.map(s => `${s.id}:${s.section_name}`).join(', '));

    const pressId = sections[0]?.id;
    const interviewId = sections[1]?.id;

    const allPosts = [
        ...pressReleasePosts.map(p => ({ ...p, section_id: pressId })),
        ...interviewPosts.map(p => ({ ...p, section_id: interviewId })),
    ];

    let inserted = 0;
    for (const p of allPosts) {
        try {
            await db.query(
                `INSERT INTO media_posts (section_id, title, content, rich_content, thumbnail_url, video_url, is_featured, published_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [p.section_id, p.title, p.content, p.rich_content, p.thumbnail_url, p.video_url, p.is_featured, p.published_at]
            );
            inserted++;
            console.log(`  ✅ [${p.section_id === pressId ? 'Press' : 'Interview'}] ${p.title.substring(0, 60)}...`);
        } catch (err) {
            console.error(`  ❌ Failed: ${p.title}`, err.message);
        }
    }

    console.log(`\n🎉 Seeded ${inserted} posts across ${sections.length} sections!`);
    process.exit(0);
}

seed().catch(err => { console.error('❌ Fatal error:', err); process.exit(1); });
