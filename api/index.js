/* NYAM FM Vercel API with shared persistent room state (Upstash Redis REST).
   Required env vars: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
*/
const fs = require('fs');
const path = require('path');
const { handleApi, rooms } = require('../game.js');
const INDEX = path.join(__dirname, '..', 'index.html');
const ROOM_TTL_SECONDS = 60 * 60; // refreshed on every room request

function sendJson(res, obj, code = 200) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Konfigurasi Redis belum ada. Isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN di Vercel.');
  return { url: url.replace(/\/$/, ''), token };
}
async function redisCommand(command) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store'
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error || `Redis HTTP ${response.status}`);
  return payload.result;
}
const roomKey = code => `nyamfm:room:${String(code || '').toUpperCase().trim()}`;
function serializeRoom(room) {
  return JSON.stringify({ ...room, locked: [...room.locked] });
}
function deserializeRoom(raw) {
  const room = JSON.parse(raw);
  room.locked = new Set(room.locked || []);
  return room;
}
async function loadRoom(code) {
  if (!code) return null;
  const raw = await redisCommand(['GET', roomKey(code)]);
  if (!raw) return null;
  const room = deserializeRoom(raw);
  rooms.set(room.code, room);
  return room;
}
async function saveRoom(code) {
  const normalized = String(code || '').toUpperCase().trim();
  if (!normalized) return;
  const room = rooms.get(normalized);
  if (!room) {
    await redisCommand(['DEL', roomKey(normalized)]);
    return;
  }
  await redisCommand(['SET', roomKey(normalized), serializeRoom(room), 'EX', String(ROOM_TTL_SECONDS)]);
}
module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/favicon.ico') { res.statusCode = 204; return res.end(); }
  if (url.pathname === '/api') {
    try {
      const body = req.method === 'GET'
        ? { ...Object.fromEntries(url.searchParams.entries()), action: 'poll' }
        : await readBody(req);
      const action = body.action;
      const codeBefore = String(body.room || body.code || '').toUpperCase().trim();
      // A function instance may serve a different room/request than before.
      rooms.clear();
      if (codeBefore) await loadRoom(codeBefore);
      const out = await handleApi(body);
      const codeAfter = String(out.code || (out.s && out.s.code) || codeBefore || '').toUpperCase().trim();
      if (codeAfter) await saveRoom(codeAfter);
      // If a leave removed the last human, removeRoom() deleted it from memory.
      if (action === 'leave' && codeBefore && !rooms.has(codeBefore)) {
        await redisCommand(['DEL', roomKey(codeBefore)]);
      }
      return sendJson(res, out, out.ok ? 200 : 200);
    } catch (e) {
      return sendJson(res, { ok: false, err: 'Server error: ' + (e && e.message) }, 500);
    }
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(fs.readFileSync(INDEX));
    } catch {
      res.statusCode = 500;
      return res.end('index.html tidak ditemukan');
    }
  }
  res.statusCode = 404;
  res.end('Not found');
};
