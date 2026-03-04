import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Board3D } from './components/Board3D';
import { GameControls } from './components/GameControls';
import { GameInfo } from './components/GameInfo';
import { NewGameModal } from './components/NewGameModal';
import { PromotionModal } from './components/PromotionModal';
import { SavedGames } from './components/SavedGames';
import { SettingsPanel } from './components/SettingsPanel';
import { Timer } from './components/Timer';
import { useChessGame } from './hooks/useChessGame';
import { useSound } from './hooks/useSound';
import { storage } from './utils/storage';
import type { Difficulty, SavedGame, TimerMode } from './types';

// Top-level app shell for Fancy Chess.
const isTerminalStatus = (status: string): boolean => {
  return status === 'checkmate' || status === 'stalemate' || status === 'draw' || status === 'timeout';
};

const statusText = (status: string): string => {
  if (status === 'checkmate') return 'Checkmate';
  if (status === 'stalemate') return 'Stalemate';
  if (status === 'draw') return 'Draw';
  if (status === 'timeout') return 'Timeout';
  if (status === 'check') return 'Check';
  if (status === 'playing') return 'Playing';
  return 'Idle';
};

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown rendering error',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
          <div className="mx-auto max-w-2xl rounded-xl border border-rose-700 bg-rose-950/40 p-6">
            <h1 className="text-2xl font-bold">Rendering Error</h1>
            <p className="mt-2 text-sm text-rose-200">{this.state.message}</p>
            <p className="mt-3 text-sm text-slate-300">WebGL may be unsupported in this browser.</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const {
    gameState,
    isAiReady,
    startNewGame,
    selectSquare,
    undoMove,
    requestHint,
    dismissHint,
    resignGame,
    saveGame,
    loadGame,
    selectPromotion,
  } = useChessGame();

  const { playMove, playCapture, playCheck, playGameEnd } = useSound();

  const settings = useMemo(() => storage.getSettings(), []);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [cameraAngle, setCameraAngle] = useState<'white' | 'black' | 'top'>(settings.cameraAngle);
  const [isNewGameOpen, setIsNewGameOpen] = useState(false);
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => storage.getSavedGames());

  const lastMoveCountRef = useRef(0);
  const lastStatusRef = useRef(gameState.status);
  const lastSavedKeyRef = useRef('');

  useEffect(() => {
    const history = gameState.chess.history({ verbose: true });
    const currentCount = history.length;

    if (currentCount > lastMoveCountRef.current) {
      const lastMove = history[history.length - 1];
      if (lastMove?.captured) {
        playCapture();
      } else {
        playMove();
      }
    }

    lastMoveCountRef.current = currentCount;
  }, [gameState.chess, playCapture, playMove]);

  useEffect(() => {
    if (gameState.status === 'check' && lastStatusRef.current !== 'check') {
      playCheck();
    }

    if (isTerminalStatus(gameState.status) && !isTerminalStatus(lastStatusRef.current)) {
      playGameEnd();

      const key = `${gameState.chess.pgn()}::${gameState.status}`;
      if (lastSavedKeyRef.current !== key) {
        saveGame();
        setSavedGames(storage.getSavedGames());
        lastSavedKeyRef.current = key;
      }
    }

    lastStatusRef.current = gameState.status;
  }, [gameState.chess, gameState.status, playCheck, playGameEnd, saveGame]);

  const startGameFromModal = (config: { difficulty: Difficulty; timer: TimerMode; playerColor: 'w' | 'b' }) => {
    storage.updateSettings({ lastDifficulty: config.difficulty, lastTimer: config.timer });
    startNewGame(config);
    setIsNewGameOpen(false);
    dismissHint();
  };

  const saveCurrentGame = () => {
    saveGame();
    setSavedGames(storage.getSavedGames());
  };

  const onLoadGame = (savedGame: SavedGame) => {
    loadGame(savedGame);
    dismissHint();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-3 text-slate-100 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Fancy Chess</h1>
            <p className="text-sm text-slate-300">3D board + Stockfish AI</p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
            {isAiReady ? 'AI Ready' : 'Initializing AI...'}
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[300px_1fr_320px] lg:gap-4">
          <section className="order-2 space-y-3 lg:order-1">
            <GameControls
              onNewGame={() => setIsNewGameOpen(true)}
              onUndo={undoMove}
              onHint={requestHint}
              onResign={resignGame}
              onSave={saveCurrentGame}
              hintsRemaining={gameState.hintsRemaining}
              canUndo={gameState.chess.history().length > 0}
              status={gameState.status}
            />
            <Timer playerTimeMs={gameState.playerTimeMs} aiTimeMs={gameState.aiTimeMs} />
            <GameInfo chess={gameState.chess} status={gameState.status} playerColor={gameState.playerColor} />
          </section>

          <section className="order-1 lg:order-2">
            <Board3D
              fen={gameState.chess.fen()}
              selectedSquare={gameState.selectedSquare}
              validMoves={gameState.validMoves}
              onSquareClick={selectSquare}
              lastMove={gameState.lastMove}
              cameraAngle={cameraAngle}
              hint={gameState.currentHint}
            />

            {isTerminalStatus(gameState.status) ? (
              <div className="mt-3 rounded-xl border border-emerald-700 bg-emerald-900/30 p-3 text-sm">
                Game finished: <span className="font-semibold">{statusText(gameState.status)}</span>
              </div>
            ) : null}
          </section>

          <section className="order-3 space-y-3">
            <SettingsPanel
              soundEnabled={soundEnabled}
              cameraAngle={cameraAngle}
              onSoundEnabledChange={setSoundEnabled}
              onCameraAngleChange={setCameraAngle}
            />
            <SavedGames games={savedGames} onLoad={onLoadGame} onDeleted={setSavedGames} />
          </section>
        </div>
      </div>

      <NewGameModal
        open={isNewGameOpen}
        defaults={{
          difficulty: storage.getSettings().lastDifficulty,
          timer: storage.getSettings().lastTimer,
          playerColor: gameState.playerColor,
        }}
        onClose={() => setIsNewGameOpen(false)}
        onStart={startGameFromModal}
      />

      <PromotionModal
        open={Boolean(gameState.promotionPending)}
        color={gameState.chess.turn()}
        onSelect={selectPromotion}
      />
    </main>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
