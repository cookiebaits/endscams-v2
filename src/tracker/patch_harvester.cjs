const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const googleQueries = \[\s*\{/s,
  `const googleQueries = [
      {
        query: 'site:techscammersunited.com',
        category: 'Tech Support & Refund Scam',
        platform: 'Tech Scammers United',
      },
      {`
);

code = code.replace(
  /const totalSteps = 6;/g,
  `const totalSteps = googleQueries.length * pageOffsets.length + 2 * pageOffsets.length; // 2 bbb targets`
);

code = code.replace(
  /const googlePageUrl = \`https:\/\/www\.google\.com\/search\?q=\$\{encodeURIComponent\(item\.query\)\}&start=\$\{offset\}\`;\s*try \{/g,
  `const googlePageUrl = \`https://www.google.com/search?q=\${encodeURIComponent(item.query)}&start=\${offset}\`;
        scanStatusMessage = \`Scanning \${item.platform}: \${item.category}...\`;
        try {`
);

code = code.replace(
  /const bbbUrl = \`https:\/\/www\.bbb\.org\/scamtracker\/lookupscam\?q=\$\{target\.qParam\}%26from%3D\$\{bbbOffset\}\`;\s*try \{/g,
  `const bbbUrl = \`https://www.bbb.org/scamtracker/lookupscam?q=\${target.qParam}%26from%3D\${bbbOffset}\`;
        scanStatusMessage = \`Scanning BBB Scam Tracker: \${target.category}...\`;
        try {`
);

fs.writeFileSync('server.ts', code);
