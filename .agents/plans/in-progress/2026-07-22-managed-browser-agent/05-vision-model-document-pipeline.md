# Workstream 05 — Vision Models and Document Intelligence

**Status:** Implemented — release acceptance pending
**Depends on:** Workstream 01 provider contracts; Workstream 07 input/output policy  
**Unblocks:** Visual application understanding, resume import, model-backed planning

**Outcome/evidence (2026-07-22):** Provider-neutral manifests, capability-based selection, packaged loopback-only llama.cpp supervision, Qwen3-VL/PaddleOCR-VL adapters, verified/resumable artifact installation, closed model outputs, image-based resume ingestion, and evidence-bound resume workflows are implemented. The supported Qwen3-VL 8B Q4 and PaddleOCR-VL 1.6 artifacts were checksum-verified and exercised sequentially on the development RTX 2070. A real two-page, two-column PDF completed in 209.4 seconds at approximately 5.6 GB peak GPU memory, producing a schema-valid proposal after OCR; malformed schema output has a bounded correction retry that does not rerun OCR. The Private AI suite passes 15 tests, the Browser Worker suite passes 76 tests, and the synthetic ATS suite passes 5 tests. Release acceptance still requires held-out 4B-versus-8B comparison metrics, a broader resume-layout corpus, model replacement/rollback proof, update lifecycle acceptance, screenshot redaction validation, and approved quality/safety thresholds.

## Objective

Replace the browser text-only model constraint with local native inference. Evaluate and integrate one general vision-language model for job-application pages and one document-specialized model for resumes, while retaining strict schemas, deterministic validation, privacy boundaries, and user review.

## Candidate baseline

- [x] Treat the current development machine—RTX 2070, 8 GB VRAM, compute capability 7.5, NVIDIA driver 591.86—as the mandatory first hardware baseline.
- [ ] Evaluate Qwen3-VL 4B and 8B Instruct first for screenshot understanding, OCR, GUI grounding, structured extraction, action proposal quality, latency, memory, and license; retain 2B as a diagnostic/minimum-resource comparison.
- [x] Treat Qwen3-VL-8B-Instruct as the preferred quality candidate. Accept slower CPU/GPU split execution on the RTX 2070 when it is stable and produces materially better evaluated results than 4B.
- [ ] Keep Qwen3-VL-4B-Instruct as the performance fallback when 8B fails memory/stability gates or its measured quality improvement is negligible.
- [x] Evaluate PaddleOCR-VL 1.6 as the document-specialized baseline for PDF/image layout, reading order, columns, tables, and scans.
- [ ] Compare a single-model Qwen path against the two-model Qwen plus Paddle pipeline for installation size and accuracy.
- [x] Record exact model repository, revision, quantization, license, artifact size, checksum, and required runtime.
- [x] Do not call a model open source when only its weights are available under a custom license.

## Inference runtime evaluation

- [ ] Evaluate Ollama for development simplicity, Windows support, image input, model management, and local API behavior.
- [x] Evaluate llama.cpp/`llama-server` for distributable cross-platform packaging, GGUF quantization, multimodal support, and OpenAI-compatible transport.
- [x] Do not use vLLM or another CC 8.0+ PaddleOCR backend on the RTX 2070. Evaluate PaddlePaddle/Transformers direct inference and the supported `llama-cpp-server` backend for PaddleOCR-VL instead.
- [ ] Evaluate vLLM only for an optional Linux/NVIDIA compute-capability-8.0-or-newer server topology; it is not part of the RTX 2070 test path.
- [ ] Compare startup time, steady memory, image prefill, decode rate, concurrency, cancellation, structured-output reliability, and crash recovery.
- [x] Select one supported first-release runtime and keep other providers behind tested adapters.
- [x] Bind inference endpoints to the private local network and disable unneeded model tools, browsing, code execution, and remote fetches.

## RTX 2070 memory strategy

