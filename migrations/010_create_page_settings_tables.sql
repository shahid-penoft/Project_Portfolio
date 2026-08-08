-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010: Create settings tables for Kothamangalam and Ente Nadu pages
-- Mirrors the `about_settings` table schema exactly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kothamangalam_settings (
    id                 INT          NOT NULL DEFAULT 1,
    data               JSON         NOT NULL,
    section_order      JSON,
    section_visibility JSON,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT kothamangalam_settings_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS ente_nadu_settings (
    id                 INT          NOT NULL DEFAULT 1,
    data               JSON         NOT NULL,
    section_order      JSON,
    section_visibility JSON,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT ente_nadu_settings_single_row CHECK (id = 1)
);
