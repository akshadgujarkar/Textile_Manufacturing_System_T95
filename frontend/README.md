# Remix of Sales Attribution Dashboard

Build a marketing attribution analytics dashboard called "Meridian Attribution" — a public-facing template for enterprise buyers who currently use Looker, Tableau, or PowerBI. This is a showcase piece and visual craft is the primary requirement.

## What it is

A single-page attribution command center for a fictional B2B SaaS company (Meridian). It answers: which marketing channels actually drive revenue, and how does that answer change depending on which attribution model you believe?

## The hero interaction

A three-way attribution model toggle at the top: First touch / Linear / Last touch. Switching models recomputes every panel with a smooth animated transition (bars re-tween, scatter points slide, table rows reorder). This is the most important feature — it's what a static BI screenshot can never do. Make the transition deliberate and smooth, around 600-800ms with easing, not an instant snap.

Critical data-integrity rule: total attributed revenue must stay constant across all three models. The same conversions are only credited differently. If totals drift, the demo loses credibility with a finance-literate viewer.

## Panels

1. KPI strip across the top — attributed revenue, blended ROAS, top channel, average touchpoints per conversion. Top channel and ROAS change with the model; total revenue does not.

2. Channel contribution waterfall (hero panel, full width). Each channel's attributed revenue stacks left to right, building to a total bar. Floating bars, one color per channel, rounded ends, value labels. This panel produces the most dramatic reshuffle on model change, so give it room to breathe.

3. Spend vs return scatter — x axis spend, y axis ROAS, bubble radius sized to budget. Dashed horizontal reference line at the 4x ROAS target. Bubbles animate to new positions on model change. Hover tooltip with channel name, spend, ROAS, attributed revenue.

4. Conversion path analysis — the most common multi-touch journeys, rendered as horizontal chips with arrows between them (e.g. Paid Social to Email to Paid Search), each row showing share of conversions and average days to close. Chip colors match channel colors used elsewhere.

5. Channel detail table — sortable, with inline sparklines showing 12-week trend per channel. Columns: channel, spend, attributed revenue, ROAS, conversions, CPA, trend. Rows reorder with animation when the model changes.

## Design direction

Deliberately do NOT use a Sankey diagram — a sibling template in this library already owns that visual and I don't want the house style to look thin.

Dense but breathable. Card-based layout on a subtle page background, generous internal padding, hairline borders rather than heavy shadows. A restrained categorical palette of 7 channel colors held consistent across every panel so a channel's color is its identity everywhere. Color encodes the entity, never its rank — re-sorting must not repaint anything.

Tabular figures for all numbers. Clear typographic hierarchy: large hero numbers, medium panel titles, small muted axis labels. Sentence case throughout.

Full dark mode support with a toggle, and make dark mode genuinely good rather than an inverted afterthought — this template gets screenshotted and dark is usually what people share.

Fully responsive. On mobile panels stack and the waterfall scrolls horizontally rather than squashing.

## Data

Seed with realistic static data in a well-organized TypeScript module — no backend or auth needed. Seven channels: Paid Search, Paid Social, Email, Organic, Display, Referral, Direct. Roughly 12,500 conversions and $2.3M attributed revenue for the quarter. Build per-model splits so the story is legible: Paid Social and Display over-index on first touch (they start journeys), Email and Paid Search over-index on last touch (they close them), Organic and Direct sit in between. Include 12 weeks of trend data per channel for sparklines.

Structure the data module so someone remixing this template can swap in their own numbers by editing one file. Comment clearly where real data would connect.

## Before you build

Give me a short plan first: component structure, which charting library you're using and why, and how you're handling the animated recompute. Then build it.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb10bd62-9ef4-4141-8ca9-45fceab45089).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
