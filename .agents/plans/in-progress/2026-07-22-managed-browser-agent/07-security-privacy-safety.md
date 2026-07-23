# Workstream 07 — Security, Privacy, and Agent Safety

**Status:** Implemented — release acceptance pending
**Depends on:** Starts after approval; gates every workstream  
**Unblocks:** Production integration and release acceptance

## Objective

Define and enforce the trust boundaries for a local browser-controlling agent that processes highly sensitive employment data. Treat webpages, documents, screenshots, model output, browser state, and user-supplied files as untrusted. The model may propose actions but never receives unrestricted authority.

## Threat-model update

- [x] Replace the static-browser/extension threat model with one covering API, PostgreSQL, browser worker, streamed viewport, user-input relay, local model services, artifact storage, and packaging/update channels.
- [x] Inventory protected assets: profile data, government identifiers, credentials, cookies, MFA, resumes, application answers, screenshots, browser history, generated artifacts, encryption keys, and model/runtime binaries.
- [x] Document trust boundaries and authenticated channels between UI, API, browser worker, model services, artifact store, and PostgreSQL.
- [x] Model hostile ATS pages, prompt injection, malicious job postings, compromised model artifacts, local malware, another local user, exposed debugging ports, and dependency/update compromise.
- [x] Record accepted residual risk and user-visible limitations.

## Webpage prompt-injection defense

- [x] Treat all page text, accessibility labels, hidden content, scripts, uploaded documents, and job descriptions as untrusted observation data.
- [x] Keep system policy and action schemas outside page-controlled content.
- [x] Refuse page requests to reveal profile data, credentials, browser storage, cookies, prompts, system instructions, files, or unrelated application history.
- [x] Refuse instructions to navigate off the allowed application/identity-provider flow, download executables, open local files, run code, or weaken safety rules.
- [ ] Detect hidden/off-screen prompt injection, CSS-obscured content, suspicious instructions, and mismatches between visual and structural observations.
- [x] Require server policy approval after model output; constrained output alone is not authorization.
- [x] Maintain adversarial fixtures and regression tests for known injection patterns.

## Browser action policy

- [x] Allow only the reviewed browser-action vocabulary with bounded arguments.
- [x] Maintain the current run's approved domain graph, including legitimate ATS and identity-provider transitions.
- [x] Block prohibited schemes, localhost administration pages, browser-internal URLs, file URLs, unrelated tabs, and arbitrary downloads.
- [x] Require postcondition verification before committing action success.
- [x] Prevent final submission retries when outcome is uncertain.
- [x] Prevent destructive account changes, withdrawals, unrelated applications, messaging, purchases, payments, or credential changes.
- [x] Rate-limit actions and detect loops, oscillation, repeated validation failures, and suspicious navigation.
- [x] Keep browser debugging and model tool interfaces inaccessible to model-generated arbitrary calls.

## Human-control and legal gates

- [x] Make control ownership server-authoritative and mutually exclusive.
- [x] Cancel queued agent actions before acknowledging user control.
- [x] Pause for username/password entry, MFA, CAPTCHA, security questions, and credential-manager interaction.
- [x] Pause for government identifiers, voluntary demographic disclosures, disability/veteran questions, background-check consent, arbitration, electronic signatures, and other legally material attestations.
- [x] Define which sensitive answers may be deterministically inserted after explicit user configuration and which always require per-application confirmation.
- [x] Require explicit final-submission approval by default and record exactly which application was approved.
- [x] Provide an emergency stop that does not wait for model completion.

## Authentication and authorization

- [x] Select the local installation/user identity model before implementing remote access.
- [x] Protect every API, SignalR hub, stream, browser command, artifact, and run query with ownership checks.
- [x] Use anti-forgery and origin checks for browser-facing commands.
- [ ] Rotate local session secrets and invalidate active streams on logout/revocation.
- [x] Do not rely on an obscured port as authentication.
- [x] Add a separate, explicitly approved design before exposing ApplyFill over a LAN or public network.

## Secrets and encryption

