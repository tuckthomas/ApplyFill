# Runtime decision record

## Selected runtime

ApplyFill currently selects a pinned llama.cpp Windows runtime through provider-neutral manifests. The evaluated CUDA build is `b10091`; a separate CPU manifest is available for compatible tasks. The runtime binds to loopback, is supervised by the Browser Worker, receives no browsing/code-execution tools, and is started or stopped as product state requires.

The RTX 2070 path intentionally permits CPU/GPU split execution. Only one vision workload is active at a time so document OCR and page understanding do not have to fit in VRAM simultaneously.

## Alternatives

- **Ollama:** useful for development, but rejected as the ordinary-user runtime because it would require another separately installed and managed product.
- **vLLM:** not part of the RTX 2070 path because its supported CUDA assumptions do not match this compute-capability-7.5 baseline; it remains a possible future Linux/server adapter.
- **Browser LiteRT/WebGPU/WebNN:** retired because the web runtime did not provide the required multimodal contract and created a large browser-managed download/configuration surface.
- **Paddle/Transformers Python services:** retained as future adapter options, not required by the current distributable runtime contract.

## Operational behavior

The setup coordinator exposes ordinary states: checking, downloading, verifying, preparing, ready, needs attention, and unavailable. Downloads are explicit, resumable, parallelized within bounds, and SHA-256 verified. Model/runtime files live outside source control. A failed candidate never replaces a known-good active installation.

## Remaining release measurements

The implementation and real PDF acceptance are complete. On the first RTX 2070 acceptance document, the full two-page PaddleOCR-VL → Qwen3-VL 8B pipeline completed in 209.4 seconds and the supervised runtime used approximately 5.6 GB of GPU memory. A release candidate still needs a repeatable multi-document latency distribution, peak system-memory measurement, sustained-load, cancellation, and failure-recovery measurements recorded by hardware profile.
