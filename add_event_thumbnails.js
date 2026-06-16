import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import db from './configs/db.js'; // Assumes db is exported properly

dotenv.config();

const THUMBNAIL_DIR = 'C:\\Users\\WorkSpace-Penoft\\Downloads\\thumbnails';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const s3Bucket = process.env.AWS_S3_BUCKET || 'my-portfolio-bucket';

async function uploadToS3(filePath, fileName) {
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || 'image/jpeg';
    const key = `uploads/thumbnails/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '-')}`;

    const uploadParams = {
        Bucket: s3Bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
    };

    try {
        console.log(`Uploading thumbnail ${fileName} to S3...`);
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

// Helper to shuffle an array
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

async function updateThumbnails() {
    try {
        if (!fs.existsSync(THUMBNAIL_DIR)) {
            console.error(`Directory not found: ${THUMBNAIL_DIR}`);
            process.exit(1);
        }

        const files = fs.readdirSync(THUMBNAIL_DIR).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        });

        if (files.length === 0) {
            console.log('No thumbnail files found in the directory.');
            process.exit(0);
        }

        console.log(`Found ${files.length} thumbnail images. Getting events to update...`);

        // Get the events seeded earlier that don't have a thumbnail
        const [rows] = await db.query(
            `SELECT id, event_id FROM event_media WHERE media_type = 'video' AND thumbnail_url IS NULL`
        );

        if (rows.length === 0) {
            console.log('No video records found needing a thumbnail.');
            process.exit(0);
        }

        console.log(`Found ${rows.length} records needing thumbnails.`);

        let shuffledThumbnails = shuffleArray([...files]);
        let thumbIndex = 0;

        for (const record of rows) {
            // Cycle through thumbnails if we have fewer images than events
            if (thumbIndex >= shuffledThumbnails.length) {
                thumbIndex = 0;
                shuffledThumbnails = shuffleArray([...files]); // Reshuffle for next round
            }

            const file = shuffledThumbnails[thumbIndex];
            const filePath = path.join(THUMBNAIL_DIR, file);
            
            // 1. Upload thumbnail to S3
            const thumbnailUrl = await uploadToS3(filePath, file);
            console.log(`Successfully uploaded. URL: ${thumbnailUrl}`);

            // 2. Update the `event_media` record
            await db.query(
                `UPDATE event_media SET thumbnail_url = ? WHERE id = ?`,
                [thumbnailUrl, record.id]
            );

            console.log(`Record ID ${record.id} updated with thumbnail.`);
            console.log('-----------------------------------');

            thumbIndex++;
        }

        console.log('All thumbnails processed and events updated successfully.');
        process.exit(0);

    } catch (err) {
        console.error('Updating failed:', err);
        process.exit(1);
    }
}

updateThumbnails();
