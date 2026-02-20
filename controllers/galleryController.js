import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// ─────────────────────────────────────────────────────────────
//  GET /api/gallery/images
//  Public — all event photos, grouped by event_type, searchable
// ─────────────────────────────────────────────────────────────
export const getGalleryImages = async (req, res) => {
    try {
        const { search, event_type_id } = req.query;

        let where = `WHERE em.media_type = 'photo'`;
        const params = [];

        if (event_type_id) { where += ' AND e.event_type_id = ?'; params.push(event_type_id); }
        if (search) { where += ' AND (e.event_name LIKE ? OR em.caption LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        const [rows] = await db.query(
            `SELECT
         em.id, em.file_url, em.caption, em.created_at,
         e.id         AS event_id,
         e.event_name,
         e.event_date,
         et.id        AS event_type_id,
         et.type_name AS event_type
       FROM event_media em
       JOIN events      e  ON  e.id = em.event_id
       LEFT JOIN event_types et ON et.id  = e.event_type_id
       ${where}
       ORDER BY et.type_name ASC, e.event_date DESC`,
            params
        );

        // Group by event type
        const grouped = {};
        for (const row of rows) {
            const key = row.event_type || 'Uncategorized';
            if (!grouped[key]) grouped[key] = { event_type_id: row.event_type_id, event_type: key, images: [] };
            grouped[key].images.push({
                id: row.id, file_url: row.file_url, caption: row.caption,
                event_id: row.event_id, event_name: row.event_name, event_date: row.event_date,
                created_at: row.created_at,
            });
        }

        return successResponse(res, {
            data: Object.values(grouped),
            total: rows.length,
        }, 'Gallery images fetched successfully.');
    } catch (err) {
        console.error('[getGalleryImages]', err);
        return errorResponse(res, 'Server error fetching gallery images.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/gallery/videos
//  Public — all event videos, grouped by event_type, searchable
// ─────────────────────────────────────────────────────────────
export const getGalleryVideos = async (req, res) => {
    try {
        const { search, event_type_id } = req.query;

        let where = `WHERE em.media_type = 'video'`;
        const params = [];

        if (event_type_id) { where += ' AND e.event_type_id = ?'; params.push(event_type_id); }
        if (search) { where += ' AND (e.event_name LIKE ? OR em.caption LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        const [rows] = await db.query(
            `SELECT
         em.id, em.file_url, em.caption, em.created_at,
         e.id         AS event_id,
         e.event_name,
         e.event_date,
         et.id        AS event_type_id,
         et.type_name AS event_type
       FROM event_media em
       JOIN events      e  ON  e.id = em.event_id
       LEFT JOIN event_types et ON et.id  = e.event_type_id
       ${where}
       ORDER BY et.type_name ASC, e.event_date DESC`,
            params
        );

        // Group by event type
        const grouped = {};
        for (const row of rows) {
            const key = row.event_type || 'Uncategorized';
            if (!grouped[key]) grouped[key] = { event_type_id: row.event_type_id, event_type: key, videos: [] };
            grouped[key].videos.push({
                id: row.id, file_url: row.file_url, caption: row.caption,
                event_id: row.event_id, event_name: row.event_name, event_date: row.event_date,
                created_at: row.created_at,
            });
        }

        return successResponse(res, {
            data: Object.values(grouped),
            total: rows.length,
        }, 'Gallery videos fetched successfully.');
    } catch (err) {
        console.error('[getGalleryVideos]', err);
        return errorResponse(res, 'Server error fetching gallery videos.');
    }
};
