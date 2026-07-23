# ApplyFill UI System

This document is required reading before changing ApplyFill's frontend. It describes the implemented design system, not a speculative redesign. Agents must inspect the referenced components and existing usage before adding markup or CSS.

## Sources Of Truth

Use these sources in this order:

1. Reusable components in `frontend/src/components/ui/` and `frontend/src/components/resume/`.
2. Theme tokens and global component styles in `frontend/src/index.css`.
3. Existing feature-level patterns near the code being changed.
4. This document.

When this document and the implementation disagree, preserve the coherent implemented pattern and update this document in the same change. Do not create a page-specific substitute for an existing component.

## Required Workflow

Before editing UI:

1. Search for an existing component and for comparable usage elsewhere in the app.
2. Inspect both light and dark theme tokens; never choose a raw color from one theme.
3. Identify desktop, intermediate wrapping, and mobile behavior before writing CSS.
4. Reuse or extend the shared component. Fix a shared defect at the component or global-style level.
5. Verify keyboard access, visible focus, labels, contrast, overflow, and text wrapping.
6. Browser-test the result in light and dark modes and at relevant responsive widths.

## Theme And Color

- Use CSS custom properties from `index.css`; do not hardcode page-level button, field, panel, or text colors.
- Light mode uses blue `--primary-color`; dark mode uses violet `--primary-color`.
- Primary color communicates the main action, current state, selection, and focus.
- Red is reserved for destructive actions and validation errors.
- Secondary actions use a soft theme-primary tint and outline, normal theme text, and a theme-primary icon. ApplyFill does not use transparent ghost buttons for normal secondary commands. Secondary controls must not introduce pale-on-white controls or filled black, navy, slate, or unrelated accent buttons.
- Text must use `--text-main`, `--text-muted`, `--text-soft`, or `--placeholder-text` according to hierarchy.
- Controls and surfaces must remain distinguishable in both themes. Do not place pale controls on white without a visible border.

## Buttons

Use `components/ui/Button.tsx` for normal command buttons.

- `primary`: one main or forward action in a local workflow; uses the theme primary color.
- `secondary`: supporting, cancel, edit, back, or alternate action; soft theme-primary background and border, normal theme text, and theme-primary icon.
- `danger`: destructive confirmation; red treatment.
- Use `components/ui/AddButton.tsx` for repeated-entry add actions. Do not recreate its icon, dimensions, or placement.
- Use `.icon-button` only for familiar icon-only commands. Supply an accessible name and the shared tooltip when the icon needs explanation.
- Use Lucide icons. Put forward arrows after forward-action text and back arrows before back-action text.
- Buttons with the same role must have stable dimensions; labels must not cause neighboring layout shifts.
- Do not add one-off button colors in page CSS.

## Current Component Inventory

Prefer these components rather than rebuilding their behavior:

