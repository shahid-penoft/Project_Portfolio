const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
    try {
        const form = new FormData();
        form.append('files', fs.createReadStream('package.json'));

        console.log('Sending request...');
        const res = await axios.post('http://localhost:5000/api/complaints/C-001/attachments', form, {
            headers: form.getHeaders(),
            timeout: 5000
        });
        console.log('Response:', res.status, res.data);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

test();
