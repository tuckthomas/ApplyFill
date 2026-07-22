# Desktop Local AI Release Verification

**Verified:** 2026-07-20  
**Outcome:** Complete for the supported Chromium/WebGPU release boundary

## Shipped boundary

- Static React 19 / TypeScript 6 / Vite 8 PWA; no application server, account database, remote AI provider, analytics, or prompt endpoint.
- `@litert-lm/core` 0.14.0 with `@litertjs/core` 2.5.3 and Gemma 4 E2B revision `9262660a1676eed6d0c477ab1a86344430854664`.
- Model: 2,008,432,640 bytes, SHA-256 `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`.
- LiteRT-LM WASM: 19,848,204 bytes, SHA-256 `54c3c54b6fedc89267556ba73abeab2f6ec3cfdece8c6e9e0e2d71e9786f437b`.
- User records remain authoritative in IndexedDB. Verified model/runtime assets use a separate Cache Storage boundary.

## Automated verification

- **SUCCESS** Frontend lint (generated `.wrangler` output excluded from source lint).
- **SUCCESS** Frontend Vitest: 12 files, 41 tests.
- **SUCCESS** Frontend TypeScript and production build: 159 static files; no asset exceeds 25 MiB; no remote ApplyFill AI endpoint bundled.
- **SUCCESS** Frontend high-severity dependency audit: no known vulnerabilities.
- **SUCCESS** Cloudflare Wrangler 4.112.0 dry run: 171 deployable files, no bindings.
- **SUCCESS** Extension TypeScript, lint, production build, and Vitest: 6 files, 37 tests.
- **SUCCESS** Extension high-severity dependency audit: no known vulnerabilities.

The deterministic suites cover AI-safe projections, injection/markup boundaries, closed output schemas, constrained response canonicalization, unsupported-claim rejection, accelerator selection, runtime lifecycle/reset/cancellation, cache retry/integrity/quota failure, resume review/accept/reject/stale/undo, persistent extension origin/secret authentication, temporary page-review expiry, supported controls, sensitive confirmation, fill reports, and no-submit behavior.

## Real-browser acceptance

Test host: current Chromium desktop on Windows, Ryzen 7 3800X, NVIDIA RTX 2070, no NPU.

- **SUCCESS** Explicit 1.87 GiB model acquisition, per-chunk verification, compilation, and WebGPU readiness.
- **SUCCESS** Measured benchmark: 174–249 ms first token and 38.2–42.3 tokens/s in final interactive runs; the broader evaluation report retains cold/warm measurements.
- **SUCCESS** Representative job posting produced structured analysis, relevance, two summary proposals, and one bullet proposal.
- **SUCCESS** Client-derived source ownership and strict validators accepted only proposals tied to the exact approved snapshot.
- **SUCCESS** Accept Selected, Save Draft, close/reopen route, and preserve the accepted summary from local storage.
- **SUCCESS** Cancel active generation without changing the resume.
- **SUCCESS** Browser-side PDF and DOCX generation reported completed downloads.
- **SUCCESS** Cold offline reload, model initialization, and inference after the static server was stopped.
- **SUCCESS** Built extension popup exercised with a synthetic job-application transport: mapping review, sensitive double confirmation, manual/unsupported classification, fill report, session destruction, and no submission.

## Deployment and network evidence

- Root and SPA routes returned 200 in deployment-like preview.
- CSP, COOP, COEP, CORP, Permissions Policy, `no-referrer`, `nosniff`, and frame denial headers were present.
- Model manifests are `no-cache`; versioned model chunks are immutable.
- Preview did not provide byte-range responses. Range support is not required because the model is packaged as independent, integrity-verified chunks under Cloudflare's 25 MiB asset limit.
- Production network use is limited to same-origin static shell/runtime/model acquisition and explicit user navigation. Prompts, profiles, and model output are never request bodies.

## Unsupported and untested configurations

- **UNTESTED** WebNN/JSPI with NPU: the host has no NPU, and LiteRT-LM.js 0.14 does not expose WebNN generation for the selected LLM.
- **UNSUPPORTED** WASM-only LLM generation and non-Chromium browsers for this release. The LiteRT-LM host runtime uses WASM, but selected-model inference requires WebGPU.
- **UNTESTED** Lower-spec desktop, second physical machine, maximum published 131,072-token context, and instrumented sustained thermal behavior. The product bounds context/output to 4,096 tokens and makes no minimum-hardware or thermal claim.
- **DOCUMENTED LIMITATION** LiteRT-LM compilation and generation remain on the window context; progress, streaming, cancellation, and runtime disposal preserve interactive control.
- **MANUAL RELEASE GATE** Chromium blocks automated access to `chrome://extensions`. The unpacked `extension/dist` install must be loaded once by a human before store/release acceptance; the actual built popup and protocol are otherwise covered by automated and synthetic-browser acceptance.

These dispositions close the plan without representing unavailable hardware or browser-internal installation as successful tests.

## 2026-07-22 resume-import addendum