- `Button.tsx`: primary, secondary, and danger commands.
- `AddButton.tsx`: standardized add action.
- `AppSelect.tsx`: shared dropdown with portaled, position-aware menu.
- `AutofillSelect.tsx`: searchable address/autofill dropdown.
- `AddressFlow.tsx`: country-first, country-aware full or locality address fields.
- `Checkbox.tsx`: accessible custom checkbox.
- `DatePicker.tsx`: themed date input and calendar.
- `FormModal.tsx` and `ModalRenderer.tsx`: modal structure, transitions, dirty-state protection, and overlay behavior.
- `TabbedForm.tsx`: tabbed form sections.
- `DataTable.tsx`: reusable searchable data tables with sorting and filtering in compact per-column menus, responsive overflow, and stable action columns.
- `TooltipPortal.tsx`: delayed, position-aware tooltip portal.
- `RepeatableSectionHeader.tsx` and `RepeatableEntryCard.tsx`: repeated profile data patterns.
- `RepeatableEmptyState.tsx`: consistent empty state for repeatable profile data.
- `EntrySortControl.tsx`: sorting for repeated entries.
- `ValidationDialog.tsx`: grouped validation feedback.
- `RichTextEditor.tsx`: all rich-text fields and toolbar behavior. It persists a restricted Tiptap JSON document; raw HTML is not supported, rendered, or migrated. Plain-text imports and AI output must be converted through `features/rich-text/`.
- `ProfileIntroductionSection.tsx`: profile opening section used by the Job Profile wizard.
- `ProfileResumeImportSection.tsx`: pre-personal-info PDF/DOCX/TXT import, plain-language Private AI status, selectable proposal review, retained-source metadata, and source preview. It warns before a new import replaces an existing profile.
- `components/pdf/PdfViewer.tsx`: shared ApplyFill PDF viewer adapted from the SkiaMime interaction model. It owns thumbnails, page navigation, fit/percentage zoom, fullscreen, and download for both source-resume preview and Resume Builder preview.
- `ProfileDataPanel.tsx`: formatted, read-only view of the exact profile document with copy, download, and validated import controls.
- `ResumePdfDocument.tsx`: canonical browser-side PDF document used by both live preview and PDF Blob download. It accepts only the resume-safe view model.
- `LocalAiTailoringPanel.tsx`: Private AI job analysis and suggestion review with accept/reject/edit/cancel/stale/undo behavior. It calls the local backend and never loads a model in the browser.
- `ManagedBrowserViewport.tsx`: managed-browser frame surface with bounded user input while the user owns control.
- `BrowserAgent.tsx`: multi-page run status, activity, questions, pause/stop, user handoff, recovery, and final-review surface inside the shared layout.
- Dashboard components under `components/dashboard/`: widget grid, widget chrome, library, and widget implementations.

## Application Shell And Routes

- `MainLayout.tsx` owns the responsive sidebar, grouped navigation, and persisted light/dark theme. Do not create a page-level substitute for these behaviors.
- Implemented routes are dashboard (`/`), Job Profile review (`/job-profile`), Job Profile builder (`/job-profile/builder`), Job Tracker and its tabbed application editor (`/job-tracker` and `/job-tracker/:applicationId/edit`), Resume Builder (`/resumes` and `/resumes/builder`), and Settings (`/settings`). The Browser Agent is a tab within a saved application.
- The dashboard uses the shared dashboard grid and widget frame. Preserve its edit-mode distinction: layout changes, widget resizing, and widget removal are editing actions.
- The Job Profile screen uses `TabbedForm`: My Profile is the readable review surface and Structured Data exposes the exact versioned local document. Section-level Edit actions navigate to the matching wizard section rather than duplicating forms.
- Settings uses shared controls. It shows ordinary-language Private AI status/setup and accurately explains the local PostgreSQL privacy boundary without exposing service topology.

## Local Application Data UX

