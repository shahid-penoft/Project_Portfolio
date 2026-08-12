const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
    try {
        console.log('1. Calling create complaint...');
        const createRes = await axios.post('http://localhost:5000/api/complaints', {
            title: 'Test Complaint',
            complainant_name: 'Test User',
            phone: '1234567890'
        });
        
        console.log('2. Create complaint response:', createRes.status);
        const complaintId = createRes.data.data.id;
        console.log('3. Complaint ID:', complaintId);

        const form = new FormData();
        form.append('files', fs.createReadStream('package.json'));

        console.log('4. Calling attachments API...');
        const attachRes = await axios.post(`http://localhost:5000/api/complaints/${complaintId}/attachments`, form, {
            headers: form.getHeaders(),
            timeout: 5000
        });
        console.log('5. Attachments API response:', attachRes.status);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

test();
