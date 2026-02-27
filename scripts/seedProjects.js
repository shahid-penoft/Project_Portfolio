/**
 * scripts/seedProjects.js
 * Seeds 15 realistic dummy projects with ALL fields populated:
 * title, description, project_content, images (JSON), tags, year,
 * sector_id, local_body_id, display_order, is_active
 */
import db from '../configs/db.js';

// Real IDs from DB
const LB = [1, 2, 3, 5, 6, 7, 8, 15]; // local_body ids
const SEC = [1, 2, 3, 4, 5, 8];         // sector ids

// Placeholder image URLs (publicly accessible via Lorem Picsum)
function imgs(...ids) {
    return JSON.stringify(ids.map(id => `https://picsum.photos/seed/${id}/800/500`));
}

const projects = [
    {
        title: 'Kothamangalam Smart Road Upgrade',
        description: 'Complete rehabilitation and widening of 4.2 km arterial road with smart LED street lighting, pedestrian-friendly sidewalks, and stormwater drainage.',
        project_content: `<h2>Project Overview</h2><p>The Kothamangalam Smart Road Upgrade project was initiated to address years of deteriorating road infrastructure in the core urban stretch of the municipality. The 4.2 km corridor is one of the most traffic-dense routes in Ernakulam district, carrying over 18,000 vehicles per day.</p><h2>Key Interventions</h2><ul><li>Full black-top resurfacing with bituminous concrete overlay</li><li>Road widening from 7.5m to 10.5m carriageway width</li><li>Smart LED street lighting with motion sensors and dimmer technology</li><li>Dedicated 1.8m wide pedestrian footpaths on both sides</li><li>Stormwater drains with grated covers at 30m intervals</li><li>Painted road markings, signage, and cat-eye road studs</li></ul><h2>Outcomes</h2><p>Since completion, accident reports on this stretch have declined by 42%. Average travel time during peak hours has reduced from 18 minutes to 11 minutes. The smart LED system has resulted in a 38% reduction in street lighting electricity cost for the municipality.</p><h2>Community Impact</h2><p>Residents along the corridor have reported significant improvement in quality of life. Local businesses have seen increased footfall, and the pedestrian infrastructure has been especially welcomed by school children and senior citizens.</p>`,
        images: imgs('road1', 'road2', 'road3'),
        tags: 'infrastructure,roads,smart city,lighting',
        year: 2023,
        sector_id: SEC[0],
        local_body_id: LB[0],
        display_order: 1,
        is_active: 1,
    },
    {
        title: 'Kavalangad Panchayat Digital Service Hub',
        description: 'Establishment of a one-stop citizen digital services center providing government service access, internet connectivity, and digital literacy training.',
        project_content: `<h2>Project Background</h2><p>The Digital Service Hub at Kavalangad Panchayat was conceptualized to bridge the digital divide between urban and rural citizens. Prior to the project, residents had to travel 12–18 km to access basic government services like certificates, land records, and pension applications.</p><h2>Facilities Offered</h2><ul><li>6 public internet terminals with high-speed broadband</li><li>E-seva counter for 35+ government services</li><li>Aadhaar enrollment and update center</li><li>Digital payment facilitation desk</li><li>Weekly digital literacy classes for senior citizens and women</li><li>Video conference room for virtual hearings and consultations</li></ul><h2>Usage Statistics</h2><p>In its first year of operation, the hub processed over 8,400 service requests. Daily footfall averages 65 citizens. The digital literacy program has trained 340 individuals in basic smartphone usage, UPI transactions, and online government service navigation.</p><h2>Future Plans</h2><p>Phase 2 of the project will introduce common service center functionality, allowing the hub to provide insurance enrollment, banking services, and skill certification registrations.</p>`,
        images: imgs('digital1', 'digital2', 'digital3'),
        tags: 'digital,e-governance,citizen services,rural development',
        year: 2024,
        sector_id: SEC[1],
        local_body_id: LB[1],
        display_order: 2,
        is_active: 1,
    },
    {
        title: 'Keerampara Rural Drinking Water Supply Scheme',
        description: 'Installation of a gravity-fed drinking water distribution network covering 12 remote tribal hamlets with purification units and overhead tanks.',
        project_content: `<h2>Project Overview</h2><p>Access to safe drinking water has been a persistent challenge for the tribal communities of Keerampara. This project, funded under the Jal Jeevan Mission with local body contributions, provides reliable clean water supply to 1,240 households across 12 hamlets at elevations ranging from 450m to 680m above sea level.</p><h2>Technical Components</h2><ul><li>Source protection of 3 perennial spring streams with catchment fencing</li><li>Slow sand filtration units with UV disinfection at each source</li><li>60,000 litre overhead storage tank with automatic float valves</li><li>18.4 km of HDPE distribution network</li><li>Individual household connections with metered supply</li><li>Solar-powered pump stations for areas without gravity flow</li></ul><h2>Construction Challenges</h2><p>The project faced significant engineering challenges due to the mountainous terrain. Pipeline laying required manual labor through dense forest areas, and two river crossings necessitated specially designed suspended pipeline bridges. Despite these challenges, the project was completed within budget and ahead of schedule.</p><h2>Impact Assessment</h2><p>Prior to the project, women in these communities walked an average of 2.8 km daily to collect water. Post-implementation, waterborne disease incidents in the area dropped by 67% within 18 months of commissioning. All 12 hamlets now have access to piped water at their doorstep for a minimum of 20 hours per day.</p>`,
        images: imgs('water1', 'water2', 'water3', 'water4'),
        tags: 'water supply,tribal,rural,infrastructure,health',
        year: 2023,
        sector_id: SEC[2],
        local_body_id: LB[2],
        display_order: 3,
        is_active: 1,
    },
    {
        title: 'Kuttampuzha Organic Farming Collective',
        description: 'Formation and capacity building of 18 women farmer groups under a cooperative organic farming model with market linkage and certification support.',
        project_content: `<h2>Project Genesis</h2><p>The Kuttampuzha Organic Farming Collective was born from a simple but powerful idea: that small and marginal women farmers, when organized and supported collectively, can achieve market outcomes far beyond what any individual farmer could reach alone. The project was initiated under the District Agriculture Department's women farmer empowerment initiative.</p><h2>Collective Structure</h2><ul><li>18 Women Farmer Groups with 12–15 members each</li><li>Central Federation Committee with elected representatives</li><li>Common facility center with cold room and primary processing unit</li><li>Shared equipment pool: power tillers, sprayers, soil testing kits</li><li>Rotating credit fund for seasonal inputs</li></ul><h2>Crop Portfolio</h2><p>The collective focuses on high-value organic produce: ginger, turmeric, black pepper, coconut, banana varieties, and seasonal vegetables. All farms operate under zero-chemical farming protocols verified by a third-party organic certifier.</p><h2>Market Linkage</h2><p>Direct supply agreements have been established with a supermarket chain, two organic grocery platforms, and an Ayurvedic pharmaceutical company. Average farm gate price received by collective members is 43% higher than what individual farmers received previously through middlemen.</p><h2>Outcomes</h2><p>In the first full cultivation cycle, collective members reported an average income increase of ₹48,000 per family annually. Soil health test results show consistent improvement in organic matter content across collective farms. The model is now being replicated in two neighboring panchayats.</p>`,
        images: imgs('farm1', 'farm2', 'farm3'),
        tags: 'agriculture,organic,women empowerment,cooperative,farming',
        year: 2024,
        sector_id: SEC[3],
        local_body_id: LB[3],
        display_order: 4,
        is_active: 1,
    },
    {
        title: 'Kothamangalam Municipality Waste-to-Value Plant',
        description: 'Integrated solid waste management facility with biogas generation, composting, material recovery, and RDF processing for 32,000 households.',
        project_content: `<h2>Project Mandate</h2><p>Kothamangalam Municipality generates approximately 32 tonnes of solid waste per day. Managing this waste had been the municipality's most persistent administrative and environmental challenge, with an aging landfill approaching capacity and growing community resistance to traditional disposal methods.</p><h2>Plant Specifications</h2><ul><li>10 TPD wet waste biogas plant producing 800 cubic metres of biogas daily</li><li>Biogas converted to electricity powering 40% of the municipality office complex</li><li>Aerobic composting windrows with 45-day processing cycle</li><li>Material Recovery Facility sorting 1,200 kg of recyclables daily</li><li>Refuse-Derived Fuel (RDF) production for co-processing in a cement kiln</li><li>Leachate treatment system with zero liquid discharge design</li></ul><h2>Revenue Generation</h2><p>The plant generates revenue through biogas electricity, compost sales, recyclable material sale, and RDF supply contracts. Net annual revenue to the municipality is approximately ₹28 lakh, partially offsetting waste management operational costs.</p><h2>Employment Created</h2><p>The facility employs 34 workers, of whom 22 are women from the local community trained under a Kudumbashree skill-building programme. Workers receive above-minimum wages with PF/ESI coverage.</p><h2>Environmental Impact</h2><p>CO₂ equivalent emissions from waste management have been reduced by an estimated 4,200 tonnes annually. The adjacent river, which previously received leachate overflow from the old dump yard, is now under active ecological restoration.</p>`,
        images: imgs('waste1', 'waste2', 'waste3', 'waste4'),
        tags: 'waste management,environment,biogas,circular economy,employment',
        year: 2022,
        sector_id: SEC[4],
        local_body_id: LB[0],
        display_order: 5,
        is_active: 1,
    },
    {
        title: 'Keerampara Tribal Youth Skill Development Centre',
        description: 'Vocational training centre offering 6-month certified courses in construction trades, electrical work, computer skills, and hospitality for Scheduled Tribe youth.',
        project_content: `<h2>Background</h2><p>Youth unemployment among Scheduled Tribe communities in Keerampara Panchayat was estimated at 54% for the 18–30 age group at the time of project initiation. Limited access to quality vocational training, combined with geographic isolation, had left a generation of young people without the skills needed to access formal employment.</p><h2>Programme Design</h2><ul><li>Centre capacity: 60 trainees per batch across 4 trade streams</li><li>Courses: Electrical Installations, Masonry & Tilework, Computer Applications, Food Production & Catering</li><li>Duration: 6 months; affiliated with NSDC and State Skill Mission</li><li>Residential facility for trainees from remote hamlets</li><li>Stipend of ₹1,200/month for all enrolled tribal youth</li><li>Post-training placement assistance for 90 days</li></ul><h2>Placement Outcomes</h2><p>Across the first three batches (180 graduates), placement rate stands at 82%. Employed graduates are working with construction companies, electrical contractors, hospitality businesses, and IT-enabled service companies across Kerala and Bengaluru. Average starting salary: ₹14,500/month.</p><h2>Community Testimonials</h2><p>Parents and community leaders have cited the programme as transformational — the first institutional pathway out of informal daily-wage labor that has been realistically accessible to tribal youth in this area. The centre is now oversubscribed, with a waiting list of 140 applicants for the upcoming batch.</p>`,
        images: imgs('skill1', 'skill2', 'skill3'),
        tags: 'skill development,tribal,youth,employment,training',
        year: 2023,
        sector_id: SEC[5],
        local_body_id: LB[2],
        display_order: 6,
        is_active: 1,
    },
    {
        title: 'Kothamangalam River Front Beautification',
        description: 'Transformation of 1.8 km Periyar river front with walking promenade, landscaped gardens, heritage plaza, amphitheatre, and heritage lighting.',
        project_content: `<h2>Vision</h2><p>The Kothamangalam River Front Beautification project was conceived as a landmark urban renewal initiative that would reclaim the river edge for public use while celebrating the town's historical connection with the Periyar River. The project transforms an underutilized, partially encroached river bank into a vibrant civic space.</p><h2>Key Features</h2><ul><li>1.8 km stone-paved promenade with weathered steel railings and river views</li><li>6 landscaped garden zones with native plant species and shaded seating</li><li>Heritage plaza with interpretive panels on Kothamangalam's cultural history</li><li>800-seat open-air amphitheatre for public events and performances</li><li>Children's play zone with river-themed installations</li><li>Heritage LED lighting illuminating the riverfront at night</li><li>Public toilets, food kiosks, and bicycle rental stations</li></ul><h2>Heritage Integration</h2><p>Three historic riverside structures — a colonial-era warehouse, a traditional wooden boat landing, and a 19th-century cremation ghats wall — have been restored and integrated into the promenade design as cultural landmarks with QR-code interpretive panels.</p><h2>Impact</h2><p>The riverfront now attracts approximately 2,800 daily visitors. Weekend footfall exceeds 5,000. Tourism revenue to nearby businesses has increased significantly. The project has been shortlisted for the National Urban Best Practices Award and featured in a national town planning journal.</p>`,
        images: imgs('river1', 'river2', 'river3', 'river4'),
        tags: 'urban renewal,beautification,tourism,heritage,public space',
        year: 2024,
        sector_id: SEC[0],
        local_body_id: LB[0],
        display_order: 7,
        is_active: 1,
    },
    {
        title: 'Kavalangad Primary Health Centre Upgrade',
        description: 'Comprehensive upgrade of PHC with new OPD block, operation theatre, equipment modernisation, ambulance, and 24-hour emergency care services.',
        project_content: `<h2>Project Need</h2><p>The Kavalangad Primary Health Centre was operating from a 1974 building with severely inadequate space, no emergency care capacity, and equipment that had not been updated meaningfully in over a decade. Residents requiring emergency treatment had to travel 22 km to the district hospital, often losing critical time.</p><h2>Upgrades Completed</h2><ul><li>New 2,400 sq ft OPD block with 8 consultation rooms</li><li>Minor operation theatre with autoclave sterilisation</li><li>Digital X-ray unit and ultrasound machine</li><li>Fully equipped emergency room with resuscitation bay</li><li>24-hour laboratory for blood tests and urine analysis</li><li>10-bed IPD ward with nurse call system</li><li>Dedicated maternity ward with 4 delivery beds</li><li>New 108-standard ambulance stationed at the PHC</li></ul><h2>Service Expansion</h2><p>Post-upgrade, the PHC now offers 24-hour emergency services, daily specialist outreach clinics (medicine, gynaecology, paediatrics, eye), and telemedicine consultations with district hospital specialists. Monthly OPD caseload has increased from 620 to 1,840 patients.</p><h2>Life-Saving Impact</h2><p>In its first 18 months post-upgrade, the PHC's emergency room handled 312 cases that would previously have required district hospital transfer. In three documented instances, on-site resuscitation saved lives that would likely have been lost during transfer. Child delivery count at the PHC has tripled, reducing maternal transport risk significantly.</p>`,
        images: imgs('health1', 'health2', 'health3'),
        tags: 'health,PHC,rural health,infrastructure,emergency care',
        year: 2023,
        sector_id: SEC[2],
        local_body_id: LB[1],
        display_order: 8,
        is_active: 1,
    },
    {
        title: 'Kuttampuzha Micro-Hydro Power Project',
        description: 'Installation of a 45 kW micro-hydroelectric generating station on a local waterfall providing clean electricity to 3 tribal hamlets off the grid.',
        project_content: `<h2>Energy Context</h2><p>Three hamlets in the upper reaches of Kuttampuzha — Manjakudi, Ulariyam, and Thottiyam — remained without grid electricity despite decades of electrification programmes elsewhere. The terrain made conventional grid extension prohibitively expensive. The micro-hydro project exploited the area's naturally steep gradient streams as a locally sustainable energy source.</p><h2>Technical Specifications</h2><ul><li>Intake weir and debris-exclusion screen at Chempillikuzhi waterfall</li><li>760m penstock pipeline with 68m effective head</li><li>45 kW Crossflow turbine-generator unit</li><li>Electronics: automatic voltage regulator, load controller, protection relays</li><li>11 kV mini-grid connecting all 3 hamlets</li><li>Individual household meters with pre-paid smart card system</li></ul><h2>Power Output</h2><p>The plant produces approximately 38,000 kWh per month during the monsoon season and 22,000 kWh per month in the dry season. This is sufficient to power all 186 households with baseline lighting, fans, and small appliances, as well as the community hall, school, and health sub-centre.</p><h2>Community Ownership</h2><p>A hamlet-level cooperative owns and operates the plant. Trained community technicians handle routine maintenance, reducing dependence on external service providers. Tariffs are set by the cooperative at ₹3.2/unit — below Kerala State Electricity Board residential rates — ensuring affordability while covering O&M costs.</p>`,
        images: imgs('hydro1', 'hydro2', 'hydro3'),
        tags: 'renewable energy,micro-hydro,tribal,off-grid,electrification',
        year: 2022,
        sector_id: SEC[4],
        local_body_id: LB[3],
        display_order: 9,
        is_active: 1,
    },
    {
        title: 'Kothamangalam Government School Smart Classroom Initiative',
        description: 'Digital transformation of 28 government schools with interactive smart boards, computer labs, high-speed internet, and teacher training in digital pedagogy.',
        project_content: `<h2>Educational Context</h2><p>Government schools in Kothamangalam Municipality serve over 6,800 students. While private schools in the area had rapidly adopted digital classrooms, government schools lagged significantly due to budget constraints — creating an equity gap in educational quality. The Smart Classroom Initiative was designed to eliminate this gap systematically.</p><h2>Hardware Deployed</h2><ul><li>84 interactive flat-panel smart boards (one per classroom, Std 5–12)</li><li>420 student laptops in 14 dedicated computer labs</li><li>High-speed broadband in all 28 schools (100 Mbps fibre)</li><li>Wi-Fi coverage across all school buildings</li><li>Webcams and microphones for video-based learning</li><li>Solar power backup for uninterrupted IT infrastructure</li></ul><h2>Software & Content</h2><p>All systems are loaded with Kerala IT @ School approved digital content aligned to the state curriculum. Teachers have access to a cloud-based lesson planning and student assessment platform. A school management system handles attendance, marks, fee collection, and parent communication.</p><h2>Teacher Development</h2><p>280 teachers across the 28 schools completed a 40-hour KITE-certified Digital Pedagogy Training. Ongoing support is provided through a monthly teacher peer learning network and on-call technical helpdesk. Teaching effectiveness surveys show a 34% improvement in student engagement scores post-implementation.</p><h2>Student Outcomes</h2><p>SSLC and HSC pass rates across these schools improved by an average of 8.2 percentage points in the two academic years since implementation. Computer literacy test scores at Std 8 level increased from 52% to 81% average.</p>`,
        images: imgs('edu1', 'edu2', 'edu3', 'edu4'),
        tags: 'education,digital,smart classroom,schools,technology',
        year: 2024,
        sector_id: SEC[1],
        local_body_id: LB[0],
        display_order: 10,
        is_active: 1,
    },
    {
        title: 'Keerampara Ecotourism Circuit Development',
        description: 'Development of 4 eco-tourism nodes with trekking trails, watch towers, bamboo rest houses, local guide training, and community tourism management.',
        project_content: `<h2>Tourism Potential</h2><p>Keerampara's forested hills, river valleys, waterfalls, and tribal culture represent extraordinary ecotourism potential that had remained largely unexploited due to lack of infrastructure and organized community involvement. This project was developed to unlock sustainable tourism revenue for tribal communities while preserving the ecological integrity of the landscape.</p><h2>Infrastructure Developed</h2><ul><li>32 km of marked and maintained trekking trails across 4 circuits</li><li>4 strategically placed teak-timber watch towers with panoramic views</li><li>12 bamboo-and-reed rest huts along popular trails</li><li>2 Tribal Heritage Homestay clusters (8 homestays, 40-person capacity)</li><li>Visitor information centre with tribal art display and trail maps</li><li>Signage in Malayalam, English and tribal language</li></ul><h2>Community Livelihood Components</h2><p>40 tribal community members trained as certified nature guides by Kerala Tourism and a wildlife conservation NGO. Training covered wildlife identification, first aid, trail safety, and interpretive storytelling. Guides are assigned to visitor groups through a cooperative rotation system ensuring equitable income distribution.</p><h2>Revenue Outcomes</h2><p>In the first 12 months of operation, the circuit welcomed 4,200 visitors. Homestay revenue per tribal family averages ₹28,000 per month during peak season. Guide income averages ₹18,000/month per active guide. Community artisan products sold at the visitor centre generated an additional ₹7.4 lakh in the first year.</p>`,
        images: imgs('eco1', 'eco2', 'eco3', 'eco4'),
        tags: 'ecotourism,tribal,environment,livelihood,tourism',
        year: 2024,
        sector_id: SEC[3],
        local_body_id: LB[2],
        display_order: 11,
        is_active: 1,
    },
    {
        title: 'Kavalangad Flood Resilience Infrastructure Project',
        description: 'Construction of flood bunds, retention basins, upgraded culverts, and an early warning network to protect 8 flood-prone wards along the Periyar tributary.',
        project_content: `<h2>Flood History and Need</h2><p>Five of Kavalangad Panchayat's 16 wards lie in the active flood plain of a Periyar tributary. The 2018 and 2019 Kerala floods caused catastrophic damage in these wards — over 340 families were displaced, agricultural losses exceeded ₹4.2 crore, and three deaths were directly attributed to flooding in the area. The flood resilience project was initiated as a long-term structural response.</p><h2>Infrastructure Interventions</h2><ul><li>2.8 km of reinforced earthen flood bund with wave-break stone pitching</li><li>3 detention basins with a combined storage of 180,000 cubic metres</li><li>14 culvert replacements with hydraulically adequate cross-sections</li><li>Automated river gauge sensors transmitting real-time data to a control centre</li><li>Community siren and SMS alert system covering 8 wards</li><li>Raised platform emergency shelters at 4 strategic locations</li></ul><h2>Early Warning System</h2><p>The automated flood early warning network can detect rising water levels and trigger community alerts with an advance warning window of 4–8 hours for moderate events, allowing agricultural equipment, livestock, and household assets to be moved ahead of inundation. Since commissioning, the system has successfully triggered timely evacuations in two moderate flood events.</p><h2>Post-Monsoon Assessment 2024</h2><p>The 2024 southwest monsoon was the heaviest in seven years. Despite 340% of normal June-July rainfall, zero deaths and zero major property damage were recorded in wards covered by the project infrastructure — a stark contrast to unprotected neighboring panchayats that experienced significant losses.</p>`,
        images: imgs('flood1', 'flood2', 'flood3'),
        tags: 'disaster management,flood,infrastructure,water,climate resilience',
        year: 2023,
        sector_id: SEC[2],
        local_body_id: LB[1],
        display_order: 12,
        is_active: 1,
    },
    {
        title: 'Kothamangalam Women\'s Business Incubator',
        description: 'State-of-the-art co-working and incubation space for women entrepreneurs with mentorship, seed funding access, e-commerce onboarding, and legal support.',
        project_content: `<h2>Problem Statement</h2><p>Despite Kothamangalam having a strong tradition of women's self-employment through Kudumbashree and SHG networks, aspiring women entrepreneurs consistently cited three barriers to scaling: lack of professional workspace, inadequate business development skills, and difficulty accessing formal finance. The Women's Business Incubator addresses all three.</p><h2>Facility Amenities</h2><ul><li>2,800 sq ft co-working space with 40 workstations</li><li>5 private cabin offices for growing businesses</li><li>Conference room with AV equipment (capacity 20)</li><li>Photography studio for product photography</li><li>High-speed internet and printing/scanning facilities</li><li>Creche facility enabling mother-entrepreneurs to work</li></ul><h2>Programme Offerings</h2><ul><li>3-month intensive incubation cohorts (4 per year, 20 businesses per cohort)</li><li>Business planning, financial modelling, and marketing workshops</li><li>E-commerce onboarding: Amazon, Meesho, ONDC, Instagram shops</li><li>Legal clinic: GST, FSSAI, trademark, and business registration</li><li>Quarterly demo day for investor and buyer pitching</li></ul><h2>Outcomes to Date</h2><p>Six incubation cohorts have been completed, with 96 businesses graduating from the programme. 78 are still actively operating. Combined annual revenue of graduates has grown from ₹84 lakh (pre-incubation baseline) to ₹3.6 crore. Three graduates have hired 5+ employees. One product line from an incubated business is now stocked in 22 retail outlets across Kerala.</p>`,
        images: imgs('women1', 'women2', 'women3'),
        tags: 'women empowerment,entrepreneurship,business,skill development,self-employment',
        year: 2023,
        sector_id: SEC[5],
        local_body_id: LB[0],
        display_order: 13,
        is_active: 1,
    },
    {
        title: 'Kuttampuzha Solar Street Lighting Network',
        description: 'Installation of 480 standalone solar street lights across 22 remote tribal hamlets eliminating dependence on grid electricity for public lighting.',
        project_content: `<h2>Project Rationale</h2><p>Extending the electricity grid to the most remote hamlets of Kuttampuzha is prohibitively expensive due to terrain and low consumer density. Meanwhile, lack of public lighting has created significant safety concerns, particularly for women and children returning from work or school after dusk. The Solar Street Lighting project offers an off-grid solution that is low-maintenance and self-sustaining.</p><h2>Technical Specifications</h2><ul><li>480 standalone LED street light units with integrated solar panels</li><li>Each unit: 40W LED luminaire, 60W monocrystalline solar panel, 60Ah LiFePO4 battery</li><li>Intelligent charge controllers with dawn-to-dusk automatic switching</li><li>Lights positioned at 25m intervals on all main paths and junctions</li><li>Remote monitoring SIM cards for fault detection in 52 high-density lights</li></ul><h2>Coverage</h2><p>22 hamlets now have full public lighting coverage. Previously, 16 of these hamlets had no public lighting at all, and 6 had only partial grid-powered lighting with frequent outages. Total illuminated path length: 12.4 km.</p><h2>Safety and Social Impact</h2><p>Night market activity has increased substantially in three hamlets. School attendance for evening tutorial classes has improved. Women community leaders interviewed post-installation reported feeling significantly safer during evening hours. The monthly cost of public lighting to the panchayat has dropped from ₹38,000 to ₹2,400 (maintenance contract) — a 94% reduction.</p>`,
        images: imgs('solar1', 'solar2', 'solar3'),
        tags: 'solar energy,lighting,tribal,rural,renewable energy',
        year: 2022,
        sector_id: SEC[4],
        local_body_id: LB[3],
        display_order: 14,
        is_active: 1,
    },
    {
        title: 'Kothamangalam Heritage Zone Conservation',
        description: 'Documentation, restoration, and conservation of 14 heritage structures in the town core including the colonial-era market building, old bridge, and three historical churches.',
        project_content: `<h2>Heritage Significance</h2><p>Kothamangalam's built heritage reflects a layered history spanning pre-colonial indigenous architecture, Portuguese and Dutch colonial influence, and early-modern mercantile building traditions unique to this Periyar river trading town. Fourteen structures have been identified as having outstanding historical, cultural, or architectural significance.</p><h2>Conservation Works</h2><ul><li>Structural stabilisation and roof restoration of the 1887 Municipal Market building</li><li>Lime mortar repointing and façade cleaning of three 18th-century churches</li><li>Protective railing and documentation of the 1910 iron suspension bridge</li><li>Weatherproofing and adaptive reuse study for two colonial-era godowns</li><li>Archaeological documentation of the river ghats complex</li><li>Heritage signage and interpretation panels at all 14 sites</li></ul><h2>Documentation</h2><p>A comprehensive Heritage Survey has been completed for all structures, including architectural drawings, material analysis, photographic documentation, and oral history records from descendants of original building families. This documentation has been digitised and deposited with the Kerala State Archives and the municipality's heritage cell.</p><h2>Public Engagement</h2><p>A Heritage Walk programme established through this project guides residents and visitors through the town's historical core every Saturday and Sunday morning. The walk has been attended by 3,200 participants since launch. A heritage map booklet designed for the project is available in Malayalam and English and has been distributed to all municipality wards and district schools.</p>`,
        images: imgs('heritage1', 'heritage2', 'heritage3', 'heritage4'),
        tags: 'heritage,culture,conservation,architecture,tourism',
        year: 2024,
        sector_id: SEC[3],
        local_body_id: LB[0],
        display_order: 15,
        is_active: 1,
    },
];

async function run() {
    console.log(`🌱 Seeding ${projects.length} dummy projects...\n`);

    // Get current max display_order
    const [[{ maxOrder }]] = await db.query('SELECT COALESCE(MAX(display_order),0) AS maxOrder FROM projects');
    let orderBase = maxOrder;

    for (const p of projects) {
        orderBase++;
        const [result] = await db.query(
            `INSERT INTO projects
             (title, description, project_content, images, tags, year,
              sector_id, local_body_id, display_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                p.title,
                p.description,
                p.project_content,
                p.images,
                p.tags,
                p.year,
                p.sector_id,
                p.local_body_id,
                p.display_order + orderBase - 1,
                p.is_active,
            ]
        );
        console.log(`  ✅ [${result.insertId}] ${p.title.slice(0, 55)}`);
    }

    console.log(`\n🎉 Done! Inserted ${projects.length} projects.`);
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