- [x] Run only one vision model at a time on the 8 GB card; unload Qwen before starting PaddleOCR-VL and unload PaddleOCR before resuming page-agent inference.
- [ ] Use the machine's 32 GB system RAM for intentional partial offload of Qwen3-VL 8B while reserving enough memory for Chromium, PostgreSQL, .NET, and the operating system.
- [x] Configure bounded image resolution and context rather than exposing the models' maximum published context windows.
- [x] Measure actual VRAM after Windows desktop/browser overhead and avoid assuming artifact size equals runtime memory.
- [ ] Close or unload development model runners such as LM Studio before acceptance benchmarks; do not terminate user applications automatically.
- [x] Record GPU-offload layers, system-RAM spill, prompt/image sizes, latency, and peak VRAM for the accepted development configuration.
- [ ] Prefer a fully GPU-resident 2B/4B configuration only when it still meets the quality gate; do not trade a material accuracy improvement from 8B merely for lower latency.
- [ ] Provide CPU fallback for document parsing only if measured latency remains usable; do not advertise it before measurement.

## Replaceable model architecture

This section is an internal engineering boundary, not a user-facing configuration system. It exists so ApplyFill can replace models without asking users to understand or manage the change.

- [x] Define a versioned provider-neutral `VisionModel` manifest with capabilities, approved tasks, input modalities, output-schema compatibility, runtime/provider, quantization, hardware limits, license, size, and digests.
- [x] Select models by task capabilities such as `page-understanding`, `gui-grounding`, `document-parsing`, `resume-fact-extraction`, and `structured-actions`, never by model-name conditionals in workflows.
- [x] Keep runtime implementations behind provider adapters with one shared generation/document contract.
- [x] Keep task prompts, safety instructions, image preprocessing, output schemas, and validators versioned independently from model artifacts.
- [ ] Permit model-specific prompt templates or preprocessing only through declared manifest/task overrides covered by conformance tests; do not scatter conditional logic across application services.
- [x] Add installation, health-check, activation, deactivation, update, rollback, and removal operations to the model registry.
- [ ] Allow multiple model revisions to be installed side by side during evaluation and rollback, while only one revision is active for a task unless an explicit experiment is running.
- [ ] Store user preference as `quality`, `balanced`, or `speed` plus optional advanced pinning; ordinary workflows request capabilities rather than a concrete model.
- [x] Default to the best evaluated compatible quality mode automatically; do not require ordinary users to choose even `quality`, `balanced`, or `speed` during setup.
- [ ] Keep optional model pinning and provider diagnostics developer-only unless a concrete support requirement justifies exposing them inside a collapsed advanced diagnostic area.
- [ ] Refuse activation when a candidate lacks the required modality/schema/tool behavior or fails security and quality gates.
- [x] Make new-model adoption a manifest + adapter (only when a new runtime is required) + conformance-report change, not a rewrite of Browser Agent orchestration.
- [ ] Prove portability by swapping between two model variants/providers without changing API contracts, workflow code, persisted domain schemas, or Browser Agent UI.

## Page-vision input pipeline

- [x] Normalize live viewport frames without cropping required labels, options, validation messages, or continuation controls.
- [x] Preserve aspect ratio and provide frame dimensions/page generation alongside the image.
- [x] Combine visual frames with bounded, sanitized browser structure rather than asking the model to infer exact executable coordinates alone.
- [ ] Annotate eligible controls only when evaluation proves annotation improves grounding without obscuring text.
- [ ] Remove or mask credential values, government identifiers, hidden inputs, and unrelated browser chrome before inference.
- [x] Treat all rendered text as untrusted quoted observation data.
- [x] Bound image count, resolution, visual token budget, structural context, and output tokens.

## Structured model outputs

- [x] Define closed schemas for page classification, field semantics, question interpretation, proposed profile mapping, action proposal, expected postcondition, confidence, and user-question request.
- [x] Keep element handles and field identifiers client/server-owned; the model may reference only values present in the current observation.
- [x] Reject unknown keys, invalid handles, prohibited actions, invented profile paths, out-of-range coordinates, oversized strings, and unsupported URLs.
- [x] Separate interpretation from execution; a schema-valid model response still requires policy validation.
- [x] Parse model output fail-closed and retry with smaller/simpler observations rather than repairing arbitrary malformed JSON.
- [x] Version prompts and output schemas; store versions in action/checkpoint records without storing private prompts.

## Resume/document ingestion

