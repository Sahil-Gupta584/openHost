# Style Lock — OpenHost ("Warm Ink")

## Source
Extracted deterministically from https://excerpt-rho.vercel.app CSS tokens
(`assets/index-BuBcSBoV.css`, `:root`) on 2026-10-21 — not from a vibe summary.

## Color contract (verified with WCAG math)
| Role | Hex | Live |
|---|---|---|
| ground / `--background` | `#0A0A0A` | page bg |
| raise / `--card` | `#131313` | cards, modals |
| hover / `--secondary` `--muted` | `#1A1A1A` | hover fills |
| warm accent fill / `--accent` | `#171913` | menu hovers |
| line / `--border` `--input` | `#232323` | borders |
| ink / `--foreground` | `#F4F3F1` | body text |
| paper / `--primary` | `#F1F0DD` | CTAs, active states |
| on-primary / `--primary-foreground` | `#0A0A0A` | button labels |
| dim / `--muted-foreground` | `#8C8C8C` | secondary text |
| ember / `--ember` | `#FF4D0F` | terminal arrows, decorative chip |
| ok / `--success` | `#5BD08A` | success, badges |
| warn / `--warning` | `#E8C77A` | warnings |
| bad / `--destructive` | `#FF4D4D` | errors |

Text-safe (≥4.5:1): ink·ground 17.9, ground·paper 17.2, dim·ground 5.9,
ember·ground 6.0, ok·ground 10.2, warn·ground 12.1, bad·ground 6.1,
ink·raise 16.8, dim·raise 5.5.
UI-safe: faint `#777777`·ground 4.4 — tertiary/disabled only, never body copy.
Legal pairings only — new pairings must be re-measured before shipping.

## Type
- Display: **Instrument Serif** (400, normal+italic) — headlines, tight -0.02em.
- Body: **Archivo** (variable) — replaces Inter everywhere.
- Labels/eyebrows: **IBM Plex Mono** 400/500 — uppercase, tracking 0.16–0.18em,
  11px, muted-foreground. NO pill borders on eyebrows.

## Shape & rhythm
- Radius 14px (`--radius: 0.875rem`); landing CTAs are rounded-full pills.
- Film grain: fixed `body::after` noise overlay at 3% (pointer-events none).
- Hairline borders at 60–80% opacity; no heavy shadows except mockup frames.
- Glows: cream `bg-primary/10`, ember `bg-ember/10` only — no colored blobs.

## Motion
- Existing reveal system kept (fade-up, cubic-bezier(0.21,1,0.41,1),
  reduced-motion honored). No new transitions over 300ms.

## Anti-slop decisions
- Gradient text ELIMINATED from hero (was from-primary via-primary to-accent clip).
- Hero headline is serif/plain-text with an italic second line, no gradients.
- Cyan accent removed everywhere; semantic states use ok/warn/bad/ember.
