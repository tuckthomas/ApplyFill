# Verification matrix

| Layer | Deterministic gate | Real dependency | Result |
| --- | --- | --- | --- |
| Domain/API/persistence | xUnit | PostgreSQL 18 Testcontainers | **SUCCESS** 26 tests |
| Browser Worker | xUnit, deterministic browser/model doubles, Playwright smoke | Managed Chromium | **SUCCESS** 76 tests |
| Private AI | Provider/catalog/installer/service contract tests | llama.cpp-compatible manifests | **SUCCESS** 15 tests |
| Synthetic ATS | Local 13-step fixture | Managed Chromium | **SUCCESS** 5 tests |
| Frontend | Vitest + Testing Library | API/worker clients are mocked at component boundaries | **SUCCESS** 47 tests in 15 files |
| Frontend static gates | Oxlint, TypeScript, and Vite production build | pnpm 11.7 project toolchain | **SUCCESS** |
| Local launcher | Pester | Docker, PostgreSQL, .NET, Node, Chromium | **SUCCESS** 5 tests and full-stack start/status drill |
| Dependency audit | NuGet and pnpm audits | Current lockfiles | **SUCCESS** no known vulnerabilities |
| Formatting | `dotnet format --verify-no-changes` | .NET 10 SDK | **SUCCESS** no changes required |

Real-model/hardware acceptance is documented separately in `model-evaluation.md`: the pinned PaddleOCR-VL/Qwen3-VL 8B pipeline completed the attached two-column resume on the RTX 2070 in 209.4 seconds. Real public job sites are deliberately excluded from automated tests because they are mutable and could cause external submissions. A human release candidate must complete the manual gates recorded in `release-verification.md`.
