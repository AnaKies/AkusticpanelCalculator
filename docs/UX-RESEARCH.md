# UX Research: Paneelwerk / Akustikplaner

## Scope

This document adapts the original request to the actual product in this repository: `Paneelwerk / Akustikplaner`, a single-page acoustic panel planning tool with a local workspace, parameter controls, an interactive plan canvas, and result views.

The current product is not a brochure website and not a law-firm-style content tree. The UX recommendations below therefore preserve the existing application shape and translate the requested structure into the planning-domain context of this tool.

## Audit Summary

- The current product is a dense single-page workbench, not a multi-page marketing site.
- The primary navigation model is functional: project tabs, left-side parameter setup, central plan editing, and contextual workflow panels.
- The primary user value is task completion: configure a room, edit geometry, inspect cuts and material output, then print or save a variant.
- The current UI already supports advanced expert workflows such as obstacle editing, alignment, combination, deletion, and measurement.
- The main UX risk is cognitive load: many controls, many edit modes, and a large amount of state live on one screen.
- The most important UX requirement is therefore not "more features" but better prioritization, clearer mode transitions, and predictable responsive behavior.

## Target User Scenarios

### Primary scenarios

1. A planner creates a room layout, sets panel dimensions and gap, and checks how many full panels and cut pieces are needed.
2. A craftsperson iterates multiple project variants, comparing alignment, rotation, and obstacle setups before choosing a final plan.
3. A user documents site constraints by adding obstacles, moving them relative to one another, and aligning them precisely.
4. A user measures distances directly on the plan and keeps a project-bound measurement table as part of the working state.
5. A user prepares a printable plan and material overview for handoff to installation or production.

### Secondary scenarios

1. A user creates a clean empty variant from scratch inside the same workspace.
2. A user duplicates the current configuration to test an alternative layout without losing the original.
3. A user revisits a saved project and needs immediate orientation without re-learning the whole interface.

## Information Architecture

### Current IA model

The product behaves as a task-oriented workbench with five core layers:

1. Global product layer
   Product identity, local workspace state, print action.
2. Project layer
   Working-copy tabs, variant saving, current configuration status.
3. Setup layer
   Room dimensions, panel grid, gap, angle, alignment, coordinate origin.
4. Editing layer
   Plan canvas, active mode toolbar, workflow panels for contextual operations.
5. Output layer
   Saved measurements, plan feedback, material and cut results, print output.

### Recommended IA framing

For future documentation, onboarding, and eventual navigation cleanup, the product should be described through the following semantic buckets:

1. Projects
   Create, duplicate, rename, delete, switch variants.
2. Geometry Setup
   Room, panel dimensions, gap, rotation, alignment, origin.
3. Plan Editing
   Obstacles, local reference movement, alignment, combination, deletion.
4. Validation and Measurement
   Measurements, status messages, conflict handling, reset confirmations.
5. Output and Handoff
   Material understanding, print preparation, saved configurations.

## Homepage Priorities

Because the current product is effectively the homepage and the main working page at the same time, content priority should remain strictly task-driven.

### Priority order

1. Immediate understanding of what project is active.
2. Fast access to room and grid parameters.
3. Dominant visibility of the plan canvas.
4. Clear indication of the currently active edit mode.
5. Immediate feedback about the consequences of changes.
6. Access to variant saving and printing without overpowering planning actions.

### What must remain above the fold on desktop

- Product identity and print action.
- Project dock with active variant context.
- Room and panel setup.
- Main plan canvas.
- Mode toolbar.

### What can move lower in hierarchy

- Dense explanatory copy.
- Secondary summaries already reflected in the plan.
- Large tabular breakdowns that do not affect the current editing decision.

## Navigation Patterns

### Current navigation pattern

- Workspace tabs act as project-level navigation.
- The page itself acts as an anchored workbench rather than route-based navigation.
- Tool selection is mode-based rather than page-based.
- Many operations are revealed progressively through contextual panels instead of permanent screen clutter.

### Recommended navigation principles

