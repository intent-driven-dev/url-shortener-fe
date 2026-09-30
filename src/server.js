import http from 'node:http';
import { readFileSync } from 'node:fs';

export function configuration(env) {
  if (!/^\d+$/.test(env.PORT || '') || +env.PORT < 1 || +env.PORT > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  let origin;
  try { origin = new URL(env.BACKEND_ORIGIN); } catch { throw new Error('BACKEND_ORIGIN must be an HTTP origin'); }
  if (origin.protocol !== 'http:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('BACKEND_ORIGIN must be an HTTP origin without credentials, path, query or fragment');
  return { port: +env.PORT, backendOrigin: origin.origin };
}
const hop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
function headers(input) {
  const excluded = new Set([...hop, ...(input.connection || '').split(',').map(x => x.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(input).filter(([key]) => !excluded.has(key)));
}
function unavailable(res) {
  if (!res.destroyed) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'BACKEND_UNAVAILABLE', message: 'The backend is unavailable. Please try again.' } })); }
}
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
].map(([path, [file, type]]) => [path, { body: readFileSync(new URL(`../public/${file}`, import.meta.url)), type }]));
export function createFrontend({ backendOrigin }) {
  const backend = new URL(backendOrigin);
  return http.createServer((req, res) => {
    const path = req.url.split('?')[0];
    const health = req.method === 'GET' && path === '/health';
    if (health || /^\/(api|s)(\/|$)/.test(path)) {
      let settled = false;
      const upstreamHeaders = health ? {} : headers(req.headers);
      upstreamHeaders.host = backend.host;
      const upstream = http.request({ hostname: backend.hostname, port: backend.port || 80, method: health ? 'GET' : req.method, path: health ? '/health' : req.url, headers: upstreamHeaders, agent: false });
      const finish = (error, response, body) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        res.off('close', cancel);
        req.off('aborted', cancel);
        if (error) { upstream.destroy(); unavailable(res); return; }
        if (health) { res.writeHead(response.statusCode === 200 ? 200 : 503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ready: response.statusCode === 200 })); }
        else { res.writeHead(response.statusCode, headers(response.headers)); res.end(body); }
      };
      const cancel = () => { if (!settled) { settled = true; clearTimeout(timer); upstream.destroy(); } };
      const timer = setTimeout(() => finish(new Error('deadline')), 5000);
      res.once('close', cancel);
      req.once('aborted', cancel);
      upstream.on('error', error => finish(error));
      upstream.on('response', response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', error => finish(error));
        response.on('aborted', () => finish(new Error('incomplete')));
        response.on('end', () => finish(null, response, Buffer.concat(chunks)));
      });
      if (health) upstream.end(); else req.pipe(upstream);
      return;
    }
    const asset = assets.get(path);
    if (asset && (req.method === 'GET' || req.method === 'HEAD')) { res.writeHead(200, { 'content-type': asset.type, 'content-length': asset.body.length }); res.end(req.method === 'HEAD' ? undefined : asset.body); }
    else { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); }
  });
}
