# Third-Party Notices

This project depends on open-source packages whose exact resolved versions are recorded in `frontend/pnpm-lock.yaml` and `extension/pnpm-lock.yaml`. Their upstream license files remain authoritative.

## Local AI runtime

- LiteRT.js (`@litertjs/core` 2.5.3) — Apache License 2.0.
- LiteRT-LM.js (`@litert-lm/core` 0.14.0) — Apache License 2.0.

## Selected model

- Gemma 4 E2B Instruct LiteRT-LM web artifact, revision `9262660a1676eed6d0c477ab1a86344430854664`.
- Source: `litert-community/gemma-4-E2B-it-litert-lm`.
- Artifact: `gemma-4-E2B-it-web.litertlm`.
- SHA-256: `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`.
- License reported by the revision-pinned model repository: Apache License 2.0.
- Attribution: Gemma 4 E2B Instruct LiteRT-LM web artifact by Google / LiteRT Community.

ApplyFill redistributes only a hash-verified, revision-pinned artifact prepared by `frontend/scripts/prepare-litert-model.mjs`. Review upstream notices again before changing the selected model or revision.
