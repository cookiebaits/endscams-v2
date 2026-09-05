const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const dup = `{
        query: 'site:techscammersunited.com',
        category: 'Tech Support & Refund Scam',
        platform: 'Tech Scammers United',
      },
      {
        query: 'site:techscammersunited.com',
        category: 'Tech Support & Refund Scam',
        platform: 'Tech Scammers United',
      },`;
const correct = `{
        query: 'site:techscammersunited.com',
        category: 'Tech Support & Refund Scam',
        platform: 'Tech Scammers United',
      },`;
code = code.replace(dup, correct);
fs.writeFileSync('server.ts', code);
