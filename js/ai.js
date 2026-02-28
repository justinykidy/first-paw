(() => {
  class StockfishAI {
    constructor() {
      this.worker = null;
      this.ready = false;
      this.currentResolve = null;
      this.currentReject = null;
      this.timeoutId = null;
      this.init();
    }

    init() {
      try {
        this.worker = new Worker('https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.js');
      } catch (err) {
        console.error('Stockfish worker failed to initialize', err);
        return;
      }

      this.worker.onmessage = (event) => {
        const line = String(event.data || '').trim();

        if (line === 'readyok') {
          this.ready = true;
          return;
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/);
          const move = parts[1];
          if (this.currentResolve) {
            clearTimeout(this.timeoutId);
            this.currentResolve(move);
            this.currentResolve = null;
            this.currentReject = null;
          }
        }
      };

      this.send('uci');
      this.send('isready');
    }

    send(cmd) {
      if (this.worker) {
        this.worker.postMessage(cmd);
      }
    }

    getBestMove(fen, depth) {
      return new Promise((resolve, reject) => {
        if (!this.worker) {
          reject(new Error('Stockfish unavailable'));
          return;
        }

        if (this.currentResolve) {
          this.send('stop');
        }

        this.currentResolve = resolve;
        this.currentReject = reject;
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);

        this.timeoutId = setTimeout(() => {
          if (this.currentReject) {
            this.currentReject(new Error('Stockfish timeout'));
            this.currentResolve = null;
            this.currentReject = null;
          }
        }, 15000);
      });
    }

    terminate() {
      if (this.worker) {
        this.worker.terminate();
      }
    }
  }

  window.StockfishAI = StockfishAI;
})();
