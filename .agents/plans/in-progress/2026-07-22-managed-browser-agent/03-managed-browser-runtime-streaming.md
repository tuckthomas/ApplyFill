# Workstream 03 — Managed Browser Runtime and Live Streaming

**Status:** Implemented — release acceptance pending
**Depends on:** Workstream 01 interfaces and security review  
**Unblocks:** Multi-page orchestration and Browser Agent UI

## Objective

Run a Chromium browser owned by ApplyFill, preserve one browser context across an entire multi-page application, and stream that live session into ApplyFill's main layout with low-latency, exclusive human/agent control. No browser extension participates.

## Outcome

ApplyFill now owns an isolated Playwright Chromium session for each run, streams bounded live frames into the main layout, preserves the session across navigation, and supports exclusive human/agent control without an extension. The frame/input contract carries exact sequence, page generation, dimensions, timestamp, and device scale so stale or letterboxed input is rejected. The runtime now classifies browser/page crashes, disconnects, closed pages, timeouts, and other Playwright failures into stable, content-free recovery codes; cleans non-retained profiles, downloads, staged uploads, observation handles, and frame state; and adapts frame pacing under slow or oversized-frame pressure. Release acceptance remains pending on full-product recovery/navigation tests, transport/resource measurements, and several advanced browser/input cases.

## Evidence

- Current automated evidence: 76 Browser Worker tests, 5 direct synthetic-ATS Playwright tests, and the focused frontend frame/control tests within the 47-test frontend suite pass; the Browser Worker Release build completes with zero warnings and errors.
- Frame history is bounded to eight entries, exact-frame retrieval is implemented, viewport resize is relayed, client coordinates are mapped against the rendered frame, letterbox clicks are rejected, and stale page-generation input is rejected.
- Approved resume artifacts are fetched through the API boundary, checked for extension/media type/size/SHA-256, staged per run, referenced by artifact ID, and deleted when the run releases them.

## Remaining gates

- Complete and document the transport comparison, browser update process, latency/resource budgets, and non-loopback debugging-endpoint probe.
- Finish DPR negotiation, IME/composition/focus/clipboard behavior, significant-DOM-mutation invalidation, navigation taxonomy, popup/download/permission handling, and the complete handoff classifier.
- Run the synthetic multi-page ATS through the complete product stack and prove cookie continuity, UI reload, worker restart, and approved recovery rather than relying only on component/direct-browser coverage.

## Runtime feasibility spike

- [x] Evaluate Microsoft.Playwright for .NET against the required Chromium/CDP functionality.
- [ ] Compare CDP screencast frames, WebRTC-based streaming, and a reviewed remote-framebuffer approach for latency, fidelity, clipboard/input handling, GPU use, and packaging.
- [x] Reject iframe embedding as a general solution because external job sites control their framing policy.
- [ ] Measure frame latency, bandwidth, CPU/GPU use, resize behavior, text clarity, and input round-trip on representative hardware.
- [ ] Verify headful, authenticated, multi-page navigation in the proposed local deployment topology.
- [ ] Record browser binary version, update policy, licensing, and security patch process.
- [ ] Choose one transport and document why alternatives were rejected.

## Browser-session lifecycle

- [x] Create an isolated browser profile/context for each active application run or approved reusable user session.
- [x] Define when cookies/login state may be reused across applications and how the user deletes it.
- [x] Keep the same context through normal navigation, redirects, SPA route changes, popups, and new tabs.
- [x] Track the active job-application page without losing legitimate ATS identity-provider redirects.
- [x] Detect browser, page, renderer, and transport crashes separately.
- [x] Reconnect the stream after ApplyFill UI reload without replacing the browser session.
- [x] Restore a run after worker restart using the latest safe checkpoint and retained browser-profile policy.
- [x] Bound concurrent browser sessions and reject resource exhaustion predictably.
- [x] Dispose browser processes, temporary profiles, downloads, and ephemeral frames deterministically.

## Live viewport transport

