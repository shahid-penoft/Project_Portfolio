-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011: Testimonial request workflow
-- Adds moderation workflow columns to `ente_nadu_testimonials` so public
-- submissions can be stored as pending requests and approved/rejected from
-- the Ente Nadu admin page.
--
--   status  : pending (public request) | approved (published) | rejected
--   email   : contact detail captured from public submissions (optional)
--   source  : admin (created in admin) | public (submitted from website)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ente_nadu_testimonials
    ADD COLUMN status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER caption,
    ADD COLUMN email  VARCHAR(150) DEFAULT NULL                       AFTER status,
    ADD COLUMN source ENUM('admin','public') NOT NULL DEFAULT 'admin' AFTER email,
    ADD INDEX idx_status (status);