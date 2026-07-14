# ApplyFill

ApplyFill is a reusable job application profile builder. It stores personal information, work history, education, skills, and resume content once so that structured data can be reused for tailored resumes and faster job application autofill.

## Project Structure

- `frontend/` - Vite React application for the profile and resume builder UI.
- `src/` - .NET backend projects for application, domain, infrastructure, API, and worker services.
- `tests/` - .NET test projects.
- `.agents/` - AI-agent guidance organized by design, planning, and task documentation.

## Agent Documentation

Repository-specific design rules, architecture decisions, and implementation tracking live under [`.agents/`](.agents/README.md). Keep this material in its category directory so future agents can load the relevant guidance without treating every planning document as a root-level project entry point.

## Frontend Development

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

## Frontend Checks

```powershell
cd frontend
npm run build
npm run lint
```

## Backend

Open `ResumeBuilder.sln` with Visual Studio or use the .NET CLI from the repository root.

```powershell
dotnet restore
dotnet build
```
