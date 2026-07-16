# ApplyFill Frontend

Vite React application for ApplyFill, the reusable job-application profile builder and workspace.

## Current Routes

- `/` — customizable dashboard and application pipeline
- `/job-profile` — reusable profile review screen
- `/job-profile/wizard` — profile-builder workflow
- `/job-tracker` — browser-local job tracker
- `/resumes` — targeted-resume workspace scaffold
- `/settings` — persisted regional date-format preference and planned integration status

The dashboard, profile workflow, job tracker, theme, and date-format preference persist in browser `localStorage`. They are not yet synchronized to the API.

## Development

```powershell
pnpm install --frozen-lockfile
pnpm dev -- --host 127.0.0.1
```

## Checks

```powershell
pnpm build
pnpm lint
```
