import dotenv from 'dotenv';
dotenv.config();

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const bucket = process.env.AWS_S3_BUCKET || 'my-portfolio-bucket';

async function testUpload() {
    try {
        console.log("Testing upload to S3...");
        const response = await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: 'test-folder/test-file.txt',
            Body: 'Hello World',
            ContentType: 'text/plain'
        }));
        console.log("Success!", response);
    } catch (err) {
        console.error("S3 Error:", err);
    }
}

testUpload();
