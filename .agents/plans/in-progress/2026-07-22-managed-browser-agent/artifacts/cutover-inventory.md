# Extension, browser AI, and storage cutover inventory

| Retired subsystem | Replacement evidence | Disposition |
| --- | --- | --- |
| `extension/` package, popup, pairing/session stores, content/background scripts | Managed Browser Worker, Browser Agent route, durable run APIs, SignalR stream | Deleted |
| `/autofill-assist`, extension IDs, connection codes, tab handoff | `/agent` and `/agent/:runId`, persistent managed context | Deleted |
| Browser LiteRT/WebNN/WebGPU runtime and model cache | Local native Private AI service and catalog | Deleted |
| Browser model manifest/chunks, service worker, Cloudflare/Wrangler static deployment | Local launcher, API/worker proxy, verified native artifacts | Deleted |
| Authoritative IndexedDB profile/resume/tracker database | PostgreSQL 18 resources and typed API clients | Deleted |
| Quill/HTML persistence | Restricted structured rich text with client/server validation | Deleted |
| Extension/local-AI gallery and protocol documentation | Current Browser Agent, settings, resume-import, tracker, profile, and resume captures | Deleted/replaced |

The development cutover policy is an intentional reset. The previous browser-authoritative build was not a production release, so no permanent legacy reader or dual writer remains. Only non-authoritative date-format preference storage remains in the browser.
