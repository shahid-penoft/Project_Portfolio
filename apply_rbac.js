import fs from 'fs';
import path from 'path';

const routesDir = './routes';

const permissionMap = {
    'achievementsRoutes.js': 'ente_nadu',
    'campaignRoutes.js': 'enquiries',
    'complaintsRoutes.js': 'complaints',
    'contactRoutes.js': 'enquiries',
    'coreVisionRoutes.js': 'about',
    'departmentRoutes.js': 'complaints',
    'enteNaduRoutes.js': 'ente_nadu',
    'enteNaduTestimonialsRoutes.js': 'ente_nadu',
    'eventRoutes.js': 'events',
    'eventTypeRoutes.js': 'events',
    'galleryRoutes.js': 'gallery',
    'heroRoutes.js': 'home',
    'impactMetricsRoutes.js': 'impact_metrics',
    'jobsRoutes.js': 'jobs',
    'kothamangalamGalleryRoutes.js': 'constituency',
    'localBodyRoutes.js': 'enquiries',
    'manifestoDevGoalsRoutes.js': 'manifesto',
    'manifestoRoutes.js': 'manifesto',
    'mediaCentreRoutes.js': 'media',
    'peopleRoutes.js': 'enquiries',
    'programRoutes.js': 'home',
    'projectRoutes.js': 'projects',
    'recognitionRoutes.js': 'about',
    'schemesRoutes.js': 'schemes',
    'sectorRoutes.js': 'projects',
    'settingsRoutes.js': 'site_settings',
    'templateRoutes.js': 'enquiries',
    'timelineRoutes.js': 'about',
    'tourismRoutes.js': 'tourism',
    'visualStoryRoutes.js': 'home',
    'wardRoutes.js': 'enquiries'
};

const files = fs.readdirSync(routesDir);

for (const file of files) {
    if (!permissionMap[file]) continue;
    const perm = permissionMap[file];
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Add requirePermission to imports if not there
    if (!content.includes('requirePermission')) {
        content = content.replace(/import\s+\{\s*verifyToken\s*\}\s+from\s+['"]\.\.\/middlewares\/auth\.js['"];?/, "import { verifyToken, requirePermission } from '../middlewares/auth.js';");
        
        // Also handle cases where requireRole might be there instead
        content = content.replace(/import\s+\{\s*verifyToken\s*,\s*requireRole\s*\}\s+from\s+['"]\.\.\/middlewares\/auth\.js['"];?/, "import { verifyToken, requirePermission } from '../middlewares/auth.js';");
    }

    // Replace router.use(verifyToken) with router.use(verifyToken, requirePermission('...'))
    content = content.replace(/router\.use\(\s*verifyToken\s*\);?/g, `router.use(verifyToken, requirePermission('${perm}'));`);
    
    // Replace router.use(requireRole(...)) with router.use(requirePermission('...'))
    content = content.replace(/router\.use\(\s*requireRole\(\s*\[?[^\]]+\]?\s*\)\s*\);?/g, `router.use(requirePermission('${perm}'));`);

    // Handle individual route endpoints that use requireRole (like in settingsRoutes)
    content = content.replace(/requireRole\(\s*\[?[^\]]+\]?\s*\)/g, `requirePermission('${perm}')`);

    // Special case for projectRoutes which has public routes before router.use(verifyToken)
    // We already replaced router.use(verifyToken), so that covers the rest.

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file} with permission: ${perm}`);
}
