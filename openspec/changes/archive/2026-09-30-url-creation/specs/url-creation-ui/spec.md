## Purpose

Allow visitors to submit destination URLs, inspect generated short links, and understand failures through an accessible browser interface.

## ADDED Requirements

### Requirement: Accessible creation form
The frontend SHALL serve a form at / with a labeled destination field, a button labeled Shorten URL, a result region, and a visible error region when an error occurs. Controls SHALL support keyboard use and status changes SHALL be announced accessibly.

#### Scenario: View and operate the form
- **WHEN** a visitor opens / and navigates using the keyboard
- **THEN** the labeled destination field and Shorten URL button are visible and operable

### Requirement: Same-origin submission and pending state
The frontend SHALL submit JSON {destinationUrl} with Content-Type application/json to same-origin POST /api/links. It SHALL clear stale results/errors and prevent duplicate submissions while pending, then restore submission when the request finishes.

#### Scenario: Submit while a previous result exists
- **WHEN** a visitor submits a destination after a previous successful creation
- **THEN** the previous result disappears, one same-origin request carries the entered destination, and submission remains disabled until completion

### Requirement: Exact selectable success result
The frontend SHALL display the exact returned shortUrl as link text and href only for a 201 response containing a valid absolute HTTP(S) short URL on the frontend origin under /s/. It SHALL NOT construct or rewrite the returned short URL.

#### Scenario: Display a successful result
- **WHEN** the creation request returns 201 with a valid shortUrl
- **THEN** the result contains a selectable link whose text and href attribute equal that string exactly

#### Scenario: Follow the result
- **WHEN** the visitor follows a displayed link and the backend redirects through the proxy
- **THEN** the browser navigates to the complete destination including its path, query, and fragment

### Requirement: Safe failures and recovery
The frontend SHALL render backend error messages as text. HTTP errors, network failures, malformed JSON, missing or invalid shortUrl, and unexpected success statuses SHALL show a readable error and SHALL NOT produce a successful link. Missing or malformed error envelopes SHALL use a local fallback message.

#### Scenario: Backend rejects creation
- **WHEN** creation returns an error envelope whose message contains HTML markup
- **THEN** the message is visible as literal text, no markup executes, and no success link is displayed

#### Scenario: Invalid response
- **WHEN** creation returns malformed JSON, an invalid shortUrl, or a status other than 201
- **THEN** a visible error replaces any stale result and submission is enabled again

#### Scenario: Retry after network failure
- **WHEN** a failed request is followed by a new submission returning valid 201 JSON
- **THEN** the error clears and the new exact short URL is displayed
