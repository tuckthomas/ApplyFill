# ApplyFill frontend

React 19 and Vite 8 frontend for ApplyFill's local .NET 10/PostgreSQL 18 application. It provides the Job Profile, resume workspace, job tracker, dashboard, Settings, and the managed Browser Agent inside the shared application layout.

This package is not a standalone PWA. It does not contain a browser AI runtime, model weights, a service worker, or a browser-extension bridge.

## Routes

- `/` — dashboard
- `/job-profile` — completed profile and structured-data view
- `/job-profile/builder` — profile consent, resume import, and profile editor
- `/resumes` and `/resumes/builder` — saved resumes, tailoring review, preview, and exports
- `/job-tracker` — tracked applications
- `/job-tracker/:applicationId/edit` — application details, notes, and Browser Agent
- `/settings` — date preference, Private AI setup/status, and local-data explanation

Legacy profile URLs redirect to their current equivalents. There is no `/autofill-assist` route.

## Service boundaries

- The local ASP.NET Core API is the authoritative record boundary. PostgreSQL is not a frontend cache.
- `src/features/browser-agent/` contains the typed Browser Agent client, run contracts, and SignalR reconnect behavior.
- `src/features/private-ai/privateAiClient.ts` sends bounded resume-import and tailoring requests to the local Private AI API.
- `src/features/local-ai/contracts/` contains only browser-side allowlists and strict response/patch validators. It does not load or execute a model.
- `src/features/profile/resumeImport.ts` renders bounded PDF, DOCX, and TXT pages in the browser for local vision/OCR, and supplies redacted embedded text only as corroborating evidence. The original upload is not sent or retained.

Resume import accepts a source file up to 10 MiB. It renders no more than 15 JPEG pages and rejects a rendered set over 14 MiB. PDF pages are capped at a 1,600-pixel longest edge and 2× scale; DOCX/TXT pages use a 1,200×1,600 canvas. Embedded text evidence is capped at 30,000 characters. Every OCR and structured field remains a proposal until the user selects it.
- `src/features/resume/resumeExport.ts` is the explicit resume-safe renderer boundary.

The frontend may keep lightweight display preferences locally. Profiles, resumes, applications, Browser Agent runs, screenshots, prompts, and artifacts belong to the local backend.

## Privacy and safety

- Private AI services run on the same computer; there is no cloud AI fallback.
- Ordinary users never choose providers, runtimes, models, quantization, ports, or accelerators.
- Resume and profile suggestions remain proposals until accepted.
- Government identifiers, authorization/sponsorship answers, demographics, reasons for leaving, supervisors, addresses, and company phone numbers are excluded from writing prompts and resume rendering.
- The managed browser is streamed into ApplyFill. User and agent control are mutually exclusive, and final submission requires explicit approval.
- Login, MFA, CAPTCHA, sensitive disclosures, legal attestations, and uncertain states require user action.

## Commands

From `frontend/`:

```powershell
corepack pnpm install
corepack pnpm dev -- --host 127.0.0.1 --port 5173
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm preview
```

Use pnpm; do not create npm or Yarn lockfiles.

The frontend expects the local ApplyFill HTTP boundary at the same origin in a packaged build. Development can provide `VITE_API_BASE_URL`, but the configured address must remain on the local trusted boundary and match the backend CORS configuration.

## Testing

Vitest covers deterministic storage/formatting code, privacy projections, structured AI response validation, resume rendering, and Browser Agent UI states. Browser Agent tests use a fake client and synthetic frames; they do not open public job sites or require a model download.

The production build contains no LiteRT packages, browser-model weights or inference runtime, service worker, extension protocol, or Cloudflare deployment files. PDF.js may use ordinary browser graphics acceleration when rendering uploaded PDF pages; it does not run an AI model.

## UI rules

Read [`.agents/design/DESIGN.md`](../.agents/design/DESIGN.md) before visible changes. Reuse shared controls, use CSS tokens in both themes, keep keyboard focus visible, and do not use `text-xs` classes.
