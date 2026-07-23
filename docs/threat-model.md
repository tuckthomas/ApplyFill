# Managed Browser Agent threat model

**Version:** 2026-07-22  
**Applies to:** the supported local ApplyFill topology described in [architecture.md](architecture.md)  
**Review trigger:** any remote/LAN access, cloud inference, external identity provider, new browser-control channel, updater, or packaging change

## Security objective

ApplyFill helps one signed-in operating-system user prepare resumes and complete job applications with a locally managed browser and local Private AI. Its security boundary must ensure that untrusted pages and model output cannot acquire more authority than the user granted, that sensitive answers are disclosed only at an explicit boundary, and that ordinary diagnostics do not become a second store of private data.

The first release is local-only. It does not claim to protect data from an administrator, malware running as the same operating-system user, physical access to an unlocked machine, or a compromised operating system.

## Supported trust boundary

| Component | Trust level | Authority | Required channel controls |
| --- | --- | --- | --- |
| React UI | Trusted presentation client, but not a durable authority | Displays backend projections and sends explicit user commands | Approved loopback origin, anti-forgery command header, bounded API contracts, optimistic concurrency |
| ASP.NET Core API | Primary policy and ownership authority | Owns validation, persistence, sensitive approvals, artifacts, and application-run state | Loopback bind, installation ownership, authenticated service boundaries, idempotency, rate limits |
| PostgreSQL 18 | Durable authoritative store | Stores substantive records and protected sensitive payloads | Local/private connection only, database credentials, least privilege, no public port |
| Browser Worker | Privileged local service | Owns Playwright Chromium, observation, input relay, action execution, and checkpoints | Loopback service token, origin checks, owner/run scope, bounded action vocabulary |
| Managed Chromium profile | Privileged local state | Holds job-site cookies, history, storage, downloads, and live authentication state | Dedicated ApplyFill profile, local filesystem protections, no remote debugging exposure |
| Private AI services | Untrusted inference result inside a trusted local process boundary | Propose structured observations, mappings, and writing output | Loopback only, allowlisted context, versioned schemas, deterministic validation, no arbitrary tools or cloud fallback |
| Artifact store | Trusted local file store | Holds approved resumes, cover letters, and generated documents | Owner-scoped paths, MIME/size checks, digest verification, path traversal prevention |
| Job and identity-provider sites | Hostile/untrusted | Render pages and receive only normal browser traffic and approved user data | Approved domain graph, navigation policy, postcondition checks, human handoffs |
| Installer, updater, package, browser, and model distribution channels | Untrusted supply chain until verified | Introduce executable code and model artifacts | Pinned versions, checksums/signatures where available, license review, rollback/withdrawal process |

The UI, API, worker, database, model services, and internal browser interfaces must remain on loopback or private process/container networks. Job-site traffic leaves the device through managed Chromium because that is the intended application workflow. No internal control endpoint may be exposed merely because it uses an uncommon port.

## Protected asset inventory

| Asset | Sensitivity | Primary protection |
| --- | --- | --- |
| Names, addresses, email, phone, links, employment, education, skills, projects | Private | Installation ownership, API validation, PostgreSQL access controls |
| Government identifiers and international equivalents | Restricted | Separate application-only payload, application-layer encryption, masked ordinary views, one-use approval boundary |
| Work authorization, sponsorship, voluntary demographic, veteran, disability, and legal answers | Restricted | Separate protected payload or explicit per-application approval; excluded from ordinary model context |
| Passwords, MFA codes, security answers, browser cookies, and session storage | Restricted credentials | Human-only entry and managed-browser profile; never profile fields, prompts, checkpoints, or logs |
| Resumes, cover letters, uploads, downloads, and generated artifacts | Private files | Owner-scoped artifact paths, validation, explicit selection and deletion |
| Job descriptions, page text, accessibility data, screenshots, and current URLs | Private and untrusted | Minimized observation, in-memory processing by default, sanitized summaries |
| Application answers, action history, pending questions, and run checkpoints | Private | Owner-scoped PostgreSQL records, closed summary codes, bounded retention |
| Prompts and raw model output | Private and untrusted | In memory by default; excluded from logs, durable checkpoints, and ordinary diagnostics |
| Data Protection keys, service tokens, database credentials | Restricted secrets | Stored outside PostgreSQL and source control; operating-system protection; never logged |
| Model, runtime, browser, package, and container binaries | Integrity-critical | Pinned versions, digest verification, controlled activation |

