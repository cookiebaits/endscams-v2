const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const \[scanProgress, setScanProgress\] = useState\(0\);/,
  'const [scanProgress, setScanProgress] = useState(0);\n  const [scanStatusMessage, setScanStatusMessage] = useState("");'
);

code = code.replace(
  /if \(data\.scanProgress !== undefined\) setScanProgress\(data\.scanProgress\);/,
  'if (data.scanProgress !== undefined) setScanProgress(data.scanProgress);\n          if (data.scanStatusMessage !== undefined) setScanStatusMessage(data.scanStatusMessage);'
);

code = code.replace(
  /\{isScanning \? \`Refreshing\.\.\. \$\{scanProgress\}%\` : 'Manual Refresh'\}/,
  "{isScanning ? (scanStatusMessage ? `${scanStatusMessage} (${scanProgress}%)` : `Refreshing... ${scanProgress}%`) : 'Manual Refresh'}"
);

fs.writeFileSync('src/App.tsx', code);
