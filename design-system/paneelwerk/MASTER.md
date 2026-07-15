# Paneelwerk Redesign Specification

## Mode and concept

- Mode: `FULL_REDESIGN`
- Approved concept: `Plan as the main screen`
- Product: professional acoustic-panel layout editor
- Primary task: configure a room, edit the panel plan, then read material and cutting results

## Architecture

1. Compact product header with project-level actions.
2. Project dock for working-copy tabs and save-as.
3. Three-column workbench: parameters, SVG plan, result inspector.
4. Dedicated material ledger below the workbench.

## Components

- Product bar and vector brand mark
- Project dock and folder-style tabs
- Parameter groups with explicit labels
- Segmented editing toolbar
- Context workflow panels
- Plan canvas and measurement drawer
- Result inspector with four live metrics
- Material ledger cards and data tables

## Tokens

- Ink: `#172220`
- Deep ink: `#0d1716`
- Canvas: `#f3f1eb`
- Surface: `#fbfaf6`
- Line: `#d4d6ce`
- Muted: `#65716c`
- Amber action: `#d58a3b`
- Amber soft: `#f4dfbd`
- Error: `#b6493e`
- Success: `#347261`

## Typography

- Display and UI: `Avenir Next`, fallback `Helvetica Neue`, sans-serif
- Utility and measurements: `SFMono-Regular`, fallback `Consolas`, monospace
- Scale: 12 / 14 / 16 / 20 / 28 / 36 px
- Numeric result values use tabular figures

## Layout

- Maximum shell: 1800px
- Workbench: `320px minmax(0, 1fr) 280px`
- Desktop breakpoint: 1380px
- Tablet breakpoint: 1040px
- Mobile breakpoint: 720px
- Minimum interactive target: 44px

## Behavior

- Header and project dock remain compact; the plan owns the largest area.
- Parameter and result columns stay sticky on wide viewports without becoming separate scrolling containers.
- Tablet stacks the inspector under the plan.
- Mobile reads in this order: project context, parameters, plan, result inspector, material ledger.
- Result tables collapse into labelled mobile cards instead of horizontal-scrolling desktop grids.
- Editing modes remain mutually exclusive and keep their existing Apply/Cancel behavior.
- Motion is limited to opacity and transform, 160-240ms, with reduced-motion support.

## Accessibility

- Preserve semantic buttons, labels, tables, live regions, and SVG accessible name.
- Add a skip link, visible keyboard focus, 4.5:1 text contrast, and non-color active states.
- Never disable browser zoom or rely on hover-only information.
