# ApplyFill Frontend

Static Vite/React PWA for ApplyFill's privacy-focused profile, resume, application-tracking, local-AI, and extension-handoff workflows.

## Routes

- `/` — local dashboard and application analytics
- `/job-profile` — completed profile review and structured JSON controls
- `/job-profile/builder` — local profile builder with reviewed PDF/DOCX/TXT resume import
- `/job-tracker` — local tracker and application editor
- `/resumes` — local resume workspace
- `/resumes/builder` — resume editor, live preview, local AI, and exports
- `/settings` — preferences, extension handoff, Local AI setup/diagnostics, storage, and deletion

## Data and AI boundaries

`src/features/storage/localDatabase.ts` is the only substantive record-storage boundary. Profiles, resume drafts, applications, and dashboard documents are authoritative in IndexedDB—not a cache—and never go to an ApplyFill server. Lightweight theme, date, sort, and extension-ID preferences may use `localStorage`.

Profile schema version 2 includes optional country-specific government identifiers, work-authorization/sponsorship answers, and decimal GPA/grading-scale pairs. Phone values persist as `+` followed by exactly 11 digits. Date of birth, citizenship, and specific immigration status are not collected.

Local AI runs through `@litert-lm/core` 0.14.0 and `@litertjs/core` 2.5.3. The selected Gemma 4 E2B web artifact is a 1.87 GiB explicit download. Same-origin chunks are versioned, size checked, SHA-256 checked, cached separately in Cache Storage, and streamed into LiteRT-LM.js. User records are not copied into the model cache.

`src/features/local-ai/contracts/` constructs an allowlisted professional snapshot. Contact details, addresses, identifiers, authorization/sponsorship answers, demographics, reasons for leaving, supervisors, and company phone numbers never enter model inputs. Job and imported resume text are untrusted quoted data. Resume import reads PDF with PDF.js 6.1.200, DOCX with Mammoth 1.12.0, or plain text; the source file remains ephemeral. PDF extraction groups positioned text into visual rows, detects substantial column boundaries, and serializes columns in reading order instead of flattening each page. Deterministic code detects contact suggestions and redacts names, contact values, links, street-address-like lines, and identifier patterns before the model receives professional text. Long input is split into bounded, slightly overlapping sections; malformed or incomplete section output is retried at a smaller size, then valid closed-schema results are deduplicated and merged. Image-only scanned PDFs are rejected until a fully local OCR fallback is implemented. Import and tailoring return through constrained, non-executable response envelopes and closed validators. Unexpected executable tool calls are rejected. Every proposed profile field or resume change requires explicit acceptance.

Imported values never overwrite an existing non-empty contact field. Education, experience, project, and skill entries are deduplicated before merging. Plain-text descriptions are converted directly into restricted Tiptap JSON; extracted or model-generated HTML is never persisted.

The selected LLM uses WebGPU, which ApplyFill selects automatically after a compatibility check and before any model download begins. WebNN/NPU remains an internal experimental capability only: LiteRT-LM.js 0.14 cannot run this model through it, so it is not exposed as a user setting. There is no cloud fallback.

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

## Autofill extension pairing

Settings accepts the installed Chromium extension ID once and creates a persistent, origin-and-secret-bound local pairing. The extension stores a bounded derived profile copy in `chrome.storage.local` and ApplyFill refreshes it after profile saves. Users do not copy per-tab codes or reconnect for each application. Opening the extension authorizes only the current job page; recognized fields are mapped deterministically, while an already-installed local model automatically proposes non-sensitive ambiguous mappings through `/autofill-assist`. That helper never initiates the model download. Page inspection and fill-review state remain active-tab scoped and temporary. Sensitive application answers are excluded by default; explicitly included values remain local, bypass AI, stay masked, and require per-field confirmation. **Unpair Extension** deletes the derived extension copy. See `../extension/README.md` for installation, permissions, supported controls, and protocol details.
