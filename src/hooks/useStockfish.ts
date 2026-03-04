import { Chess } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { StockfishEngine } from '../engine/stockfish-worker';
import { getDifficultyConfig, HINT_CONFIG } from '../utils/difficulty';
import type { Difficulty, MoveDescriptor } from '../types';

// React hook that provides Stockfish best-move and hint helpers.
const parseUciMove = (uciMove: string): MoveDescriptor => {
  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotionRaw = uciMove.slice(4, 5);

  return {
    from,
    to,
    promotion: promotionRaw === 'q' || promotionRaw === 'r' || promotionRaw === 'b' || promotionRaw === 'n' ? promotionRaw : undefined,
  };
};

const fallbackMove = (fen: string): MoveDescriptor => {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  const pick = moves[Math.floor(Math.random() * moves.length)];
  if (!pick) {
    throw new Error('No legal moves available for fallback AI');
  }

  const promotion = pick.promotion === 'q' || pick.promotion === 'r' || pick.promotion === 'b' || pick.promotion === 'n'
    ? pick.promotion
    : undefined;

  return {
    from: pick.from,
    to: pick.to,
    promotion,
  };
};

export function useStockfish(): {
  isReady: boolean;
  getBestMove: (fen: string, difficulty: Difficulty) => Promise<MoveDescriptor>;
  getHint: (fen: string) => Promise<{ from: string; to: string }>;
  stop: () => void;
  destroy: () => void;
} {
  const engineRef = useRef<StockfishEngine | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engine
      .init()
      .then(() => {
        if (mounted) {
          setIsReady(true);
        }
      })
      .catch((error) => {
        console.error('Stockfish init failed, fallback AI will be used.', error);
      });

    return () => {
      mounted = false;
      engine.quit();
      engineRef.current = null;
      setIsReady(false);
    };
  }, []);

  const getBestMove = useCallback(async (fen: string, difficulty: Difficulty): Promise<MoveDescriptor> => {
    const engine = engineRef.current;

    if (!engine || !isReady) {
      return fallbackMove(fen);
    }

    try {
      engine.setPosition(fen);
      const uciMove = await engine.search(getDifficultyConfig(difficulty));
      if (uciMove.length < 4) {
        return fallbackMove(fen);
      }
      return parseUciMove(uciMove);
    } catch (error) {
      console.error('Stockfish search failed, using fallback AI.', error);
      return fallbackMove(fen);
    }
  }, [isReady]);

  const getHint = useCallback(async (fen: string): Promise<{ from: string; to: string }> => {
    const engine = engineRef.current;
    if (!engine || !isReady) {
      const move = fallbackMove(fen);
      return { from: move.from, to: move.to };
    }

    try {
      engine.setPosition(fen);
      const uciMove = await engine.search(HINT_CONFIG);
      const parsed = parseUciMove(uciMove);
      return { from: parsed.from, to: parsed.to };
    } catch (error) {
      console.error('Hint search failed, using fallback hint.', error);
      const move = fallbackMove(fen);
      return { from: move.from, to: move.to };
    }
  }, [isReady]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const destroy = useCallback(() => {
    engineRef.current?.quit();
    engineRef.current = null;
    setIsReady(false);
  }, []);

  return {
    isReady,
    getBestMove,
    getHint,
    stop,
    destroy,
  };
}
