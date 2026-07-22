# ApplyFill Frontend

Static Vite/React PWA for ApplyFill's privacy-focused profile, resume, application-tracking, local-AI, and extension-handoff workflows.

## Routes

- `/` — local dashboard and application analytics
- `/job-profile` — completed profile review and structured JSON controls
- `/job-profile/builder` — local profile builder
- `/job-tracker` — local tracker and application editor
- `/resumes` — local resume workspace
- `/resumes/builder` — resume editor, live preview, local AI, and exports
- `/settings` — preferences, extension handoff, Local AI setup/diagnostics, storage, and deletion

## Data and AI boundaries

`src/features/storage/localDatabase.ts` is the only substantive record-storage boundary. Profiles, resume drafts, applications, and dashboard documents are authoritative in IndexedDB—not a cache—and never go to an ApplyFill server. Lightweight theme, date, sort, accelerator, and extension-ID preferences may use `localStorage`.

Profile schema version 2 includes optional country-specific government identifiers, work-authorization/sponsorship answers, and decimal GPA/grading-scale pairs. Phone values persist as `+` followed by exactly 11 digits. Date of birth, citizenship, and specific immigration status are not collected.

Local AI runs through `@litert-lm/core` 0.14.0 and `@litertjs/core` 2.5.3. The selected Gemma 4 E2B web artifact is a 1.87 GiB explicit download. Same-origin chunks are versioned, size checked, SHA-256 checked, cached separately in Cache Storage, and streamed into LiteRT-LM.js. User records are not copied into the model cache.

`src/features/local-ai/contracts/` constructs an allowlisted professional snapshot. Contact details, addresses, identifiers, authorization/sponsorship answers, demographics, reasons for leaving, supervisors, and company phone numbers never enter model inputs. Job text is untrusted quoted data. Resume tailoring returns through one constrained, non-executable response envelope. The client owns schema/version IDs, derives bullet source ownership from an exact unique snapshot-text match, and then applies the closed structured validators. Unexpected executable tool calls are rejected. Suggestions require explicit acceptance and support rejection, editing, cancellation, stale-result detection, and undo.

The selected LLM uses WebGPU. Settings reports WebNN/NPU availability honestly, but LiteRT-LM.js 0.14 does not run this model through WebNN. There is no cloud fallback.

## Resume generation

Resume preview, JSON, PDF, and DOCX consume only `src/features/resume/resumeExport.ts`. Application-only data, reasons for leaving, supervisor/company contact data, street addresses, and editing metadata are structurally unavailable to renderers. React PDF and `docx` generate independent browser Blobs; neither format is converted into the other.

## Model preparation

`public/models/manifest.json` is checked in; generated `.part` and `.litertlm` assets are ignored. Prepare the approved revision from its pinned source or a local verified copy:

```powershell
pnpm model:prepare
pnpm model:prepare -- --source-file M:\path\gemma-4-E2B-it-web.litertlm
```

The script resumes interrupted downloads, verifies the exact 2,008,432,640-byte artifact and SHA-256, writes 24 MiB immutable chunks, and updates the same-origin manifest. It refuses to mark a model usable without `model-approval.json`.

## Development

Requirements: Node.js 24+ and pnpm 11+.

```powershell
pnpm install --frozen-lockfile
pnpm dev -- --host 127.0.0.1
```

IndexedDB and Cache Storage are origin scoped. Changing hostname or port produces different local storage.

## Verification

```powershell
pnpm lint
pnpm test
pnpm build
pnpm audit
```

Hardware evaluation is separate from deterministic unit tests. Open `/local-ai-benchmark.html` or import `src/features/local-ai/evaluation/browserHarness.ts` from browser development tools after preparing the model. Record the actual accelerator, fallback, initialization, first-token latency, throughput, and model revision; never infer NPU use from API presence.

## Offline and Cloudflare deployment

The production build generates `dist/service-worker.js` and then runs `scripts/verify-static-build.mjs`. The PWA precaches its shell, model manifest, and LiteRT loader. The model manager separately integrity-checks and caches model chunks and the exact 19,848,204-byte LiteRT-LM WASM binary (SHA-256 `54c3c54b6fedc89267556ba73abeab2f6ec3cfdece8c6e9e0e2d71e9786f437b`) so service-worker upgrades do not evict a working model. Cold offline initialization and inference work after these assets have been verified and cached.

```powershell
pnpm deploy
```

`wrangler.jsonc` deploys `dist` as Cloudflare Workers static assets with SPA fallback. `public/_headers` defines CSP, COOP/COEP/CORP, Permissions Policy, and cache rules. Manifests are `no-cache`; versioned chunks are immutable. Range responses are not required because the model is packaged as independent verified chunks at or below 25 MiB, which the build verifier enforces. No Worker code processes profiles, prompts, or outputs.

## Autofill extension handoff

Settings accepts the installed Chromium extension ID and the one-time code created on a user-approved job tab. Only scoped values enter the extension's short-lived memory. Sensitive fields require a visible opt-in timestamp and another per-field confirmation inside the extension. Disconnect clears both sides. See `../extension/README.md` for installation, permissions, supported controls, and protocol details.
