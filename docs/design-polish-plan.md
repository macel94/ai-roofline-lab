# Readability and interface polish

## Scope

Use the officially installed Impeccable skill in `.pi/skills/impeccable` for typesetting, distilling, polishing, animating, colorizing, and delight. Refine the existing dark silicon lab rather than introduce a new brand, a concept-selection exercise, or runtime design tooling. Preserve all calculator equations, input ranges, assumptions, evidence, schematics, selection, and pause controls.

## Assessment

The old body was 14px, and many labels and notes were 5–12px, even smaller on phones. Those sizes were not comfortable for sustained reading. WCAG does **not** prescribe a minimum font size: AA instead requires sufficient contrast, 200% text resizing, reflow, and usable targets. Larger type alone is not an accessibility certification.

References: [Impeccable](https://github.com/pbakaus/impeccable), [text resizing](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Plan

- [x] Install Impeccable using `npx impeccable@4.1.0 install --providers=pi --scope=project`; run its context loader and read its installed playbooks.
- [x] Replace arbitrary tiny sizes with rem-based roles: 18px body, 16px controls, 14px notes at default browser settings. Self-host Atkinson Hyperlegible Next with its OFL license; retain system fallbacks and font-display swap.
- [x] Distill: delete repeated kickers, decorative numbers, redundant live badges, glow, gradients, nested panel borders, unused legacy CSS, and decorative hero animation. Keep every feature accessible, including optional Roofline and chip assumptions.
- [x] Colorize: slate surfaces, pale-blue focus/selection, green capacity/faster stages, red limiting/blocked stages. Maintain labels and geometry as independent encodings.
- [x] Animate: preserve resource-driven packets and tile duty; short, interruptible bar transitions connect changed values. No page-load choreography. User pause, reduced motion, blocked/excluded states, hidden tabs, and offscreen graphics remain authoritative.
- [x] Delight: clearly acknowledge the active size preset; preserve a horizontally explored schematic when parameters change. No confetti, invented claims, or delayed calculation.
- [x] Test build, behavior, offline assets, typography, contrast, targets, resizing, keyboard, motion, and mobile/intermediate/desktop reflow.
- [x] Run the installed Impeccable detector once; inspect screenshots in one batched round, fix material defects, then confirm.

## Verification

- Production build and strict TypeScript checks passed. All **59 tests passed twice (118/118)** with `npm run test:e2e -- --repeat-each=2`.
- Eleven new browser tests cover local font loading, 18/16/14px roles, active presets, 44px controls, computed HTML text/control-border contrast, preserved schematic scroll, nonoverlapping compute-limit labels, short resource-bar transitions, user pause/reduced motion, and 200% HTML text at 320/360/768/1440px with disclosures open. Existing numerical, keyboard, network/offload, hidden/offscreen motion, and offline/no-external-request tests still pass.
- The installed engine's mechanical detector reported a skip-link hover contrast problem and a repeating-gradient legend swatch. Fixed the hover foreground and replaced the swatch with a dashed border that retains its evidence meaning. No rule suppression was added. The detector was run once as its context guidance requested; fixes were then verified by source review and browser tests, not represented as a second clean scan.
- Fixed a motion-control bug exposed by the larger layout: its label and pressed state now describe user intent independently of offscreen scheduling. Reduced-motion mode disables the control and stops spatial animation; tile text stays opaque while only the processing surfaces indicate duty.
- Final desktop/mobile screenshots are retained locally under `.impeccable/review/` (ignored), with a TPU prefill check. Only schematics/charts/tables scroll horizontally; the document does not.
- `npm audit`: **0 vulnerabilities**. `git diff --check` passes. No Impeccable tooling enters the production build. Fonts add approximately 53KB before transport compression and make no remote requests.

These checks improve accessibility but are not a full WCAG conformance certification or a complete assistive-technology audit.

## Tooling

The official installer CLI is 4.1.0, the installed skill metadata is 4.5.0, and its launcher pins engine 0.1.11. Guidance, launchers, and the upstream Apache license are checked into source. Platform binaries are ignored; the official launcher obtains its checksum-verified pinned engine when needed. No engine or skill file is imported by Vite or delivered to site visitors.
