# Hospitality till

React + Vite till: PIN, dine-in map, takeaway, FOH tickets, kitchen MORE chits, guest `#/order`.

## Run

```bash
npm install
npm run dev
```

`npm run dev` listens on the LAN (`--host`). Open the **Network** URL on the till so a phone can reach `/api/snapshot`. `localhost` will not.

Starter PIN: `1234` (local gate, not a real secret). Process and screens: `docs/README.md`.

```bash
npm test
npm run build
```

## Folders

- `src/app` — PIN gate composition
- `src/features/till` — Dine in, Takeaway, Tickets, Kitchen
- `src/services` — check/chit rules (`pos.js`)
- `src/shared/ui` — reusable presentational pieces
- `src/styles` — tokens + global styles

Read `PROJECT.md` before reshaping architecture.

## Prerequisites

### Windows

- **Node.js 20 LTS or newer**
  - Installer: [nodejs.org](https://nodejs.org/) (LTS), **or**
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
- Verify: `node -v` and `npm -v` (new terminal after install)

### macOS

- **Homebrew:** `brew install node`
- **Official installer:** pkg from [nodejs.org](https://nodejs.org/) (LTS)
- **Version manager (optional):** install [nvm](https://github.com/nvm-sh/nvm), then `nvm install --lts`
- Verify: `node -v` and `npm -v`

### Linux

- **Official / binary:** [nodejs.org](https://nodejs.org/) or [NodeSource distributions](https://github.com/nodesource/distributions)
- **Debian/Ubuntu:** install Node 20+ via NodeSource or `nvm install --lts` (distro `nodejs` packages are often too old)
- **Fedora:** `sudo dnf install nodejs npm` (ensure ≥ 20) or use nvm
- **Arch:** `sudo pacman -S nodejs npm`
- Verify: `node -v` and `npm -v`

## Run

```bash
npm install
npm run dev
```

## Principles

- Small foundational structure
- Design tokens
- Disposable demo shell only — **replaced** by `src/features/till`
- Product logic lives in `src/services/pos.js`, not in presentational pieces

## Folders

- `src/app` — application shell / root UI
- `src/features` — **next feature goes here**
- `src/shared/ui` — reusable presentational pieces
- `src/styles` — tokens + global styles

Read `PROJECT.md` before reshaping architecture.
