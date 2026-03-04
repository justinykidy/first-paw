import { Chess, type Square } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStockfish } from './useStockfish';
import { storage } from '../utils/storage';
import type { Difficulty, GameEndReason, GameState, GameStatus, SavedGame, TimerMode } from '../types';

// Core chess game state and actions, including AI and persistence.
const TIMER_TO_MS: Record<TimerMode, number> = {
  '3min': 3 * 60 * 1000,
  '5min': 5 * 60 * 1000,
  '10min': 10 * 60 * 1000,
  unlimited: Number.POSITIVE_INFINITY,
};

const isPromotionMove = (from: string, to: string, fen: string): boolean => {
  const chess = new Chess(fen);
  const piece = chess.get(from as Square);
  if (!piece || piece.type !== 'p') {
    return false;
  }

  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
};

const getResult = (winner: 'w' | 'b' | null, endReason: GameEndReason | null): string => {
  if (!endReason) {
    return '*';
  }
  if (winner === 'w') {
    return '1-0';
  }
  if (winner === 'b') {
    return '0-1';
  }
  if (endReason === 'draw' || endReason === 'stalemate') {
    return '1/2-1/2';
  }
  return '*';
};

const deriveStatus = (chess: Chess): GameStatus => {
  if (chess.isCheckmate()) {
    return 'checkmate';
  }
  if (chess.isStalemate()) {
    return 'stalemate';
  }
  if (chess.isDraw()) {
    return 'draw';
  }
  if (chess.inCheck()) {
    return 'check';
  }
  return 'playing';
};

const deriveEndState = (
  chess: Chess,
  status: GameStatus,
): { winner: 'w' | 'b' | null; endReason: GameEndReason | null } => {
  if (status === 'checkmate') {
    return { winner: chess.turn() === 'w' ? 'b' : 'w', endReason: 'checkmate' };
  }
  if (status === 'stalemate') {
    return { winner: null, endReason: 'stalemate' };
  }
  if (status === 'draw') {
    return { winner: null, endReason: 'draw' };
  }
  return { winner: null, endReason: null };
};

const initialTimer = (mode: TimerMode): number => {
  return TIMER_TO_MS[mode];
};

const defaultState = (): GameState => {
  const settings = storage.getSettings();
  const chess = new Chess();

  return {
    chess,
    playerColor: 'w',
    difficulty: settings.lastDifficulty,
    timerMode: settings.lastTimer,
    playerTimeMs: initialTimer(settings.lastTimer),
    aiTimeMs: initialTimer(settings.lastTimer),
    hintsRemaining: 3,
    currentHint: null,
    moveHistory: [],
    status: 'idle',
    winner: null,
    endReason: null,
    selectedSquare: null,
    validMoves: [],
    lastMove: null,
    promotionPending: null,
  };
};

