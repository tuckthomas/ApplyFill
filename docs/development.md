# Development guide

## Toolchain

- .NET SDK 10.0.302 or a compatible patch selected by `global.json`
- pnpm 11.7 through Corepack
- PostgreSQL 18.4 through Compose for development
- Microsoft Playwright 1.61 managed Chromium

Restore and build:

```powershell
Copy-Item .env.example .env
# Replace both database password placeholders.
docker compose up -d postgres
dotnet tool restore
dotnet restore ApplyFill.slnx
dotnet ef database update --project src/ResumeBuilder.Infrastructure --startup-project src/ResumeBuilder.Api
dotnet build ApplyFill.slnx --no-restore
```

Install Chromium after the Browser Worker builds:

```powershell
pwsh src/ResumeBuilder.BrowserWorker/bin/Debug/net10.0/playwright.ps1 install chromium
```

Run the API, Browser Worker, and frontend in separate terminals:

```powershell
dotnet run --project src/ResumeBuilder.Api
dotnet run --project src/ResumeBuilder.BrowserWorker
cd frontend
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

## Configuration

The checked-in `appsettings.json` values are development placeholders, not secrets. Put local credentials and stable installation values in ignored development settings or environment variables. Never commit `.env`, database passwords, service tokens, key material, browser profiles, model weights, or real user artifacts.

The API defaults to `127.0.0.1:5180`; the Browser Worker defaults to `127.0.0.1:5098`; Vite uses `127.0.0.1:5173`. All listening addresses must remain loopback-only in the local topology. Use explicit CORS origins and service credentials—never `AllowAnyOrigin`, a public bind address, or wildcard worker authorization.

## Tests

```powershell
dotnet test ApplyFill.slnx --no-build
cd frontend
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Database integration tests require a running container engine. Real-model/hardware tests are opt-in and must record the exact model revision, runtime, GPU/CPU path, latency, peak memory, and fixture corpus. Deterministic CI tests must use fake browser/model adapters and synthetic ATS pages.

## Database operations

Use `scripts/database/backup.ps1`, `restore.ps1`, and `reset-development.ps1`. Confirm the target before a reset. Back up the configured Data Protection key directory with database backups.

## Model changes

Add or update a manifest under `private-ai/catalog/`; do not hard-code model names in user workflows. A candidate must declare revision, checksums, modality, runtime contract, memory profile, approved tasks, and license. Run the same evaluation corpus before activation and retain the previous manifest for rollback.

## Browser changes

Use the managed Playwright context and synthetic fixtures. Preserve mutually exclusive control leases, bounded input, observation/action verification, checkpoints, and explicit final submission approval.

## Security and retention changes

Read [Managed Browser Agent threat model](threat-model.md) and [Data retention and deletion](data-retention.md) before changing API ownership, Browser Agent controls, model context, artifacts, logging, storage roots, backup behavior, or packaging. Update those documents in the same change whenever a new asset, trust boundary, data field, persistence location, network connection, or deletion behavior is introduced.

Security verification must use synthetic seeded secrets and confirm that logs, `ProblemDetails`, checkpoints, diagnostics, and model requests do not contain them. A release candidate also requires explicit cleanup tests for browser profiles, frames, observations, uploads/downloads, pending approvals, artifacts, and each supported deletion scope.
