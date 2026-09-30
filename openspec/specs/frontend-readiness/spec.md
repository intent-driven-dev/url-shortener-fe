# frontend-readiness Specification

## Purpose

Make frontend startup and readiness predictable for local component delivery and coordinated application acceptance.

## Requirements

### Requirement: Explicit runtime configuration
The frontend SHALL require PORT and BACKEND_ORIGIN, listen on 127.0.0.1 at the supplied port, and reject missing or invalid configuration with a clear startup error. PORT SHALL be an integer from 1 to 65535; BACKEND_ORIGIN SHALL be an HTTP origin without credentials, path prefix, query, or fragment.

#### Scenario: Valid configuration
- **WHEN** the process starts with an available PORT and valid BACKEND_ORIGIN
- **THEN** it serves the frontend on 127.0.0.1 at that port

#### Scenario: Invalid configuration
- **WHEN** either required setting is absent or invalid
- **THEN** startup fails with a diagnostic identifying the invalid setting

### Requirement: Backend-dependent readiness
GET /health SHALL return 200 only when backend GET /health returns 200. Other upstream statuses, redirects, connection failures, or a five-second response deadline SHALL produce 503 without following redirects. Later probes SHALL reflect backend recovery.

#### Scenario: Backend is usable
- **WHEN** backend /health returns 200
- **THEN** frontend /health returns 200

#### Scenario: Backend is unusable
- **WHEN** backend /health returns a non-200 status, refuses the connection, or exceeds five seconds
- **THEN** frontend /health returns 503 while the static creation form remains available

#### Scenario: Backend recovers
- **WHEN** a failing probe is followed by a backend /health response of 200
- **THEN** the next frontend probe returns 200 without restarting the frontend

### Requirement: Reproducible delivery instructions
The component SHALL document installation, startup, required configuration, listening address, backend dependency, readiness semantics, and HTTP/browser test commands.

#### Scenario: Delivery setup
- **WHEN** a developer follows the documented setup with allocated ports and a backend origin
- **THEN** the frontend can be started and checked using /health, npm test, and npm run test:e2e
