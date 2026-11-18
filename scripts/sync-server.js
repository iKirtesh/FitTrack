// FitTrack LAN sync server: run this on your computer; your phone app and the website both sync through it.
//   npm run build:web && npm run sync:server        (default port 8787)
// It serves the web build from ./dist AND the sync API. Data is stored in ./sync-data/ on this computer only.
// Traffic is plain HTTP on your own network, protected by a pairing code. Do not expose this port to the internet.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { mergeEnvelopes, emptyEnvelope } = require('./sync-merge');

const port = Number(process.argv[2] || process.env.PORT || 8787);
const root = path.join(__dirname, '..', 'dist');
const dataDir = process.env.SYNC_DATA_DIR || path.join(__dirname, '..', 'sync-data');
fs.mkdirSync(dataDir, { recursive: true });
const dataFile = path.join(dataDir, 'data.json');
const codeFile = path.join(dataDir, 'pairing-code.txt');
if (!fs.existsSync(codeFile)) fs.writeFileSync(codeFile, String(crypto.randomInt(100000, 999999)));
const code = fs.readFileSync(codeFile, 'utf8').trim();
const load = () => (fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : emptyEnvelope());
const MAX_BODY = 200 * 1024 * 1024;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf' };
const authed = (q) => {
  const got = Buffer.from((q.headers.authorization || '').replace(/^Bearer /, ''));
  const want = Buffer.from(code);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};
const json = (r, status, body) => { r.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }); r.end(JSON.stringify(body)); };

http.createServer((q, r) => {
  const url = q.url.split('?')[0];
  if (url.startsWith('/api/')) {
    if (q.method === 'OPTIONS') return json(r, 204, {});
    if (url === '/api/ping') return json(r, 200, { ok: true, app: 'fittrack-sync' });
    if (url === '/api/sync' && q.method === 'POST') {
      if (!authed(q)) return json(r, 401, { error: 'Wrong pairing code' });
      let size = 0; const chunks = [];
      q.on('data', (c) => { size += c.length; if (size > MAX_BODY) { json(r, 413, { error: 'Too large' }); q.destroy(); } else chunks.push(c); });
      q.on('end', () => {
        try {
          const { merged, added } = mergeEnvelopes(load(), JSON.parse(Buffer.concat(chunks).toString('utf8')));
          const tmp = `${dataFile}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(merged)); fs.renameSync(tmp, dataFile); // atomic: never a half-written file
          console.log(new Date().toLocaleTimeString(), `sync from ${q.socket.remoteAddress}: ${added} new row(s)`);
          json(r, 200, merged);
        } catch (e) { json(r, 400, { error: String(e.message || e) }); }
      });
      return;
    }
    return json(r, 404, { error: 'Not found' });
  }
  let f = path.join(root, decodeURIComponent(url));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('Run "npm run build:web" first, then start this server again.'); }
  r.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  r.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  r.setHeader('Content-Type', f.endsWith(path.sep + 'worker') ? 'text/javascript' : types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(r);
}).listen(port, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('FitTrack sync server running.\n');
  for (const ip of ips) console.log(`  Website + server address:  http://${ip}:${port}`);
  console.log(`\n  Pairing code: ${code}\n  Data folder:  ${dataDir}\n`);
  console.log('Enter the address and pairing code in the app: Settings > Sync across devices.');
});
