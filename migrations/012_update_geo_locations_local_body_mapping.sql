-- Migration: 012_update_geo_locations_local_body_mapping.sql
-- Description: Ensures local_body_id and indexes exist on geo_locations, and maps unassigned Kothamangalam locations to Kothamangalam Municipality.

-- 1. Ensure local_body_id column exists on geo_locations
SET @dbname = DATABASE();
SET @tablename = 'geo_locations';
SET @columnname = 'local_body_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_NAME = @tablename)
      AND (TABLE_SCHEMA = @dbname)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE geo_locations ADD COLUMN local_body_id INT NULL AFTER history_details;'
));
PREPARE alterTableIfNotExists FROM @preparedStatement;
EXECUTE alterTableIfNotExists;
DEALLOCATE PREPARE alterTableIfNotExists;

-- 2. Add foreign key if not already present
SET @fkExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'geo_locations' 
  AND CONSTRAINT_NAME = 'fk_geo_locations_local_body');

SET @sqlFk = IF(@fkExists = 0, 
  'ALTER TABLE geo_locations ADD CONSTRAINT fk_geo_locations_local_body FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE SET NULL;', 
  'SELECT 1');
PREPARE stmtFk FROM @sqlFk;
EXECUTE stmtFk;
DEALLOCATE PREPARE stmtFk;

-- 3. Add composite / performance indexes for fast filter lookups
CREATE INDEX IF NOT EXISTS idx_geo_locations_local_body ON geo_locations (local_body_id);
CREATE INDEX IF NOT EXISTS idx_geo_locations_ward ON geo_locations (ward);
CREATE INDEX IF NOT EXISTS idx_geo_locations_category ON geo_locations (category);
CREATE INDEX IF NOT EXISTS idx_geo_locations_sub_category ON geo_locations (sub_category);
CREATE INDEX IF NOT EXISTS idx_geo_locations_status_tourist ON geo_locations (status, is_tourist_place);

-- 4. Update unassigned Kothamangalam landmarks/tourist places to Kothamangalam Municipality
UPDATE geo_locations g
SET g.local_body_id = (
  SELECT id FROM local_bodies WHERE name = 'Kothamangalam Municipality' LIMIT 1
)
WHERE g.local_body_id IS NULL
  AND (
    g.landmark = 'Kothamangalam'
    OR g.name LIKE '%Kothamangalam%'
    OR g.full_address LIKE '%Kothamangalam%'
  );

-- Verify mapping
SELECT 
  g.id, 
  g.name, 
  g.category, 
  g.sub_category, 
  g.ward, 
  g.local_body_id, 
  lb.name AS local_body_name
FROM geo_locations g
LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
WHERE lb.name = 'Kothamangalam Municipality'
LIMIT 10;
