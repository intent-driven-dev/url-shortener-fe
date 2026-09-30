---
status: accepted
---
# Use plain JavaScript and Node for the frontend

## Context and Problem Statement

The new frontend needs a browser form and a same-origin HTTP proxy under the application [boundary](../../../url-shortener-app-spec/architecture/boundary.md). The user-provided execution plan confirms plain JavaScript + Node; this record documents that accepted choice.

## Considered Options

- Plain HTML, CSS, and browser JavaScript with Node's built-in HTTP server/client.
- A browser framework and bundler with a Node web framework.
- Static hosting with a separately managed reverse proxy.

## Decision Outcome

Chosen option: "Plain HTML, CSS, and browser JavaScript with Node's built-in HTTP server/client", because it matches the confirmed stack and keeps this small component runnable as one process without runtime framework dependencies.

Use Node's test runner for HTTP boundary tests and Playwright as a development dependency for real browser verification. See the [component design](../../openspec/changes/url-creation/design.md). This decision implements, and does not supersede, application [ADR 0001](../../../url-shortener-app-spec/architecture/adrs/0001-component-boundaries-and-same-origin-proxy.md) and [ADR 0002](../../../url-shortener-app-spec/architecture/adrs/0002-durable-link-mappings.md).

### Consequences

- Good, because the form and proxy require no browser build step or runtime framework.
- Good, because real HTTP boundary tests can isolate this component from backend technology.
- Bad, because routing, proxy transport details, and DOM state transitions require explicit implementation and tests.
- Bad, because browser tests require a separate Playwright browser installation.
