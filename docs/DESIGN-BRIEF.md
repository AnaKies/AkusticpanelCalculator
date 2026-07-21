# Design Brief: Paneelwerk / Akustikplaner

## Scope

This brief describes the desired visual and interaction direction for the current `Paneelwerk / Akustikplaner` product.

It is intentionally aligned to the existing application architecture:

- product header
- project dock
- three-part planning workbench
- contextual workflow panels
- material and measurement outputs

It does not introduce a new page model and does not require component or route changes at this stage.

## Desired Visual Character

- Precise, workshop-grade, and trustworthy.
- Quietly premium rather than glossy.
- Technical without feeling cold or enterprise-generic.
- Strong sense of craft, measurement, and material reality.
- Editorial restraint over startup theatrics.

The interface should feel like a serious planning instrument, not like a template-derived dashboard.

## Trust and Seriousness Requirements

- The UI must communicate operational reliability before personality.
- Numerical data, measurements, and geometry outputs must feel more important than brand gestures.
- States, warnings, and confirmations must be explicit and legible.
- Decorative styling must never reduce clarity of inputs, dimensions, or result interpretation.
- Print- and handoff-related actions must feel stable and intentional, not promotional.

## Animation Constraints

- Motion should be minimal and functional only.
- Use opacity and short-distance transform transitions only.
- Keep timings in the restrained range, roughly 160-240ms.
- No bouncing, elastic, floating, parallax, or attention-seeking hero motion.
- Respect reduced-motion preferences everywhere.
- Never animate numeric values, geometry changes, or destructive confirmations in a way that creates doubt about final state.

## Preferred Typographic Hierarchy

### Character

- Use a sober sans-serif system with high legibility and strong numeric clarity.
- Display type should remain restrained; this is not a marketing-first composition.
- Measurement-heavy UI must use tabular figures consistently.

### Hierarchy

1. Product title
   Distinct, compact, credible.
2. Section headings
   Clear and structured, not oversized.
3. Panel labels and tool labels
   Dense but readable.
4. Body/help text
   Secondary and low-noise.
5. Numeric and measurement output
   Extremely stable, aligned, and easy to scan.

### Practical rules

- Avoid oversized hero typography inside the application shell.
- Prefer tight but readable line lengths.
- Use smaller uppercase or eyebrow labels sparingly to support navigation hierarchy.
- Make all important numbers visually consistent and aligned.

## Color Principles

- Default to a light, content-first workspace.
- Base palette should be warm-neutral rather than blue-gray.
- Accent color should feel material and deliberate, not synthetic.
- Success, warning, and error colors must be present but restrained.
- The plan canvas and editable geometry need strong local contrast without becoming neon.
- Use color to support hierarchy, not to replace hierarchy.

### Color direction

- Warm canvas surfaces.
- Deep ink text and plan strokes.
- Low-chrome borders and dividers.
- A single controlled action accent.
- Muted semantic colors for warning/error/success states.

## Interface Density

- Medium-to-compact density on desktop.
- Tight enough for expert workflows.
- Never so compressed that labels, units, or mode states become ambiguous.
- Density should come from disciplined spacing and hierarchy, not from cramming controls together.

### Density rules

- The plan canvas remains the largest visual area.
- Side panels should be compact and efficient.
- Secondary outputs should feel docked, not sprawling.
- Repeated cards and lists should avoid oversized padding.

## Character of Cards, Buttons, and Forms

### Cards

- Cards should feel architectural and quiet.
- Prefer thin borders, low shadow, and clear internal hierarchy.
- Avoid glassmorphism, heavy blur, and floating "widget" aesthetics.
- Cards should read as tool surfaces, not promotional tiles.

### Buttons

- Buttons should look mechanical, deliberate, and dependable.
- Primary actions should be obvious but not loud.
- Mode buttons must communicate state clearly with more than color alone.
- Destructive and confirmation actions must be visually distinct.

### Forms

- Forms should feel exact and practical.
- Labels must stay attached to fields.
- Units must never be ambiguous.
- Validation must appear inline and close to the cause.
- Preserve entered values on failure.

## Desktop, Tablet, and Mobile Requirements

### Desktop

- Preserve the workbench model: setup, plan, results.
- Keep the canvas dominant.
- Maintain fast scanning across project, setup, and output zones.
- Avoid extra chrome that competes with geometry work.

### Tablet

- Stack the inspector below the canvas while preserving project and setup context.
- Maintain mode clarity even when tool groups wrap.
- Avoid forcing laptop-level density onto medium screens.

### Mobile

- Prioritize orientation first, then input, then plan, then results.
- Present data-heavy outputs as readable cards rather than compressed tables.
- Keep the current task and active mode obvious at all times.
- Ensure apply/cancel actions remain easy to reach during workflow steps.

## Explicit Ban on Typical SaaS/AI Style

The interface must not drift into the visual language of generic SaaS, AI copilots, or startup dashboards.

### Prohibited cues

- Purple or indigo default brand bias.
- Oversized gradient hero treatments.
- Floating glass cards.
- Soft, vague shadows everywhere.
- Four equal KPI cards with interchangeable metrics.
- Abstract AI-style icon bubbles.
- Excessive rounded-pill controls without hierarchy.
- Marketing-style microcopy inside expert workflow areas.
- Empty decorative illustrations that do not support planning.

### Preferred alternative

- Content-first layout.
- Warm industrial restraint.
- Precise numeric readability.
- Strong visual ownership of the plan canvas.
- Functional surfaces with low ornament.
- A brand tone that feels engineered and credible.
