# Workstream C — Model Selection and Evaluation

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** This workstream records historical LiteRT/WebGPU model evaluation. The browser runtime and model are no longer supported product paths. Current models run through native local Private AI services and must pass the current provider-neutral evaluation contract. See [current architecture](../../../../docs/architecture.md).

**Status:** Implemented; NPU/lower-spec hardware matrix remains a lab follow-up  
**Depends on:** Minimal runtime runner from Workstream A; schemas and adversarial fixtures from Workstream B  
**Produces:** Reproducible evaluation report and approved model manifest entry

## Objective

Select models from measured ApplyFill performance, not announcement benchmarks. Separate small deterministic ML tasks from generative tasks so the language model is not used where embeddings, classification, or application logic are more reliable.

## Candidate inventory

- [x] Inventory LiteRT-LM.js-compatible instruction/tool-calling models suitable for desktop-browser memory limits.
- [x] Inventory LiteRT.js-compatible embedding or classification models for semantic matching and relevance scoring.
- [x] Record source, exact version/revision, artifact format, quantization, size, context limit, supported accelerators, license, attribution, and redistribution terms.
- [x] Reject models whose weights cannot legally be redistributed from ApplyFill's static host.
- [x] Reject opaque artifacts without a reproducible source and integrity hash.
- [x] Prefer the smallest model that meets quality thresholds; do not equate parameter count with product quality.

## Evaluation corpus

- [x] Create synthetic, license-safe profiles representing varied careers, education, gaps, projects, and skill sets.
- [x] Create representative job postings across software, operations, healthcare administration, retail, skilled trades, and early-career roles.
- [x] Include long, poorly formatted, contradictory, and instruction-injected postings.
- [x] Include profiles deliberately missing requested qualifications to test non-invention.
- [x] Exclude real user profile data and sensitive identifiers from committed fixtures.
- [x] Version the corpus and expected structured properties.

## Quality evaluation

- [x] Measure schema-valid response rate.
- [x] Measure unsupported-claim and invented-qualification rate.
- [x] Measure correct experience/skill selection against human-reviewed fixtures.
- [x] Evaluate bullet rewrites through exact source matching, novel-numeric-claim blocking, schema validation, and live human review; the small synthetic corpus is not a general writing-quality benchmark.
- [x] Evaluate summaries for relevance without keyword stuffing.
- [x] Evaluate refusal to follow instructions embedded inside job-posting data.
- [x] Evaluate tool-call accuracy, argument validity, and unnecessary-tool rate.
- [x] Record human-review rubric and sample size.
- [x] Define pass/fail thresholds before choosing the winner.

## Runtime evaluation

- [x] Benchmark the available WebGPU backend; record WebNN/NPU and WASM LLM generation as unsupported by the selected LiteRT-LM.js path on the tested host.
- [x] Record model download/cache size, initialization time, first-token latency, tokens per second, and repeated-run behavior; sustained thermal instrumentation was unavailable and no thermal claim is made.
- [x] Record the hardware-matrix disposition: one WebGPU desktop was tested; lower-spec and NPU-capable desktops remain explicitly untested, so no minimum-hardware claim is published.
- [x] Repeat each benchmark enough times to distinguish cold start, warm start, and normal variance.
- [x] Verify cancellation and recovery after memory/device failure.
- [x] Enforce the 4,096-token operational context/output bounds and reject oversized inputs; the model's published 131,072-token maximum is outside the approved product envelope and was not claimed as tested.
- [x] Do not publish a minimum hardware claim until results support it.

## Model packaging

- [x] Define a versioned, signed or hash-verified model manifest.
- [x] Include artifact URL, byte size, digest, runtime compatibility, context limit, and license metadata.
- [x] Decide whether one default model is shipped, downloaded on demand, or selected from multiple tiers.
- [x] Prevent automatic multi-gigabyte downloads without explicit user action and size disclosure.
- [x] Verify interrupted downloads resume or restart safely.
- [x] Verify cached models are invalidated only when the manifest changes and integrity succeeds.

## Acceptance report

- [x] Check in a concise report containing tested hardware/browser versions, runtime versions, model revisions, prompts/corpus version, results, known failures, and selected default.
- [x] State whether WebNN/NPU is faster or more efficient than WebGPU for the selected model on tested hardware.
- [x] State whether WASM is usable or emergency-only.
- [x] Document tasks the model is not approved to perform.
- [x] Obtain explicit approval before turning a candidate artifact into the production default.

## Handoff

- [x] Provide the selected manifest entry and task configuration to Workstreams A and F.
- [x] Provide validated prompt/tool templates and known model quirks to Workstream D.
- [x] Provide benchmark evidence and model attribution to Workstream G.

WebNN/NPU, WASM language generation, lower-spec hardware, and extended thermal testing were not available on this host and remain unchecked above. The acceptance report makes no claim for them.
