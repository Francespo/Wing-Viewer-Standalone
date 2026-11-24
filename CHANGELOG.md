# Changelog — Wing-Engine Viewer

Semantic versioning. This repo is versioned independently of the engine;
the exact engine build is pinned in `engine.lock.json`.

## [0.2.0] — 2026-11-24 — standalone viewer, unified engine pin

### Added
- Standalone repo: viewer separated from the Rust engine. The engine is a
  pinned HTTP dependency (`engine.lock.json`, `test:contract`), not a submodule.
- Real scanned TTS/Fly Casual assets on the board: ships, faction bases,
  obstacle scans clipped to exact silhouettes, token icons, damage cards,
  dice, mats and rulers (`board-art.ts`, `ship-sprites.ts`, `obstacle-art.ts`).
- Full 4GG parity viewer: setup/ship poses, batch confirm, rulers/templates,
  snap-drag, optional fast path, undo, keyboard, tabs, match scoreboard,
  card details, squad library + XWS import, guided tour, host-seat curtain,
  difficulty/sandbox/seat UI.
- Executable engine contract check (fixture sha256, schema strings, 21 kinds).
- `npm run verify` gate (svelte-check + Vitest + contract).

### Engine pin
- Unified engine commit `75bdd2a0` (viewer-parity + main, zero feature loss).
- Replay fixtures: seed-7 `101c117d…`, aces `9987dc7c…`, Epic as pinned.

## [0.1.0] — earlier

- The viewer lived inside the Wing-Engine repo; wave-based development.
