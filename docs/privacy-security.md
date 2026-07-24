# Privacy and security

The formal security boundary, hostile-actor analysis, policy decisions, and accepted residual risks are documented in [Managed Browser Agent threat model](threat-model.md). Field-level storage, backup, expiry, and deletion rules are documented in [Data retention and deletion](data-retention.md).

## In plain language

ApplyFill keeps its database, browser sessions, Private AI, screenshots, prompts, artifacts, and action history on your computer. It does not create an ApplyFill cloud account. Job sites still receive the information you enter or approve through normal browsing, and files you export are no longer controlled by ApplyFill.

The Browser Agent cannot make a computer safe from malware, another signed-in user, screen recording, a malicious job site, or an unsafe downloaded file. Protect the operating-system account and keep the machine updated.

## Sensitive profile data

Government identifiers and other application-only answers are separated from ordinary profile content. The API protects that payload with installation-bound ASP.NET Core Data Protection keys; Windows installations protect key material with DPAPI. Revealing the payload requires an explicit sensitive action. Identifiers must remain masked in ordinary views and are never included in resumes or writing prompts.

Company sign-in passwords use a separate cross-platform credential vault. The user-created vault password is processed with Argon2id to derive an encryption key; the vault password and derived key are not stored in PostgreSQL. Password records use AES-GCM authenticated encryption. The derived key remains in memory only while the vault is unlocked and expires after inactivity. A credential selected for an application is sent directly to the managed-browser worker over the authenticated loopback service connection and is excluded from model prompts, checkpoints, activity history, and logs.

Do not collect date of birth, citizenship, or detailed immigration status. Work authorization and sponsorship questions use the neutral form commonly found on job applications.

## Private AI boundary

Private AI runs locally. Resume writing and application reasoning receive the minimum allowlisted information needed for the task. Names, contact details, street addresses, government identifiers, authorization and sponsorship answers, demographics, reasons for leaving, supervisor details, and company phone numbers are excluded from resume-writing prompts.

Job pages, resumes, and model output are untrusted data. They cannot change system policy, request secrets, authorize tools, or bypass a response schema. Model output must pass closed validation and becomes a proposal, not an instruction executed directly.

## Managed browser safeguards

- Only loopback/local trusted boundaries may control the worker.
- Every browser session belongs to one installation owner and has bounded access credentials.
- User and agent control are exclusive.
- Login, MFA, CAPTCHA, sensitive disclosures, legal attestations, file uploads, and unsupported controls can require a handoff.
- Navigation and actions are limited to the active application objective and approved origins.
- Hidden fields, honeypots, prompt injection, downloads, and unrelated/exfiltration navigation must fail closed.
- Final submission requires explicit approval and uncertain submission is never automatically retried.

## Retention and deletion

PostgreSQL holds substantive records. Local artifacts and Data Protection keys use configured local directories. Browser sessions and transient frames should be removed when their retention window expires, a run is deleted, or the user selects delete-data. Logs and diagnostics must not contain profile contents, page values, credentials, cookies, prompts, screenshots, or model responses.

Deletion must name what will be removed. Uninstalling the application and deleting user data are separate choices.

The retained managed-Chromium profile may contain cookies and browser storage. It currently relies on operating-system account and disk protections rather than independent ApplyFill encryption. Treat the local device account as part of the privacy boundary and delete retained browser data when it is no longer needed.

## Backup and restore

Back up PostgreSQL and the matching Data Protection key directory together. Store backups securely: they may contain private application history. Restoring a database without its original keys leaves protected values intentionally unreadable.

Development scripts are in `scripts/database/`. Validate backups with a restore test before relying on them.

## Reporting

Do not include real resumes, government identifiers, credentials, cookies, or private job-application screenshots in bug reports. Reproduce with synthetic data and attach only content-free diagnostics.
