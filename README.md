# Derby Rush–style Slot (with Hold & Respin)

A browser slot game in the style of **Derby Rush**, extended with a **Hold & Respin** feature. Built with [PixiJS](https://pixijs.com/) and TypeScript on Vite. The game engine is fully headless (no rendering), with a thin Pixi view layer on top.

5 reels · 3 rows · 15 fixed paylines.

## Features

- **Base game** — payline wins, plus value-carrying Prize horses (Blue / Red / Gold).
- **Free Spins** — triggered by 3 Bonus (Scatter) symbols. Wilds appear, collect Prize values, and every 4 Wilds retrigger the feature with a rising win multiplier (×2 → ×3 → ×10).
- **Hold & Respin** — land 5 Trophy symbols to lock them and respin for more; each Trophy carries a bet multiplier, all collected when the feature ends.
- **Buy Bonus** / **Buy Hold & Respin** — jump straight into either feature.
- Animated reels, win presentations, sound effects, and an in-game Info / Paytable modal.

## Getting started

```bash
npm install
npm run dev      # start the dev server (Vite)
```

Then open the URL Vite prints (default http://localhost:5173).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local dev server. |
| `npm run build` | Type-check and build for production into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the unit tests (Vitest). |
| `npm run test:watch` | Run the tests in watch mode. |

## Project structure

```
src/
  core/      lifecycle, state machine, RNG, event bus
  config/    game tuning — symbols, paytable, paylines, reel strips, bonus config
  slot/      reel generation, payline & prize evaluation
  bonus/     Free Spins and Hold & Respin managers
  game/      headless engine (Game) + wallet
  ui/        PixiJS view — scene, reels, HUD, panels, modals
  audio/     Web Audio sprite player
  assets/    art + audio + the asset manifest
```

The view never owns game logic: the engine emits events, the scene renders state and forwards input.

## Debugging

The engine is exposed on `window.game` for quick console play:

```js
await game.spin()                  // base spin
game.buyBonus('super')             // buy Free Spins, then loop: await game.spin()
game.buyHoldAndRespin()            // buy into Hold & Respin (3× the bet)
game.debugTriggerHoldAndRespin()   // force Hold & Respin (free, debug)
```

## Tech

PixiJS 8 · TypeScript · Vite · Vitest. Audio plays from a single sprite via the Web Audio API.

> This is a demo project for entertainment/educational purposes — not real-money gambling.