- Added an eight-step profile wizard with Resume Import immediately before Personal Info.
- PDF, DOCX, and TXT source files are read ephemerally in the browser. Contact data, links, street-address-like lines, and identifier patterns are deterministically separated or redacted before bounded professional text reaches the existing approved Gemma profile-fact task.
- The local model returns a closed education, experience, project, and skill schema. Every contact and professional proposal is reviewed individually before a duplicate-safe merge; nonempty contact values are preserved and narratives are created directly as restricted Tiptap JSON.
- **SUCCESS** Real Chromium/WebGPU acceptance with the pinned Gemma model: upload, extraction, local inference, proposal review, merge, and persisted Personal Info, Education, and Work Experience results.
- **SUCCESS** Deterministic profile-import and workflow suites: 2 files, 6 tests; full frontend suite: 14 files, 47 tests.
- **SUCCESS** Frontend lint, TypeScript, and production build: 167 static files; no asset exceeds 25 MiB and no remote ApplyFill AI endpoint is bundled.
- **SUCCESS** Cloudflare Wrangler 4.113.0 dry run: 179 deployable files, no bindings.
- **SUCCESS** High-severity dependency audit: no known vulnerabilities. Wrangler's Miniflare dependency still requested vulnerable Sharp 0.34.5, so the pnpm workspace pins its transitive resolution to patched Sharp 0.35.3; the production build and Wrangler dry run both pass with that override.

## 2026-07-22 persistent-extension addendum

- Replaced per-application five-minute connection codes with a pair-once local extension relationship that survives navigation, completed fills, service-worker restarts, and browser restarts.
- ApplyFill automatically refreshes a bounded derived profile copy in extension-local storage after profile saves. The exact approved origin and 256-bit pairing secret authenticate updates; explicit unpair deletes the copy.
- Sensitive answers remain excluded by default. If explicitly included, they remain local, bypass AI, stay masked, and require per-field confirmation. Job-page inspection, review state, and fill reports remain temporary and are never persisted.
- Removed the obsolete handoff, inspection, disconnect, nonce, and connection-code contracts instead of retaining a compatibility path.
- Recognized fields are mapped deterministically. Ambiguous non-sensitive fields automatically use the same local model through a temporary same-origin helper when—and only when—the complete model was already downloaded explicitly. Suggestions return to the existing extension review without re-pairing.
- **SUCCESS** Frontend lint, production build, high-severity dependency audit, and Vitest: 14 files, 48 tests.
- **SUCCESS** Extension TypeScript, lint, production build, high-severity dependency audit, and Vitest: 7 files, 35 tests.
- **SUCCESS** Browser acceptance at `/settings` and the built popup harness: plain pair-once language, no connection-code control, persistent-pairing status, Local AI autofill explanation, **Close Review** rather than disconnect, deterministic/AI/sensitive/manual mapping presentation, and no submission control.

## 2026-07-22 Private AI setup correction

- Removed user-facing accelerator selection and the separate compatibility button. The approved Gemma artifact supports WebGPU, so Private AI setup now checks the model/browser combination before downloading and selects the compatible path automatically.
- Retired saved accelerator preferences are deleted when Settings loads. Experimental WebNN/NPU remains developer-only and cannot affect ordinary setup or the autofill helper.
- Download/verification messages are translated to a plain-language percentage. Failure clears the progress bar and explains that verified chunks remain cached for retry instead of leaving the last byte count onscreen.
- **SUCCESS** Added a regression test proving an unsupported model/accelerator combination fails before any model fetch.
- **SUCCESS** Frontend lint, production build, high-severity dependency audit, and Vitest: 14 files, 50 tests.
- **SUCCESS** Browser acceptance: one **Set Up Private AI** action, automatic-hardware explanation, no processor selector, no compatibility quiz, no raw-byte progress copy, and no console errors.

## 2026-07-22 two-column resume-import correction

- Reproduced the reported failure with `Tucker_Olson_Banking_Credit_Resume_With_Volunteer.pdf`, a two-page tagged PDF with selectable text arranged in two visual columns. It is not an image-only scan and therefore does not require OCR.
- Replaced page-wide space joining with positioned PDF extraction that reconstructs visual rows, detects a substantial column split, and emits columns in reading order.
- Replaced the single oversized model request with bounded, overlapping resume sections. Incomplete or malformed section output is retried at a smaller size; only outputs that pass the existing closed schema are deduplicated and merged.
- Kept OCR outside the selectable-text path. Image-only PDFs remain rejected with a clear message until a fully local OCR fallback is implemented.
- Replaced the colliding native file-picker presentation with a custom accessible chooser and filename display. Removed raw runtime-state copy, hid setup guidance during generation, and translated progress and failure states into ordinary user language.
- **SUCCESS** Exact-file browser acceptance: the attached PDF extracted locally, reached the ready state, displayed its full filename, and did not produce the previous native-control layout collision.
- **SUCCESS** Frontend lint, Vitest (14 files, 54 tests), TypeScript, and production build (173 verified static files; no file exceeds 25 MiB; no remote ApplyFill AI endpoint bundled).
- **SUCCESS** High-severity dependency audit: no known vulnerabilities.
