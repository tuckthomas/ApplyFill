# ApplyFill Local Autofill Extension

Manifest V3 desktop Chromium extension for user-invoked, review-before-fill job-application assistance. The extension is a narrow browser surface, not a profile database or AI host.

## Privacy boundary

- The ApplyFill web application remains the authoritative profile, resume, and application store.
- The extension receives only a short-lived application packet selected for one active tab.
- Packets, values, prompts, DOM snapshots, and reports are never written to `chrome.storage`, IndexedDB, local storage, analytics, or console logs.
- Closing either tab, navigating the target tab, cancelling, completing a fill, expiration, or extension reload destroys or invalidates the in-memory session.
- The content script returns bounded field descriptors, never field values, complete DOM, hidden content, cookies, storage, tokens, or unrelated page text.
- LiteRT inference belongs in ApplyFill. The extension service worker does not load or retain an AI model.
- Government identifiers, work authorization, sponsorship, voluntary demographics, and salary expectations bypass AI. They remain masked and require per-field confirmation immediately before insertion.
- The extension never submits an application, accepts an attestation, uploads a document, solves a CAPTCHA, authenticates, or supplies credentials.

Local processing reduces network exposure; it does not protect against an unlocked browser profile, a compromised device, another privileged extension, screen capture, or a hostile job site. See [the threat model](docs/SECURITY.md).

## Permissions

| Manifest capability | Why it is needed | What is deliberately absent |
|---|---|---|
| `activeTab` | Grants temporary access only after the user clicks the extension on the current job tab. | No permanent access to all sites and no broad host permission. |
| `scripting` | Injects the bundled discovery/fill script into that user-approved tab. | No remotely loaded code and no arbitrary script supplied by a page. |
| `externally_connectable` | Lets an approved ApplyFill page deliver a nonce-bound packet. Runtime validation narrows development access to ports 5173/4173. | No messages from other sites. |

Incognito use is disabled pending a separate privacy review. The extension does not request `storage`, `cookies`, `downloads`, `clipboardWrite`, `webRequest`, native messaging, or broad `tabs` permission.

## Supported controls

| Control | Discovery | Fill behavior |
|---|---|---|
| Text-like native `<input>` | Supported | Native value setter plus bubbling/composed `input` and `change` events. |
| `<textarea>` | Supported | Plain text only; honors `maxlength`. |
| Native `<select>` | Supported | Exact value or visible-label match. |
| Named radio group | Supported | Exact option value or label match. |
| Native checkbox | Supported | Explicit yes/true/on or no/false value. |
| Input-based combobox/datalist | Limited | Text insertion; the user must verify any site-managed selection. |
| Custom ARIA combobox | Discovery only | Marked manual when deterministic insertion is not safe. |
| File input | Discovery only | The browser prohibits assigning a local file; download the chosen resume from ApplyFill and upload it manually. |
| Password, one-time-code, payment, hidden, authentication | Excluded | Never collected or filled. |
| Signature, legal attestation, CAPTCHA, final submit | Manual | Never filled or activated. |

Site-controlled components can replace or rewrite a value. The completion report calls this `changed-by-site`; it does not repeatedly force the value. When a single-page application changes form steps, the user must explicitly click **Inspect again**.

## Local development

