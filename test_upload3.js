import express from 'express';
import multer from 'multer';

const fileFilter = (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });
const app = express();

app.post('/upload-array', upload.array('files'), (req, res) => {
    res.json({ originalname: req.files[0].originalname });
});

const server = app.listen(3007, async () => {
    const { execSync } = await import('child_process');
    try {
        const out = execSync('curl.exe -s -X POST -F "files=@test_upload2.js;filename=മലയാളം.js" http://localhost:3007/upload-array').toString();
        console.log('Result:', out);
    } catch(e) {
        console.error(e);
    }
    server.close();
});
