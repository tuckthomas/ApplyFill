# Release verification record

## Environment

- .NET SDK 10.0.302
- PostgreSQL 18.4 (`postgres:18.4-bookworm`, pinned digest in `compose.yaml`)
- Node.js 25.2.1
- pnpm 11.9.0 through the bundled workspace runtime
- Microsoft Playwright 1.61 managed Chromium
- NVIDIA GeForce RTX 2070, driver 591.86, 8,192 MiB VRAM

## Automated results

- **SUCCESS** .NET Release build: 0 warnings, 0 errors.
- **SUCCESS** .NET tests: 122 total (15 Private AI, 76 Browser Worker, 26 API/persistence, 5 synthetic ATS).
- **SUCCESS** Frontend lint.
- **SUCCESS** Frontend tests: 47 tests in 15 files.
- **SUCCESS** Frontend production build. Vite reports the documented large Resume Builder chunk warning.
- **SUCCESS** Pester launcher tests: 5.
- **SUCCESS** `dotnet format --verify-no-changes`: no changes required.
- **SUCCESS** NuGet vulnerability audit: no known vulnerable packages.
- **SUCCESS** pnpm audit: no known vulnerabilities.
- **SUCCESS** Six EF migrations applied to PostgreSQL 18.4, including the owner-scoped settings resource.
- **SUCCESS** Full local launcher/status drill: web 5173, API 5180, worker 5098, PostgreSQL healthy.
- **SUCCESS** Real two-column PDF vision/document import on the RTX 2070: 209.4 seconds, approximately 5.6 GB GPU memory, 18,117 OCR characters, one education entry, five experience entries, and 27 skills proposed for review.

## Implemented acceptance behavior

The synthetic ATS exercises 13 steps including redirects, SPA changes, reload, iframe, Shadow DOM, popup, login/MFA/CAPTCHA handoff, sensitive/legal gates, prompt injection, honeypots, exfiltration, final approval, and uncertain submission. The Browser Worker persists verified checkpoints, retains one objective across navigation, supports exclusive user/agent control, recovers explicitly after restart, and hard-blocks duplicate submission.

## Manual release gates

The following require a human release candidate and are intentionally not labeled automated:

- Non-technical install/setup usability test without developer assistance.
- Representative real job-site applications through final review without unintended submission.
- Keyboard/screen-reader/high-contrast acceptance across every live run state.
- Packaged installer, update, rollback, repair, uninstall-with-data, and uninstall-and-delete-data drills on a clean machine.
- Comparative held-out Qwen/Paddle model metrics and sustained resource budgets.
- Manual security review of the packaged build and adversarial real-model corpus.

The repository is therefore a verified development build, not a signed production installer. This limitation is also stated in the root README.
