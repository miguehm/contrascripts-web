---
name: Warm Screenplay Minimal
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#564338'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#897267'
  outline-variant: '#ddc1b3'
  surface-tint: '#9b4500'
  primary: '#903f00'
  on-primary: '#ffffff'
  primary-container: '#b45309'
  on-primary-container: '#fff1eb'
  inverse-primary: '#ffb68e'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#005998'
  on-tertiary: '#ffffff'
  tertiary-container: '#0072c0'
  on-tertiary-container: '#eef3ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb68e'
  on-primary-fixed: '#331200'
  on-primary-fixed-variant: '#763300'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#d2e4ff'
  tertiary-fixed-dim: '#9fcaff'
  on-tertiary-fixed: '#001d36'
  on-tertiary-fixed-variant: '#00497e'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  script-slugline:
    fontFamily: Courier Prime
    fontSize: 12pt
    fontWeight: '700'
    lineHeight: 12pt
    letterSpacing: '0'
  script-body:
    fontFamily: Courier Prime
    fontSize: 12pt
    fontWeight: '400'
    lineHeight: 12pt
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers a focused, contemplative writing environment calibrated for screenwriters, dramatists, and narrative designers. The aesthetic marries editorial minimalism with physical manuscript tactility: quiet cream-tinted desk surfaces, an immaculate white virtual page, and razor-sharp typographic discipline. 

The emotional tone balances absolute clarity with welcoming warmth. By banishing noisy chrome, garish highlights, and heavy container boxes, the interface steps back entirely, allowing dialogue, parentheticals, and scene headings to take precedence. Micro-accents in rich caramel amber guide intentional interactions (such as export pipelines, active beat markers, and caret presence) without puncturing creative flow.

## Colors

The palette reproduces the tactile quality of premium manuscript paper resting under natural daylight.

- **Primary (`#b45309`)**: A grounded, burnished amber used for critical actions, primary callouts, active script states, and selected navigator beats.
- **Secondary (`#d97706`)**: A glowing caramel gold used for focus rings, hover indicators, subtle scene flags, and badge counters.
- **Neutral Dark (`#0f172a`)**: Deep slate charcoal providing uncompromising readability for script dialogue and dominant UI headers without the harsh vibration of pure `#000000`.
- **Secondary Muted Text (`#64748b`)**: Balanced cool slate for scene metadata, dual-dialogue indicators, and interface secondary labels.
- **Surfaces & Borders**:
  - Script Sheet Canvas: `#ffffff`
  - Workspace / Desk Backdrop: `#f8fafc` fading into `#f1f5f9`
  - Subtle Borders & Dividers: `#e2e8f0`

## Typography

The typography creates a strict segregation between the tool interface and the literary output:

- **Chrome & Workspace UI**: Set in **Plus Jakarta Sans**. Geometric yet warm, its contemporary clarity structures navigation menus, scene breakdowns, inspector panels, and character relationship trees without intruding on the writer's cognitive space.
- **Fountain Editor & Script Canvas**: Set strictly in **Courier Prime** at `12pt` with exact 100% leading. Industry-standard industry metrics must be preserved: 10 characters per horizontal inch and 6 lines per vertical inch, upholding canonical 1-page-per-minute screen timing.
- **Sluglines / Scene Headers**: Expressed via `script-slugline` in uppercase Courier Prime, maintaining distinct hierarchy while preserving monospace grid consistency.

## Layout & Spacing

The interface employs a fixed-width manuscript stage flanked by collapsible contextual fluid gutters.

- **The Manuscript Center**: Standard 8.5" × 11" screenplay page (max width: 816px) centered automatically within the viewport. Vertical padding around the page remains generous (`space-xl`) to preserve the illusion of a desk surface.
- **Sidebar Rail & Navigator**: 280px fixed width on desktop, collapsing to icon-only (56px) or hidden in dedicated Zen Focus mode.
- **Responsive Adaptations**:
  - **Desktop (≥ 1024px)**: Full multi-pane arrangement (Navigator, Script Page, Inspector/Notes) with a 1.5rem gutter.
  - **Tablet (768px - 1023px)**: Sidebars convert to slide-over drawers; page scale matches viewport padding with `margin: 1.5rem`.
  - **Mobile (< 768px)**: Fluid full-bleed typewriter mode; page edges drop outward shadows and assume an edge-to-edge layout with `margin-mobile: 1rem` and fluid line reflow.

## Elevation & Depth

Visual hierarchy uses tonal surface layering and low-contrast perimeter lines rather than heavy drop shadows:

- **Canvas Elevation (The Desk vs. The Page)**: The workspace desk sits at base level `#f8fafc`. The screenplay page sits on top at `#ffffff`, framed by a fine border (`1px solid #e2e8f0`) and an ambient, whisper-soft paper shadow: `0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)`.
- **Sidebars & Utility Panels**: Flush planar surfaces separated strictly by `1px solid #e2e8f0` dividers, eliminating spatial clutter.
- **Modals, Floating Toolbars, & Autocomplete Menus**: Positioned slightly above the canvas with `box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)` and crisp borders (`#cbd5e1`).

## Shapes

The interface adopts a soft, disciplined shape language (`roundedness: 1`). 

- Default interactive elements (buttons, inputs, scene cards, dropdown menus) employ a precise `0.25rem` (4px) corner radius, signaling utility and editorial order.
- Modal dialogs, floating action toolbars, and contextual popovers scale up slightly to `0.5rem` (8px).
- The virtual paper manuscript maintains crisp, authentic sheet corners (`0px` or `2px` max) to honor physical stationery standards.

## Components

- **Buttons**:
  - *Primary*: Background `#b45309`, text `#ffffff`, border none. Hover state `#92400e`. Active state `#78350f`.
  - *Secondary / Ghost*: Background transparent, text `#0f172a`, border `1px solid #e2e8f0`. Hover brings background to `#f1f5f9`.
  - *Zen Toggle*: Icon-based micro-button that dims to 40% opacity when idle, regaining full clarity on mouse approach.
- **Input Fields & Quick Searches**:
  - Background `#ffffff`, border `1px solid #e2e8f0`, text `#0f172a`. Focused inputs activate an amber accent border (`#d97706`) with a subtle `0 0 0 1px #d97706` inner ring.
- **Cards & Scene Outliners**:
  - Index card views feature an off-white fill (`#ffffff`) surrounded by a subtle hairline border (`#e2e8f0`). When selected or active in playback, apply a left accent strip of `3px solid #b45309`.
- **Chips & Tags**:
  - Compact `rounded-sm` badges for scene numbers, locations (INT/EXT), and character tags. Subtle `#f1f5f9` slate background with muted `#64748b` text; active filters adopt `#fef3c7` with `#b45309` text.
- **Checkboxes & Radios**:
  - Minimal square controls with `2px` corner radius. Unchecked state holds `1px solid #cbd5e1`; checked state fills with `#b45309` with a crisp white glyph.
- **Screenplay Autocomplete Menu**:
  - Floating contextual overlay showing matching Characters and Scene Slugs as the writer types. Background `#ffffff`, active item highlighted in `#fffbeb` with left-edge amber accenting and Courier preview text.
