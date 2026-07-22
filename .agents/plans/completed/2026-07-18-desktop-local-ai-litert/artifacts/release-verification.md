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

The deterministic suites cover AI-safe projections, injection/markup boundaries, closed output schemas, constrained response canonicalization, unsupported-claim rejection, accelerator selection, runtime lifecycle/reset/cancellation, cache retry/integrity/quota failure, resume review/accept/reject/stale/undo, extension origin/tab/nonce/expiry authentication, supported controls, sensitive confirmation, fill reports, and no-submit behavior.

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
