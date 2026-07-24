# Third-Party Notices

ApplyFill depends on open-source software. Exact resolved package versions are recorded in `Directory.Packages.props`, `frontend/pnpm-lock.yaml`, the PostgreSQL image digest in `compose.yaml`, and the manifests under `private-ai/catalog/`. Upstream license files and notices remain authoritative.

## Application runtime

- .NET / ASP.NET Core 10 — MIT License.
- Entity Framework Core 10 — MIT License.
- Npgsql Entity Framework Core provider 10 — PostgreSQL License.
- Konscious.Security.Cryptography.Argon2 and Blake2 — MIT License.
- Microsoft Playwright 1.61 and its managed browser distribution — Apache License 2.0 and the browser vendors' applicable notices.
- PostgreSQL 18.4 — PostgreSQL License.

## Frontend

- React and React DOM 19 — MIT License.
- Vite 8 — MIT License.
- Microsoft SignalR JavaScript client 10 — MIT License.
- Tiptap 3 — MIT License.
- PDF.js (`pdfjs-dist`) — Apache License 2.0.
- Mammoth.js — BSD 2-Clause License. ApplyFill extracts raw text and does not render Mammoth-generated HTML.
- React PDF, PDF-Lib, and docx — see their upstream package notices and the exact versions in `frontend/pnpm-lock.yaml`.

## Private AI runtimes and models

Model weights and native runtimes are not checked into this repository. ApplyFill's setup flow downloads revision-pinned artifacts only after user approval and verifies the sizes and SHA-256 values recorded in `private-ai/catalog/`.

- llama.cpp runtime manifests identify MIT-licensed upstream builds.
- Qwen3-VL model manifests identify Apache-2.0 upstream artifacts.
- PaddleOCR-VL model manifests identify Apache-2.0 upstream artifacts.

Review the upstream revision's model card, acceptable-use terms, training-data notice, and bundled license files before redistributing any runtime or model artifact. Updating a URL, revision, checksum, runtime, quantization, or license requires a catalog review and a new evaluation record.
