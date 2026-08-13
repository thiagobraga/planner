const http = require('http');

const API = 'http://localhost:4000/api/v1';
let token = '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (res.statusCode >= 400) reject(new Error(`${method} ${path}: ${res.statusCode}`));
        else resolve(json);
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    console.log('Registering user...');
    const reg = await request('POST', '/auth/register', {
      email: 'test@planner.local',
      password: 'Password123!@',
      displayName: 'Test User',
    });
    token = reg.token;
    console.log('✓ Registered');

    console.log('Creating collection...');
    const col = await request('POST', '/collections', {
      name: 'Test Project',
      color: '#d56b64',
    });
    const collectionId = col.id;
    console.log('✓ Created collection');

    console.log('Creating 12 test tasks...');
    const dates = [-2, -1, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5];
    for (let i = 0; i < dates.length; i++) {
      const d = new Date();
      d.setDate(d.getDate() + dates[i]);
      const due = d.toISOString().split('T')[0];
      await request('POST', '/tasks', {
        title: `Task ${i + 1}`,
        collectionId,
        dueDate: due,
        type: 'task',
      });
    }
    console.log('✓ Created 12 tasks');
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
