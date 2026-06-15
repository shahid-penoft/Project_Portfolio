import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import db from '../configs/db.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE_PATH = path.join(__dirname, '..', 'Kothamangalam - Local body and Wards(Local Body & Wards).csv');

const formatWardName = (name) => {
    if (!name) return '';
    const trimmed = name.trim();
    if (trimmed.length === 0) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const seed = async () => {
    try {
        console.log('Reading CSV file...');
        const workbook = xlsx.readFile(CSV_FILE_PATH);
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`Found ${rows.length} rows in CSV.`);

        // 1. Extract and Insert Unique Local Bodies
        const localBodyNames = [...new Set(rows.map(row => row['Local Body']).filter(Boolean))];
        console.log(`Found ${localBodyNames.length} unique local bodies.`);

        for (const name of localBodyNames) {
            await db.query(
                'INSERT IGNORE INTO local_bodies (name) VALUES (?)',
                [name.trim()]
            );
        }

        // 2. Fetch all local bodies to get their IDs
        const [localBodies] = await db.query('SELECT id, name FROM local_bodies');
        const localBodyMap = {};
        localBodies.forEach(lb => {
            localBodyMap[lb.name] = lb.id;
        });

        // 3. Insert Wards
        console.log('Inserting wards...');
        let insertedCount = 0;
        let skippedCount = 0;

        for (const row of rows) {
            const lbName = row['Local Body'];
            const wardNo = row['Ward Number'];
            const wardNameRaw = row['Ward Name'];

            if (!lbName || !wardNo || !wardNameRaw) {
                skippedCount++;
                continue;
            }

            const localBodyId = localBodyMap[lbName];
            const formattedWardName = formatWardName(wardNameRaw);

            try {
                // Use ON DUPLICATE KEY UPDATE to ensure formatting is applied even if the record exists
                const [result] = await db.query(
                    'INSERT INTO local_body_wards (local_body_id, ward_no, place_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE place_name = VALUES(place_name)',
                    [localBodyId, String(wardNo), formattedWardName]
                );
                
                if (result.affectedRows > 0) {
                    insertedCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error(`Failed to insert/update ward ${wardNo} for ${lbName}:`, err.message);
                skippedCount++;
            }
        }

        console.log(`Seeding completed successfully.`);
        console.log(`Inserted/Updated: ${insertedCount}`);
        console.log(`Skipped/Errors: ${skippedCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seed();
