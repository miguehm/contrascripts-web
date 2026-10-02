---
name: Cinematic Script Minimal
colors:
  surface: '#131317'
  surface-dim: '#131317'
  surface-bright: '#39393d'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e7'
  on-surface-variant: '#dbc2b0'
  inverse-surface: '#e4e1e7'
  inverse-on-surface: '#303034'
  outline: '#a38c7c'
  outline-variant: '#554336'
  surface-tint: '#ffb77d'
  primary: '#ffb77d'
  on-primary: '#4d2600'
  primary-container: '#d97707'
  on-primary-container: '#432100'
  inverse-primary: '#904d00'
  secondary: '#c3c0ff'
  on-secondary: '#1d00a5'
  secondary-container: '#3626ce'
  on-secondary-container: '#b3b1ff'
  tertiary: '#96ccff'
  on-tertiary: '#003353'
  tertiary-container: '#0297e8'
  on-tertiary-container: '#002c48'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdcc3'
  primary-fixed-dim: '#ffb77d'
  on-primary-fixed: '#2f1500'
  on-primary-fixed-variant: '#6e3900'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#cee5ff'
  tertiary-fixed-dim: '#96ccff'
  on-tertiary-fixed: '#001d32'
  on-tertiary-fixed-variant: '#004a75'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-screenplay:
    fontFamily: Courier Prime
    fontSize: 12pt
    fontWeight: '400'
    lineHeight: 12pt
    letterSpacing: 0em
  body-fountain-editor:
    fontFamily: Courier Prime
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.625rem
    letterSpacing: 0em
  code-slugline:
    fontFamily: Courier Prime
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: 1.625rem
    letterSpacing: 0.05em
  label-ui:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0.01em
  label-meta:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system is crafted for screenwriters, dramatists, and narrative designers requiring absolute cognitive focus. Rooted in purposeful minimalism and typographic authenticity, the interface recedes entirely, allowing the dramatic structure and prose rhythm of the writer to command the workspace.

The aesthetic reconciles two physical metaphors: the precision of modern minimalist workstation tools and the enduring heritage of Hollywood tradecraft (standardized 12pt monospaced Courier on three-hole punched cardstock). Emotional resonance targets quiet authority, tactile craftsmanship, and unhurried intellectual discipline.

Visual weight relies on pristine proportions, hairline rules, disciplined monospaced gutters, and meticulous typographic hierarchies rather than decorative chrome, overt gradients, or superfluous container nesting.

## Colors

The core palette features deep carbon obsidian (`#0D0D11`) as the default canvas, paired with parchment warm whites for paper emulation modes and deep zinc structural surfaces (`#18181B`). 

### Palette Architecture
- **Primary Accent (`#D97706` Amber)**: Reserved strictly for critical state reflections: cursor position indicators, live wordcount milestones, unsaved state tokens, and active scene markers.
- **Secondary Accent (`#4F46E5` Editorial Indigo)**: Applied to syntax classification highlights within raw Fountain mode (e.g., scene headings, transitions, and character directives) to distinguish structural tokens without distracting from body copy.
- **Base Surfaces**:
  - `canvas-dark`: `#0D0D11`
  - `surface-panel`: `#131317`
  - `surface-subtle`: `#18181B`
  - `border-hairline`: `rgba(255, 255, 255, 0.08)`
  - `border-focus`: `rgba(217, 119, 6, 0.40)`
- **Page Preview Tokens (Screenplay Simulation)**:
  - `paper-base`: `#FBFBF9`
  - `paper-ink`: `#121214`
  - `paper-shadow`: `rgba(0, 0, 0, 0.45)`
  - `paper-margin-guide`: `rgba(0, 0, 0, 0.05)`

In pure distraction-free focus modes, all interface chrome dims to `rgba(255, 255, 255, 0.35)` until hovered.

## Typography

Typography establishes a deliberate dialogue between crisp utilitarian application chrome (`Plus Jakarta Sans`) and immutable industry-standard script typesetting (`Courier Prime`).

### Screenplay Standard Specifications
- Standard screenplay representation strictly honours the 10-pitch, 12pt standard rule: 1 inch = 6 lines of text vertically; 10 characters per horizontal inch.
- In formatted preview mode, margins align to US Letter specifications (Left: 1.5 in / 108pt, Right: 1.0 in / 72pt, Top & Bottom: 1.0 in / 72pt).
- In raw Fountain mode, the active editing line maintains strict line-height tracking (`1.625rem`) with visual tabs mapped to standard screenplay block indentations (Sluglines at col 0, Action at col 0, Character at col 20-22, Dialogue at col 10-15, Parenthetical at col 15-16).

## Layout & Spacing

