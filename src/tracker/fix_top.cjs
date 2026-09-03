const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /let isScanningInProgress = false;\s*scanStatusMessage = "";\s*let scanProgress = 0;\s*let scanStatusMessage = "";/,
  'let isScanningInProgress = false;\nlet scanProgress = 0;\nlet scanStatusMessage = "";'
);
fs.writeFileSync('server.ts', code);
