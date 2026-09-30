## 1. Runtime and isolated test foundation

- [x] 1.1 Add the plain JavaScript/Node package manifest, lockfile, start script, Node HTTP test command, and development-only Playwright setup; verify installation succeeds and npm test / npm run test:e2e discover their respective suites.
- [x] 1.2 Add server construction and process startup with required PORT/BACKEND_ORIGIN validation and loopback binding; verify process-level tests for valid startup, missing/invalid settings, and the actual listening address.
- [x] 1.3 Add programmable local HTTP mock fixtures with fresh state and allocated ports per test; verify request capture, delayed/error responses, and teardown of owned listeners/sockets/timers even on test failure, without importing or starting backend implementation.

## 2. Proxy and readiness

- [x] 2.1 Implement slash-delimited /api and /s routing and transparent forwarding; verify raw method/path/query/body and end-to-end headers, 201 response bytes, malformed JSON forwarding, and 400/INVALID_INPUT, 404/NOT_FOUND, 503/STORAGE_UNAVAILABLE envelopes using real HTTP tests.
- [x] 2.2 Handle upstream Host, framing, hop-by-hop headers, and Connection-nominated headers in both directions; verify request and response transport header tests preserve application headers and valid body lengths.
- [x] 2.3 Relay redirects without following them; verify a raw 302 and exact Location containing path/query/fragment, plus zero requests at a separate local redirect destination.
- [x] 2.4 Implement five-second completion deadlines, connection-failure envelopes, upstream cancellation, and cleanup; verify refused connections, incomplete responses, stalled/trickled responses, JSON 503/BACKEND_UNAVAILABLE, and subsequent successful recovery.
- [x] 2.5 Implement GET /health against backend GET /health; verify 200 only for backend 200, 503 for other statuses including redirects, refusal and timeout, no redirect following, and recovery without frontend restart.

## 3. Browser interface

- [x] 3.1 Serve allowlisted HTML/CSS/JavaScript assets and an accessible form at /; verify media types and unknown paths in HTTP tests, plus visible labeled field, Shorten URL button, keyboard operation, result/alert semantics, and form availability during backend failure in Playwright.
- [x] 3.2 Implement same-origin JSON submission and pending state; verify real browser requests reach the mock through the frontend with exact entered destination, duplicate submission is blocked, and old result/error content clears immediately.
- [x] 3.3 Display only valid 201 shortUrl responses using original text/href and safe DOM operations; verify exact selectable output and rejection of missing, non-string, relative, unsafe-scheme, wrong-origin, wrong-path, malformed JSON, and unexpected-status responses.
- [x] 3.4 Display backend messages safely and restore submission after every outcome; verify literal HTML-like error text, fallback errors for malformed envelopes, no successful links on failure, stale-result removal, and successful retry after HTTP/network failures.

## 4. Navigation and delivery verification

- [x] 4.1 Add a Playwright navigation test using the real frontend, mock backend redirect, and separate local destination server; verify clicking the returned link reaches the exact destination URL with path/query/fragment and uses no external network.
- [x] 4.2 Document supported Node version, install/browser-install commands, startup, PORT/BACKEND_ORIGIN, 127.0.0.1 binding, backend PUBLIC_LINK_ORIGIN relationship, readiness/deadline semantics, and both test commands; verify the documented setup against a local mock and explicitly distinguish component tests from live durability/application acceptance.
- [x] 4.3 Run npm test, npm run test:e2e, and openspec validate url-creation --strict; record command outcomes and review scenario coverage across all three specs, confirming owned resources are cleaned up and reporting any remaining limitations.
