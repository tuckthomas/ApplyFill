- `[x]` Local-first product foundation
  - `[x]` Store profile, resume, tracker, and dashboard records in IndexedDB
  - `[x]` Add versioned JSON copy/download/import and destructive local deletion
  - `[x]` Remove PostgreSQL, persistence APIs, authentication stubs, and the application backend
  - `[x]` Add privacy acknowledgment and durability disclosures
  - `[x]` Add application-only identifiers, work authorization/sponsorship, demographics, GPA, and normalized phone fields
  - `[x]` Add pre-personal-info PDF/DOCX/TXT resume import with deterministic contact redaction, local AI extraction, review, and duplicate-safe merge
  - `[x]` Rewrite Settings around plain-language user tasks and move Local AI diagnostics into a collapsed Advanced section

- `[x]` Browser-side resume generation
  - `[x]` Add local resume collection and schema-versioned portable drafts
  - `[x]` Define the resume-safe allowlist
  - `[x]` Generate live preview, PDF, DOCX, and JSON entirely in the browser
  - `[x]` Keep application-only, supervisor, reason-for-leaving, address, and editing fields outside renderers

- `[x]` Desktop Local AI
  - `[x]` Integrate LiteRT.js 2.5.3 and LiteRT-LM.js 0.14.0 with local WASM
  - `[x]` Add lifecycle, capability detection, honest accelerator fallback, cancellation, diagnostics, and reset
  - `[x]` Add same-origin, SHA-256-verified, Cache Storage-backed model delivery
  - `[x]` Evaluate and approve Gemma 4 E2B for structured job analysis, profile fact selection, and reviewed resume drafts
  - `[x]` Record WebGPU benchmark evidence and prohibit unsupported native tool calling
  - `[x]` Add AI-safe projections, untrusted-text boundaries, strict structured JSON, and patch validation
  - `[x]` Add analysis, relevance, summary/bullet proposals, review, edit, accept/reject, cancel, stale blocking, and undo

- `[x]` Local autofill extension
  - `[x]` Add least-privilege Manifest V3 extension with active-tab inspection
  - `[x]` Add approved-origin and secret-bound persistent pairing with bounded derived profile sync
  - `[x]` Prefer deterministic mapping, then request local AI for ambiguous labels and narrative drafts through the persistent pairing
  - `[x]` Keep page inspection/review sessions temporary while the extension pairing survives navigation and browser restarts
  - `[x]` Add mapping review, optional sensitive-data storage, per-field sensitive confirmation, and completion report
  - `[x]` Prevent credentials, attestations, file upload, CAPTCHAs, and final submission
  - `[x]` Add automatic profile refresh, explicit unpair deletion, and extension release documentation

- `[x]` Static/offline delivery
  - `[x]` Add PWA manifest and versioned service worker
  - `[x]` Keep model cache lifecycle independent from application-shell updates and user documents
  - `[x]` Add Cloudflare Workers static-assets configuration and security headers
  - `[x]` Enforce 25 MiB asset limit with 24 MiB model chunks and static build verification
  - `[x]` Remove retired API URLs, provider configuration, server prerequisites, and backend documentation

- `[x]` Hardware and release matrix (verified scope plus explicit unsupported/untested dispositions)
  - `[x]` Verify Chrome 150 / RTX 2070 WebGPU runtime and six-case structured evaluation
  - `[x]` Verify deterministic frontend and extension suites, production builds, audits, and browser UI
  - `[x]` Record WebNN/NPU as unavailable on the current Ryzen 7 3800X / RTX 2070 system and unsupported for the selected LiteRT-LM.js LLM; make no NPU claim
  - `[x]` Record unpacked-extension installation as a manual release gate because automated `chrome://extensions` access is policy-blocked; verify the built popup through its synthetic browser harness
  - `[x]` Restrict performance claims to the tested host; make no lower-spec or minimum-hardware claim
