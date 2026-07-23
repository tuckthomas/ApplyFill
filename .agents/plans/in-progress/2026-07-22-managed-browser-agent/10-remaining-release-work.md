# Remaining Release Work Checklist

**Created:** 2026-07-23  
**Status:** In progress  
**Purpose:** Consolidated execution checklist for the work that remains after the managed-browser development vertical slice

This is the practical release to-do list. The detailed workstream documents remain the source for design constraints and acceptance evidence. Do not mark an item complete based only on implementation existing; record the test, measurement, screenshot, or human result that proves it.

## 1. Reconcile the existing plan suite

- [ ] Audit every unchecked item in workstreams 01–09 against the current implementation.
- [ ] Check off implemented items only when a code, test, measurement, or documentation reference proves completion.
- [ ] Mark obsolete requirements explicitly as superseded instead of leaving stale unchecked boxes.
- [ ] Add links from each remaining item below to its detailed workstream acceptance criteria.
- [ ] Keep the plan suite in `in-progress/` until all release gates and required human tests pass.

## 2. Complete the multi-page Browser Agent product flow

- [ ] Complete at least three distinct application pages in one managed Chromium session, including a redirect or SPA transition.
- [ ] Reach final review without an extension, per-page reconnection, or loss of the original objective.
- [ ] Automatically advance ordinary intermediate pages after verified field completion.
- [ ] Stop before final submission and require explicit user approval.
- [ ] Verify conditional questions for work authorization, sponsorship, location, education, experience, demographics, and availability.
- [ ] Verify page validation errors are detected, explained, corrected where safe, and rechecked before navigation.
- [ ] Verify tailored-resume selection, generation, review policy, and upload in the same application run.
- [ ] Verify popup and new-tab workflows retain the same run, browser context, cookies, and objective.
- [ ] Verify iframe, Shadow DOM, custom select, and file-upload controls against the synthetic ATS.
- [ ] Verify downloads, external protocols, browser permission prompts, certificate errors, and prohibited schemes pause safely.

## 3. Finish user handoff and recovery behavior

- [ ] Verify pause, stop, take control, manual edit, return control, and resume from every applicable run state.
- [ ] Verify agent and user input remain mutually exclusive during every control transition.
- [ ] Verify login, MFA, CAPTCHA, bot checks, session expiry, and access-denied pages produce understandable user handoffs.
- [ ] Verify a missing profile answer becomes a plain-language question and does not trigger model invention.
- [ ] Verify unsupported controls preserve the session and let the user continue manually.
- [ ] Recover the same run after ApplyFill reload, Browser Worker restart, API restart, and a closed popup/tab.
- [ ] Distinguish model, browser, page, transport, database, and policy failures in the UI.
- [ ] Preserve inspection and export options when a run becomes irrecoverable.
- [ ] Verify stopping and deleting runs applies the approved transient-data cleanup policy.

## 4. Complete model and document quality evaluation

- [ ] Benchmark Qwen3-VL 4B and 8B on the RTX 2070 using the same held-out application-page corpus.
- [ ] Record field-detection, field-mapping, action-selection, navigation, abstention, and hallucination metrics.
- [ ] Select the default model from recorded quality and compatibility evidence, prioritizing correctness over latency.
- [ ] Replace the selected Qwen model with a second conforming model through configuration only.
- [ ] Verify the replacement requires no workflow-code, API-contract, or database-schema changes.
- [ ] Run PaddleOCR-VL against a held-out resume corpus containing single-column, multi-column, scanned, table-based, and unusual layouts.
- [ ] Record resume entity, date, section, reading-order, and layout accuracy.
- [ ] Verify malformed output, cancellation, timeout, GPU out-of-memory, runtime crash, and restart behavior.
- [ ] Verify model download, checksum failure, update, rollback, and removal through the packaged UI.
- [ ] Add the successful two-column resume import and its observed limitations to the model-evaluation evidence.

## 5. Validate PostgreSQL operations and data lifecycle

- [ ] Document and test backup, restore, migration rollback, and development reset commands.
- [ ] Complete a backup/restore drill covering a profile, resume, tracker record, and paused application run.
- [ ] Test transaction rollback for partial profile, resume, tracker, and run writes.
- [ ] Test application-layer encryption round-trip, wrong-key failure, masking, deletion, backup, and restore behavior.
- [ ] Test owner isolation for every authoritative record type.
- [ ] Test retention jobs with time-controlled fixtures.
- [ ] Verify screenshots, page observations, cookies, and transient browser state follow the approved retention table.
- [ ] Verify run deletion removes transient state without deleting unrelated profile, resume, or tracker data.
- [ ] Verify every collection, string, JSON document, artifact, checkpoint history, and action history is bounded.
- [ ] Verify phone numbers, dates, URLs, location identifiers, GPA pairs, and enums normalize consistently across frontend and backend.

