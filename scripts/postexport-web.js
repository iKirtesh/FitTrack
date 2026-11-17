// expo-sqlite's web build starts its worker from `new URL('./worker', location.href)`, i.e. `/worker`.
// Metro's static export emits it under a hashed name instead, so copy it to the path the code expects.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'dist', '_expo', 'static', 'js', 'web');
const file = fs.readdirSync(dir).find((f) => /^worker-.*\.js$/.test(f));
if (!file) { console.error('postexport-web: no worker bundle found in', dir); process.exit(1); }
fs.copyFileSync(path.join(dir, file), path.join(__dirname, '..', 'dist', 'worker'));
console.log('postexport-web: copied', file, '-> dist/worker');
