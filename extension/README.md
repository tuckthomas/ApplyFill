# ApplyFill Job Application Autofill Extension

Manifest V3 desktop Chromium extension for persistent local pairing, review-before-fill job-application assistance, and no automatic submission.

## How it works

1. Install the unpacked extension once and copy its Extension ID into ApplyFill Settings.
2. Select **Pair Extension Once**. ApplyFill sends a bounded, derived profile copy to the extension's local browser storage.
3. When the profile changes, ApplyFill automatically refreshes that extension copy while the pairing remains available.
4. On any job application, open the extension and select **Inspect This Application**. This is a page-access action, not a new connection.
5. ApplyFill immediately handles recognized fields. When Local AI has already been set up, the extension automatically opens a local ApplyFill helper for ambiguous questions and adds its suggestions to the same review—without another pairing step.
6. Review, edit, deselect, or mark suggestions as manual before filling. ApplyFill never clicks Submit.

There is no per-tab connection code and no five-minute re-pairing step. The pairing survives job-site navigation, completed fills, extension service-worker restarts, and browser restarts. The user can deliberately remove it with **Unpair Extension**.

## Privacy boundary

- The ApplyFill profile in IndexedDB remains authoritative. The extension stores only a derived autofill copy in `chrome.storage.local` so it can work without reopening Settings for every application.
- Sensitive application answers are excluded by default. Users may explicitly include them in the local extension copy. They remain masked and require a separate confirmation for every sensitive field before insertion.
- Page inspection remains temporary and active-tab scoped. Field descriptors, review state, current page values, reports, and page content are not persisted.
- The content script returns bounded field descriptions, never existing field values, complete DOM, hidden content, cookies, storage, tokens, or unrelated page text.
- Passwords, authentication codes, payment fields, file uploads, signatures, attestations, CAPTCHAs, and final submission are never filled.
- Local AI never receives government identifiers, work authorization, sponsorship, or voluntary demographic answers. It receives only scrubbed field descriptions and the existing AI-safe professional profile projection.

Local-only storage reduces network exposure; it does not protect against an unlocked browser profile, a compromised device, another privileged extension, screen capture, or a hostile job site. See [the threat model](docs/SECURITY.md).

## Permissions

| Manifest capability | Why it is needed | What remains absent |
|---|---|---|
| `activeTab` | Temporarily accesses only the job tab where the user opens the extension. | No permanent access to every website. |
| `scripting` | Injects the bundled discovery/fill script into that active tab. | No remote or page-supplied executable code. |
| `storage` | Keeps the user-approved pairing and derived profile copy across browser restarts. | No cloud sync; no page inspection or report history. |
| `externally_connectable` | Accepts paired profile updates only from approved ApplyFill origins. | No messages from unrelated sites. |

Incognito use is disabled. The extension does not request cookies, downloads, clipboard write, web request, native messaging, broad host permissions, or persistent content scripts.

## Supported controls

| Control | Behavior |
|---|---|
| Text-like native `<input>` and `<textarea>` | Reviewed plain-text insertion with normal input/change events. |
| Native `<select>` and named radio groups | Exact value or visible-label matching. |
| Native checkbox | Explicit yes/true/on or no/false matching. |
| Input-based combobox/datalist | Text insertion; the user verifies any site-managed selection. |
| Custom ARIA combobox | Review only when deterministic insertion is unsafe. |
| File input | Manual; browsers prohibit assigning a local file. |
| Password, authentication, payment, hidden fields | Excluded. |
| Signature, legal attestation, CAPTCHA, final submit | Always manual. |

Site-controlled components may replace a value. ApplyFill reports that result instead of repeatedly forcing the value. A multi-step application can be inspected again without re-pairing.

## Persistent pairing protocol

The web app generates a cryptographically random pairing secret and stores it locally alongside the Extension ID. The extension stores the matching secret, exact approved ApplyFill origin, profile update timestamp, sensitive-data preference, and bounded derived values.

Approved origins can send six exact, versioned messages:

- `applyfill.pair` creates or replaces the pairing after the user presses **Pair Extension Once**.
- `applyfill.sync-profile` refreshes the derived extension copy after a profile save.
- `applyfill.pairing-status` confirms that the local secret and origin still match.
- `applyfill.unpair` deletes the extension copy and clears active review sessions.
- `applyfill.inspect-paired` returns bounded, scrubbed descriptors for an active page review to the local ApplyFill AI helper.
- `applyfill.attach-ai-suggestions` adds validated, non-sensitive Local AI proposals to that same review.

All requests use protocol `applyfill.autofill.pairing.v1`, are limited by exact schemas and message-size bounds, and require both the approved sender origin and matching local secret. A job site cannot call this external protocol.

Each application review is still a separate in-memory session. It is cleared on completion, cancellation, navigation, or tab close without deleting the persistent pairing.

## Local development

Requirements: Node.js 24+ and pnpm 11+.

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm test
pnpm build
```

Load `extension/dist` using **Manage extensions → Developer mode → Load unpacked**. Copy the displayed Extension ID into ApplyFill Settings, pair once, then open a synthetic or real job form and use the extension.

## Release procedure

1. Update package and manifest versions together.
2. Review production origins and permission changes.
3. Run check, lint, test, build, and dependency audit.
4. Confirm the built manifest has no remote scripts, broad host permission, persistent content script, or source maps.
5. Test pairing across an extension reload and browser restart, automatic profile refresh, multi-step application reuse, unpair deletion, sensitive confirmation, and no-submit behavior.
6. Zip only the contents of `dist/` for Chromium distribution.
