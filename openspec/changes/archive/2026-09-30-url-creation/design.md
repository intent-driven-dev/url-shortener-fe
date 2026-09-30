## Context

The repository contains OpenSpec configuration and skills but no application code, tests, package manifest, or existing component ADRs. See [proposal](proposal.md) for motivation. The application [boundary](../../../../url-shortener-app-spec/architecture/boundary.md), [registry](../../../../url-shortener-app-spec/architecture/components.md), and accepted [proxy ADR](../../../../url-shortener-app-spec/architecture/adrs/0001-component-boundaries-and-same-origin-proxy.md) and [durability ADR](../../../../url-shortener-app-spec/architecture/adrs/0002-durable-link-mappings.md) govern this delivery.

## Goals / Non-Goals

**Goals:** One loopback process serving static assets and the real proxy; deterministic component tests using only local HTTP peers; explicit lifecycle cleanup and recovery.

**Non-Goals:** Reimplement backend validation or persistence, test backend internals, or claim application acceptance from mock-backed tests.

## Decisions

### Runtime and layout

Use the confirmed [plain JavaScript and Node stack](../../../architecture/adrs/0001-plain-javascript-and-node.md). Plan static files in `public/`, server/configuration code in `src/`, HTTP tests in `test/`, and browser tests in `e2e/` with shared programmable mock utilities. Separate process startup from server construction so tests can own ephemeral listeners and cleanup. Prefer built-in Node HTTP APIs over a web/proxy framework to avoid runtime dependencies. Serve an explicit static asset allowlist with correct media types, avoiding filesystem traversal.

### Browser state

Use a semantic form with an explicitly associated label, keyboard submission, a live result region, and visible alert region. POST JSON `{destinationUrl}` to relative `/api/links`. Backend owns destination validation; avoid browser validation preventing contract-level failures from being displayed. Pending state clears old result/error content and disables duplicate submission. Restore submission in a finally path after success, HTTP failure, malformed JSON, or network failure.

Only a `201` JSON object with a nonempty absolute HTTP(S) `shortUrl` is displayable. Validate its same-origin `/s/` shape without assuming backend code format. Assign the original returned string to link text and the href attribute without rewriting it. Use textContent for both result and error messages; malformed envelopes receive a local readable fallback. Native anchors allow normal selection/copying and browser navigation.

### Proxy transport

Route `/api`, `/api/...`, `/s`, and `/s/...` to configured backend; unrelated prefix lookalikes are not proxy routes. Node HTTP client requests preserve raw path/query, method, body bytes, statuses, and end-to-end headers, including complete Location. Do not parse/re-serialize JSON or follow redirects. Replace Host for the upstream authority; remove hop-by-hop headers and all headers nominated by Connection in both directions, and let Node frame each connection correctly. Preserve valid content-length only when bytes are unchanged.

Use a five-second wall-clock deadline from upstream request initiation through completion, rather than an inactivity-only timeout. Destroy upstream work on timeout/client disconnect and clear timers on completion. Buffer the upstream response before committing downstream status so connection failure, truncated response, or deadline expiry can produce the required `503` JSON `BACKEND_UNAVAILABLE` envelope even after upstream headers arrive. This is suitable for small link API responses; large arbitrary payload support is outside the current component use case. Never leak internal connection details in the human-readable message.

### Configuration and health

Require PORT as an integer from 1 through 65535 and BACKEND_ORIGIN as an HTTP origin with no credentials, query, fragment, or path prefix (a trailing slash is acceptable). Fail startup with a clear diagnostic for missing/invalid inputs. Bind only 127.0.0.1. Tests may use port zero through the server construction API; the public process configuration still requires an allocated port.

For every GET /health, probe backend GET /health with the same five-second deadline and no redirect following. Return 200 only for backend 200; any other status or transport failure yields 503. Do not cache failures: a subsequent successful probe must recover. Continue serving the form while the backend is unavailable.

### Isolated verification

Use fresh programmable Node HTTP mock servers and allocated loopback ports per test. Exercise the actual frontend server/proxy without importing or starting backend code. Record upstream requests byte-for-byte and control status, headers, delays, socket closure, and recovery.

`npm test` runs Node HTTP checks: exact method/path/query/body/header forwarding, unchanged malformed JSON, 201 body, 400/INVALID_INPUT, 404/NOT_FOUND, 503/STORAGE_UNAVAILABLE, transport header handling, and raw 302 Location with path/query/fragment. Use a local redirect destination counter to prove the frontend itself never follows redirects. Verify healthy/unhealthy/redirected health, refused connections, full five-second deadline (including trickled responses), and recovery.

`npm run test:e2e` uses Playwright with the real frontend and mock backend, not browser request interception, to verify accessible form controls, same-origin JSON submission, exact selectable results, pending duplicate prevention, safe backend errors, malformed responses, stale-result removal, and retry after failure. For navigation, return a frontend-origin short URL and redirect via the mock backend to a separate local destination server; assert the complete browser URL including fragment without external network access. Close owned listeners, sockets, timers, processes, and browser contexts in teardown even after assertions fail.

### Delivery workflow

The saved mappings identify INT-59 and its project/team by actual UUIDs. Ready is the existing unstarted status and the agreed Todo equivalent; leave it unchanged after proposal preparation. All implementation tasks remain unchecked. Later apply work follows configured In Progress and In Review transitions and records test/setup evidence.

## Risks / Trade-offs

- Manual transport handling can corrupt redirects or framing → verify exact payload/header behavior and Connection-nominated header removal.
- Buffered responses consume memory proportional to response size → this design targets small link API responses; revisit streaming and limits if that boundary expands.
- A mock can agree with an incorrect implementation → derive assertions from the application boundary and retain separate live application acceptance.
- Real timeout tests take at least five seconds → keep cases focused and isolate ports/state to prevent flaky interference.

## Migration Plan

No existing deployment or data needs migration. During apply, add documented install, browser-install, startup, health, and test commands; start with allocated PORT and BACKEND_ORIGIN. Rollback consists of stopping/reverting the frontend delivery and does not modify backend mappings.
