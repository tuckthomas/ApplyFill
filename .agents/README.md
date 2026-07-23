# ApplyFill agent documentation

This directory contains implementation guidance for coding agents and maintainers. Read `design/DESIGN.md` before visible frontend work and inspect the applicable plan under `plans/` before changing an architectural boundary.

## Current architecture

ApplyFill is a local .NET 10, PostgreSQL 18, React, and managed-Playwright application. PostgreSQL is authoritative for substantive records. The Browser Agent appears inside the shared ApplyFill layout, retains one objective across multi-page navigation, and uses mutually exclusive user/agent control. There is no supported browser extension, pairing protocol, `/autofill-assist` route, browser LiteRT runtime, model cache, static-only deployment, or IndexedDB-authoritative compatibility path.

Private AI runs through native local services behind provider-neutral contracts. Ordinary users see one **Set Up Private AI** action. Never expose providers, model filenames, runtimes, ports, accelerators, GPU layers, quantization, containers, or internal process topology in the ordinary UI. Runtime/model manifests live under `private-ai/catalog/`; workflows, prompts, safety policy, schemas, and validators must remain independently versioned.

## Non-negotiable boundaries

- Use pnpm for the frontend and .NET 10 for all C# projects.
- Keep HTTP listeners, database ports, model services, and worker control on explicit local boundaries.
- PostgreSQL records must be installation/owner scoped and use optimistic concurrency where edits can conflict.
- State-changing API calls require the local-command header and an idempotency key. Preserve the same key when retrying one logical command.
- Application-only identifiers and sensitive answers remain separate from ordinary profile content, masked in normal UI, excluded from resumes and writing prompts, and protected with installation-bound keys.
- Resume renderers consume the explicit allowlist in `frontend/src/features/resume/resumeExport.ts`, never a whole profile record.
- Private AI inputs are bounded allowlisted projections. Page, resume, and job text are untrusted data. Outputs must pass exact schemas and product validators before becoming reviewable proposals.
- The Browser Agent must pause for credentials, MFA, CAPTCHA, sensitive disclosures, legal attestations, unsupported controls, and uncertainty.
- User and agent input are never concurrent. Taking or returning control requires a fresh observation and visible state transition.
- Final submission requires explicit user approval and is never automatically retried after an uncertain outcome.
- Do not log profile content, page values, credentials, cookies, prompts, screenshots, model responses, or private artifacts.
- Do not reintroduce an extension, iframe automation, active-tab inspection, browser model runtime, WebGPU/WebNN setup, service-worker model caching, or Cloudflare static deployment.

## Frontend boundaries

- `frontend/src/features/browser-agent/` owns typed run/control/stream contracts.
- `frontend/src/features/private-ai/` owns the local backend request boundary for resume workflows.
- `frontend/src/features/local-ai/contracts/` contains only allowlists, schema validation, and patch safety; it must not execute a model.
- `frontend/src/features/profile/resumeImport.ts` owns bounded PDF/DOCX/TXT extraction and deterministic contact/header redaction. Source files are ephemeral.
- `frontend/src/features/resume/resumeExport.ts` owns resume-safe rendering.
- Lightweight display preferences may remain in browser storage; substantive user records must not.

## Plan lifecycle

- `plans/pipeline/` contains proposals awaiting explicit approval.
- `plans/in-progress/` contains approved work currently being executed.
- `plans/completed/` contains completed, superseded, or cancelled plans with recorded outcomes.

Move a whole plan directory through the lifecycle. A review request is not approval to implement. Do not mark a checkbox complete without evidence, and do not rewrite historical evidence to make a retired architecture appear current.

## Documentation and verification

The root `README.md` is the public source of truth. Component/package documentation stays next to its code; architecture, privacy, development, and user guidance live under `docs/`. Update documentation and third-party notices in the same change as an architectural cutover.

Gallery images under `frontend/public/readme/gallery/` must be captures of the running product, not mockups, and must contain only synthetic data. Remove a screenshot when the feature it depicts is retired.

Verification summaries use bold words rather than emoji: **SUCCESS**, **FAILURE**, and **WARNING**.