## Threat actors and failure cases

| Threat | Example | Required response |
| --- | --- | --- |
| Hostile ATS page | Hidden instructions request profile secrets or unrelated navigation | Treat all page content as data; deterministic policy rejects expanded authority |
| Prompt injection | Job text tells the model to reveal prompts, files, cookies, or profile data | The model receives only an allowlisted projection; output remains a proposal checked by policy |
| Visual/structural deception | CSS hides a field, labels disagree, or a honeypot resembles a normal input | Compare visual and browser-observed structure; pause on mismatch or unsupported controls |
| Malicious redirect or popup | Application opens an unrelated origin or browser-internal URL | Allow only the reviewed application and identity-provider domain graph; block prohibited schemes and local/internal targets |
| Data exfiltration attempt | Page requests local files, browser storage, another application, or arbitrary download | Refuse the action; never give the model arbitrary filesystem, script, or browser-tool access |
| Model error or compromise | Model emits an invalid action, fabricated success, or sensitive value | Closed schemas, server policy, current handles, action bounds, postcondition verification, human approval |
| Duplicate or uncertain submission | Timeout occurs after a final-submit click | Persist submission intent before the click and never automatically retry an uncertain outcome |
| Compromised model/browser artifact | Download is replaced in transit or repository content changes | Verify pinned digest before activation; fail closed and retain last-known-good version |
| Local malware or another local user | Process memory, browser profile, database, or screen is inspected | Outside the application security boundary; rely on OS account isolation, disk encryption, lock screen, and device hygiene |
| Exposed debugging/service port | Another process or LAN host sends browser commands | Loopback/private binding, service credentials, origin checks, no remote debugging publication |
| Dependency/update compromise | Package, installer, container, or model update contains malicious code | Pin, scan, verify, document licenses, support withdrawal and rollback before release |
| Resource exhaustion | Huge page, JSON, upload, model output, loop, or repeated validation failure | Payload/action limits, cancellation, timeouts, rate limits, loop detection, bounded retries |
| Secret loss | Data Protection key directory is deleted or mismatched during restore | Protected values remain unreadable; documentation must not promise recovery |

## Deterministic policy matrix

Model output never grants authority. The API/orchestrator must approve an action after validating the current run, control lease, page generation, domain graph, target handle, and arguments.

| Action or data | Default | Required approval or validation | May be sent to a model? |
| --- | --- | --- | --- |
| Observe visible application page | Allow within active run | Approved origin/domain graph; bounded screenshot and semantic snapshot | Only the minimum observation needed for the approved task |
| Fill ordinary profile fields | Allow when an exact reviewed mapping exists | Current handle, supported control, value validation, postcondition check | Only non-restricted allowlisted values |
| Answer an unknown or ambiguous question | Pause | User supplies or approves the answer | Question text may be used; restricted answer is excluded |
| Username/password/security answer | Human only | User owns control lease and types directly in managed Chromium | Never |
| MFA or CAPTCHA | Human only | User owns control lease | Never |
| Government identifier | Deny by default | Explicit per-field approval, exact target control, one-use plaintext consumption | Never |
| Work authorization or sponsorship | Restricted | Exact deterministic mapping plus configured approval policy; otherwise per-application approval | Never as plaintext |
| Voluntary demographic, disability, veteran, background-check, arbitration, signature, or legal attestation | Pause | Per-application user decision | Never as plaintext |
| Upload resume or cover letter | Allow only after selection | Server-addressable approved artifact, MIME/size/path validation, exact upload control | Artifact bytes are not sent to the page-understanding model |
| Intermediate page navigation | Allow | Within approved domain graph; bounded action; result verified | Model may propose, policy decides |
| New domain, popup, or identity-provider transition | Pause or allow only if reviewed | Domain-graph approval and same run/session ownership | URL query/fragment and secrets excluded from logs/prompts |
| Download | Deny by default | Explicit product workflow and validated destination/type are required | No arbitrary model-requested download |
| Local file, browser-internal URL, localhost administration page, executable, script, shell, payment, purchase, message, account/credential change, withdrawal, or unrelated application | Deny | No model or page content can override this rule | Never |
| Final submission | Pause by default | Explicit approval bound to the exact application and current review state | Model cannot authorize |
| Retry after uncertain final submission | Deny | User investigates and starts a new explicit decision | Never automatic |
| Pause, take control, or stop | Allow immediately | Server-owned lease transition; queued agent actions cancelled first | No model approval required |

