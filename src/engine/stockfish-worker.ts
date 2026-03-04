import createStockfish from 'stockfish';

import type { SearchOptions } from '../types';

// Stockfish UCI wrapper that exposes async init/search APIs.
interface StockfishInstance {
  postMessage: (command: string) => void;
  onmessage: ((event: string | { data: string }) => void) | null;
  terminate?: () => void;
}

const normalizeMessage = (event: string | { data: string }): string => {
  return typeof event === 'string' ? event : event.data;
};

export class StockfishEngine {
  private engine: StockfishInstance | null = null;

  private ready = false;

  private pendingBestMove: {
    resolve: (move: string) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  } | null = null;

  async init(): Promise<void> {
    if (this.ready) {
      return;
    }

    this.engine = createStockfish() as unknown as StockfishInstance;

    await new Promise<void>((resolve, reject) => {
      if (!this.engine) {
        reject(new Error('Stockfish engine was not created'));
        return;
      }

      const timeoutId = window.setTimeout(() => {
        reject(new Error('Stockfish initialization timed out'));
      }, 10_000);

      this.engine.onmessage = (event) => {
        const message = normalizeMessage(event);
        if (message.includes('uciok')) {
          this.engine?.postMessage('isready');
        }
        if (message.includes('readyok')) {
          window.clearTimeout(timeoutId);
          this.ready = true;
          resolve();
        }
      };

      this.engine.postMessage('uci');
    });
  }

  setPosition(fen: string): void {
    if (!this.engine || !this.ready) {
      throw new Error('Stockfish engine is not initialized');
    }

    this.engine.postMessage(`position fen ${fen}`);
  }

  async search(options: SearchOptions): Promise<string> {
    if (!this.engine || !this.ready) {
      throw new Error('Stockfish engine is not initialized');
    }
    if (this.pendingBestMove) {
      this.stop();
    }

    const commandParts: string[] = ['go'];
    if (typeof options.depth === 'number') {
      commandParts.push('depth', String(options.depth));
    }
    if (typeof options.movetime === 'number') {
      commandParts.push('movetime', String(options.movetime));
    }

    if (typeof options.skillLevel === 'number') {
      this.engine.postMessage(`setoption name Skill Level value ${options.skillLevel}`);
    }

    const command = commandParts.join(' ');

    return new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingBestMove = null;
        reject(new Error('Stockfish search timed out'));
      }, 10_000);

      this.pendingBestMove = {
        resolve,
        reject,
        timeoutId,
      };

      this.engine!.onmessage = (event) => {
        const message = normalizeMessage(event);

        if (!message.startsWith('bestmove')) {
          return;
        }

        const move = message.split(' ')[1] ?? '';
        window.clearTimeout(timeoutId);
        this.pendingBestMove = null;
        resolve(move);
      };

      this.engine!.postMessage(command);
    });
  }

  stop(): void {
    if (!this.engine) {
      return;
    }

    this.engine.postMessage('stop');
    if (this.pendingBestMove) {
      window.clearTimeout(this.pendingBestMove.timeoutId);
      this.pendingBestMove.reject(new Error('Stockfish search stopped'));
      this.pendingBestMove = null;
    }
  }

  quit(): void {
    if (!this.engine) {
      return;
    }

    this.stop();
    this.engine.postMessage('quit');
    this.engine.terminate?.();
    this.engine = null;
    this.ready = false;
  }
}
