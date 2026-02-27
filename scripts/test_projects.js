const endpoints = [
    'http://localhost:5000/api/projects/public/year/2025',
    'http://localhost:5000/api/projects/public/local-body/1',
    'http://localhost:5000/api/projects/public/sector/1',
    'http://localhost:5000/api/projects/public/search?q=test'
];

async function run() {
    for (const ep of endpoints) {
        console.log('Testing', ep);
        const res = await fetch(ep);
        const data = await res.json();
        console.log('Status:', res.status, 'Success:', data.success, 'Items received:', data.data ? data.data.length : 'N/A');
    }
}
run();
