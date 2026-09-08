# PROJECT

## Stack

- React + Vite
- JavaScript
- CSS design tokens

## Language overlay

Follow `core/languages/javascript.md` from the starters catalog (copy or keep nearby when generating).

## Map

| Path | Role |
|---|---|
| `src/app/` | PIN gate + till composition |
| `src/features/till/` | Dine in, Book, Takeaway, Tickets, Kitchen, Stock, Roster, History, Settings |
| `src/features/staff/` | Staff clock (`#/clock`) — same venue snapshot, no till shell |
| `src/services/` | Check/chit domain (`pos.js`), persist, live venue config, venue snapshot, `npm start` host; guest claims pending vs accepted |
| `src/shared/ui/` | Reusable UI primitives |
| `src/styles/` | Tokens and global CSS |

## Rules for collaborators (including AI)

- Extend this structure; do not invent a parallel layout.
- Demo content under the shell is disposable—replace it when the product direction is clear. The admin demo is gone; till screens are the product.
- Reuse design tokens before adding one-off colors/spacing.
- Keep business logic and API I/O out of pure presentational pieces when practical.


## Documentation contract

This project includes `docs/agile`, `docs/devops`, and `docs/engineering`.

When you ship work:

- follow `docs/agile/DEFINITION_OF_DONE.md`
- update backlog/sprint/stories for user-visible features
- update devops docs when run/deploy/config assumptions change
- write/update tests per `docs/engineering/TESTING_STRATEGY.md`
- keep architecture notes / ADRs current for meaningful decisions


## Archetype

- Active: `admin` canvas was the starting IA; product UI is now `src/features/till`

## Product north star

One venue, one vertical at a time.

- **Now:** this till is a **restaurant OS** — check vs chit, floor, kitchen MORE, guest `#/order`, staff `#/clock`, hours on the venue snapshot. That is the wedge.
- **Later:** extract a **kernel** (catalog, tax, tender, staff, hours, close, venue identity) and a **retail client** (counter sale, barcode, inventory — no tables). Boutique retail is a second face, not a flag on this till.
- **Much later:** supermarket / grocery is a different scale (SKU volume, lanes, promotions, hardware, real DB). Not a theme. Not this year.

Rules we already bought: one venue, the snapshot is the DB, no SQL until we leave one LAN, no processor yet, hide unused nav.
