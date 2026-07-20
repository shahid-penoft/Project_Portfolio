import fs from 'fs';

async function test() {
  const form = new FormData();
  form.append('name', 'Test User');
  form.append('governing_body_type', 'DISTRICT_PANCHAYAT');
  form.append('local_body_id', '39');
  form.append('ward_id', '1');
  form.append('role_id', '1');
  form.append('gender', 'MALE');
  form.append('phone', '1234567890');
  
  // Create a dummy image
  fs.writeFileSync('dummy.jpg', 'fake image data');
  const blob = new Blob([fs.readFileSync('dummy.jpg')], { type: 'image/jpeg' });
  form.append('photo', blob, 'dummy.jpg');

  try {
    const res = await fetch('http://localhost:5000/api/admin/governing-bodies', {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
