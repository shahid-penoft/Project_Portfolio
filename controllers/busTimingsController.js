import pool from '../configs/db.js';

export const getAll = async (req, res) => {
    try {
        let sql = `SELECT * FROM bus_timings WHERE 1=1`;
        const params = [];

        if (req.query.type && req.query.type !== 'All') {
            sql += ` AND type = ?`;
            params.push(req.query.type);
        }

        if (req.query.search) {
            sql += ` AND (route LIKE ? OR departure_stand LIKE ? OR destination_stand LIKE ? OR type LIKE ?)`;
            const term = `%${req.query.search}%`;
            params.push(term, term, term, term);
        }

        if (req.query.departure) {
            const deps = req.query.departure.split(',');
            sql += ` AND departure_stand IN (${deps.map(() => '?').join(',')})`;
            params.push(...deps);
        }

        if (req.query.destination) {
            const dests = req.query.destination.split(',');
            sql += ` AND destination_stand IN (${dests.map(() => '?').join(',')})`;
            params.push(...dests);
        }

        if (req.query.days) {
            const selectedDays = req.query.days.split(',');
            if (selectedDays.length > 0) {
                const dayConditions = selectedDays.map(() => `JSON_CONTAINS(days, ?)`).join(' OR ');
                sql += ` AND (JSON_LENGTH(days) = 0 OR ${dayConditions})`;
                params.push(...selectedDays.map(d => `"${d}"`));
            }
        }

        sql += ` ORDER BY departure_time ASC`;

        const [rows] = await pool.query(sql, params);

        // Parse JSON days column
        const data = rows.map(r => ({
            id: r.id,
            type: r.type,
            departureTime: r.departure_time,
            departureStand: r.departure_stand,
            route: r.route,
            destinationTime: r.destination_time,
            destinationStand: r.destination_stand,
            days: typeof r.days === 'string' ? JSON.parse(r.days) : r.days,
            reservation: Boolean(r.reservation),
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));

        // Get counts
        const [countRows] = await pool.query(`SELECT type, COUNT(*) as count FROM bus_timings GROUP BY type`);
        let total = 0;
        const counts = { All: 0 };
        for (const row of countRows) {
            counts[row.type] = row.count;
            total += row.count;
        }
        counts.All = total;

        // Get last updated info
        const [lastUpdatedRow] = await pool.query(`
            SELECT updated_at, updated_by_name
            FROM bus_timings
            ORDER BY updated_at DESC LIMIT 1
        `);

        res.json({
            success: true,
            data,
            meta: {
                total: data.length,
                counts,
                updatedAt: lastUpdatedRow.length > 0 ? lastUpdatedRow[0].updated_at : null,
                updatedBy: lastUpdatedRow.length > 0 ? lastUpdatedRow[0].updated_by_name : null,
            }
        });
    } catch (error) {
        console.error('Error in getAll bus_timings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const create = async (req, res) => {
    try {
        const { type, departureTime, departureStand, route, destinationTime, destinationStand, days, reservation } = req.body;

        if (!['KSRTC', 'Private', 'Other State Gov'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid bus type' });
        }
        if (!/^\d{2}:\d{2}$/.test(departureTime) || !/^\d{2}:\d{2}$/.test(destinationTime)) {
            return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:MM' });
        }
        if (!departureStand || !destinationStand || !route) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (!Array.isArray(days)) {
            return res.status(400).json({ success: false, message: 'Days must be an array' });
        }

        const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        if (!days.every(d => validDays.includes(d))) {
            return res.status(400).json({ success: false, message: 'Invalid days provided' });
        }

        const updatedByName = req.user?.name || 'Admin';

        const [result] = await pool.query(
            `INSERT INTO bus_timings (type, departure_time, departure_stand, route, destination_time, destination_stand, days, reservation, created_by_name, updated_by_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [type, departureTime, departureStand, route, destinationTime, destinationStand, JSON.stringify(days), reservation ? 1 : 0, updatedByName, updatedByName]
        );

        res.json({
            success: true,
            data: { id: result.insertId, type, departureTime, departureStand, route, destinationTime, destinationStand, days, reservation }
        });
    } catch (error) {
        console.error('Error in create bus_timings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, departureTime, departureStand, route, destinationTime, destinationStand, days, reservation } = req.body;

        if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

        const [existing] = await pool.query(`SELECT id FROM bus_timings WHERE id = ?`, [id]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Bus route not found' });

        if (!['KSRTC', 'Private', 'Other State Gov'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid bus type' });
        }
        if (!/^\d{2}:\d{2}$/.test(departureTime) || !/^\d{2}:\d{2}$/.test(destinationTime)) {
            return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:MM' });
        }
        if (!departureStand || !destinationStand || !route) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (!Array.isArray(days)) {
            return res.status(400).json({ success: false, message: 'Days must be an array' });
        }

        const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        if (!days.every(d => validDays.includes(d))) {
            return res.status(400).json({ success: false, message: 'Invalid days provided' });
        }

        const updatedByName = req.user?.name || 'Admin';

        await pool.query(
            `UPDATE bus_timings SET type = ?, departure_time = ?, departure_stand = ?, route = ?, destination_time = ?, destination_stand = ?, days = ?, reservation = ?, updated_by_name = ? WHERE id = ?`,
            [type, departureTime, departureStand, route, destinationTime, destinationStand, JSON.stringify(days), reservation ? 1 : 0, updatedByName, id]
        );

        res.json({
            success: true,
            data: { id: parseInt(id), type, departureTime, departureStand, route, destinationTime, destinationStand, days, reservation }
        });
    } catch (error) {
        console.error('Error in update bus_timings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const remove = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

        const [existing] = await pool.query(`SELECT id FROM bus_timings WHERE id = ?`, [id]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Bus route not found' });

        await pool.query(`DELETE FROM bus_timings WHERE id = ?`, [id]);

        res.json({ success: true, message: 'Route deleted' });
    } catch (error) {
        console.error('Error in remove bus_timings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
