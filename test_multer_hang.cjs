const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');

const app = express();

const fileFilter = (req, file, cb) => {
    // Simulate the error
    try {
        let name = file.originalname; // what if it's undefined?
        // Wait, if it's undefined, Buffer.from throws
        // Let's force an error
        throw new Error("Boom");
    } catch(e) {
        // If we don't catch it, what happens? Let's not catch it to see if it hangs
    }
};

const fileFilterThrow = (req, file, cb) => {
    throw new Error("Boom!");
};

const upload = multer({ dest: 'uploads/', fileFilter: fileFilterThrow });

app.post('/upload', upload.single('file'), (req, res) => {
    res.send('ok');
});

// Error handling middleware
app.use((err, req, res, next) => {
    res.status(500).send(err.message);
});

const server = app.listen(3000, async () => {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream('package.json'));
        const res = await axios.post('http://localhost:3000/upload', form, { headers: form.getHeaders() });
        console.log(res.data);
    } catch (err) {
        console.error("Client Error:", err.message);
    }
    server.close();
});
