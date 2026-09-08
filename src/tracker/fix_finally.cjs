const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /isScanningInProgress = false;/g,
  'isScanningInProgress = false;\n      scanStatusMessage = "";'
);
fs.writeFileSync('server.ts', code);