1. Preserve the single-page workbench.
2. Treat project tabs as the primary navigation model.
3. Treat the mode toolbar as task navigation, not as visual decoration.
4. Keep only one active editing mode at a time.
5. Make mode entry, mode state, and mode exit unambiguous.
6. Preserve the skip link and extend keyboard-accessible jumps between setup, canvas, and result zones.

### Navigation anti-confusion rules

- Never make users guess whether they are editing geometry or only viewing results.
- Never allow multiple destructive modes to appear active simultaneously.
- Never hide variant state changes behind subtle styling only.

## Structure of Planning Areas

This section is the domain-specific replacement for the originally requested `Rechtsgebiete` page structure.

The product does not have legal practice-area pages. Its equivalent content structure is the set of planning areas a user moves through during work.

### Recommended planning-area structure

1. Raum
   Width, height, room limits.
2. Paneelraster
   Panel width, panel height, gap, angle presets.
3. Rasterausrichtung
   Horizontal and vertical alignment, true center, coordinate origin.
4. Sperrflaechen
   Add, size, position, align, move relative.
5. Paneelkombination
   Combine adjacent full panels into larger units.
6. Loeschen
   Remove obstacles or combined areas safely.
7. Messen
   Select points, store distances, manage the project measurement table.
8. Ausgabe
   Print, variant review, and material interpretation.

### Structural rule

Each planning area should answer three questions quickly:

1. What is this mode for?
2. What action is expected from me now?
3. How do I confirm or cancel safely?

## Contact Flow

The current application has no classic contact page or lead form. Its equivalent user-support flow is the handoff and action-confirmation path inside the tool.

### Product-equivalent contact flow

1. User identifies the active project.
2. User configures or edits the plan.
3. User validates the geometry through visual feedback and measurements.
4. User saves a variant when branching is needed.
5. User prints the plan for external communication, installation, or production.

### If a future support/contact layer is added

1. Keep it secondary to planning.
2. Place it near print/export/handoff actions, not above the workbench.
3. Pre-fill project context where possible.
4. Preserve unsaved project state before launching any external contact or request flow.

## Mobile Behavior

### Required mobile order

1. Project context.
2. Parameter controls.
3. Plan canvas.
4. Contextual mode panel.
5. Results and measurement history.

### Mobile behavior principles

- Avoid horizontal scrolling for core planning tasks.
- Collapse data-heavy tables into labeled cards.
- Keep active-mode actions reachable without excessive thumb travel.
- Preserve minimum 44px hit targets.
- Ensure sticky or persistent context does not consume too much vertical space.
- Show mode state clearly even when toolbars wrap or stack.

### Mobile-specific risks

- Dense multi-step edit panels can become overwhelming if shown fully expanded.
- The plan can become visually secondary if setup cards are too tall.
- Confirmation actions can feel risky if apply/cancel controls fall below the fold.

## Accessibility Requirements

### Core requirements

- Preserve semantic buttons, labels, grouped controls, tables, summaries, and live regions.
- Keep keyboard access for all editing modes and variant switching.
- Maintain visible focus states that do not rely on color alone.
- Maintain at least WCAG AA contrast for text and essential UI states.
- Use both text and visual state for validation and mode status.
- Keep the skip link functional and visible on focus.
- Do not rely on hover-only explanations for critical actions.

### Form and validation requirements

Based on Design MCP behavioral guidance:

- Validate on blur, not on every keystroke.
- Place errors directly under the field.
- Preserve user input on validation or save failure.
- Use plain-language messages instead of technical wording.
- For partial failures, do not replace the entire screen with an error state.

## UX Anti-Patterns

1. Treating the tool like a brochure site and pushing the plan below ornamental content.
2. Equal visual weight for setup, canvas, and secondary outputs, which weakens task hierarchy.
3. Allowing multiple edit modes to feel active at once.
4. Hiding destructive consequences until after the user commits.
5. Using color alone to communicate active mode, error, or success.
6. Overloading mobile with desktop-sized data tables.
7. Full-screen error interruptions for field-level or panel-level failures.
8. Losing user-entered values after validation or save errors.
9. Adding decorative motion that distracts from precision work.
10. Adopting a generic SaaS dashboard pattern that makes the tool feel abstract rather than craft-oriented and plan-centric.
