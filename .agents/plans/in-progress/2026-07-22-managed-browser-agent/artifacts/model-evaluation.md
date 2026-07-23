# Private AI evaluation

## Tested machine

- Windows development host
- NVIDIA GeForce RTX 2070, 8,192 MiB VRAM
- NVIDIA driver 591.86
- Approximately 32 GB system memory

## Pinned candidates

The checked-in catalog contains exact revisions and SHA-256 digests for Qwen3-VL 8B Q4, Qwen3-VL 4B Q4, PaddleOCR-VL 1.6, and CUDA/CPU llama.cpp runtime variants. Installed weights and runtime binaries are ignored and remain local.

## Real document result

A real selectable-text, two-column, two-page PDF was rendered to page images and processed locally through the installed vision/document pipeline on the RTX 2070. The accepted end-to-end run completed in 209.4 seconds and returned a closed review proposal with one education entry, five experience entries, no invented project entry, and 27 skills. The OCR stage produced 18,117 detected text characters in visual reading order. No source page or model response left the machine, and no profile record was mutated without review.

This test found and fixed two real integration defects:

1. PDF text extraction previously flattened multi-column reading order.
2. Valid plain OCR text from the document parser was rejected as malformed structured output.
3. The local API proxy's default 100-second activity timeout was shorter than a legitimate two-model RTX 2070 run.
4. Model responses occasionally added harmless Markdown/prose wrappers or missed the exact closed proposal shape.

The document parser now permits bounded plain text only for the `document-page-parsing` contract and wraps it into the closed schema. The loopback-only AI proxy allows a bounded 15-minute activity window while preserving cancellation. Harmless wrappers are normalized before validation, and a malformed final proposal receives one bounded schema-correction retry without repeating OCR. Browser planning and resume tailoring remain closed-schema operations and fail safely.

During the accepted run, the supervised llama.cpp process used approximately 5.6 GB of GPU memory. ApplyFill loaded PaddleOCR-VL and Qwen3-VL sequentially, so the two models did not need to fit in VRAM together.

## Model replaceability evidence

Provider, model, task, prompt, and output-schema versions are independent. Catalog tests resolve capabilities without workflow model-name conditionals. CPU and CUDA runtime manifests and 4B/8B model variants use the same contracts; changing the active catalog entry does not change frontend, API, workflow, or database schemas.

## Manual release gates still required

- Record comparative Qwen 4B versus 8B page-grounding metrics on a held-out ATS corpus.
- Record PaddleOCR layout/entity metrics across the full synthetic resume corpus.
- Record startup time, peak VRAM/RAM, page latency, cancellation, out-of-memory, process-crash, and restart measurements.
- Exercise update, rollback, removal, and corrupt-download behavior from a packaged release candidate.

These are not represented as completed automated tests.
