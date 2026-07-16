# ApplyFill Agent Documentation

This directory contains repository guidance intended for AI coding agents and future maintainers.

Before making frontend or UI changes, agents must read `design/DESIGN.md`, inspect the reusable components it references, and verify the result in the running application. The design document must be updated whenever the shared component inventory, route behavior, or global interaction rules change.

The current frontend is a Vite/React single-page application. Its implemented routes are `/`, `/job-profile`, `/job-profile/wizard`, `/job-tracker`, `/resumes`, and `/settings`; legacy `/profile` paths redirect to the Job Profile routes. Browser-local state is intentional for the current frontend slice and must not be described as API-backed persistence.

## Structure

- `design/` - product design system, visual language, accessibility, and interaction rules.
- `planning/` - forward-looking product architecture, implementation direction, and technical decisions. It is not a claim that planned features already exist.
- `tasks/` - implementation-status checklist. Update it when an item is completed, deferred, or superseded.

The root `README.md` remains the public project overview and current gallery. The frontend README stays beside the frontend package so its commands and routes remain discoverable in context. The repository `LICENSE` controls the current source-available usage terms; planning notes do not change them.

When a visible application area changes materially, refresh the matching README screenshot from the running frontend and update its caption in the root README. Store gallery assets under `frontend/public/readme/gallery/`; do not present mockups as product screenshots.
