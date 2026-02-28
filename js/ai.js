(() => {
  class StockfishAI {
    constructor() {
      this.worker = null;
      this.ready = false;
      this.initFailed = false;
      this.currentResolve = null;
      this.currentReject = null;
      this.timeoutId = null;
      this.workerBlobUrl = null;
      this.readyResolve = null;
      this.readyReject = null;
      this.readyPromise = new Promise((resolve, reject) => {
        this.readyResolve = resolve;
        this.readyReject = reject;
      });
      this.initPromise = this.init();
    }

    async init() {
      try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.js');
        if (!res.ok) {
          throw new Error(`Stockfish fetch failed: ${res.status}`);
        }
        const blob = await res.blob();
        this.workerBlobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(this.workerBlobUrl);
      } catch (err) {
        console.error('Stockfish worker failed to initialize', err);
        this.initFailed = true;
        this.rejectReady(err);
        return;
      }

      this.worker.onmessage = (event) => {
        const line = String(event.data || '').trim();

        if (line === 'readyok') {
          this.ready = true;
          this.resolveReady();
          return;
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/);
          const move = parts[1];
          if (this.currentResolve && move && move !== '(none)') {
            const resolve = this.currentResolve;
            this.clearPending();
            resolve(move);
          }
        }
      };

      this.worker.onerror = (event) => {
        const err = new Error(event.message || 'Stockfish worker error');
        console.error(err);
        this.initFailed = true;
        this.ready = false;
        this.rejectReady(err);
        this.rejectPending(err);
      };

      this.send('uci');
      this.send('isready');
    }

    resolveReady() {
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
        this.readyReject = null;
      }
    }

    rejectReady(err) {
      if (this.readyReject) {
        this.readyReject(err);
        this.readyResolve = null;
        this.readyReject = null;
      }
    }

    clearPending() {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      this.currentResolve = null;
      this.currentReject = null;
    }

    rejectPending(err) {
      if (this.currentReject) {
        const reject = this.currentReject;
        this.clearPending();
        reject(err);
      }
    }

    async waitUntilReady() {
      await this.initPromise;
      if (this.ready) {
        return;
      }
      if (this.initFailed) {
        throw new Error('Stockfish unavailable');
      }
      await this.readyPromise;
    }

    send(cmd) {
      if (this.worker) {
        this.worker.postMessage(cmd);
      }
    }

    stop() {
      this.send('stop');
      this.rejectPending(new Error('Stockfish search stopped'));
    }

    async getBestMove(fen, depth) {
      await this.waitUntilReady();

      if (this.currentResolve) {
        this.send('stop');
        this.rejectPending(new Error('Stockfish request superseded'));
      }

      return new Promise((resolve, reject) => {
        if (!this.worker) {
          reject(new Error('Stockfish unavailable'));
          return;
        }

        this.currentResolve = resolve;
        this.currentReject = reject;
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);

        this.timeoutId = setTimeout(() => {
          this.rejectPending(new Error('Stockfish timeout'));
        }, 15000);
      });
    }

    terminate() {
      this.stop();
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      if (this.workerBlobUrl) {
        URL.revokeObjectURL(this.workerBlobUrl);
        this.workerBlobUrl = null;
      }
    }
  }

  window.StockfishAI = StockfishAI;
})();
