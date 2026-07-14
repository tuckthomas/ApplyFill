# ResumeJobAssistant Design System

This document outlines the UI/UX design patterns, tokens, and thematic guidelines for the ResumeJobAssistant application. Future AI agents must strictly adhere to these patterns to maintain a consistent, premium user experience.

The application supports a dual-theme architecture: **Vantage Premium** (Light Mode) and **Obsidian Path** (Dark Mode).

---

## 1. Vantage Premium (Light Mode)

### Brand & Style
The design system is engineered to evoke a sense of high-level professional advancement. It shifts away from heavy aesthetics toward an airy, "Executive Light" style. The brand personality is **authoritative yet accessible**, functioning as a high-end concierge for career growth. The visual direction follows **Precision Minimalism** with generous whitespace and a restrained but vibrant accent palette.

### Colors
The palette is anchored by **Vantage Blue** (`#2563EB`), a sophisticated, high-energy indigo. This is contrasted against a deep **Slate Navy** (`#0F172A`) for primary headings.
- **Level 0 (Base):** Pure White (`#FFFFFF`) for the main canvas.
- **Level 1 (Surface):** Ghost Gray (`#F8FAFC`) for secondary modules and navigation sidebars.
- **Level 2 (Stroke):** Cool Slate (`#E2E8F0`) for subtle borders and dividers.

### Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Soft Ambient Shadows** rather than harsh outlines, creating a "stacked paper" effect.
- **Cards:** White background, 1px border (`#E2E8F0`), and subtle rounding.

---

## 2. Obsidian Path (Dark Mode)

### Brand & Style
Engineered for a premium, tech-forward resume-building experience targeting professionals who value precision. The visual narrative centers on **Dark Glassmorphism**, combining deep, multi-layered charcoal surfaces with translucent frosted overlays to evoke depth and sophistication. The emotional response is one of modern authority and "editorial" quality.

### Colors
Built on a foundation of "True Dark" values.
- **Primary:** Electric Violet (`#8B5CF6`) is the signature interactive color, used for CTA buttons.
- **Secondary:** Teal (`#06B6D4`) is used sparingly for subtle highlights.
- **Neutrals:** Slate and Charcoal (`#020617` to `#1E293B`) create the structural hierarchy.
- **Glass Surfaces:** Semi-transparent Slate with a high blur radius to maintain legibility.

### Elevation & Depth
Depth is established through **Backdrop Blurs** and **Tonal Stacking**.
- **Level 0 (Background):** Deepest black (`#020617`).
- **Level 2 (Main Cards):** Glassmorphic surface (60% opacity) with a 40px backdrop blur and 1px subtle borders.

---

## 3. Shared Architecture

### Typography
Both themes exclusively employ the **Geist** font family, leveraging its technical precision for a "resume-builder" feel that looks both modern and engineered.

### Shapes
The shape language is **Refined-Rounded**.
- Standard Elements (Buttons, Inputs): `8px` corner radius.
- Large Elements (Cards, Preview Panes): `16px` to `24px` corner radius.

### Layout & Spacing
- **Fixed-Fluid Hybrid:** The main editing workspace is centered, while the live resume preview pane occupies a secondary fluid column.
- **Spacing:** A strict `8px` grid governs all spacing (e.g., 12px small, 24px medium, 48px large).

### Components
- **Buttons:** Primary buttons utilize the primary accent color (Vantage Blue or Electric Violet) with a soft outer glow. Secondary buttons use a "Ghost" style.
- **Form Fields:** Inputs have subtle borders. Upon focus, the border transitions to the primary accent color and the background becomes slightly more opaque.
- **Progress Indicators:** Step indicators should use thin, high-contrast tracks with primary accent fills. No rounded ends on the fill to maintain a technical "meter" look.
