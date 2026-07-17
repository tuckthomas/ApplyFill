# ApplyFill Agent Documentation

This directory contains repository guidance intended for AI coding agents and future maintainers.

Before making frontend or UI changes, agents must read `design/DESIGN.md`, inspect the reusable components it references, and verify the result in the running application. The design document must be updated whenever the shared component inventory, route behavior, or global interaction rules change.

The current frontend is a Vite/React single-page application. Its implemented routes are `/`, `/job-profile`, `/job-profile/builder`, `/job-tracker`, `/resumes`, and `/settings`; legacy `/profile` and `/job-profile/wizard` paths redirect to the Job Profile routes. Browser-local state is intentional for the current frontend slice and must not be described as API-backed persistence.

## Structure

- `design/` - product design system, visual language, accessibility, and interaction rules.
- `planning/` - forward-looking product architecture, implementation direction, and technical decisions. It is not a claim that planned features already exist.
- `tasks/` - implementation-status checklist. Update it when an item is completed, deferred, or superseded.
- `plans/pipeline/` - proposed implementation plans awaiting explicit review and approval. Do not implement these plans.
- `plans/in-progress/` - approved plans currently being executed. Move a plan here only after explicit instruction to begin it.
- `plans/completed/` - completed, superseded, or cancelled plans, updated with their final outcome before the move.

Plans progress in one direction: `pipeline/` → `in-progress/` → `completed/`. A request to review a plan is not approval to start it. Preserve this distinction even when adjacent frontend work is already implemented.

The root `README.md` remains the public project overview and current gallery. The frontend README stays beside the frontend package so its commands and routes remain discoverable in context. The repository `LICENSE` controls the current source-available usage terms; planning notes do not change them.

When a visible application area changes materially, refresh the matching README screenshot from the running frontend and update its caption in the root README. Store gallery assets under `frontend/public/readme/gallery/`; do not present mockups as product screenshots.
