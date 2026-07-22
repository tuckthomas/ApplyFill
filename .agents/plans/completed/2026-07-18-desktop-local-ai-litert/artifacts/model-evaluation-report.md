# Gemma 4 E2B browser acceptance report

**Decision:** Approved for constrained structured-JSON fact selection, job-posting analysis, and human-reviewed resume-tailoring drafts  
**Not approved:** Native tool calling, sensitive identifiers, unreviewed final resumes, or automatic application submission

## Reproducibility

| Item | Value |
|---|---|
| Model | `gemma-4-e2b-it-web` |
| Upstream revision | `9262660a1676eed6d0c477ab1a86344430854664` |
| Artifact | `gemma-4-E2B-it-web.litertlm` |
| Artifact size | 2,008,432,640 bytes |
| SHA-256 | `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5` |
| License metadata | Apache-2.0 |
| Runtime | `@litert-lm/core` 0.14.0 |
| Browser | Chrome 150.0.0.0, Windows 10/11 x64 user agent |
| Hardware | NVIDIA GeForce RTX 2070; no NPU |
| Published context | 131,072 tokens |
| Configured operational context | 4,096 tokens |
| Corpus | `2026-07-18.1`, six synthetic cases |

The source artifact and license metadata are recorded in the [LiteRT Community model repository](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/tree/9262660a1676eed6d0c477ab1a86344430854664). No real user data appears in the corpus.

## Runtime results

The final structured-JSON run used same-origin, per-chunk-verified assets.

| Measurement | Result |
|---|---:|
| Initialization | 28.30 s |
| Cold first token | 484 ms |
| Cold decode | 41.92 tokens/s |
| Warm first token | 107–111 ms |
| Warm decode | 43.93–45.06 tokens/s |
| Accelerator | WebGPU |
| Fallback | WebNN API not enabled; no NPU claim |

This single-machine result is not a minimum-hardware claim. WASM language-model generation was not supported by the official JavaScript path and was not benchmarked. Thermal behavior and NPU comparison remain hardware-lab follow-ups.

## Quality gate

| Metric | Threshold | Result |
|---|---:|---:|
| Schema-valid response | 98% | 100% |
| Unsupported-claim rate | 0% | 0% |
| Mean selection precision | 85% | 88.89% |
| Mean selection recall | 85% | 100% |
| Prompt-injection resistance | 100% | 100% |
| Structured-operation validity | 98% | 100% |

The corpus covers software, operations, healthcare administration, retail, skilled trades, and early-career profiles, including gaps, contradictory requirements, poor formatting, missing qualifications, and embedded hostile instructions.

## Constrained response boundary

The initial six-case run measured agentic/native tool selection at **0%**, so ApplyFill does not authorize the model to choose or execute tools. Resume tailoring instead registers exactly one non-executable `return_resume_tailoring` response envelope to obtain constrained structured data.

LiteRT may omit constant schema fields under constrained decoding and may emit its own bookkeeping IDs. The client therefore supplies formats, schema versions, and patch IDs; it derives each bullet's source only from an exact unique match of `before` text to the approved snapshot. It then validates the complete canonical structure, rejects unknown fact identifiers and unsupported claims, and applies deterministic business logic after validation. Native/agentic tool execution remains disabled until a future runtime/model pair passes its own gate.

## Approval boundary

The checked-in `frontend/model-approval.json` is the promotion record consumed by the packaging script. Repackaging the same revision preserves approval; a different model revision returns to evaluation-required status. Model download remains an explicit user action with the 2.01 GB size disclosed.
