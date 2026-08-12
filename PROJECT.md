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
| `src/app/` | App shell and root composition |
| `src/features/` | Product features (put the next feature here) |
| `src/shared/ui/` | Reusable UI primitives |
| `src/styles/` | Tokens and global CSS |

## Rules for collaborators (including AI)

- Extend this structure; do not invent a parallel layout.
- Demo content under the shell is disposable—replace it when the product direction is clear.
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

- Active: `admin`
- Overlay path: `archetype/` (feature slots + IA)
- **Canvas applied** into the demo UI where supported (React/HTML/Expo/Electron) — your archetype choice should look different on day one.
- Merge slots into your template feature folder; keep demo disposable.
