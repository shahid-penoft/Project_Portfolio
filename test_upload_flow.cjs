const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
    try {
        console.log('Creating complaint...');
        const createRes = await axios.post('http://localhost:5000/api/complaints', {
            title: 'Test Complaint',
            complainant_name: 'Test User',
            phone: '1234567890'
        });
        
        const complaintId = createRes.data.data.id;
        console.log('Complaint created with ID:', complaintId);

        console.log('Sending attachment...');
        const form = new FormData();
        form.append('files', fs.createReadStream('package.json'));

        const attachRes = await axios.post(`http://localhost:5000/api/complaints/${complaintId}/attachments`, form, {
            headers: form.getHeaders(),
            timeout: 10000
        });
        console.log('Attachment Response:', attachRes.status, attachRes.data);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

test();