- [x] Store encryption keys outside PostgreSQL and ordinary configuration files.
- [ ] Encrypt approved sensitive application values and retained browser-profile material at rest.
- [x] Never log connection strings, keys, tokens, cookies, Authorization headers, credentials, MFA values, or decrypted sensitive fields.
- [ ] Define secure development secrets and production/local installation secret provisioning.
- [x] Define what happens when a user loses the local encryption key; do not promise recovery that does not exist.
- [x] Verify backups exclude keys and clearly document restoration requirements.

## Data minimization and retention

- [x] Create a field-by-field data classification and retention table.
- [x] Keep raw screenshots, DOM/accessibility snapshots, model prompts, and raw model output in memory by default.
- [x] If a short-lived crash-recovery observation is retained, encrypt it, timestamp it, and delete it automatically.
- [x] Store only user-visible action summaries and verification results required for recovery/audit.
- [x] Exclude chain-of-thought and hidden reasoning from persistence and UI.
- [x] Delete temporary browser profiles, uploads, downloads, frames, and observations when their retention expires.
- [ ] Make delete-all and per-run deletion behavior explicit and testable.
- [x] Ensure diagnostics and telemetry are content-free; do not add remote analytics in this plan.

## Model and dependency supply chain

- [x] Pin every model/runtime/browser/package/container version.
- [ ] Verify model and browser artifacts with checksums before activation.
- [x] Maintain licenses and notices for Qwen, PaddleOCR, Ollama/llama.cpp/vLLM, Playwright/Chromium, PostgreSQL, and supporting libraries.
- [ ] Scan .NET, pnpm, Python/model-service, container, and browser dependencies.
- [ ] Define emergency withdrawal/update behavior for a vulnerable model/runtime/browser build.
- [x] Prevent model services from downloading remote code or trusting arbitrary model repository code in production.

## Network boundary

- [x] Produce an allowlist of all expected local and remote connections.
- [x] Keep PostgreSQL, model APIs, browser debugging, and internal worker endpoints on loopback/private networks.
- [x] Distinguish job-site browser traffic from ApplyFill service traffic in logs without recording sensitive URLs/query strings unnecessarily.
- [x] Block model-provider cloud fallback and remote image fetching.
- [x] Verify default containers do not publish internal ports broadly.
- [x] Add outbound restrictions where practical without breaking legitimate browser navigation.

## Security verification

- [ ] Add automated authorization/ownership tests for every resource and realtime channel.
- [ ] Fuzz API/model/action schemas for unknown keys, deep JSON, oversized payloads, malformed Unicode, and invalid transitions.
- [ ] Run prompt-injection and exfiltration fixtures through the selected real model.
- [ ] Test race conditions during pause, take control, stop, worker crash, final approval, and submission.
- [ ] Test exposed-port and misconfiguration scenarios.
- [ ] Test log/trace/ProblemDetails/diagnostic redaction with seeded secrets.
- [ ] Perform dependency, container, secret, and license scans.
- [ ] Complete a manual security review before real-site acceptance.

## Exit criteria

- [ ] Threat model, retention table, policy matrix, and residual risks are approved.
- [x] Prohibited actions and data flows are blocked by deterministic code.
- [ ] Security tests demonstrate that hostile page/model content cannot broaden authority.

## Outcome and evidence

**Outcome:** Implemented — release acceptance pending.

- Current policy is documented in `docs/threat-model.md`; field-level storage, backup, retention, and deletion rules are in `docs/data-retention.md`.
- `artifacts/security-review.md` records the enforced loopback, ownership, encryption, one-use approval, control-lease, action-policy, logging, and model-boundary controls.
- The 76-test Browser Worker suite covers ownership, command guards, idempotency, encryption/masking, one-use ordinary-answer routing, sensitive approval, stale actions, control races, recoverable browser-failure propagation, cleanup, prompt injection, honeypots, exfiltration, and uncertain submission. API-backed approved artifacts are checked before staging and removed on run release, expiry, invalidation, startup cleanup, or worker shutdown. NuGet and pnpm vulnerability audits are clean.

Remaining gates are application encryption for retained browser-profile material, session-secret rotation/revocation, delete-all verification, browser-artifact integrity proof, comprehensive dependency/container/secret/license scanning, schema fuzzing, real-model adversarial testing, exposed-port/redaction testing, and a human security review of the packaged release.
