# Workstream 04 — Multi-Page Agent Orchestration

**Status:** Pipeline  
**Depends on:** Workstream 01 contracts, Workstream 03 browser actions, Workstream 07 policy rules  
**Unblocks:** End-to-end autonomous application completion

## Objective

Implement a persistent observe–decide–act–verify loop that completes ordinary application steps across many pages, asks the user only when needed, and recovers without losing the application objective. The agent must operate through a bounded action contract, not arbitrary browser code.

## Run state machine

- [ ] Define explicit states: `Created`, `StartingBrowser`, `Navigating`, `Observing`, `Planning`, `AgentRunning`, `Pausing`, `Paused`, `UserControl`, `AwaitingUser`, `Recovering`, `ReviewReady`, `Submitting`, `Completed`, `Stopped`, and `Failed`.
- [ ] Define legal transitions, actor permissions, idempotency, concurrency tokens, and timeout behavior for every state.
- [ ] Keep the run's objective, job identity, selected profile/resume, current page stage, completed requirements, and pending work across every transition.
- [ ] Treat pause as a safe transition after the current atomic action, with an emergency stop that cancels queued actions immediately.
- [ ] Make stop non-destructive by default so the user can inspect or explicitly discard retained state.
- [ ] Make final submission a distinct, auditable transition that requires the configured approval policy.
- [ ] Unit-test every legal and illegal transition exhaustively.

## Observation contract

- [ ] Combine the current screenshot with bounded browser-derived structure: URL/domain, title, visible controls, labels, roles, validation messages, enabled/required state, options, and current non-sensitive values.
- [ ] Assign observation-local handles only for the current page generation; never persist them as cross-page identity.
- [ ] Mark page and job-posting content as untrusted data that cannot redefine system policy.
- [ ] Exclude password values, session tokens, hidden secrets, browser storage, cookies, government identifiers, and unrelated tabs.
- [ ] Bound screenshot resolution/token budget and structural payload size.
- [ ] Detect whether the page is an application step, login/MFA/CAPTCHA, review, confirmation, error, unrelated navigation, or unsupported state.
- [ ] Version and validate every observation before model use.

## Planning and action loop

- [ ] Request a structured page interpretation before requesting actions when the page is unfamiliar or materially changed.
- [ ] Build an allowlisted application context containing only profile fields relevant to visible questions.
- [ ] Resolve straightforward mappings deterministically before model reasoning.
- [ ] Ask the vision model for bounded proposed actions referencing observation-local handles or approved navigation targets.
- [ ] Validate every action against schema, current run state, domain policy, field sensitivity, and user-control ownership.
- [ ] Execute one atomic action or a small rollback-safe batch.
- [ ] Observe and verify the postcondition before marking an action complete.
- [ ] Replan from a fresh observation after navigation, stale handles, unexpected validation, or page mutation.
- [ ] Limit repeated failures, oscillating actions, no-progress loops, total actions, model calls, and elapsed time.
- [ ] Never execute model-provided JavaScript, selectors, shell commands, filesystem paths, network requests, or raw tool definitions.

## Multi-page progression

- [ ] Identify ordinary continuation controls such as Next, Continue, Save and Continue, Review, and application-specific equivalents.
- [ ] Fill all confidently answerable required fields before advancing.
- [ ] Preserve previously supplied answers and detect when a later page requests the same information differently.
- [ ] Handle conditional branches triggered by work authorization, sponsorship, location, education, experience, demographics, and availability answers.
- [ ] Detect client- and server-side validation errors after continuation and correct only supported fields.
- [ ] Recognize successful navigation using URL, document generation, page-stage, and visible-content evidence.
- [ ] Save a checkpoint after each material field group, upload, page transition, user answer, and control handoff.
- [ ] Detect final review separately from ordinary intermediate review pages.
- [ ] Confirm completion using an explicit confirmation page or other approved terminal evidence.

## User questions and handoffs

- [ ] Ask one concise, non-technical question when required information is absent or ambiguous.
- [ ] Explain which application asks the question and why the answer is needed.
- [ ] Offer the relevant visible options exactly as presented without inventing eligibility advice.
- [ ] Save reusable answers only after the user explicitly chooses whether to update their profile.
- [ ] Pause for credentials, MFA, CAPTCHA, legal attestations, disability/veteran/race disclosures, government identifiers, and other policy-gated fields.
- [ ] Let the user take control proactively without waiting for an agent checkpoint.
- [ ] Re-observe the page after user control and reconcile manual changes before continuing.
- [ ] Never overwrite a manual change merely because it differs from an earlier plan.

## Resume and document workflow

- [ ] Choose an approved base resume using job requirements and the user's saved preferences.
- [ ] Invoke resume tailoring only through the approved evidence-bound resume workflow.
- [ ] Present or apply the configured resume-review policy before uploading a generated artifact.
- [ ] Upload the exact approved artifact ID and verify the webpage displays the expected filename.
- [ ] Handle cover-letter questions through separate evidence-bound generation and review rules.
- [ ] Never upload the structured profile export, raw database backup, or application-only sensitive data.

## Recovery

- [ ] Detect API, model, browser, page, transport, and database failures distinctly.
- [ ] Resume from the last verified checkpoint rather than replaying all actions blindly.
- [ ] Re-observe before replaying an action and skip it when the desired state already exists.
- [ ] Recover from session expiry through user login without creating a new run.
- [ ] Recover from closed popup/tab when the primary browser context remains valid.
- [ ] Mark irrecoverable state with a plain explanation and preserve inspection/export options.
- [ ] Prevent a recovered run from submitting twice.

## Checkpoint and audit semantics

- [ ] Store concise action intent, target field/section, result, user/agent actor, timestamps, and page-stage evidence.
- [ ] Do not store hidden chain-of-thought or unrestricted full-page content.
- [ ] Record policy denials, user decisions, corrections, uploads, navigation, and final approval.
- [ ] Make the user-visible activity feed derived from these records rather than raw model text.
- [ ] Compact low-value repetitive wait/scroll observations.

## Verification

- [ ] Run deterministic fake-browser/fake-model scenarios for every state and transition.
- [ ] Cover three-page, ten-page, SPA, redirect, popup, conditional-branch, validation-error, upload, login, CAPTCHA, and final-review fixtures.
- [ ] Inject malicious page text that requests secrets, policy overrides, arbitrary navigation, submission, or filesystem access and prove denial.
- [ ] Verify no-progress and repeated-failure limits.
- [ ] Verify pause/stop/take-control races and stale command rejection.
- [ ] Verify crash recovery does not duplicate answers, uploads, navigation, or submission.

## Exit criteria

- [ ] The agent completes a representative multi-page application to final review with no per-page user reconnection.
- [ ] User control can interrupt and return at any step without losing progress.
- [ ] All actions are validated, verified, checkpointed, and recoverable.

