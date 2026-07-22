# Workstream E — Desktop Browser Extension and Autofill

**Status:** Completed  
**Depends on:** Workstream B message/data contracts; local mapping may use Workstream A after its interface stabilizes  
**Purpose:** Provide the separately permissioned browser surface that a static ApplyFill page cannot provide across job-site origins

## Objective

Build a desktop browser extension that inspects and fills a job-application form only after a user invokes it on the active tab. Keep ApplyFill's web application as the authoritative profile store and local AI host. The extension receives a short-lived, scoped application packet and must not become a second persistent profile database.

## Extension architecture

- [x] Create a separate pnpm package for a Manifest V3 desktop Chromium extension; do not mix content-script code into the Vite application bundle.
- [x] Use `activeTab` and user-triggered script injection where practical instead of permanent access to every website.
- [x] Request the minimum permissions needed for the approved workflow and explain each permission in user-facing documentation.
- [x] Keep the content script responsible for page-field discovery and deterministic value insertion only.
- [x] Keep LiteRT inference in the ApplyFill application or an explicitly designed extension offscreen context; do not assume a suspendable service worker can hold a large model indefinitely.
- [x] Define a versioned, origin-checked message protocol between the ApplyFill page and extension.
- [x] Allow external messages only from approved production and local-development ApplyFill origins.
- [x] Authenticate each handoff with a one-time, short-lived nonce bound to the requesting tab/session.
- [x] Clear in-memory packets when the tab closes, the fill completes, the user cancels, or the handoff expires.

## Page-field discovery

- [x] Extract bounded descriptors: control type, accessible label, nearby label, name, autocomplete token, required state, allowed options, and a generated page-local field ID.
- [x] Prefer platform semantics, labels, and autocomplete attributes over visual coordinates.
- [x] Treat all page text, attributes, and options as untrusted job-site data.
- [x] Never send arbitrary scripts, complete DOM, hidden page content, cookies, storage, authentication tokens, or unrelated page text to ApplyFill or the model.
- [x] Detect standard inputs, textareas, selects, radio groups, checkboxes, and supported custom combobox patterns.
- [x] Mark unsupported controls for manual completion rather than guessing.
- [x] Re-scan safely after client-side navigation or form steps only when the user continues the workflow.
- [x] Avoid collecting values already present in password, payment, authentication, or unrelated fields.

## Local mapping and AI boundary

- [x] Send only bounded field descriptors and necessary question text to the AI-safe mapping workflow.
- [x] Keep profile retrieval and projection inside the ApplyFill origin.
- [x] Use deterministic mappings first for known semantics such as name, email, phone, address, dates, and yes/no profile answers.
- [x] Use local AI for ambiguous label classification, matching, and proposed narrative answers.
- [x] Never provide government identifiers, work-authorization answers, sponsorship answers, voluntary demographics, or credentials to the model.
- [x] Allow deterministic application code to retrieve a sensitive value only after mapping is complete and the user explicitly approves that individual field.
- [x] Distinguish `model-suggested`, `deterministic`, `sensitive-confirmation-required`, `unsupported`, and `manual` mappings.
- [x] Prevent a job-site instruction from adding tools, requesting broader profile access, or overriding the sensitive-data rules.

## Review and fill workflow

- [x] Show a review table before insertion with field label, proposed source, proposed value or masked sensitive indicator, confidence, and reason.
- [x] Let users edit, deselect, or mark each proposed mapping as manual.
- [x] Mask sensitive values throughout review and reveal them only through an intentional control.
- [x] Require explicit per-field confirmation immediately before inserting a government identifier or comparably sensitive answer.
- [x] Dispatch the appropriate input/change events so supported frameworks recognize inserted values.
- [x] Visually identify filled fields without permanently altering the job site's styling or semantics.
- [x] Return a completion report listing filled, skipped, unsupported, changed-by-site, and failed fields.
- [x] Never click the final submit button, accept legal attestations, upload documents, solve CAPTCHAs, or bypass authentication.
- [x] Require manual review of the completed page before the user submits it.

## Document and narrative handling

- [x] Let users explicitly choose which locally generated resume file/version is intended for the application.
- [x] Investigate browser security constraints for file inputs; do not promise automatic file upload if the platform prohibits assigning local files.
- [x] Provide a clear manual upload/download handoff when direct upload is unavailable.
- [x] Generate narrative answers as proposed plain text with citations to the supplied profile facts where practical.
- [x] Do not invent salary expectations, legal attestations, authorization status, dates, credentials, or demographic answers.
- [x] Keep accepted application-specific answers in the existing local application document only when the user saves them.

## Security controls

- [x] Restrict extension communication by origin, tab, nonce, schema version, size, and expiration.
- [x] Validate all messages at both the extension and application boundaries.
- [x] Add a strict extension CSP and bundle all executable code; do not load remote JavaScript.
- [x] Do not persist full application packets, sensitive values, page snapshots, or prompts in extension storage or logs.
- [x] Ensure incognito behavior is disabled or separately reviewed.
- [x] Handle hostile pages that replace controls, intercept events, mutate values, or create lookalike overlays.
- [x] Treat browser extensions installed by other parties and compromised job sites as residual local threats in the threat model.
- [x] Provide an immediate disconnect/clear-session control in both ApplyFill and the extension.

## Focused tests

- [x] Unit-test the message protocol, origin checks, nonce expiration, schema validation, and packet disposal.
- [x] Test field discovery against static HTML and representative React/Vue-style controlled forms.
- [x] Test deterministic mappings independently from AI mapping.
- [x] Test prompt-injected field labels and malicious page attributes.
- [x] Test masked sensitive review and per-field confirmation.
- [x] Test that prohibited values never enter model inputs or diagnostic output.
- [x] Test fill/change event behavior and detect when a site rejects or rewrites a value.
- [x] Test multi-step navigation, cancellation, tab closure, extension reload, and stale handoffs.
- [x] Browser-test the local synthetic form's rendered semantics in Chrome and the extension discovery/fill path in browser-like DOM tests; an unpacked-extension acceptance pass remains pending because browser automation cannot install unpacked extensions.

## Handoff

- [x] Provide permission rationale, supported-control matrix, limitations, and privacy behavior to Workstream G.
- [x] Provide extension build artifacts and release procedure to Workstream F.
- [x] Record unsupported job-site patterns as limitations rather than expanding permissions silently.
