import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createFrontend } from '../src/server.js';
import { mock, listen, close, request } from '../test-support/servers.js';
async function fixture(t) {
  const backend = await mock(); t.after(() => backend.close());
  const frontend = createFrontend({ backendOrigin: backend.origin }); const origin = await listen(frontend); t.after(() => close(frontend));
  return { backend, frontend, origin };
}
test('process rejects invalid configuration', async () => {
  for (const env of [{}, { PORT: '0' }, { PORT: '1.2' }, { PORT: '65536' }, { PORT: '1234' }, ...['https://localhost', 'http://a/path', 'http://u:p@a', 'http://a/?q=1', 'http://a/#f', 'bad'].map(BACKEND_ORIGIN => ({ PORT: '1234', BACKEND_ORIGIN }))]) {
    const child = spawn(process.execPath, ['src/start.js'], { env: { ...process.env, PORT: '', BACKEND_ORIGIN: '', ...env } });
    let stderr = ''; child.stderr.on('data', data => stderr += data);
    const [code] = await once(child, 'exit'); assert.equal(code, 1); assert.match(stderr, /PORT|BACKEND_ORIGIN/);
  }
});
test('real startup binds allocated loopback port', async t => {
  const backend = await mock(); t.after(() => backend.close());
  const allocator = await mock(); const port = allocator.server.address().port; await allocator.close();
  const child = spawn(process.execPath, ['src/start.js'], { env: { ...process.env, PORT: String(port), BACKEND_ORIGIN: backend.origin + '/' } });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const [output] = await once(child.stdout, 'data'); assert.match(output.toString(), new RegExp(`127.0.0.1:${port}`));
  assert.equal((await request(`http://127.0.0.1:${port}`, '/')).status, 200);
});
test('mock records bytes, delays and cleans resources even after failure', async () => {
  const backend = await mock();
  try { backend.handler = (_req, res) => backend.delay(() => res.end('delayed'), 20); assert.equal((await request(backend.origin, '/raw?x=%2F', { method: 'POST', body: '{bad' })).text, 'delayed'); assert.equal(backend.requests[0].body.toString(), '{bad'); backend.delay(() => assert.fail('timer leaked'), 1000); throw new Error('simulated assertion failure'); }
  catch (error) { assert.equal(error.message, 'simulated assertion failure'); }
  finally { await backend.close(); }
  assert.equal(backend.server.listening, false); assert.equal(backend.timers.size, 0);
});
test('transparent routes, payloads, application envelopes and framing', async t => {
  const { backend, origin } = await fixture(t);
  for (const [status, code] of [[201, null], [400, 'INVALID_INPUT'], [404, 'NOT_FOUND'], [503, 'STORAGE_UNAVAILABLE']]) {
    const body = code ? JSON.stringify({ error: { code, message: 'literal <b>message</b>' } }) : '{ "shortUrl": "http://example/s/a" }';
    backend.handler = (_req, res) => { res.writeHead(status, { 'content-type': 'application/json', 'x-app': 'yes', 'content-length': Buffer.byteLength(body), connection: 'close, x-private', 'x-private': 'secret' }); res.end(body); };
    const response = await request(origin, '/api/links?raw=%2f&x=1', { method: 'POST', body: '{malformed', headers: { 'content-type': 'application/json', 'content-length': 10, 'x-client': 'keep', connection: 'close, x-remove', 'x-remove': 'secret' } });
    assert.equal(response.status, status); assert.equal(response.text, body); assert.equal(response.headers['x-app'], 'yes'); assert.equal(response.headers['x-private'], undefined); assert.equal(+response.headers['content-length'], Buffer.byteLength(body));
    const captured = backend.requests.at(-1); assert.equal(captured.method, 'POST'); assert.equal(captured.url, '/api/links?raw=%2f&x=1'); assert.equal(captured.body.toString(), '{malformed'); assert.equal(captured.headers['x-client'], 'keep'); assert.equal(captured.headers['x-remove'], undefined); assert.equal(captured.headers.host, new URL(backend.origin).host);
  }
  backend.handler = (_req, res) => res.end('route');
  for (const path of ['/api', '/s', '/s/code?x=%2F', '/api/nested']) assert.equal((await request(origin, path)).text, 'route');
  for (const path of ['/apix', '/something', '/sneaky', '/../package.json']) assert.equal((await request(origin, path)).status, 404);
  const response = await request(origin, '/api', { method: 'PATCH', headers: { te: 'trailers', 'proxy-authorization': 'secret' }, body: 'chunked bytes' }); assert.equal(response.text, 'route'); assert.equal(backend.requests.at(-1).headers.te, undefined); assert.equal(backend.requests.at(-1).headers['proxy-authorization'], undefined); assert.equal(backend.requests.at(-1).body.toString(), 'chunked bytes');
});
test('redirect Location preserved and never followed, including health redirects', async t => {
  const { backend, origin } = await fixture(t); const destination = await mock(); t.after(() => destination.close());
  const location = destination.origin + '/path?q=%2F#fragment'; backend.handler = (_req, res) => { res.writeHead(302, { location }); res.end(); };
  const response = await request(origin, '/s/code'); assert.equal(response.status, 302); assert.equal(response.headers.location, location);
  assert.equal((await request(origin, '/health')).status, 503); assert.equal(destination.requests.length, 0);
});
for (const kind of ['refused', 'interrupted', 'stalled', 'trickled']) test(`upstream ${kind} fails with JSON and recovers`, async t => {
  const { backend, origin } = await fixture(t);
  if (kind === 'refused') await backend.close();
  else backend.handler = (_req, res) => {
    if (kind === 'interrupted') { res.writeHead(201, { 'content-length': 100 }); res.write('partial'); backend.delay(() => res.destroy(), 30); }
    if (kind === 'trickled') { const tick = () => { if (!res.destroyed) { res.write('.'); backend.delay(tick, 200); } }; tick(); }
  };
  const start = Date.now(); const response = await request(origin, '/api/links'); assert.equal(response.status, 503); assert.match(response.headers['content-type'], /application\/json/); const error = JSON.parse(response.text).error; assert.equal(error.code, 'BACKEND_UNAVAILABLE'); assert.equal(typeof error.message, 'string');
  if (['stalled', 'trickled'].includes(kind)) { assert.ok(Date.now() - start >= 4900); assert.ok(Date.now() - start < 6500); }
  if (kind === 'refused') await new Promise(resolve => backend.server.listen(new URL(backend.origin).port, '127.0.0.1', resolve));
  backend.handler = (_req, res) => res.end('recovered'); assert.equal((await request(origin, '/api')).text, 'recovered');
});
test('readiness statuses, refusal, timeout, recovery and static availability', async t => {
  const { backend, origin } = await fixture(t);
  for (const status of [200, 201, 400, 503]) { backend.handler = (_req, res) => { res.writeHead(status); res.end(); }; assert.equal((await request(origin, '/health')).status, status === 200 ? 200 : 503); assert.equal(backend.requests.at(-1).url, '/health'); assert.equal(backend.requests.at(-1).method, 'GET'); }
  backend.handler = () => {}; assert.equal((await request(origin, '/health')).status, 503);
  await backend.close(); assert.equal((await request(origin, '/health')).status, 503); assert.equal((await request(origin, '/')).status, 200);
  await new Promise(resolve => backend.server.listen(new URL(backend.origin).port, '127.0.0.1', resolve)); backend.handler = (_req, res) => res.end(); assert.equal((await request(origin, '/health')).status, 200);
});
test('static media types and explicit allowlist', async t => {
  const { origin, frontend } = await fixture(t); assert.equal(frontend.address().address, '127.0.0.1');
  for (const [path, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) assert.ok((await request(origin, path)).headers['content-type'].startsWith(type));
  for (const path of ['/src/server.js', '/package.json', '/public/index.html']) assert.equal((await request(origin, path)).status, 404);
});
test('client disconnect cancels owned upstream work', async t => {
  const { backend, origin } = await fixture(t);
  backend.handler = () => {};
  const http = await import('node:http');
  const client = http.request(origin + '/api'); client.on('error', () => {}); client.end();
  t.after(() => client.destroy());
  const deadline = Date.now() + 2000;
  while (!backend.requests.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(backend.requests.length, 1); client.destroy();
  while (backend.sockets.size && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(backend.sockets.size, 0);
  backend.handler = (_req, res) => res.end('recovered'); assert.equal((await request(origin, '/api')).text, 'recovered');
});
