# Local AI Security Threat Model

**Scope:** ApplyFill desktop browser local inference, model distribution, resume-tailoring inputs, structured outputs, and deterministic patch application.

## Assets and trust boundaries

- The complete IndexedDB profile is sensitive and is never an AI input. The allowlisted AI snapshot is a separate, workflow-specific value created in memory.
- Model/runtime assets are executable supply-chain inputs. Production models require an approved manifest, immutable version, license review, byte size, and SHA-256 integrity value.
- Job postings are hostile quoted data. They do not become workflow instructions and cannot register tools or broaden snapshot fields.
- Model output is hostile data. It is parsed against closed versioned schemas, rendered as plain text, and converted to visible proposals.

## Threats, mitigations, and residual risk

| Area | Threats | Mitigations | Accepted residual risk |
|---|---|---|---|
| Model assets | Malicious replacement, compromised host/CDN, stale cache | Same-origin distribution, approved manifest, SHA-256 verification before compile, explicit version/update UI, no approved default until evaluation | A compromised signed build or manifest can still approve a malicious artifact |
| Inputs | Prompt injection, hidden markup, malformed Unicode, oversized text | Strip executable markup and control/bidirectional characters; bound every field and total context; delimit posting as untrusted quoted JSON; closed workflow prompt | Natural-language injection may still affect model quality, so no output receives authority |
| Outputs | Hallucinated qualifications, HTML/script injection, malformed/deep output, denial-of-service output | Maximum output size; exact versioned schemas; unknown-key rejection; opaque-ID allowlist; string/array/score bounds; plain-text rendering; block novel numeric claims and URLs | Plausible unsupported prose without a detectable numeric or URL marker still requires human review |
| Tools | Storage/network/DOM access, argument broadening, recursion | Closed registry; read-only/pure tools; immutable scoped snapshot; exact argument validation; call/time limits; no generic query, fetch, JavaScript, filesystem, clipboard, or DOM tool | A permitted pure transformation can still return poor text |
| Local access | Another user or extension reads IndexedDB; copied exports; unlocked browser profile | Honest consent/settings copy, no claim that inference encrypts storage, browser-profile/OS access controls, explicit export warnings | Web storage is not a secure enclave and remains readable to same-origin code and privileged extensions |
| Runtime | Device loss, worker crash, memory exhaustion, silent fallback | Explicit lifecycle/error states, cancellation, reset, requested/actual accelerator and fallback diagnostics, unsaved draft preservation | Browser or driver failure can lose an in-memory session and require reload |
| Supply chain | Compromised LiteRT package/model, incompatible update, license change | Pinned package/runtime versions, lockfile, source revision and attribution inventory, integrity verification, gated updates and evaluation | Upstream security issues can require an emergency update or model withdrawal |
| Browser storage | Quota denial, eviction, corrupt/partial cache, cache-write failure | Per-chunk size/digest checks, retryable fetches, last-known-good cache separation, explicit re-download/removal, and continuing the valid current load if Cache Storage rejects a write | Offline reuse can be lost when the browser evicts or refuses the multi-gigabyte model cache |
| Constrained decoding | Runtime omits constant/bookkeeping fields or emits its own opaque bookkeeping | Client supplies formats/versions/patch IDs, derives bullet ownership only from one exact source-text match, filters evidence to allowlisted IDs, and runs the same closed validators afterward | A valid but low-quality rewrite can still pass structural checks and therefore remains review-only |
| Extension installation | Automated acceptance cannot access browser-internal extension pages | Built popup is exercised against a synthetic transport fixture; unpacked installation is documented as a manual release gate | Browser-policy restrictions require a human to perform final developer-install acceptance |

## Logging and retention

- Prompts, profile/job content, raw generation, and review sessions are not persisted or placed in diagnostics.
- Only accepted resume patches enter the resume document. Closing or cancelling disposes the workflow session state.
- Diagnostics include runtime/model/accelerator/error metadata only; user content is excluded.

## Security acceptance fixtures

`frontend/src/features/local-ai/contracts/securityFixtures.ts` contains synthetic postings that request secrets, full storage access, network tools, policy overrides, and hidden markup. Candidate model evaluation must demonstrate that these inputs do not produce tools, broaden the snapshot, or bypass structured-output validation.