- Profiles, resume drafts, job applications, dashboard records, and Browser Agent history use the local backend and PostgreSQL. Frontend state is an editable/view cache, never an independent source of truth.
- Backup messaging must state that downloaded JSON contains sensitive, unencrypted personal data.
- Government identifiers are application-only. Mask them in cards and profile summaries, reveal them only through an explicit control while editing, and warn before users expose them in structured JSON, clipboard copies, or downloads. Never include them in resumes or AI writing requests.
- Work authorization uses the neutral application questions "currently authorized to work" and "now or in the future require sponsorship" per country. Do not collect citizenship, specific immigration status, or date of birth.
- Education GPA is an optional pair of numeric fields: earned GPA and grading scale. Normalize saved values to two decimal places, support scales through 100.00, and reject incomplete pairs or a GPA greater than its scale.
- Phone controls display `+1 (555) 123-4567` while editing and reviewing, but persist only `+15551234567`. Partial phone input stays in component state and must never enter the profile document.
- Import controls must accept only a recognized ApplyFill format and supported schema version before replacing local data.
- Resume import is distinct from ApplyFill JSON replacement: it accepts a PDF/DOCX/TXT source up to 10 MiB and renders no more than 15 JPEG pages in the browser (14 MiB rendered-set limit). PDF pages are capped at a 1,600-pixel longest edge and 2× scale; DOCX/TXT pages use a 1,200×1,600 canvas. Local vision/OCR preserves columns, headings, and visual order. Up to 30,000 characters of selectable text may accompany page images only as corroborating evidence after deterministic contact/header redaction; the original upload is retained in the owner-scoped local artifact store but is not sent beyond the local services. When profile data already exists, selecting a new source requires explicit overwrite confirmation. Continuing with reviewed proposals replaces the existing profile data while retaining the current automation-consent acknowledgment.
- Resume drafts are source-profile derivatives. The live preview and all file renderers consume the explicit resume-safe allowlist, never the complete profile document. Generated PDF and DOCX Blobs remain ephemeral until downloaded.
- Private AI runs through local native services. Explain the allowlisted data boundary in plain language; never expose models, providers, runtimes, ports, accelerators, GPU layers, or quantization in the ordinary UI.
- Private AI suggestions are proposals: show progress and cancellation, render before/after review, allow edit/select/reject, block stale results, and provide undo after acceptance.
- Settings owns one **Set Up Private AI** action and clear ready/setup/failure status. Show progress as a percentage when known and provide a plain retry path.
- Browser Agent automation stays inside ApplyFill's main layout, and the same run persists across pages.
- Pause, Stop, Take Control, Return Control, pending-question, recovery, and final-review states must always remain visible. User and agent input are mutually exclusive.
- Final submission is a separate explicit approval; never present reaching the last page as permission to submit.
- Destructive deletion requires explicit confirmation and must name all substantive local records affected.

Update this list whenever a reusable component is added, renamed, or retired.

## Forms

- Use `.form-group`, `.form-label`, and `.form-input` for standard fields.
- Use `AppSelect` for fixed option sets. Set `isSearchable={false}` when manual text entry is not appropriate.
- Use `AutofillSelect` only when type-to-filter/autofill behavior is intentional.
- All inputs, dropdowns, date controls, and rich-text shells use the shared field height, border, placeholder, focus, and disabled tokens.
- Do not create native browser date/select UI when a shared component exists.
- Repeated data is added or edited through the established modal and summary-card pattern.
- Country-dependent address fields must use `AddressFlow`; do not duplicate country/state logic.
- Validation must be discoverable and grouped when multiple fields fail.

## Layout And Spacing

- Use a 4px spacing base with established gaps of 8, 12, 16, 20, and 24px.
- Use 8px or smaller control/card radii unless an established component defines otherwise.
- Keep operational pages compact and scannable. Do not turn sections into decorative floating cards.
- Do not nest cards inside cards.
- Wrapped toolbar/action groups must retain their intended alignment on the new row.
- Reserve stable dimensions for controls, fixed-format widgets, and progress tracks to prevent DOM movement.
- On mobile, controls may stack to full width. Modal and sidebar behavior must still expose a clear close/back path.
- Test long labels and content; text must wrap without overlapping or resizing adjacent controls unexpectedly.

## Accessibility And Interaction

- Meet WCAG AA contrast for text and interactive boundaries in both themes.
- Every control needs a programmatic label. Icon-only controls need an accessible name.
- Keyboard focus must be visible and must follow the same visual language as pointer focus.
- Use semantic elements: links navigate, buttons perform actions, headings preserve hierarchy.
- Tooltips supplement unfamiliar icon controls; they do not repeat visible labels. Use the shared delayed tooltip portal.
- Respect `prefers-reduced-motion`. Animation must not be required to understand state.
- Drag-and-drop interactions need keyboard support and must not capture nested actionable controls.

## Review Checklist

Before considering UI work complete, verify:

- Existing reusable components were used or deliberately extended.
- No page-specific raw colors or duplicate component CSS were added.
- Primary, secondary, destructive, add, and icon actions follow their shared variants.
- Light and dark modes have readable text, placeholders, borders, menus, and overlays.
- Desktop, wrapped intermediate widths, and mobile layouts were browser-tested.
- Keyboard operation, focus, labels, tooltips, portals, and reduced-motion behavior remain correct.
- The component inventory and guidance were updated if the system changed.