- [x] Render each PDF page locally at an evaluated resolution suitable for small resume text.
- [ ] Convert DOCX to a faithful local page representation or a reviewed intermediate layout before vision parsing.
- [x] Send image-only scans and visually complex pages through PaddleOCR-VL.
- [x] Preserve embedded PDF/DOCX text as corroborating evidence for exact spelling, dates, numbers, emails, phone numbers, and URLs.
- [x] Reconcile visual reading order with embedded text rather than replacing accurate text with OCR blindly.
- [ ] Detect and report low-confidence or contradictory visual/text results.
- [ ] Keep contact and application-sensitive data outside general professional-fact model prompts where deterministic extraction suffices.
- [x] Return the existing closed profile-import proposal shape or an explicitly versioned successor.
- [x] Require review before profile mutation.

## Application-answer safety

- [x] Build workflow-specific allowlists so the model receives only information relevant to visible questions.
- [ ] Keep passwords, session data, financial accounts, government identifiers, demographic answers, disability/veteran disclosures, and legal attestations out of general vision prompts.
- [x] Route sensitive fields through deterministic mapping and explicit user confirmation.
- [ ] Prevent model inference from converting a user's profile into unsupported legal/immigration conclusions.
- [x] Require evidence for generated resume or cover-letter claims and prohibit invented credentials, employers, dates, metrics, and degrees.

## Evaluation corpus

- [ ] Create synthetic and licensed/private-safe fixtures covering single-column, two-column, sidebar, table, graphic, scanned, low-contrast, skewed, and multi-page resumes.
- [x] Create synthetic ATS pages covering Workday-like, Greenhouse-like, Lever-like, custom React, server-rendered, iframe, Shadow DOM, dropdown, combobox, upload, date, and rich-text controls.
- [ ] Include mobile/responsive and zoomed layouts only if supported in the first release.
- [ ] Include ambiguous labels, unlabeled controls, hidden honeypots, validation errors, and adversarial page instructions.
- [ ] Define expected structured facts/actions and score exactness, omissions, hallucinations, grounding, and safety denials.
- [ ] Maintain a holdout set not used for prompt tuning.

## Acceptance metrics

- [ ] Define minimum field-semantic precision and recall for ordinary application controls.
- [ ] Require zero execution authority from invalid or prohibited model outputs.
- [ ] Define maximum unsupported-answer and invented-resume-fact rates.
- [ ] Define resume entity/date/reading-order accuracy by layout class.
- [ ] Record first observation latency, subsequent observation latency, memory, model startup, and cancellation responsiveness on each tested machine.
- [ ] Require a complete evaluation run on the RTX 2070 baseline before selecting the first-release model/runtime combination.
- [ ] Publish tested hardware honestly and avoid unsupported minimum-spec claims.
- [ ] Choose model variants based on measured quality and usability, not parameter count alone.

## Model lifecycle

- [x] Implement one **Set Up Private AI** action with human-readable download size, disk requirement, progress, cancellation, retry, verification, update, and removal.
- [x] Package and manage the selected runtime automatically; users must not separately install or launch Ollama, llama.cpp, Python, Paddle, CUDA toolkits, model servers, or containers.
- [x] Automatically inspect compatibility and choose the approved model/runtime configuration without exposing GPU layers, quantization, context limits, provider names, model repositories, or API endpoints.
- [x] Translate internal states into ordinary outcomes: checking this computer, downloading Private AI, preparing Private AI, ready, update available, needs attention, and unavailable on this computer.
- [x] Put technical diagnostics behind an explicit collapsed **Advanced diagnostics** control intended for troubleshooting/export, not setup.
- [x] Verify SHA-256 before a model becomes available.
- [ ] Keep last-known-good revisions during staged update until the new model passes health checks.
- [x] Never download a multi-gigabyte model implicitly when a run begins.
- [x] Provide a content-free diagnostic report containing model/runtime versions and failure metadata only.

## Verification and exit criteria

- [x] Provider contract suites pass against fakes and the selected real runtime.
- [x] Candidate evaluation report and model/license inventory are checked in under this plan's `artifacts/` directory.
- [ ] Selected models meet documented accuracy, safety, performance, and memory gates.
- [ ] Model replacement/rollback conformance test passes with at least two model variants or providers.
- [x] Resume and application screenshots never leave the local boundary during supported operation.
