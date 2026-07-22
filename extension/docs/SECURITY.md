# Extension Security and Threat Model

## Protected assets

- The derived local autofill profile copy
- Sensitive government, authorization, sponsorship, and demographic answers when explicitly included
- The integrity of the user's application and final submission decision

## Trust boundaries

1. ApplyFill remains the authoritative profile store and sends bounded updates only after persistent pairing.
2. The extension validates the exact ApplyFill origin, pairing secret, protocol version, schema, size, and sensitive-data preference before updating `chrome.storage.local`.
3. The extension creates a temporary active-tab review session from the paired copy. The content script observes bounded control semantics and inserts only reviewed values.
4. If Local AI is already installed, ambiguous non-sensitive fields may be sent as scrubbed descriptors to a temporary same-origin ApplyFill helper. The validated suggestions return to the active review; the model download is never started implicitly.
5. Job sites and all page text, attributes, options, scripts, frames, and overlays are untrusted.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Malicious site requests the profile | Job sites cannot invoke the internal popup protocol or the approved-origin external pairing protocol. | A compromised device or ApplyFill origin can expose local data. |
| Unauthorized profile replacement | Profile updates require the exact approved origin and a 256-bit local pairing secret. Messages use strict schemas and size limits. | Malicious code already running on the paired ApplyFill origin can access the web app's local authority. |
| Persistent extension copy is read locally | The copy is held only in extension-local storage, never cloud-synced by ApplyFill, and is deleted on explicit unpair. Sensitive fields are opt-in. | An unlocked browser profile, privileged extension, or compromised device may read extension storage. |
| Prompt-injected field labels | Page strings are bounded and treated as untrusted. Known injection text is neutralized; prohibited actions remain manual. | Novel phrasing can still require human review. |
| Automatic helper triggers an unexpected model download | The helper checks that every approved model chunk is already present before initialization. Model setup remains an explicit Settings action. | A previously cached model can still require initialization time. |
| Sensitive value reaches AI | Sensitive semantics never accept AI mapping and are excluded from model input. Values remain masked and require immediate per-field confirmation. | A hostile page can read a value after the user chooses to insert it. |
| Site intercepts or rewrites values | Values are inserted once with normal events, then re-read and reported rather than repeatedly forced. | The page controls its own behavior after insertion. |
| Unauthorized submission or attestation | No submit action exists. Signatures, attestations, CAPTCHAs, uploads, authentication, and legal acceptance remain manual. | A malicious page may react to normal field events; users must review before submitting. |
| Supply-chain or remote-code compromise | All executable extension code is bundled and the CSP allows only self-hosted scripts. | Build-tool or extension-store compromise remains possible. |

## Security invariants

- Pair once; do not require per-application pairing or copy codes.
- Treat opening the extension on a job page as temporary page authorization, not connection setup.
- Persist only the bounded derived profile copy and pairing metadata.
- Never persist page discovery, current page values, review choices, or fill reports.
- Keep sensitive values opt-in, masked, excluded from AI, and confirmation-gated.
- Never access passwords, payment data, cookies, authentication codes, hidden content, or complete DOM snapshots.
- Never upload files, accept attestations, solve CAPTCHAs, or submit an application.
- Never execute remote code or add broad host permissions as a workaround.
