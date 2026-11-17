// Serves ./dist like a production static host would for FitTrack: SPA fallback plus the
// cross-origin isolation headers that SQLite-on-web (SharedArrayBuffer) needs. Usage: node scripts/serve-dist.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf' };
http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  r.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  r.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  r.setHeader('Content-Type', f.endsWith(path.sep + 'worker') ? 'text/javascript' : types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(r);
}).listen(Number(process.argv[2] || 8099), () => console.log('serving dist on', process.argv[2] || 8099));
