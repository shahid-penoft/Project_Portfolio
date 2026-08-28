import xlsx from 'xlsx';
import db from '../configs/db.js';

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function seedTourismPlaces() {
  console.log("🚀 Starting Tourism Places Seeding...");

  try {
    // 1. Ensure columns exist in tourism_attractions
    console.log("⚙️ Ensuring tourism_attractions schema columns...");
    const [existingCols] = await db.query("SHOW COLUMNS FROM tourism_attractions");
    const colNames = existingCols.map(c => c.Field);

    if (!colNames.includes('sub_category')) {
      await db.query("ALTER TABLE tourism_attractions ADD COLUMN sub_category VARCHAR(100) NULL AFTER category");
    }
    if (!colNames.includes('tourism_potential')) {
      await db.query("ALTER TABLE tourism_attractions ADD COLUMN tourism_potential VARCHAR(50) NULL AFTER sub_category");
    }
    if (!colNames.includes('visit_period')) {
      await db.query("ALTER TABLE tourism_attractions ADD COLUMN visit_period VARCHAR(100) NULL AFTER tourism_potential");
    }

    // 2. Read Excel file
    const path = 'c:/Users/WorkSpace-Penoft/Documents/Project_Portfolio/Kothamangalam Tourism Project (1).xlsx';
    console.log(`📖 Reading Excel file from: ${path}`);
    const workbook = xlsx.readFile(path);
    const sheetName = workbook.SheetNames[0]; // 'Tourism Inventory'
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`📋 Found ${rows.length} items in sheet '${sheetName}'`);

    let insertedTourism = 0;
    let updatedTourism = 0;
    let insertedGeo = 0;
    let updatedGeo = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const placeName = (row['Place'] || '').trim();
      const category = (row['Category'] || 'Nature').trim();
      const subCategory = (row['Sub Category'] || '').trim();
      const potential = (row['Tourism Potential'] || 'Medium').trim();
      const visitPeriod = (row['Visit Period'] || 'Oct-Feb').trim();

      if (!placeName) continue;

      const baseSlug = slugify(placeName);
      const description = `A prominent ${category} attraction featuring ${subCategory || 'scenic landscapes'} in Kothamangalam with ${potential} tourism potential. Best visit period: ${visitPeriod}.`;

      // ── A. Seed into tourism_attractions ──
      const [[existingAttraction]] = await db.query(
        "SELECT id, slug FROM tourism_attractions WHERE title = ? OR slug = ?",
        [placeName, baseSlug]
      );

      const daysOpenJson = JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

      if (existingAttraction) {
        await db.query(
          `UPDATE tourism_attractions 
           SET title = ?, category = ?, sub_category = ?, tourism_potential = ?, visit_period = ?, description = ?, location = 'Kothamangalam', updated_at = NOW()
           WHERE id = ?`,
          [placeName, category, subCategory, potential, visitPeriod, description, existingAttraction.id]
        );
        updatedTourism++;
      } else {
        await db.query(
          `INSERT INTO tourism_attractions 
           (slug, title, description, location, category, sub_category, tourism_potential, visit_period, published_by, days_open)
           VALUES (?, ?, ?, 'Kothamangalam', ?, ?, ?, ?, 'MLA Office', ?)`,
          [baseSlug, placeName, description, category, subCategory, potential, visitPeriod, daysOpenJson]
        );
        insertedTourism++;
      }

      // ── B. Seed into geo_locations (All Locations & Tourist Places pages) ──
      const [[existingGeo]] = await db.query(
        "SELECT id FROM geo_locations WHERE name = ?",
        [placeName]
      );

      if (existingGeo) {
        await db.query(
          `UPDATE geo_locations 
           SET category = ?, sub_category = ?, local_body_id = COALESCE(local_body_id, 1), is_tourist_place = 1, status = 'published', description = ?, updated_at = NOW()
           WHERE id = ?`,
          [category, subCategory, description, existingGeo.id]
        );
        updatedGeo++;
      } else {
        await db.query(
          `INSERT INTO geo_locations 
           (type, name, category, sub_category, local_body_id, landmark, full_address, description, is_operational, is_public_access, is_tourist_place, status, created_at, updated_at)
           VALUES ('Detailed Location', ?, ?, ?, 1, 'Kothamangalam', 'Kothamangalam, Ernakulam, Kerala', ?, 1, 1, 1, 'published', NOW(), NOW())`,
          [placeName, category, subCategory, description]
        );
        insertedGeo++;
      }
    }

    console.log("\n✅ Seeding Summary:");
    console.log(`- tourism_attractions: ${insertedTourism} inserted, ${updatedTourism} updated.`);
    console.log(`- geo_locations:       ${insertedGeo} inserted, ${updatedGeo} updated.`);
    console.log("🎉 Seeding completed successfully!");
  } catch (err) {
    console.error("❌ Seeding Error:", err);
  } finally {
    process.exit(0);
  }
}

seedTourismPlaces();
