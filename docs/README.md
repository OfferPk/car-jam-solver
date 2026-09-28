# Car Jam Solver

**Version:** `1.0.0-complete`  
**App ID:** `com.offerpk.carjam`  
**Path:** `/workspace/games/car-jam-solver`

Offline traffic-jam / parking sorting puzzle. Plan vehicle order so limited parking doesn’t fill. Passengers board only matching-color vehicles. Full vehicles exit → free slots → CLEAR xN combos. Wrong choices soft-lock into **TRAFFIC JAM**.

## Play

```bash
cd /workspace/games/car-jam-solver
npm start
# → http://localhost:4180
```

Or open `index.html` / use `dist/car-jam-solver-web/PLAY-WINDOWS.bat`.

## Core loop

1. Queue of color passengers (front boards first).
2. Tap a waiting vehicle → pulls into an empty parking slot.
3. Matching passengers auto-board; full vehicle drives away; slot frees.
4. Win: clear all passengers & vehicles. Lose: parking full with no valid board.

No countdown timer on normal levels. No luck. Boosters optional, never required.

## Content

| World | Levels | Theme |
|-------|--------|-------|
| Downtown | 1–20 | Handcrafted tutorial / early |
| Airport | 21–40 | Procedural + solver-validated |
| Beach | 41–60 | 4 colors + locks |
| Night City | 61–80 | 5 colors + obstacles params |
| Highway | 81–120 | Advanced |

- **120 levels** total. Generator params: colors, vehicles, capacities, slots, locks, difficulty.
- **Auto-solver** (`js/solver.js` BFS) validates every generated level; unsolvable discarded / fallback.

## Meta

- Stars 1–3 (complete / limited mistakes / no booster + target moves)
- Coins 100 / 150 / 200 (configurable via `coinReward`)
- Undo: 1 free per level (full state); more via coins / inventory / rewarded stub
- Boosters: Undo, Extra Parking, Remove Vehicle, Clear Parking, Passenger Skip
- Garage skins (cosmetic): Classic, Taxi, Police, Sports, SUV, MiniBus, Neon, Luxury
- Daily Challenge: local date seed, bonus coins, 7-day streak field, offline
- Save: `localStorage` key `carjam_save_v1`
- Ads stubs: rewarded coins/undo; interstitial between levels — never blocks puzzle core

## Screens

Main (PLAY | DAILY | GARAGE | SETTINGS) → Map/world → Level play → Win / TRAFFIC JAM fail.

## Tech

- Vanilla HTML/CSS/JS, DOM 2.5D angled cars (no heavy engine)
- Offline PWA (`sw.js` cache `carjam-v1-20260928-complete`)
- Capacitor scaffold `com.offerpk.carjam`, `webDir: www`
- Artifacts: `www/`, `docs/`, `dist/car-jam-solver-web-windows.zip`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Serve on :4180 |
| `npm test` / `npm run smoke` | Solver unit + sample levels |
| `npm run build:web` | Refresh www + docs + Windows zip |

## Privacy

Short page: `privacy.html` — local-only save, no accounts in this build.
