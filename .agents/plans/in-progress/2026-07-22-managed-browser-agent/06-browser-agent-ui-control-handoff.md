# Workstream 06 — Browser Agent UI and Human-Control Handoff

**Status:** Implemented — release acceptance pending
**Depends on:** Workstream 01 client contracts, Workstream 03 stream/input protocol, Workstream 04 run states  
**Unblocks:** User acceptance and operational control

**Outcome/evidence (2026-07-22):** Browser Agent now has first-class routes, persistent navigation, setup/history/live-workspace surfaces, streamed viewport controls, plain-language state and handoff UI, automatic SignalR reconnect/re-watch and REST resynchronization, explicit recovery, masked sensitive-answer approval, final review, destructive-stop confirmation, and friendly retry states across substantive pages. Dashboard layout/text and date format persist through PostgreSQL-backed settings with ETag concurrency. The frontend suite passes 47 tests across 15 files; lint and the production build also pass. Release acceptance still requires durable “save to profile” behavior, full Playwright handoff/reload/final-review coverage, the seven-state screenshot matrix, screen-reader/contrast/responsive QA, and real-user usability review.

## Objective

Add a Browser Agent workspace inside ApplyFill's existing main layout. The user must always understand what application is running, whether the agent or user controls the browser, what is happening next, and how to pause, stop, take control, answer a question, or resume.

## Route and navigation

- [x] Add a first-class `/agent` or reviewed equivalent route under the existing header/sidebar layout.
- [x] Add a persistent sidebar destination named in ordinary product language such as **Browser Agent**.
- [x] Add run list/history access without replacing the main live-workspace route.
- [x] Support deep links to a specific application run while enforcing ownership and authorization.
- [x] Preserve current run context when navigating between ApplyFill panels where safe; warn before leaving actions that would relinquish user control.
- [x] Remove extension-oriented navigation and settings only during the approved cutover workstream.

## Ordinary-user setup experience

- [x] Present one setup action named **Set Up Private AI** when the required local capability is not ready.
- [x] Do not ask the user to choose a model, provider, runtime, accelerator, quantization, GPU layer count, context size, port, API URL, container, or Python environment.
- [x] Check hardware and disk space automatically before downloading anything.
- [x] Explain the download size and that Private AI stays on this computer in one short paragraph.
- [x] Show plain percentage/progress stages rather than bytes, tokens, layers, shards, or runtime logs.
- [ ] After setup, show only **Private AI is ready**, update/remove actions, and ordinary recovery guidance.
- [ ] If the internal model/runtime changes in a future update, present it as a Private AI update; do not make the user repeat setup or learn the new implementation.
- [ ] Keep troubleshooting details inside a collapsed **Advanced diagnostics** area with a copyable content-free report.
- [ ] Verify every setup and failure message with non-technical usability review.

## Workspace layout

- [x] Keep the existing ApplyFill header, sidebar, tokens, typography, focus language, and responsive behavior.
- [x] Place a persistent control toolbar directly above the live browser viewport.
- [x] Include clear **Pause**, **Stop**, **Take Control**, **Return to Agent**, and context-appropriate **Resume** actions.
- [x] Show the target company, job title, current domain, application stage, run status, and control owner without exposing a raw diagnostic panel.
- [x] Render the live browser viewport as the dominant workspace content.
- [x] Add a compact activity/progress surface for completed steps, current action, pending questions, and recoverable errors.
- [x] Avoid nested decorative cards and do not shrink essential status text to `text-xs`.
- [x] Support intermediate desktop widths and a deliberate small-screen limitation or layout; do not silently make the browser unusable.

## Control states

