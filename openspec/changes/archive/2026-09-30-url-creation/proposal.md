## Why

Visitors need a form to create and follow short links. This empty frontend repository must deliver its portion of the accepted application boundary under [INT-59](https://linear.app/intent-driven-dev/issue/INT-59/implement-url-creation-frontend-frontend), independently testable without the backend implementation.

## What Changes

- Serve an accessible destination form, selectable returned short URL, and visible errors at `/` using plain JavaScript and Node.
- Proxy same-origin `/api` and `/s` requests without altering application payloads, statuses, or redirect destinations.
- Require allocated port and backend origin configuration; expose backend-dependent readiness and bounded upstream failures.
- Add isolated HTTP and browser boundary tests and setup documentation.

## Capabilities

### New Capabilities

- `url-creation-ui`: Accessible submission, pending state, exact result display, safe failures, and link navigation.
- `backend-proxy`: Transparent requests/responses and redirects with bounded backend availability failures.
- `frontend-readiness`: Required configuration, loopback listening, and backend-dependent health.

### Modified Capabilities

None; there are no existing component specifications.

## Impact

Adds the first application code, Node package/test commands, static browser assets, and development-only Playwright dependency in a later apply workflow. The application [boundary](../../../../url-shortener-app-spec/architecture/boundary.md) remains authoritative. Validation of destinations, code generation, durable storage, expiry, accounts, analytics, and link management remain outside this component. Mock-backed component evidence does not establish live backend durability or combined application acceptance.
