import express from 'express';
import multer from 'multer';

const fileFilter = (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });
const app = express();

app.post('/upload', upload.single('file'), (req, res) => {
    console.log("Req file originalname:", req.file.originalname);
    res.json({ originalname: req.file.originalname });
});

app.listen(3006, () => console.log('Test server on 3006'));
