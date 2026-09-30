## Purpose

Expose backend link operations through the frontend origin while preserving application semantics and reporting bounded connectivity failures.

## ADDED Requirements

### Requirement: Transparent application forwarding
The frontend SHALL proxy /api and /s and their slash-delimited descendants to BACKEND_ORIGIN, preserving methods, raw paths, query strings, body bytes, statuses, and end-to-end headers. It SHALL handle Host and connection-specific transport headers correctly without forwarding hop-by-hop or Connection-nominated headers.

#### Scenario: Creation forwarding
- **WHEN** a client posts JSON to /api/links with a query string and end-to-end headers
- **THEN** the backend receives the same method, raw path/query, body bytes, and end-to-end headers and its 201 response is relayed unchanged

#### Scenario: Malformed request and backend errors
- **WHEN** a request contains malformed JSON or the backend returns 400/INVALID_INPUT, 404/NOT_FOUND, or 503/STORAGE_UNAVAILABLE
- **THEN** request bytes are forwarded without JSON interpretation and response status, envelope bytes, and end-to-end headers are preserved

#### Scenario: Transport header isolation
- **WHEN** either peer sends Connection naming a connection-specific header
- **THEN** that header and hop-by-hop headers are not relayed to the other connection and message framing remains valid

### Requirement: Redirect preservation
The frontend SHALL relay redirects without following them server-side and SHALL preserve the complete Location value.

#### Scenario: Complete destination redirect
- **WHEN** the backend returns 302 with a Location containing a path, query, and fragment
- **THEN** the client receives that exact 302 and Location and the frontend makes no request to the redirect destination

### Requirement: Bounded upstream failures
The frontend SHALL return 503 with application/json and {error:{code:"BACKEND_UNAVAILABLE",message}} containing a human-readable string message when an upstream connection fails or the response does not complete within five seconds.

#### Scenario: Refused or interrupted connection
- **WHEN** the backend refuses the connection or disconnects before a complete response
- **THEN** the frontend returns the BACKEND_UNAVAILABLE envelope rather than a partial success

#### Scenario: Deadline and recovery
- **WHEN** an upstream response stalls or trickles beyond five seconds and a later request completes normally
- **THEN** the first request returns 503 after the deadline and the later request relays its normal response
