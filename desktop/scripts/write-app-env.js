const fs = require('fs');
const path = require('path');

const profile = String(process.argv[2] || '').trim();
if (!profile) {
  console.error('Usage: node scripts/write-app-env.js <APP_ENV>');
  process.exit(1);
}

const outDir = path.resolve(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(outDir, 'app-env.json');
fs.writeFileSync(outFile, JSON.stringify({ APP_ENV: profile }, null, 2) + '\n', 'utf8');

console.log(`[build] Wrote ${outFile} (APP_ENV=${profile})`);

