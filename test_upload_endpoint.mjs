import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function testVideoUpload() {
    try {
        console.log("Preparing mock video upload...");
        
        // Create a dummy video file
        const dummyPath = path.join(process.cwd(), 'dummy_video.mp4');
        fs.writeFileSync(dummyPath, Buffer.alloc(1024 * 1024)); // 1MB dummy file

        // Create form data
        const form = new FormData();
        form.append('file', fs.createReadStream(dummyPath), {
            filename: 'dummy_video.mp4',
            contentType: 'video/mp4'
        });

        console.log("Sending to localhost:5000/api/projects/upload-video ...");
        const response = await axios.post('http://localhost:5000/api/projects/upload-video', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log("Success! Response from server:");
        console.log(response.data);

        // cleanup
        fs.unlinkSync(dummyPath);
    } catch (err) {
        console.error("Upload failed.");
        if (err.response) {
            console.error("Server responded with:", err.response.status);
            console.error(err.response.data);
        } else {
            console.error(err.message);
        }
        
        if (fs.existsSync('dummy_video.mp4')) {
            fs.unlinkSync('dummy_video.mp4');
        }
    }
}

testVideoUpload();
