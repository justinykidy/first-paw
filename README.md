# Fancy Chess

Fancy Chess is a browser-only 3D chess game built with React, TypeScript, Three.js (R3F), and chess.js. It supports Stockfish AI, four difficulty levels, hints, undo, timers, saved PGN games, and persisted settings.

## Features

- 3D chess board with interactive square selection and animated pieces
- Stockfish AI (easy / medium / hard / hell)
- Hint system with 3-use limit per game
- Timer modes: 3 min, 5 min, 10 min, unlimited
- Pawn promotion modal
- Undo, resign, and manual save
- Auto-save when game ends
- Saved games list with load / delete / PGN download
- Sound effects with on/off setting
- Camera angle setting (white / black / top)
- Responsive layout for desktop and mobile
- Error boundary fallback for rendering/WebGL issues

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- Three.js + @react-three/fiber + @react-three/drei
- chess.js
- stockfish
- howler

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Persistence

Local storage keys:

- `fancy-chess-settings`
- `fancy-chess-saved-games`

Saved games are capped at 50 entries (oldest removed first).

## Deployment

Configured for Vercel static deployment using `vercel.json`:

- COOP/COEP headers
- SPA rewrite to `/index.html`