- [x] Visually distinguish `Agent running`, `Pausing`, `Paused`, `You have control`, `Waiting for you`, `Recovering`, `Ready for review`, `Stopped`, and `Completed`.
- [x] Make **Pause** immediately available during every agent-controlled state.
- [x] Make **Take Control** available without navigating to settings or completing a reconnection flow.
- [x] Confirm destructive **Stop** behavior and explain whether the browser session/checkpoint will be retained.
- [ ] Disable controls only with a visible reason, not an unexplained inactive appearance.
- [ ] Show a brief handoff transition so the user knows when input is safe.
- [x] Prevent viewport input while the agent owns control and prevent agent actions while the user owns control.
- [x] Recover the visible control state from the backend after reload; do not infer it from stale React state.

## Live viewport interaction

- [x] Fit the remote viewport without distorting aspect ratio.
- [x] Provide fullscreen/focus mode while preserving an always-available route back to ApplyFill controls.
- [x] Map pointer and keyboard focus predictably into the managed browser while the user has control.
- [x] Show connection loss, stale frame, resizing, and reconnection states over the viewport without pretending it is live.
- [x] Ensure browser focus does not trap the user; provide an accessible shortcut and visible control to leave the viewport.
- [x] Display the actual page URL/domain through trusted backend metadata, not only page-rendered pixels.

## Questions and intervention

- [x] Present one pending question at a time with application context and the exact visible options.
- [ ] Let the user answer, choose whether to save the answer to their profile, or take manual control.
- [x] Provide explicit handoffs for login, MFA, CAPTCHA, sensitive disclosures, legal attestations, and unsupported controls.
- [x] Do not expose internal prompt text, token counts, model names, schemas, handles, or processor terminology in ordinary flows.
- [ ] After manual intervention, show what changed and what the agent will do when control returns.

## Final review and submission

- [x] Distinguish ordinary intermediate review pages from the final submission checkpoint.
- [ ] Summarize answered sections, selected resume/cover letter, unresolved warnings, sensitive disclosures, and any user-modified fields.
- [x] Keep final submit disabled until the current page is verified as the intended application and the configured approval is recorded.
- [x] Make submission status unambiguous: not submitted, submitting, confirmed, or uncertain.
- [x] If confirmation cannot be proven, stop and ask the user rather than retrying submission.

## Run history

- [x] Show durable human-readable checkpoints and decisions, not chain-of-thought or raw model output.
- [x] Let users reopen paused/stopped/recoverable runs.
- [x] Let users delete a run and understand which browser/session/transient data is removed.
- [ ] Connect completed runs to the Job Tracker without creating duplicate records.
- [x] Show why a run failed and the safe next action.

## Accessibility

- [x] Preserve semantic headings and landmarks around the streamed browser surface.
- [ ] Give every control an accessible name, visible focus, and keyboard activation.
- [x] Announce run/control state changes through polite live regions; reserve assertive alerts for immediate user action or safety stops.
- [x] Make control ownership understandable without relying on color alone.
- [ ] Ensure toolbar and intervention dialogs meet WCAG AA contrast in light and dark themes.
- [x] Respect reduced motion and avoid flashing/high-frequency frame transitions around status overlays.
- [ ] Test screen-reader navigation into and out of the viewport wrapper; document inherent limitations of pixel-streamed third-party pages.

## Responsive and visual QA

- [ ] Test common desktop sizes, sidebar collapsed/expanded, browser zoom, long employer/job names, and long error/question copy.
- [ ] Test light/dark themes and Windows high-contrast behavior where supported.
- [ ] Verify controls remain visible while the page scrolls or the viewport enters focus mode.
- [ ] Capture screenshots for idle, agent-running, user-control, awaiting-user, final-review, failure, and completed states.
- [x] Update `.agents/design/DESIGN.md` when the shared browser viewport, control toolbar, status, and handoff patterns are implemented.

## Focused tests and exit criteria

- [ ] Component-test every run/control state and command failure.
- [ ] Browser-test pause, take control, manual edit, return control, stop, reload recovery, pending question, and final review.
- [x] Verify no extension ID, pairing, connection-code, processor selector, or raw runtime status appears.
- [ ] Real users can understand and control the application run without reading technical documentation.