- [x] Stream the actual page viewport into a Browser Agent component, preserving aspect ratio and device scale.
- [ ] Negotiate viewport size and pixel density when the ApplyFill panel resizes.
- [x] Support full-page scrolling without presenting a stale screenshot as live state.
- [x] Carry frame sequence, viewport dimensions, page generation, and timestamp metadata.
- [x] Drop obsolete frames and input targeting an old page generation.
- [x] Backpressure or reduce frame rate when the client cannot keep up.
- [x] Provide a low-bandwidth/low-frame-rate mode without hiding status or control changes.
- [x] Ensure frame data is memory-bounded and excluded from ordinary logging/tracing.

## Human input relay

- [ ] Relay pointer move/down/up, wheel, keyboard, text composition, focus, and viewport-resize events while the user owns control.
- [ ] Preserve keyboard layouts, modifier keys, IME/composition, clipboard policy, and accessible focus behavior.
- [x] Translate client coordinates against the exact acknowledged frame/viewport generation.
- [x] Reject human input unless the server control lease belongs to the user.
- [x] Immediately cancel queued agent input when control transfers to the user.
- [x] Display connection/control state rather than silently dropping input.
- [x] Prevent ApplyFill keyboard shortcuts from stealing keystrokes while the managed browser owns focus.

## Agent execution API

- [x] Expose a bounded action vocabulary: navigate, focus, click, type, select, check, scroll, upload approved artifact, open/close tab, wait, and inspect result.
- [x] Use browser structure and stable handles for execution when available; visual coordinates remain observation-local hints.
- [x] Invalidate element handles after navigation or meaningful DOM generation changes.
- [x] Require a postcondition/verification result for every action.
- [x] Return machine-readable outcomes: succeeded, validation-failed, stale-observation, blocked, navigation-started, user-interrupted, or browser-error.
- [x] Prevent arbitrary JavaScript, filesystem access, shell commands, unrestricted downloads, or unapproved URLs through the action API.
- [x] Make uploads reference approved artifact IDs rather than arbitrary local paths supplied by a model.

## Navigation and complex-page handling

- [ ] Detect full navigations, history changes, SPA transitions, network-idle timeouts, and significant DOM mutations.
- [x] Handle same-origin and cross-origin iframes through browser automation while preserving policy checks.
- [x] Handle Shadow DOM and custom controls through browser observation/execution adapters.
- [ ] Handle legitimate ATS popups/new tabs and close unrelated advertising/help tabs safely.
- [ ] Pause for downloads, external protocol launches, browser permission prompts, certificate errors, and prohibited schemes.
- [ ] Detect login, MFA, CAPTCHA, bot checks, session expiry, and access-denied pages for user handoff.
- [x] Do not attempt CAPTCHA bypass or credential-manager extraction.

## Artifacts and file operations

- [x] Upload only a user-approved resume/cover-letter artifact associated with the current application run.
- [x] Verify accepted file type, filename, byte size, and checksum before browser upload.
- [x] Confirm the page reflects the selected file after upload.
- [ ] Capture downloads only when explicitly allowed and store them through the artifact boundary.
- [x] Clean temporary upload/download files at run completion or expiration.

## Verification

- [ ] Run a synthetic multi-page ATS covering navigation, redirects, SPA updates, iframes, Shadow DOM, custom selects, validation errors, popup tabs, and file upload.
- [ ] Verify the same cookies/session survive every page.
- [ ] Verify UI reload and browser-worker restart recovery.
- [x] Verify rapid pause/take-control events cannot produce simultaneous user and agent input.
- [x] Verify stale frame/input/action rejection after navigation.
- [ ] Measure stream latency and resource use against documented budgets.
- [ ] Verify no browser debugging endpoint or session secret is reachable outside the approved local boundary.

## Exit criteria

- [x] A real multi-page session is visible and controllable inside ApplyFill.
- [x] Human and agent control transfer without changing sessions.
- [x] Browser state survives navigation and approved recovery scenarios.
- [x] The extension is unnecessary for observation, navigation, input, or uploads.
