-- ============================================================
-- Migration: Add ward_id to events table
-- Module: Events
-- ============================================================

ALTER TABLE events 
ADD COLUMN ward_id INT UNSIGNED DEFAULT NULL AFTER local_body_id,
ADD CONSTRAINT fk_events_ward FOREIGN KEY (ward_id) REFERENCES local_body_wards(id) ON DELETE SET NULL;
