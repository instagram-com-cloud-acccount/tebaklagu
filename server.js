/* ============================================================
   NYAM FM — server lokal (Node murni, zero dependency)
   node server.js
   Untuk Vercel, entry-nya ada di api/index.js
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { handleApi, sweep } = require('./game.js');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

function readBody(req) {
  return new Promise((ok) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } });
    req.on('error', () => ok({}));
  });
}
function json(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }

  if (u.pathname === '/api') {
    try {
      sweep();
      if (req.method === 'GET') {
        const q = Object.fromEntries(u.searchParams.entries());
        return json(res, await handleApi({ ...q, action: 'poll' }));
      }
      const b = await readBody(req);
      return json(res, await handleApi(b));
    } catch (e) {
      return json(res, { ok: false, err: 'Server error: ' + (e && e.message) }, 500);
    }
  }

  if ((u.pathname === '/' || u.pathname === '/index.html') && req.method === 'GET') {
    return fs.readFile(INDEX, (e, d) => {
      if (e) { res.writeHead(500); return res.end('index.html tidak ditemukan di samping server.js'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(d);
    });
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  Object.values(os.networkInterfaces()).forEach(l => l && l.forEach(n => {
    if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  }));
  console.log('\n  NYAM FM siap nge-gas.');
  console.log('  Lokal      : http://localhost:' + PORT);
  ips.forEach(ip => console.log('  Satu Wi-Fi : http://' + ip + ':' + PORT));
  console.log('\n  Kirim link itu (tambah ?room=KODE kalau sudah bikin room) ke temanmu.\n');
});
