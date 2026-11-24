# Wing-Engine Viewer (standalone)

The browser viewer for Wing-Engine: `/` replay viewer and `/play` live game.
It is a SvelteKit app with **no game rules in TypeScript** — every rule,
question, legality check and replay comes from the engine via its HTTP API.

## Engine dependency

This repo does not contain the Rust engine. It is pinned to one definitive
engine build in [`engine.lock.json`](engine.lock.json):

- repo: `https://github.com/Francespo/Wing-Engine.git`
- commit: `75bdd2a06a71bddb0d67a77bb594952b098a4e40` (the unified engine:
  viewer-parity + main, zero feature loss)
- schemas: `wing-engine/live@1`, `wing-engine/replay@1`, `wing-engine/list@1`
- replay fixtures are byte-pinned to that engine's `--release` output

`npm run test:contract` checks the pin (fixture sha256, schema strings in the
client, 21 question kinds). `npm run verify` runs check + tests + contract.

### Running against the engine

Build this viewer, then start the pinned engine pointing at the build:

```sh
cd web && npm ci && npm run build
# from the engine repo, with the unified engine binary:
./target/release/we-serve --addr 127.0.0.1:8787 --web /root/dev/Wing-Viewer-Standalone/web/build
```

Open `http://127.0.0.1:8787/` (replay) or `/play` (live). The engine serves
both the API and this viewer's static build, so there is no CORS setup.

## Layout

- `web/src/routes/` — `/` replay, `/play` live, `/play/tournament` list play
- `web/src/lib/components/` — Board (real scanned assets), pickers, roster,
  inspector, dice, squad panel, tour overlay, optional picker
- `web/src/lib/` — `live.ts` (API client + schema validation), `replay.ts`,
  `board-art.ts` / `ship-sprites.ts` / `obstacle-art.ts` (asset resolution),
  `squad-store.ts`, `tour.ts`, `xws-preview.ts`
- `web/static/models/` — scanned TTS/Fly Casual ships, bases, cards, dice,
  tokens, obstacles, mats and rulers (presentation assets only)
- `web/static/replays/` — engine-produced fixtures pinned by `engine.lock.json`
- `scripts/check-engine-contract.mjs` — the executable engine pin

## Verification

```sh
cd web && npm ci && npm run verify && npm run build
```