The architecture operates on an adaptive tri-state pane paradigm:
1. **Focus Editor Mode**: A centered single column locked to a max width of `820px` to mirror true script page limits with expansive lateral breathing room.
2. **Dual-Pane Split**: A 50/50 horizontal division (collapsing to proportional 45/55 on wider displays) isolating the raw Fountain markdown input on the left and the real-time paginated PDF preview on the right.
3. **Desk Layout**: Accommodates a collapsible 240px `Scene Navigator / Outline` panel docked to the left edge, persistent global meta header (scene tally, runtime estimator at 1 page/minute, page counter), and contextual drawer.

### Responsive Breakpoints
- **Mobile (<768px)**: Single pane with strict tab toggle between `Fountain Editor` and `PDF Preview`. Navigator converts to bottom-sheet drawer.
- **Tablet (768px - 1024px)**: Stacked or toggle-based preview. Minimal fixed header bar with dynamic status.
- **Desktop (>1024px)**: Side-by-side synchronized scrolling, floating gutter actions, and live margin guide indicators.

## Elevation & Depth

Visual hierarchy abandons saturated drop shadows in favor of low-contrast hairline borders, tone-on-tone surface tiers, and calibrated physical sheet elevations for the script preview canvas.

- **Level 0 (Application Void)**: `#0D0D11` baseline surface.
- **Level 1 (Docked Toolbars & Nav Panels)**: `#131317` with a 1px border of `rgba(255, 255, 255, 0.07)`. No shadow.
- **Level 2 (Dropdowns, Overlays, Command Palette)**: `#18181B` surface with border `rgba(255, 255, 255, 0.12)` and ambient shadow `0 12px 32px rgba(0, 0, 0, 0.6)`.
- **Level Paper (PDF Sheet Mockup)**: Ivory substrate `#FBFBF9` sitting against the dark canvas elevated with dual-tier shadows: `0 2px 4px rgba(0, 0, 0, 0.2), 0 16px 40px rgba(0, 0, 0, 0.4)`. In optional tactile mode, brass brad fasteners are represented via flat vector brass rivets at `left: 0.5in; top: 1.5in` and `top: 9.5in`.

## Shapes

The geometric vocabulary is disciplined, precise, and understated (`roundedness: 1` — Soft, default radius of `0.25rem` / `4px`). 

Structural toolbars, split-pane handles, segment controls, and scene list items feature subtle 4px corner rounding. Floating palettes and modal dialogs extend to `0.5rem` (`rounded-lg`). Page previews, sheet edges, and document dividers remain strictly orthogonal (`0px`) to preserve structural authenticity.

## Components

### 1. Mode Segment Controls & Action Buttons
- **Toolbar Buttons**: Height of `32px`, typography `label-ui`. Resting state transparent background with text `rgba(255, 255, 255, 0.7)`. On hover, surface becomes `rgba(255, 255, 255, 0.05)`. Active/Selected toggles employ an outline style with `rgba(217, 119, 6, 0.3)` and warm amber active glyphs.
- **Primary Compilation/Export Button**: High-contrast solid background (`#D97706` amber or crisp stark white `#FFFFFF` with `#0D0D11` text for production export actions).

### 2. Scene Navigator & Card List
- Item cells feature single-line auto-truncated headings (`INT. COFFEE SHOP - DAY`).
- Left-aligned indicator line: 2px wide, invisible at rest, shifting to primary amber `#D97706` on active cursor location.
- Drag-and-drop handles surface only on cursor proximity.

### 3. Screenplay Element Syntax Toolbar (Mobile / Contextual)
- Micro-pill chips for instantaneous Fountain insertions: `SCENE`, `CHAR`, `PAREN`, `DIALOGUE`, `ACTION`, `TRANS`.
- Set in monospaced uppercase `10px` typography with `0.25rem` radius, bound by 1px subtle borders.

### 4. Input Fields & Search Bars
- Minimal inline containers: single hairline underline or full pill frame with zero background elevation. Cursor color locked to `#D97706`.

### 5. Checkboxes, Radio Controls, & Toggles
- Custom micro-toggles: `16px x 28px` tracks with crisp mechanical sliding thumbs. Checkboxes are squircle-shaped (`4px` radius) with hairline stroke; filled state resolves in solid `#4F46E5` or `#D97706`.

### 6. The Standard Screenplay Page Canvas
- Proportion: Fixed 8.5" x 11" dimensional aspect ratio.
- Canvas metrics: Explicitly render page breaks indicated by horizontal hairline rules flanked by dynamic label tokens: `-- Page 14 --`.
- Margins: Explicit desktop guidelines delineating standard Hollywood script parameters.
