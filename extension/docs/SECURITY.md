# Extension Security and Threat Model

## Protected assets

- Scoped profile/application values selected for the current form
- Sensitive government, work-authorization, sponsorship, demographic, and salary data
- Generated resumes and application-specific narrative answers
- The integrity of the user's job application and final submission decision

## Trust boundaries

1. ApplyFill origin owns profile retrieval, local AI, redaction, and proposed mappings.
2. The extension service worker validates origin, source/target tabs, nonce, version, size, schema, and expiration. A read-only inspection returns only redacted descriptors, binds the source tab, and does not consume the nonce; the subsequent handoff from that same source consumes it and holds the scoped packet in memory.
3. The content script observes bounded control semantics and inserts only approved values into the activated tab.
4. The job site and all its text, attributes, options, events, frames, overlays, and scripts are untrusted.

The extension does not cross into inaccessible frames. Unsupported frames and controls remain manual.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Malicious site requests the full profile | The site cannot invoke the internal popup protocol; external handoffs require an exact ApplyFill origin and active nonce. Descriptors contain no existing values. | A compromised ApplyFill origin or device can still expose data. |
| Prompt-injected field labels | Page strings are bounded/untrusted, known injection text is neutralized, sensitive labels are redacted, and AI cannot add tools or access storage. | Novel phrasing can influence a small local model; review remains mandatory. |
| Replay, descriptor theft, or cross-tab handoff | Cryptographic nonce, exact target tab, inspection-bound source tab/origin, five-minute maximum, handoff consumption, response-size bound, and in-memory disposal. | Malware with local browser-process access is outside the web security boundary. |
| Packet retained by the extension | No persistence APIs, analytics, or value logging. Clear on fill/cancel/tab close/navigation/expiry; service-worker unload also clears memory. | Process memory may be inspectable on a compromised system. |
| Sensitive value reaches AI | Sensitive semantics cannot accept model-suggested mappings; model-safe descriptors redact them. A recent ApplyFill approval timestamp and immediate per-field extension confirmation are both required. | The authoritative ApplyFill application must enforce the same projection and visible approval before constructing the handoff. |
| Site intercepts or rewrites values | Standard framework events are dispatched once, values are re-read, and replacements/rewrites are reported rather than forced. | A hostile page can read anything the user chooses to insert into that page. |
| Lookalike overlay or replaced control | Disconnected elements fail; values are re-read; fields receive a temporary outline; final human review is required. | Visual deception cannot be fully defeated by an extension with least privilege. |
| Unauthorized submission or attestation | No submit action exists. Attestations, signatures, CAPTCHAs, uploads, authentication, and legal acceptance remain manual. | A malicious page can submit itself based on its own event handlers; users should use reputable application sites. |
| Supply-chain or remote-code compromise | Executable code is bundled, the CSP is `script-src 'self'`, there are no remote scripts, and the lockfile is committed. | A compromised build tool or extension-store update remains possible; releases require review. |
| Another browser extension reads the page | ApplyFill cannot isolate inserted values from another extension with broader privileges. | Accepted local threat; document it and minimize installed extensions/browser profile access. |

## Security invariants

- No automatic final submission.
- No full profile or complete DOM in a message.
- No existing field values in discovery output.
- No raw or sensitive descriptors in external inspection output.
- No password, payment, authentication, cookie, storage, or hidden-content access.
- No sensitive model input.
- No packet/value persistence or logging.
- No remote executable code.
- No permission expansion without explicit review and documentation.

Report new incompatible controls as limitations. Do not add global host access, DOM snapshots, repeated value forcing, or site-specific remote scripts as a workaround.