Requirements: Node.js 24+ and pnpm 11+.

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm test
pnpm build
```

Load `extension/dist` using **Manage extensions → Developer mode → Load unpacked** in a Chromium desktop browser. Pin the extension, open a local synthetic form, and click it to begin inspection.

The build is self-contained: `background.js`, `content.js`, `popup.js`, HTML, CSS, and the manifest. The strict CSP permits only bundled extension scripts.

## ApplyFill inspect and handoff contract

The popup displays a connection code in the form `<targetTabId>.<nonce>`. ApplyFill parses it locally. The nonce is random, bound to the previously user-activated target tab, and expires after at most five minutes.

### 1. Inspect model-safe descriptors

ApplyFill first requests a bounded, redacted view of the discovered fields:

```ts
const inspection = await chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'applyfill.inspect',
  protocolVersion: 'applyfill.autofill.v1',
  targetTabId,
  nonce,
});
```

Successful response:

```json
{
  "ok": true,
  "protocolVersion": "applyfill.autofill.v1",
  "targetTabId": 42,
  "expiresAt": 1784420000000,
  "fields": [
    {
      "id": "af-0-example",
      "control": "input",
      "inputType": "email",
      "label": "Email",
      "autocomplete": "email",
      "required": true,
      "options": []
    },
    {
      "id": "af-1-example",
      "control": "input",
      "inputType": "text",
      "label": "[sensitive field]",
      "required": false,
      "options": []
    }
  ]
}
```

The request is restricted to 1 KiB and an exact schema. The response is restricted to 64 KiB and the active session's remaining lifetime. It contains only `createModelSafeDescriptors(...)` output: control semantics, bounded label/question text, allowed options, and opaque page-local field IDs. It never contains current field values, complete DOM, hidden page content, cookies, storage, authentication data, or sensitive labels. Prompt-injected labels are replaced with `[untrusted field text removed]`; known sensitive labels are replaced with `[sensitive field]`.

Inspection does not consume the nonce, but it binds the session to the exact approved ApplyFill origin and source tab. Reinspection is allowed only from that same source while the session remains live. A different source tab/origin, expired session, consumed nonce, oversized response, or malformed request fails without returning descriptors.

ApplyFill may run its local mapper over this response. Deterministic matching remains preferred; local AI can classify ambiguous labels and propose narrative mappings using only the returned safe descriptors and AI-safe profile projection.

### 2. Send the final scoped handoff

The same ApplyFill source tab then sends the final packet. This consumes the nonce:

```ts
await chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'applyfill.handoff',
  protocolVersion: 'applyfill.autofill.v1',
  targetTabId,
  nonce,
  expiresAt: Date.now() + 60_000,
  values: [
    {
      sourceKey: 'contact.email',
      semantic: 'email',
      displayLabel: 'Email',
      value: 'person@example.test',
    },
  ],
  proposals: [
    {
      fieldId: 'af-0-example',
      sourceKey: 'contact.email',
      classification: 'deterministic',
      confidence: 1,
      reason: 'Matched the email autocomplete token.',
    },
  ],
  selectedDocument: {
    documentId: 'opaque-resume-id',
    versionId: 'opaque-version-id',
    fileName: 'Ada-Lovelace-Resume.pdf',
  },
});
```

Both boundaries reject unknown properties, wrong protocol versions, duplicate or unknown source keys, invalid tabs/nonces, messages above 64 KiB, more than 120 fields, strings above their bounds, and lifetimes beyond five minutes. A handoff is rejected unless the same origin/source tab successfully inspected the live session first. Production origins are `https://applyfill.app` and `https://www.applyfill.app`; local development is restricted at runtime to `localhost` or `127.0.0.1` on ports 5173 and 4173.

Only bounded, redacted inspection descriptors may enter ApplyFill's local-AI mapper. Any proposed value comes from a scoped local value selected by deterministic application code; the model cannot query IndexedDB or add new tools/profile fields.

ApplyFill may send an empty `proposals` array. The extension maps recognized autocomplete tokens and labels deterministically; ambiguous controls remain manual.

Sensitive values may be included only after ApplyFill has completed mapping and the user has approved that individual value. Such a scoped value must add a `userApprovedAt` integer timestamp from the preceding 60 seconds. Non-sensitive values must omit that property. The extension then requires a second, immediate confirmation before insertion. This timestamp is a protocol invariant, not a substitute for ApplyFill's visible approval UI.

`selectedDocument` carries display metadata only—never file bytes, a filesystem path, or a profile record. ApplyFill keeps the selected version authoritative and provides the download; the extension reminds the user which local file to upload manually.

### Disconnect from ApplyFill

Settings can destroy a connected in-memory extension session without opening the popup. Send the request from the same approved ApplyFill tab that created the handoff, using the same target tab and nonce:

```ts
const response = await chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'applyfill.disconnect',
  protocolVersion: 'applyfill.autofill.v1',
  targetTabId,
  nonce,
});
```

Successful response:

```json
{ "ok": true, "cleared": true }
```

Unknown properties, invalid versions/tabs/nonces, messages above 1 KiB, a different ApplyFill origin, a different source tab, or a session that is absent/expired return `{ "ok": false, "error": "..." }` without exposing packet content. ApplyFill should discard its own handoff state regardless of the response so its disconnect action remains fail-closed.

## Review and completion

The popup lists the label, mapping source, masked proposed value, confidence, and reason. Users can edit non-sensitive proposals, deselect them, or mark them manual. Sensitive values are read-only in the extension, require an intentional reveal, and require a separate checkbox immediately before fill.

The report contains only field labels, status, and a bounded generic error. Possible statuses are `filled`, `skipped`, `unsupported`, `changed-by-site`, and `failed`. The user must inspect the final page and submit it manually.

## Release procedure

1. Update the package and manifest versions together.
2. Review production origins and permission changes. Do not silently expand either.
3. Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build`.
4. Inspect `dist/manifest.json` and confirm the package contains no remote script URLs or source maps.
5. Browser-test the unpacked build on local synthetic static and controlled-component forms.
6. Zip the contents of `dist/` for Chromium distribution. Do not package `src/`, tests, dependencies, or local data.
7. Record unsupported site patterns as limitations; permission expansion requires an explicit security review.

Build output is generated and ignored by Git. Cloudflare/static ApplyFill deployment remains separate from extension distribution.
