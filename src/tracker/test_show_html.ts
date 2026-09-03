import fs from 'fs';

const html = fs.readFileSync('google_res.html', 'utf8');
console.log('HTML preview:\n', html.slice(0, 1000));
