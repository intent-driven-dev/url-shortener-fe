import { configuration, createFrontend } from './server.js';
try {
  const config = configuration(process.env);
  const server = createFrontend(config);
  server.on('error', error => { console.error(`Startup failed: ${error.message}`); process.exitCode = 1; });
  server.listen(config.port, '127.0.0.1', () => console.log(`Frontend listening at http://127.0.0.1:${config.port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
} catch (error) { console.error(`Startup failed: ${error.message}`); process.exitCode = 1; }
