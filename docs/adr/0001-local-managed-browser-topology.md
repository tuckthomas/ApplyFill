# ADR 0001: Local managed-browser topology

- **Status:** Accepted
- **Date:** 2026-07-22

## Decision

ApplyFill's first supported architecture is a local/private installation composed of the React application, an ASP.NET Core 10 API, PostgreSQL 18, a dedicated .NET Browser Worker that owns Playwright Chromium, and native Private AI runtimes. The API, worker, database, browser-control channels, and model endpoints bind only to loopback or the private Compose network.

The Browser Agent is a first-class ApplyFill route. It does not use an extension, an iframe, a user's installed browser, WebNN, WebGPU-hosted models, or a static Cloudflare deployment. A browser context remains attached to one application run across pages, redirects, popups, user-control handoffs, UI reloads, and safe recovery.

PostgreSQL is authoritative for substantive records. Application-only sensitive values are protected before persistence with installation-bound keys stored outside PostgreSQL. Transient screenshots, browser observations, prompts, model responses, cookies, and credentials are not written to ordinary records.

Private AI is selected by declared capabilities. Model names, providers, ports, quantization, and offload settings remain implementation details. The ordinary product exposes one **Set Up Private AI** action.

## Process ownership

- The local launcher starts, checks, and stops PostgreSQL, the API, Browser Worker, and web application.
- Docker owns PostgreSQL restart and the named data volume.
- The Browser Worker owns Chromium processes, temporary browser profiles, frames, and native model-process supervision.
- PostgreSQL checkpoints make API/UI reload recovery durable. Worker recovery always re-observes from the latest verified checkpoint and never retries an uncertain submission.
- Windows 10/11 is the currently tested development host. Other operating systems are not claimed as packaged or accepted.

## Security boundary

Loopback plus installation secrets is the reviewed local trust boundary for this development release. The API enforces exact local origins, loopback access, command headers, idempotency, optimistic concurrency, bounded request sizes, rate limits, secure response headers, and ownership-scoped data access. The worker separately requires its service token and session credentials. Remote or LAN access is not supported by this decision.

## Consequences

The local topology preserves user control and avoids ApplyFill-operated cloud storage, but it does not protect an unlocked or compromised computer. A distributable end-user installer/updater remains a separate release-engineering gate; the repository provides a tested one-command development launcher in the meantime.
