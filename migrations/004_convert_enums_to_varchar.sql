-- Convert complaints table ENUMs to VARCHAR
ALTER TABLE `complaints` 
  MODIFY COLUMN `status` VARCHAR(255) NOT NULL DEFAULT 'Pending',
  MODIFY COLUMN `priority` VARCHAR(255) NOT NULL DEFAULT 'Medium';

-- Convert issues table ENUMs to VARCHAR
ALTER TABLE `issues` 
  MODIFY COLUMN `status` VARCHAR(255) NOT NULL DEFAULT 'Pending',
  MODIFY COLUMN `priority` VARCHAR(255) NOT NULL DEFAULT 'Medium';

-- Convert ideas table ENUMs to VARCHAR
ALTER TABLE `ideas` 
  MODIFY COLUMN `status` VARCHAR(255) NOT NULL DEFAULT 'Pending',
  MODIFY COLUMN `priority` VARCHAR(255) NOT NULL DEFAULT 'Medium';

-- Convert suggestions table ENUMs to VARCHAR
ALTER TABLE `suggestions` 
  MODIFY COLUMN `status` VARCHAR(255) NOT NULL DEFAULT 'Pending',
  MODIFY COLUMN `priority` VARCHAR(255) NOT NULL DEFAULT 'Medium';
