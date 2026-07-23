# Workstream B — Privacy, Security, and AI Contracts

> **ARCHIVED AND SUPERSEDED — 2026-07-22:** This workstream documents the retired static/browser-local architecture. Its historical privacy decisions do not replace the current [managed-browser threat model](../../../../docs/threat-model.md) or [data-retention contract](../../../../docs/data-retention.md).

**Status:** Implemented; candidate-model adversarial evaluation pending Workstream C  
**Depends on:** Existing profile/resume schemas and local-first privacy boundary  
**Unblocks:** Product workflows and production model evaluation

## Objective

Create the only permitted boundary between ApplyFill's substantive local records and local AI models. Local execution reduces network exposure but does not make unrestricted model access safe: prompts can leak through UI, model outputs can be malicious, and job postings can contain prompt injection.

## AI-safe input projection

- [x] Add an AI-specific allowlisted projection separate from `ResumeSafeViewModel`.
- [x] Include only user-selected professional summary, selected employment accomplishments, selected projects, selected education details, selected skills, and the job text required by the invoked workflow.
- [x] Exclude name, email, phone, street/city location, profile links, government identifiers, work authorization, sponsorship, voluntary demographics, reasons for leaving, supervisor information, contact permissions, company phone numbers, and internal IDs/metadata unless an individual field is explicitly proven necessary and separately approved.
- [x] Convert rich-text content to bounded plain text before it enters the model.
- [x] Apply per-field and total-context length limits.
- [x] Reject unsupported or structurally invalid local documents; do not add legacy parsing.
- [x] Make workflow-specific projections so a summary rewrite cannot automatically receive every experience record.
- [x] Add tests that fail when prohibited fields become reachable from AI request types.

## Job-posting boundary

- [x] Treat pasted/imported job text as untrusted quoted content.
- [x] Delimit data from system/workflow instructions in prompts.
- [x] Strip executable markup and never render model-provided HTML.
- [x] Bound job-posting size and normalize pathological Unicode/control characters.
- [x] Add prompt-injection fixtures requesting secrets, complete profiles, storage access, or policy overrides.
- [x] Ensure injected posting text cannot add tools, broaden tool arguments, or change the AI-safe projection.

## Structured output

- [x] Define versioned schemas for job analysis, relevance scores, content selections, summary suggestions, bullet suggestions, and application-answer suggestions.
- [x] Parse output as untrusted data and reject invalid JSON/schema versions.
- [x] Reject unknown properties where practical.
- [x] Bound array counts, string lengths, scores, and identifiers.
- [x] Allow output to reference only opaque IDs explicitly included in the input snapshot.
- [x] Prevent the model from creating profile records, identifiers, credentials, URLs, or known unsupported numeric facts; every remaining prose change is an untrusted proposal requiring human acceptance.
- [x] Represent uncertainty and missing evidence explicitly rather than encouraging invented answers.

## Tool boundary

- [x] Define a closed, versioned tool registry owned by deterministic application code.
- [x] Start with read-only analysis tools and pure transformation tools.
- [x] Never give a model a generic database query, JavaScript execution, network fetch, filesystem, clipboard, or DOM-manipulation tool.
- [x] Pass a scoped immutable snapshot into a tool invocation; tools must not open IndexedDB themselves.
- [x] Validate every tool name and argument against an exact schema.
- [x] Limit tool-call count, recursion, and total execution time.
- [x] Return proposed patches rather than directly mutating profile/resume documents.
- [x] Require a visible user confirmation before applying each patch group.

## Local privacy controls

- [x] Confirm runtime and model requests resolve only to same-origin static assets after installation/download.
- [x] Add a development test or browser assertion that fails when an AI workflow makes an unexpected network request.
- [x] Keep prompts, outputs, benchmarks, and diagnostic information out of analytics and logs.
- [x] Decide whether optional local prompt history is needed; default to no history and require a separate versioned local document if approved.
- [x] Ensure error messages do not echo complete prompts or profile content.
- [x] Make model/context disposal available when a user finishes or cancels a workflow.
- [x] Update consent language to distinguish browser-local inference from optional future remote providers.

## Threat-model checklist

- [x] Document assets: malicious model replacement, compromised CDN/build, and stale cached model.
- [x] Document inputs: prompt injection, oversized text, malformed Unicode, and hidden markup.
- [x] Document outputs: hallucinated qualifications, script/HTML injection, malformed patches, and denial-of-service output.
- [x] Document local access: another person/browser extension reading local data, copied exports, and unlocked browser profiles.
- [x] Document accelerator/runtime failure: device loss, worker crash, memory exhaustion, and silent CPU fallback.
- [x] Document supply chain: LiteRT packages, model sources, licenses, hashes, and update process.
- [x] Document mitigations and accepted residual risks without claiming that local inference encrypts IndexedDB.

## Focused tests

- [x] Snapshot or type-test every allowed input field.
- [x] Add negative tests for every prohibited profile category.
- [x] Fuzz structured-output validators with unknown keys, long strings, deep nesting, invalid IDs, and prototype-pollution keys.
- [x] Test tool-call limits and unknown tool rejection.
- [x] Test job-posting prompt-injection fixtures against each candidate model during Workstream C.
- [x] Test that generated content cannot bypass the existing resume-safe PDF/DOCX boundary.

## Handoff

- [x] Publish stable AI-safe input, output, patch, and tool types to Workstreams A, C, and D.
- [x] Provide security acceptance fixtures to Workstream C.
- [x] Provide consent/privacy copy requirements to Workstreams D and G.

## Implementation evidence

- Contracts and fixtures: `frontend/src/features/local-ai/contracts/`
- Workflow/network assertions: `frontend/src/features/local-ai/workflows/resumeTailoring.test.ts`
- Threat model: `security-threat-model.md`
- Remaining acceptance: run the checked-in prompt-injection fixtures against every candidate model during Workstream C; this cannot pass until a candidate model is actually evaluated.
