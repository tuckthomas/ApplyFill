# Workstream 03 — Managed Browser Runtime and Live Streaming

**Status:** Pipeline  
**Depends on:** Workstream 01 interfaces and security review  
**Unblocks:** Multi-page orchestration and Browser Agent UI

## Objective

Run a Chromium browser owned by ApplyFill, preserve one browser context across an entire multi-page application, and stream that live session into ApplyFill's main layout with low-latency, exclusive human/agent control. No browser extension participates.

## Runtime feasibility spike

- [ ] Evaluate Microsoft.Playwright for .NET against the required Chromium/CDP functionality.
- [ ] Compare CDP screencast frames, WebRTC-based streaming, and a reviewed remote-framebuffer approach for latency, fidelity, clipboard/input handling, GPU use, and packaging.
- [ ] Reject iframe embedding as a general solution because external job sites control their framing policy.
- [ ] Measure frame latency, bandwidth, CPU/GPU use, resize behavior, text clarity, and input round-trip on representative hardware.
- [ ] Verify headful, authenticated, multi-page navigation in the proposed local deployment topology.
- [ ] Record browser binary version, update policy, licensing, and security patch process.
- [ ] Choose one transport and document why alternatives were rejected.

## Browser-session lifecycle

- [ ] Create an isolated browser profile/context for each active application run or approved reusable user session.
- [ ] Define when cookies/login state may be reused across applications and how the user deletes it.
- [ ] Keep the same context through normal navigation, redirects, SPA route changes, popups, and new tabs.
- [ ] Track the active job-application page without losing legitimate ATS identity-provider redirects.
- [ ] Detect browser, page, renderer, and transport crashes separately.
- [ ] Reconnect the stream after ApplyFill UI reload without replacing the browser session.
- [ ] Restore a run after worker restart using the latest safe checkpoint and retained browser-profile policy.
- [ ] Bound concurrent browser sessions and reject resource exhaustion predictably.
- [ ] Dispose browser processes, temporary profiles, downloads, and ephemeral frames deterministically.

## Live viewport transport

- [ ] Stream the actual page viewport into a Browser Agent component, preserving aspect ratio and device scale.
- [ ] Negotiate viewport size and pixel density when the ApplyFill panel resizes.
- [ ] Support full-page scrolling without presenting a stale screenshot as live state.
- [ ] Carry frame sequence, viewport dimensions, page generation, and timestamp metadata.
- [ ] Drop obsolete frames and input targeting an old page generation.
- [ ] Backpressure or reduce frame rate when the client cannot keep up.
- [ ] Provide a low-bandwidth/low-frame-rate mode without hiding status or control changes.
- [ ] Ensure frame data is memory-bounded and excluded from ordinary logging/tracing.

## Human input relay

- [ ] Relay pointer move/down/up, wheel, keyboard, text composition, focus, and viewport-resize events while the user owns control.
- [ ] Preserve keyboard layouts, modifier keys, IME/composition, clipboard policy, and accessible focus behavior.
- [ ] Translate client coordinates against the exact acknowledged frame/viewport generation.
- [ ] Reject human input unless the server control lease belongs to the user.
- [ ] Immediately cancel queued agent input when control transfers to the user.
- [ ] Display connection/control state rather than silently dropping input.
- [ ] Prevent ApplyFill keyboard shortcuts from stealing keystrokes while the managed browser owns focus.

## Agent execution API

- [ ] Expose a bounded action vocabulary: navigate, focus, click, type, select, check, scroll, upload approved artifact, open/close tab, wait, and inspect result.
- [ ] Use browser structure and stable handles for execution when available; visual coordinates remain observation-local hints.
- [ ] Invalidate element handles after navigation or meaningful DOM generation changes.
- [ ] Require a postcondition/verification result for every action.
- [ ] Return machine-readable outcomes: succeeded, validation-failed, stale-observation, blocked, navigation-started, user-interrupted, or browser-error.
- [ ] Prevent arbitrary JavaScript, filesystem access, shell commands, unrestricted downloads, or unapproved URLs through the action API.
- [ ] Make uploads reference approved artifact IDs rather than arbitrary local paths supplied by a model.

## Navigation and complex-page handling

- [ ] Detect full navigations, history changes, SPA transitions, network-idle timeouts, and significant DOM mutations.
- [ ] Handle same-origin and cross-origin iframes through browser automation while preserving policy checks.
- [ ] Handle Shadow DOM and custom controls through browser observation/execution adapters.
- [ ] Handle legitimate ATS popups/new tabs and close unrelated advertising/help tabs safely.
- [ ] Pause for downloads, external protocol launches, browser permission prompts, certificate errors, and prohibited schemes.
- [ ] Detect login, MFA, CAPTCHA, bot checks, session expiry, and access-denied pages for user handoff.
- [ ] Do not attempt CAPTCHA bypass or credential-manager extraction.

## Artifacts and file operations

- [ ] Upload only a user-approved resume/cover-letter artifact associated with the current application run.
- [ ] Verify accepted file type, filename, byte size, and checksum before browser upload.
- [ ] Confirm the page reflects the selected file after upload.
- [ ] Capture downloads only when explicitly allowed and store them through the artifact boundary.
- [ ] Clean temporary upload/download files at run completion or expiration.

## Verification

- [ ] Run a synthetic multi-page ATS covering navigation, redirects, SPA updates, iframes, Shadow DOM, custom selects, validation errors, popup tabs, and file upload.
- [ ] Verify the same cookies/session survive every page.
- [ ] Verify UI reload and browser-worker restart recovery.
- [ ] Verify rapid pause/take-control events cannot produce simultaneous user and agent input.
- [ ] Verify stale frame/input/action rejection after navigation.
- [ ] Measure stream latency and resource use against documented budgets.
- [ ] Verify no browser debugging endpoint or session secret is reachable outside the approved local boundary.

## Exit criteria

- [ ] A real multi-page session is visible and controllable inside ApplyFill.
- [ ] Human and agent control transfer without changing sessions.
- [ ] Browser state survives navigation and approved recovery scenarios.
- [ ] The extension is unnecessary for observation, navigation, input, or uploads.