## 6. Complete accessibility and ordinary-user usability

- [ ] Keyboard-test every Browser Agent control and run state.
- [ ] Screen-reader-test status changes, questions, control ownership, errors, final review, and completion.
- [ ] Test Windows high-contrast behavior where supported.
- [ ] Test all Browser Agent states in light and dark themes.
- [ ] Verify controls remain visible and operable while the managed page scrolls or enters focus mode.
- [ ] Verify narrow desktop layouts, zoom, long employer names, long questions, and long error messages.
- [ ] Give a non-technical tester only the installer and the goal of setting up ApplyFill and beginning an application.
- [ ] Verify setup requires one **Set Up Private AI** action and no model, runtime, provider, accelerator, port, or container knowledge.
- [ ] Verify pause, stop, take-control, recovery, and failure language is understandable without developer explanation.
- [ ] Treat any ordinary-user requirement to open a terminal, Docker Desktop, Ollama, LM Studio, Python, or a model-server UI as a release failure.

## 7. Establish performance and reliability budgets

- [ ] Define acceptable startup, browser-start, first-frame, control-handoff, ordinary-action, checkpoint, and recovery latency.
- [ ] Define CPU, GPU memory, system memory, disk, and frame-bandwidth budgets for idle and active runs.
- [ ] Measure viewport frame latency, text clarity, resize behavior, and input round-trip on representative hardware.
- [ ] Measure OCR and vision-processing latency and peak resource use.
- [ ] Define the maximum supported concurrent runs for the first release.
- [ ] Run sustained multi-page and repeated-run leak tests.
- [ ] Verify cleanup after completion, stop, deletion, model failure, browser crash, and service shutdown.
- [ ] Test low disk, unavailable PostgreSQL, unavailable model, unavailable browser, port conflict, and corrupted-artifact behavior.

## 8. Package and exercise the local product

- [ ] Package or provision .NET 10, frontend assets, managed Chromium, PostgreSQL 18, model runtime, models, and required native libraries.
- [ ] Hide internal processes, ports, providers, models, containers, and database topology from ordinary users.
- [ ] Build a clean-machine installer that reaches the Browser Agent without manual service configuration.
- [ ] Make application, database, browser, runtime, and model updates transactional with last-known-good rollback.
- [ ] Preserve user data during application updates.
- [ ] Clearly separate uninstalling the application from deleting local user data.
- [ ] Test clean install, upgrade, repair, rollback, uninstall-with-data, and uninstall-and-delete-data.
- [ ] Verify licenses and third-party notices are included for every packaged runtime, browser, model, and library.

## 9. Complete security and release verification

- [ ] Run dependency, container, secret, license, and static-analysis scans on the release candidate.
- [ ] Verify no browser debugging endpoint, database listener, model endpoint, session token, or service secret is reachable outside the approved local boundary.
- [ ] Run log, ProblemDetails, trace, and diagnostic redaction tests.
- [ ] Run the adversarial prompt-injection, honeypot, exfiltration, and uncertain-submission corpus with real models.
- [ ] Manually review the packaged build against the threat model and retention table.
- [ ] Complete representative real-job-site applications through final review without unintended submission.
- [ ] Have a human verify the release-like application flow, including intervention and recovery.
- [ ] Run all unit, integration, contract, migration, browser, model-conformance, security, accessibility, and packaging suites.
- [ ] Record exact release-candidate versions, commands, results, failures, and accepted limitations in `artifacts/release-verification.md`.

## 10. Finish documentation and gallery evidence

- [ ] Update the root README after the packaged workflow and user-facing language are final.
- [ ] Capture real product screenshots with synthetic data for Browser Agent idle/start.
- [ ] Capture agent-running and multi-page-progress screenshots.
- [ ] Capture pause, take-control, manual-control, and return-control screenshots.
- [ ] Capture pending-question, resume-upload, and final-review screenshots.
- [ ] Capture failure, recovery, and completed-run screenshots.
- [ ] Capture representative light- and dark-theme screenshots at readable desktop sizes.
- [ ] Remove obsolete gallery images that depict retired extension, browser-only AI, or superseded flows.
- [ ] Verify architecture, privacy, installation, backup/restore, troubleshooting, model/license, and limitations documentation matches the release candidate.

## Release completion gate

- [ ] Every remaining workstream item is completed, evidenced, or explicitly superseded.
- [ ] A clean machine can install and start ApplyFill without manual service surgery.
- [ ] A non-technical user can set up Private AI and control an application run without internal technical terminology.
- [ ] A representative multi-page application reaches final review with safe user handoffs and no extension.
- [ ] Backup, restore, rollback, repair, update, and both uninstall modes pass.
- [ ] Accessibility, security, model-quality, performance, and recovery acceptance pass.
- [ ] Release documentation and gallery images depict the shipped product.
- [ ] Record the final outcome in the suite README and move the complete plan directory to `plans/completed/`.