## Logging, diagnostics, and telemetry policy

- Ordinary logs may contain content-free identifiers, timestamps, closed status/action/failure codes, sequence numbers, durations, and exception types.
- Logs must not contain profile values, page values, full sensitive URLs, query strings, fragments, credentials, cookies, authorization headers, service tokens, connection strings, prompts, screenshots, raw DOM/accessibility snapshots, uploaded documents, raw model responses, or decrypted fields.
- Checkpoints persist recovery state and user-visible closed summaries, not hidden model reasoning or chain-of-thought.
- ApplyFill adds no remote analytics or remote diagnostic upload in this local release.
- Bug reports must use synthetic data. Users should inspect every attachment before sharing it.

## Supply-chain and network rules

- Pin application, .NET, pnpm, PostgreSQL, Playwright/Chromium, model, runtime, and container versions.
- Verify downloaded model artifacts and managed binary artifacts with declared checksums before activation.
- Model services must not fetch arbitrary remote code, trust repository-provided code, fetch remote images, or silently fall back to cloud inference.
- Internal database, model, worker, and browser-debugging interfaces stay on loopback/private networks. Only managed Chromium makes ordinary job-site and identity-provider requests.
- A remote or LAN deployment requires a separate reviewed identity, TLS, authorization, network, retention, and threat model. It is not enabled by this document.

## Accepted residual risks and user-visible limitations

These risks are accepted only for the local, single-operating-system-user product boundary. They must be reconsidered before remote access or a general release installer is approved.

1. **Local administrator and same-user malware access:** ApplyFill cannot defend secrets from an administrator, malware with the user's permissions, memory inspection, screen capture, or an unlocked device. Users must protect the OS account and use full-disk encryption where appropriate.
2. **Managed-browser profile protection:** retained cookies and browser storage rely on operating-system account and disk protections; the browser profile is not independently application-encrypted today. Delete retained runs/browser data when persistence is unnecessary.
3. **Necessary disclosure to job sites:** approved answers and selected files leave ApplyFill when inserted or uploaded through the job site's normal browser flow. ApplyFill cannot control the site's later storage, sharing, or breach risk.
4. **Model fallibility:** local models can misunderstand layouts and questions. Deterministic policy reduces authority but cannot guarantee completion or correctness. Unsupported, ambiguous, sensitive, and legally material cases pause for the user.
5. **Prompt-injection detection limits:** known suspicious patterns and deterministic action restrictions are enforced, but no detector can promise to recognize every adversarial phrase or visual deception. Visual/structural disagreement must fail closed.
6. **Authentication challenges:** ApplyFill does not bypass CAPTCHA, MFA, security questions, or identity verification. The user must take control without entering those values into the profile.
7. **Key loss is irreversible:** losing the matching Data Protection key directory can make protected values permanently unreadable, including after a database restore.
8. **Backups and exported files:** PostgreSQL backups, artifact backups, downloaded resumes, and exported JSON remain sensitive outside ApplyFill and must be protected and deleted by the user.
9. **No remote-access security claim:** binding services to a LAN/public interface is unsupported. Loopback-only controls are insufficient for remote deployment.
10. **Supply-chain residual risk:** hashes prove downloaded bytes match the pinned manifest, not that an upstream binary or model is benign. Releases still require dependency, license, secret, container, and manual security review.

## Security review checklist

Before release-like real-site testing:

- Review this model and [data-retention.md](data-retention.md) against the shipped topology.
- Run authorization, ownership, idempotency, schema-fuzzing, redaction, race, prompt-injection, exfiltration, exposed-port, and dependency/security scan suites.
- Test pause, take control, emergency stop, worker recovery, final approval, and uncertain-submission behavior end to end.
- Verify browser-profile, artifact, upload, download, frame, and observation cleanup.
- Inspect published ports and outbound connections from the packaged configuration.
- Record unresolved risks and obtain explicit human security approval; automated test success is not that approval.
