# URL Shortener frontend

Plain JavaScript browser UI and a Node HTTP server, with no runtime dependencies. Requires Node.js 22 or newer (verified with Node 25.9.0).

## Install and run

```sh
npm ci
npx playwright install chromium
PORT=3100 BACKEND_ORIGIN=http://127.0.0.1:3101 npm start
```

Allocate distinct available frontend/backend ports before startup. `PORT` is required, an integer from 1 to 65535. `BACKEND_ORIGIN` is required, an HTTP origin without credentials, path prefix, query, or fragment; a trailing slash is allowed. Invalid settings fail startup. The frontend binds only `127.0.0.1`.

Start the separately delivered backend on its allocated port with `PUBLIC_LINK_ORIGIN=http://127.0.0.1:3100` (the frontend origin). The backend owns destination validation, generation, durable mappings and redirects. Open `http://127.0.0.1:3100/`. The browser submits same-origin `/api/links`; returned links use this origin under `/s/`.

```sh
curl -i http://127.0.0.1:3100/health
```

Each GET `/health` probes backend GET `/health`; only backend 200 produces frontend 200. Other statuses (including redirects), failed connections, incomplete responses and responses exceeding a five-second wall-clock completion deadline yield 503. Failures are not cached, so readiness recovers without restart. The creation form remains available during backend failure. `/api`, `/s` and slash-delimited descendants proxy raw application requests, responses and Location without following redirects. Responses are buffered, appropriate for these small API payloads; large arbitrary payloads are outside the current boundary.

## Component verification

```sh
npm test
npm run test:e2e
openspec validate url-creation --strict
```

HTTP tests exercise real loopback listeners, process startup, transparent bytes/headers, redirects, deadlines and readiness. Playwright uses real Chromium, the frontend and programmable local backend peers; no browser request interception or external destination network is used. Tests allocate ephemeral ports and clean owned sockets, timers, listeners, child processes and browser contexts in teardown. The process-startup test verifies the documented configuration against a local mock.

These are isolated component tests. They do not establish backend durability or live combined application acceptance. Those checks require the separately delivered backend and application acceptance environment, including persistence across backend restart.
