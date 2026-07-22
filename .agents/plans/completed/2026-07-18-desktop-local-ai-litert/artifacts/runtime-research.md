# LiteRT browser runtime research

**Recorded:** 2026-07-18  
**Runtime target:** Desktop Chromium, local-only inference

## Package decision

- `@litertjs/core` **2.5.3**, Apache-2.0, one runtime dependency (`@litertjs/wasm-utils`). This is the generic `.tflite` runtime and exposes WebNN, WebGPU, and WASM backends.
- `@litert-lm/core` **0.14.0**, Apache-2.0, one runtime dependency (`@litertjs/wasm-utils`). The official JavaScript API is early preview and currently documents text generation through WebGPU.
- Both packages are exact-pinned in `frontend/package.json`; no CDN import or provider credential is used.

Primary references:

- [LiteRT.js web guide](https://developers.google.com/edge/litert/web/get_started)
- [LiteRT-LM JavaScript guide](https://developers.google.com/edge/litert-lm/js)
- [LiteRT-LM overview and platform status](https://developers.google.com/edge/litert-lm/overview)

## Accelerator reality

The provider-neutral contract detects and can rank `webnn-npu`, `webgpu`, and `wasm`. That does not make them interchangeable for every model:

- Generic LiteRT.js task models may attempt experimental WebNN/NPU and fall back to WebGPU/WASM.
- Gemma 4 through LiteRT-LM.js 0.14 is compiled as WebGPU only. The adapter records WebNN as the attempted preference and reports the reason for the WebGPU fallback; it never reports NPU as active.
- The tested RTX 2070 machine has no NPU. No WebNN performance claim is made.

## Local runtime assets and headers

Vite serves and emits npm-owned WASM/JavaScript assets under `/vendor/litert*/wasm/`. LiteRT core assets are below 10 MiB each. The LiteRT-LM JSPI WASM builds are about 19.8 MiB each and fit Cloudflare's 25 MiB per-file limit. Its Asyncify WASM builds are about 31 MiB and are deliberately excluded. The packaged language runtime therefore requires WebAssembly JSPI and fails explicitly if it is unavailable; it never falls through to the package's default CDN.

The current adapter does not request LiteRT's threaded WASM build, so `SharedArrayBuffer`, COOP, and COEP are not required for the selected path. If threading is enabled later, cross-origin isolation must be added and retested with document export and extension integration.

## Responsiveness and disposal

The early-preview package does not publish a supported dedicated-worker recipe. Model assets stream in verified 24 MiB chunks and LiteRT-LM's GPU Artisan loader consumes the stream asynchronously, but engine calls currently originate in the page context. A development hardware harness verifies that the page continues to surface state while loading and generating. Engine, conversation, and runtime resources are explicitly deleted; generation is cancellable and concurrent calls are rejected.

## Delivery and privacy

- Browser model requests are same-origin only and use `credentials: same-origin`.
- A versioned Cache Storage cache commits only verified chunks and supports offline reuse.
- Profiles, prompts, and generated text never enter diagnostics or cache keys.
- `pnpm model:prepare` downloads at build time (or accepts a local file), verifies the whole upstream SHA-256, creates Cloudflare-safe chunks, hashes every chunk, and writes `/models/manifest.json`.
- Runtime reset releases model memory. Removing cached model bytes is a separate explicit API and does not touch IndexedDB/profile data.

