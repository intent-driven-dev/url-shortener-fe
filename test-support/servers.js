import http from 'node:http';
export async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
export async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
export async function mock() {
  const requests = []; const timers = new Set(); const sockets = new Set();
  const state = { handler: (_req, res) => res.end('ok'), requests, sockets, timers };
  state.delay = (fn, ms) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); return timer; };
  state.server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
    state.handler(req, res);
  });
  state.server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  state.origin = await listen(state.server);
  state.close = async () => { for (const timer of timers) clearTimeout(timer); timers.clear(); for (const socket of sockets) socket.destroy(); await close(state.server); };
  return state;
}
export function request(origin, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(origin + path, { method, headers, agent: false }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end(body);
  });
}