export function useChessGame(): {
  gameState: GameState;
  isAiReady: boolean;
  startNewGame: (config: { difficulty: Difficulty; timer: TimerMode; playerColor: 'w' | 'b' }) => void;
  selectSquare: (square: string) => void;
  makeMove: (from: string, to: string, promotion?: string) => void;
  undoMove: () => void;
  requestHint: () => void;
  dismissHint: () => void;
  resignGame: () => void;
  saveGame: () => void;
  loadGame: (savedGame: SavedGame) => void;
  selectPromotion: (piece: 'q' | 'r' | 'b' | 'n') => void;
} {
  const { isReady, getBestMove, getHint } = useStockfish();
  const [gameState, setGameState] = useState<GameState>(defaultState);
  const gameRef = useRef(gameState);
  const isAiThinkingRef = useRef(false);
  const lastAiTurnFenRef = useRef<string | null>(null);

  useEffect(() => {
    gameRef.current = gameState;
  }, [gameState]);

  const aiColor = useMemo(() => (gameState.playerColor === 'w' ? 'b' : 'w'), [gameState.playerColor]);

  const applyTimerTick = useCallback(() => {
    setGameState((prev) => {
      if (prev.status !== 'playing' && prev.status !== 'check') {
        return prev;
      }
      if (prev.timerMode === 'unlimited') {
        return prev;
      }

      const chess = new Chess(prev.chess.fen());
      const playerTurn = chess.turn() === prev.playerColor;
      const amount = 100;

      if (playerTurn) {
        const nextTime = Math.max(0, prev.playerTimeMs - amount);
        const didTimeout = nextTime <= 0;
        return {
          ...prev,
          playerTimeMs: nextTime,
          status: didTimeout ? 'timeout' : prev.status,
          winner: didTimeout ? (prev.playerColor === 'w' ? 'b' : 'w') : prev.winner,
          endReason: didTimeout ? 'timeout' : prev.endReason,
        };
      }

      const nextTime = Math.max(0, prev.aiTimeMs - amount);
      const didTimeout = nextTime <= 0;
      return {
        ...prev,
        aiTimeMs: nextTime,
        status: didTimeout ? 'timeout' : prev.status,
        winner: didTimeout ? prev.playerColor : prev.winner,
        endReason: didTimeout ? 'timeout' : prev.endReason,
      };
    });
  }, []);

  useEffect(() => {
    if (gameState.status !== 'playing' && gameState.status !== 'check') {
      return;
    }
    if (gameState.timerMode === 'unlimited') {
      return;
    }

    const id = window.setInterval(applyTimerTick, 100);
    return () => window.clearInterval(id);
  }, [applyTimerTick, gameState.status, gameState.timerMode]);

  const runAiTurn = useCallback(async () => {
    const snapshot = gameRef.current;
    if (snapshot.status !== 'playing' && snapshot.status !== 'check') {
      return;
    }
    if (snapshot.chess.turn() !== (snapshot.playerColor === 'w' ? 'b' : 'w')) {
      return;
    }

    try {
      const requestedFen = snapshot.chess.fen();
      const move = await getBestMove(snapshot.chess.fen(), snapshot.difficulty);
      setGameState((prev) => {
        if ((prev.status !== 'playing' && prev.status !== 'check') || prev.chess.fen() !== requestedFen) {
          return prev;
        }

        const chess = new Chess(prev.chess.fen());
        const from = move.from;
        const to = move.to;
        const historyFen = prev.chess.fen();
        const result = chess.move({ from, to, promotion: move.promotion ?? 'q' });

        if (!result) {
          return prev;
        }

        const status = deriveStatus(chess);
        const endState = deriveEndState(chess, status);

        return {
          ...prev,
          chess,
          moveHistory: [...prev.moveHistory, historyFen],
          selectedSquare: null,
          validMoves: [],
          currentHint: null,
          lastMove: { from: result.from, to: result.to },
          status,
          winner: endState.winner,
          endReason: endState.endReason,
          promotionPending: null,
        };
      });
    } catch (error) {
      console.error('AI turn failed', error);
    }
  }, [getBestMove]);

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    setGameState((prev) => {
      const fenBefore = prev.chess.fen();

      if (!promotion && isPromotionMove(from, to, fenBefore)) {
        return {
          ...prev,
          promotionPending: { from, to },
          selectedSquare: null,
          validMoves: [],
        };
      }

      const chess = new Chess(fenBefore);
      const moveResult = chess.move({
        from,
        to,
        promotion: promotion === 'q' || promotion === 'r' || promotion === 'b' || promotion === 'n' ? promotion : undefined,
      });

      if (!moveResult) {
        return {
          ...prev,
          selectedSquare: null,
          validMoves: [],
        };
      }

      const status = deriveStatus(chess);
      const endState = deriveEndState(chess, status);
      return {
        ...prev,
        chess,
        moveHistory: [...prev.moveHistory, fenBefore],
        selectedSquare: null,
        validMoves: [],
        lastMove: { from: moveResult.from, to: moveResult.to },
        currentHint: null,
        status,
        winner: endState.winner,
        endReason: endState.endReason,
        promotionPending: null,
      };
    });
  }, []);

  useEffect(() => {
    if (gameState.status !== 'playing' && gameState.status !== 'check') {
      lastAiTurnFenRef.current = null;
      return;
    }
    if (gameState.chess.turn() !== aiColor) {
      lastAiTurnFenRef.current = null;
      return;
    }

    const fen = gameState.chess.fen();
    if (lastAiTurnFenRef.current === fen || isAiThinkingRef.current) {
      return;
    }

    lastAiTurnFenRef.current = fen;
    isAiThinkingRef.current = true;
    void runAiTurn().finally(() => {
      isAiThinkingRef.current = false;
    });
  }, [aiColor, gameState.chess, gameState.status, runAiTurn]);

  const startNewGame = useCallback((config: { difficulty: Difficulty; timer: TimerMode; playerColor: 'w' | 'b' }) => {
    const chess = new Chess();
    setGameState({
      chess,
      playerColor: config.playerColor,
      difficulty: config.difficulty,
      timerMode: config.timer,
      playerTimeMs: initialTimer(config.timer),
      aiTimeMs: initialTimer(config.timer),
      hintsRemaining: 3,
      currentHint: null,
      moveHistory: [],
      status: 'playing',
      winner: null,
      endReason: null,
      selectedSquare: null,
      validMoves: [],
      lastMove: null,
      promotionPending: null,
    });
  }, []);

  const selectSquare = useCallback((square: string) => {
    setGameState((prev) => {
      if (prev.status !== 'playing' && prev.status !== 'check') {
        return prev;
      }

      const chess = new Chess(prev.chess.fen());
      const currentTurn = chess.turn();
      const isPlayerTurn = currentTurn === prev.playerColor;
      if (!isPlayerTurn) {
        return prev;
      }

      const selectedPiece = prev.selectedSquare ? chess.get(prev.selectedSquare as Square) : undefined;
      const clickedPiece = chess.get(square as Square);

      if (prev.selectedSquare && selectedPiece) {
        const validTargets = chess.moves({ square: prev.selectedSquare as Square, verbose: true }).map((move) => move.to);
        if (validTargets.includes(square as Square)) {
          window.setTimeout(() => {
            makeMove(prev.selectedSquare!, square);
          }, 0);

          return {
            ...prev,
            selectedSquare: null,
            validMoves: [],
          };
        }
      }

      if (!clickedPiece || clickedPiece.color !== prev.playerColor) {
        return {
          ...prev,
          selectedSquare: null,
          validMoves: [],
        };
      }

      const validMoves = chess.moves({ square: square as Square, verbose: true }).map((move) => move.to);
      return {
        ...prev,
        selectedSquare: square,
        validMoves,
      };
    });
  }, [makeMove]);

  const undoMove = useCallback(() => {
    setGameState((prev) => {
      const chess = new Chess(prev.chess.fen());
      const firstUndo = chess.undo();
      if (!firstUndo) {
        return prev;
      }

      chess.undo();
      const status = deriveStatus(chess);
      const endState = deriveEndState(chess, status);
      const history = [...prev.moveHistory];
      history.pop();
      history.pop();
      return {
        ...prev,
        chess,
        moveHistory: history,
        selectedSquare: null,
        validMoves: [],
        lastMove: null,
        promotionPending: null,
        status,
        winner: endState.winner,
        endReason: endState.endReason,
      };
    });
  }, []);

  const requestHint = useCallback(() => {
    const snapshot = gameRef.current;
    if (
      snapshot.hintsRemaining <= 0 ||
      (snapshot.status !== 'playing' && snapshot.status !== 'check') ||
      snapshot.chess.turn() !== snapshot.playerColor
    ) {
      return;
    }

    getHint(snapshot.chess.fen())
      .then((hint) => {
        setGameState((prev) => ({
          ...prev,
          hintsRemaining: Math.max(0, prev.hintsRemaining - 1),
          currentHint: hint,
        }));
      })
      .catch((error) => {
        console.error('Hint request failed', error);
      });
  }, [getHint]);

  const dismissHint = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      currentHint: null,
    }));
  }, []);

  const resignGame = useCallback(() => {
    setGameState((prev) => {
      if (prev.status !== 'playing' && prev.status !== 'check') {
        return prev;
      }

      return {
        ...prev,
        status: 'resigned',
        winner: prev.playerColor === 'w' ? 'b' : 'w',
        endReason: 'resign',
      };
    });
  }, []);

  const saveGame = useCallback(() => {
    const snapshot = gameRef.current;
    const payload: SavedGame = {
      id: crypto.randomUUID(),
      pgn: snapshot.chess.pgn(),
      date: new Date().toISOString(),
      difficulty: snapshot.difficulty,
      result: getResult(snapshot.winner, snapshot.endReason),
      playerColor: snapshot.playerColor,
    };

    storage.saveGame(payload);
  }, []);

  const loadGame = useCallback((savedGame: SavedGame) => {
    const chess = new Chess();
    try {
      chess.loadPgn(savedGame.pgn);
    } catch (error) {
      console.error('Failed to load saved PGN');
      console.error(error);
      return;
    }

    const timer = storage.getSettings().lastTimer;
    const status = deriveStatus(chess);
    const endState = deriveEndState(chess, status);
    setGameState((prev) => ({
      ...prev,
      chess,
      difficulty: savedGame.difficulty,
      playerColor: savedGame.playerColor,
      timerMode: timer,
      playerTimeMs: initialTimer(timer),
      aiTimeMs: initialTimer(timer),
      hintsRemaining: 3,
      currentHint: null,
      moveHistory: [],
      selectedSquare: null,
      validMoves: [],
      lastMove: null,
      promotionPending: null,
      status,
      ...endState,
    }));
  }, []);

  const selectPromotion = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    const pending = gameRef.current.promotionPending;
    if (!pending) {
      return;
    }

    makeMove(pending.from, pending.to, piece);
  }, [makeMove]);

  return {
    gameState,
    isAiReady: isReady,
    startNewGame,
    selectSquare,
    makeMove,
    undoMove,
    requestHint,
    dismissHint,
    resignGame,
    saveGame,
    loadGame,
    selectPromotion,
  };
}
