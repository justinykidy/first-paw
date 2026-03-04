declare module 'stockfish/src/stockfish-nnue-16.js' {
  interface StockfishInstance {
    postMessage: (command: string) => void;
    onmessage: ((event: string | { data: string }) => void) | null;
    terminate?: () => void;
  }

  export default function createStockfish(): StockfishInstance;
}
