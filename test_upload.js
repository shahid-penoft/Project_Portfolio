import express from 'express';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.post('/upload', upload.single('file'), (req, res) => {
    console.log("Raw originalname:", req.file.originalname);
    console.log("Decoded latin1->utf8:", Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
    console.log("Decoded utf8->latin1:", Buffer.from(req.file.originalname, 'utf8').toString('latin1'));
    res.json({ 
        raw: req.file.originalname, 
        latin1ToUtf8: Buffer.from(req.file.originalname, 'latin1').toString('utf8') 
    });
});

app.listen(3005, () => console.log('Test server on 3005'));
