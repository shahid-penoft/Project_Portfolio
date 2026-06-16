import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import db from './configs/db.js'; // Assumes db is exported properly
import { slugify } from './utils/helpers.js';

dotenv.config();

const VIDEO_DIR = 'C:\\Users\\WorkSpace-Penoft\\Downloads\\election';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const s3Bucket = process.env.AWS_S3_BUCKET || 'my-portfolio-bucket';

// Array of generalized campaign templates
const TEMPLATES = [
    "Constituency Tour & Public Address",
    "Election Campaign 2026",
    "Public Meeting and Interaction",
    "Constituency Visit",
    "Mass Rally",
    "Meet the Candidate",
    "Campaign Roadshow"
];

// Generate a random date in March or May 2026
function getRandomDate() {
    const isMarch = Math.random() > 0.5;
    const year = 2026;
    const month = isMarch ? 2 : 4; // 0-indexed: 2 is March, 4 is May
    const maxDays = isMarch ? 31 : 31;
    const day = Math.floor(Math.random() * maxDays) + 1;
    
    // HH:MM:SS between 09:00:00 and 18:00:00
    const hour = Math.floor(Math.random() * 10) + 9;
    const minute = Math.random() > 0.5 ? '00' : '30';
    
    const dateObj = new Date(year, month, day, hour, parseInt(minute), 0);
    
    return {
        dateStr: dateObj.toISOString().split('T')[0],
        timeStr: `${hour.toString().padStart(2, '0')}:${minute}:00`
    };
}

async function uploadToS3(filePath, fileName) {
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    const key = `uploads/events/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '-')}`;

    const uploadParams = {
        Bucket: s3Bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
    };

    try {
        console.log(`Uploading ${fileName} to S3...`);
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);
        
        // Construct the public URL manually
        const region = process.env.AWS_REGION || 'us-east-1';
        return `https://${s3Bucket}.s3.${region}.amazonaws.com/${key}`;
    } catch (err) {
        console.error(`Error uploading ${fileName}:`, err);
        throw err;
    }
}

async function seed() {
    try {
        if (!fs.existsSync(VIDEO_DIR)) {
            console.error(`Directory not found: ${VIDEO_DIR}`);
            process.exit(1);
        }

        const files = fs.readdirSync(VIDEO_DIR).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.webm', '.mov'].includes(ext);
        });

        if (files.length === 0) {
            console.log('No video files found in the directory.');
            process.exit(0);
        }

        console.log(`Found ${files.length} video files. Starting seed process...`);

        for (const file of files) {
            const filePath = path.join(VIDEO_DIR, file);
            
            // 1. Upload to S3
            const fileUrl = await uploadToS3(filePath, file);
            console.log(`Successfully uploaded. URL: ${fileUrl}`);

            // 2. Generate Event Data
            const eventName = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
            const venue = 'Kothamangalam Constituency';
            const shortDesc = 'Join us for this public event as part of the 2026 election campaign.';
            const { dateStr, timeStr } = getRandomDate();
            
            // Slug generation
            let baseSlug = slugify(eventName);
            let slug = baseSlug;
            let counter = 1;
            while (true) {
                const [existing] = await db.query('SELECT id FROM events WHERE slug = ?', [slug]);
                if (existing.length === 0) break;
                slug = `${baseSlug}-${counter++}`;
            }

            // 3. Insert into `events` table
            console.log(`Creating event: ${eventName} on ${dateStr}`);
            const [eventResult] = await db.query(
                `INSERT INTO events 
                 (event_name, slug, event_date, event_time, venue, short_description, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [eventName, slug, dateStr, timeStr, venue, shortDesc, 'upcoming']
            );
            
            const eventId = eventResult.insertId;

            // 4. Insert into `event_media` table
            await db.query(
                `INSERT INTO event_media 
                 (event_id, media_type, file_url, caption) 
                 VALUES (?, ?, ?, ?)`,
                [eventId, 'video', fileUrl, eventName]
            );

            console.log(`Event ID ${eventId} created successfully with media.`);
            console.log('-----------------------------------');
        }

        console.log('All videos processed and events seeded successfully.');
        process.exit(0);

    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
