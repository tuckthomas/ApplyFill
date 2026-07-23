# Security review record

## Enforced controls

- All product services bind to loopback or a private Compose network; PostgreSQL is published only on `127.0.0.1`.
- Browser-facing mutations require the local command header and an idempotency key. Persistent encrypted receipts detect conflicting key reuse.
- Resource queries and mutations are installation-owner scoped and use optimistic concurrency.
- Sensitive answers are encrypted with keys outside PostgreSQL, masked by default, approved per field, and consumed once. Plaintext is never sent to the model or persisted in run history.
- Browser and agent input use a mutually exclusive server-owned lease.
- Page/model content can propose only closed, bounded actions. Deterministic policy blocks arbitrary JavaScript, files, shell commands, unsafe schemes, exfiltration, prompt injection, honeypots, and uncertain submission retries.
- Raw screenshots, prompts, cookies, credentials, model output, and chain-of-thought are excluded from ordinary records and diagnostics.
- API request sizes, history sizes, JSON depth, action counts, retries, and command rates are bounded.
- Response headers disable caching, MIME sniffing, referrers, framing, and unintended content loading.
- Model, runtime, browser, package, and container versions are pinned; model artifacts are digest verified.

## Automated evidence

Ownership, command guard, idempotency replay/conflict, encryption, masking, one-use sensitive approval, policy denial, stale action, control race, recovery, prompt injection, honeypot, exfiltration, and uncertain-submission fixtures pass. NuGet and pnpm audits report no known vulnerable dependencies.

## Residual risk

ApplyFill cannot protect an unlocked or compromised operating-system account, malicious kernel/browser/runtime code, screen recording, unsafe exported files, or information deliberately submitted to a job site. The current topology is local-only and has not been reviewed for LAN or internet exposure.

## Manual gate

A separate human security review of the packaged release, artifact provenance, installer/updater, port exposure, browser sandbox, and real-model adversarial corpus remains required before calling the product production-ready.
