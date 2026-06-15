import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

// ─── S3 Config ───────────────────────────────────────────
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const s3Bucket = process.env.AWS_S3_BUCKET || 'my-portfolio-bucket';

// ─── File type filter ─────────────────────────────────────────
const fileFilter = (req, file, cb) => {
    fs.appendFileSync('multer_debug.log', `fileFilter called for: ${file.originalname} mimetype: ${file.mimetype}\n`);
    const allowed = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf',
        'application/octet-stream'
    ];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
};

const iconFileFilter = (req, file, cb) => {
    const allowed = [
        'image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'
    ];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Icon file type not allowed: ${file.mimetype}`), false);
    }
};

// ─── Base S3 Storage Configuration ────────────────────────────
const s3StorageOptions = (folder = 'uploads') => ({
    s3: s3Client,
    bucket: s3Bucket,
    key: (req, file, cb) => {
        const name = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '-');
        cb(null, `${folder}/${name}`);
    },
});

// ─── Exports for different size limits ───────────────────────
export const uploadDocument = multer({
    storage: multerS3(s3StorageOptions('documents')),
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
}).single('file');

export const uploadImage = multer({
    storage: multerS3(s3StorageOptions('images')),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('file');

export const uploadVideo = multer({
    storage: multerS3(s3StorageOptions('videos')),
    fileFilter,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
}).single('file');

export const uploadMedia = multer({
    storage: multerS3(s3StorageOptions('media')),
    fileFilter,
    limits: { fileSize: 200 * 1024 * 1024 },
}).single('file');

export const uploadMediaFields = multer({
    storage: multerS3(s3StorageOptions('media')),
    fileFilter,
    limits: { fileSize: 200 * 1024 * 1024 },
}).fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
]);

export const uploadThumbnail = multer({
    storage: multerS3(s3StorageOptions('thumbnails')),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('thumbnail');

export const uploadVisualStoryFiles = multer({
    storage: multerS3(s3StorageOptions('visual-stories')),
    fileFilter,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
}).fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]);

export const uploadIcon = multer({
    storage: multerS3(s3StorageOptions('ente-nadu-icons')),
    fileFilter: iconFileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single('icon');

export const uploadJobDocuments = multer({
    storage: multerS3(s3StorageOptions('job-applications')),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
}).array('documents', 5);


// Helper: wrap multer in a promise (for use inside async controllers)
export const runMulter = (multerFn, req, res) =>
    new Promise((resolve, reject) =>
        multerFn(req, res, (err) => {
            if (!req.body) req.body = {};
            return err ? reject(err) : resolve();
        })
    );

// Safe wrapper for uploadIcon that ensures req.body exists
export const safeUploadIcon = (req, res, next) => {
    uploadIcon(req, res, (err) => {
        if (!req.body) req.body = {};
        if (err) {
            console.warn('Multer S3 error (non-fatal):', err.message);
        }
        next();
    });
};
