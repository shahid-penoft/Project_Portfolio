import http from 'http';

http.get('http://localhost:5000/api/admin/governing/bodies?type=OTHER', (resp) => {
  let data = '';

  resp.on('data', (chunk) => {
    data += chunk;
  });

  resp.on('end', () => {
    const json = JSON.parse(data);
    console.log(JSON.stringify(json, null, 2).slice(0, 500));
  });

}).on("error", (err) => {
  console.log("Error: " + err.message);
});
