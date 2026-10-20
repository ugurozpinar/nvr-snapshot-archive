# Kare / The observation desk

## Brief

Redesign the existing private camera archive for its single administrator. Preserve authentication, Turkish/English/Portuguese localization, camera configuration, retention controls and frame playback. No fabricated cameras, health metrics or sample surveillance imagery. Existing Express server and static HTML/CSS/JS are the stack: no framework migration or build overhead.

## Concepts considered

| Territory | Concept / signature / emotion / screenshot / anchor                                                                                                                                                          | Originality | Fit | Feasibility | Portability (lower better) |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --- | ----------- | -------------------------- |
| Material  | Observation desk: select a camera and its latest captured image slides into a large inspection stage. Calm precision. A camera image alongside oversized archive readings. Anchored in actual NVR snapshots. | 4           | 5   | 5           | 2                          |
| Identity  | Kare means square: a modular square mosaic reorganizes around the selected camera. Order. A square image matrix. Anchored in the Turkish name.                                                               | 3           | 4   | 4           | 3                          |
| Process   | Time strata: a vertical sediment of frames reveals retention layers. Reflective. A cutaway of archive history. Anchored in compaction and capture intervals.                                                 | 5           | 4   | 3           | 2                          |

Selected: observation desk. It makes the product's actual image content the signature, with immediate operational value.

## Concept card

Idea: An observation desk where every stored moment can be inspected.
Metaphor: Precision camera instrumentation and archival equipment.
Signature: Camera selection advances the latest real capture into an inspection stage, then opens that camera's dated archive.
Emotion: Quiet control, clear sight.
Motion verb: Advance and lock.
Screenshot: Large image stage, red capture marker, oversized readings, compact side navigation.

## System

Palette: ground #f5f5f2; ink #202321; muted #626760; line #daddd5; accent #bd3529; curtain #242824. Red is reserved for selection and capture identity; operational success remains green. White surfaces avoid a dark surveillance cliché.
Type: self-hosted Space Grotesk (Google Fonts) for display and UI, system monospace for timecodes. Fluid 38–76px display, 16px body at 1.5, 12–14px secondary UI. Negative display tracking, tabular metrics.
Grid: 224px navigation, 48px desktop gutters, 12-column logic. Metric instrument strip; 8/4 inspection split; full-width camera index. Mobile navigation becomes a compact top band; metrics remain a composed two-column readout, inspection stacks.
Shape: 3px controls, 8px image stage. No decorative shadows.
Motion: power3.out / 200–500ms, short image advance and navigation underline. Native scrolling; no smooth-scroll interception in this operational app. No loader. Still at rest is intentional: a monitoring tool must not imply a real capture or live video through decorative animation. Reduced motion disables translations and leaves all content visible.

## Composition

Status: [navigation | title + refresh] / [four connected readings] / [large capture | camera selector + archive action] / [camera status index].
Archive: [title] / [camera + date + action bar] / [image contact sheet] / [gaps and operations].
Settings: [title] / [two-column operational forms].
Authentication: [oversized brand + archival crosshair illustration | secure sign-in form].
404: [brand / missing-frame number / return link].

Genericness test: rejected equal floating metric cards, teal SaaS chrome and decorative live indicators. Connected instrument readings and actual camera imagery replace them. Private app remains noindex: public sitemap, fictional canonical and marketing case studies would be inappropriate.

## Assumptions

The administrator values a quiet, fast inspection workspace. Existing image endpoints are the source of truth. No image means an explicit empty state, never a sample photograph. Preview is the latest stored capture, not live video.

## Verification and review

Two full visual passes cover authentication, overview, archive and settings at desktop, tablet, phone and reduced motion. The second pass has no JavaScript errors, horizontal overflow or WCAG axe violations. A separate production-asset audit covers authentication and the actual HTTP 404. Authentication measures 1.32s throttled mobile LCP, zero CLS and approximately 61fps. The authenticated warm reload measures 532ms LCP and .034 CLS; this is a local fixture result, not a production network promise.

Independent visual reviews scored the second pass 7.55/10: Design 7.7, Usability 7.6, Creativity 7.1, Content 7.8. This is not an award claim. Follow-up improvements compact the phone overview, keep settings section navigation available while scrolling, and strengthen 404 contrast. The final accessory removed is the redundant crosshair above the inspection copy.

All five browser tests and 39 integration tests pass. Repository lint, syntax and changed-file formatting checks pass. The aggregate check stops on pre-existing README.md formatting. The static marketing audit counts all four hidden SPA headings as one document; rendered states each have one visible h1. Canonical links and a public sitemap are intentionally omitted for this noindex private application.

Run the application with `npm start`, using the existing environment configuration. There is no frontend build step. Restart the existing Node service to deploy the updated assets and 404 handler; no public deployment was performed. Font license is in public/fonts/OFL.txt. QA evidence is generated locally in .shots/ and excluded from Git. `node scripts/design-qa.js .shots/pass-1` expects the isolated browser helper server on port 3099, not a production archive.
