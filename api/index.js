/* ============================================================
   Vercel serverless entry — semua request masuk ke sini.
   GET  /            -> index.html
   POST /api         -> aksi game
   GET  /api?room=.. -> polling state (pengganti SSE)
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const { handleApi, sweep } = require('../game.js');

const INDEX = path.join(__dirname, '..', 'index.html');

function sendJson(res, obj, code = 200) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');

  // favicon: balas kosong supaya tidak 404 berisik di console
  if (url.pathname === '/favicon.ico') {
    res.statusCode = 204;
    return res.end();
  }

  if (url.pathname === '/api') {
    try {
      sweep();
      if (req.method === 'GET') {
        // polling: klien kirim room/pid/token lewat query
        const q = Object.fromEntries(url.searchParams.entries());
        const out = await handleApi({ ...q, action: 'poll' });
        return sendJson(res, out);
      }
      const body = await readBody(req);
      const out = await handleApi(body);
      return sendJson(res, out);
    } catch (e) {
      return sendJson(res, { ok: false, err: 'Server error: ' + (e && e.message) }, 500);
    }
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = fs.readFileSync(INDEX);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(html);
    } catch (e) {
      res.statusCode = 500;
      return res.end('index.html tidak ditemukan');
    }
  }

  res.statusCode = 404;
  res.end('Not found');
};
