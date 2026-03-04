import { storage } from '../utils/storage';
import type { SavedGame } from '../types';

// Saved PGN list with load/delete/download actions.
interface SavedGamesProps {
  games: SavedGame[];
  onLoad: (game: SavedGame) => void;
  onDeleted: (nextGames: SavedGame[]) => void;
}

export function SavedGames({ games, onLoad, onDeleted }: SavedGamesProps) {
  const onDelete = (id: string) => {
    storage.deleteSavedGame(id);
    onDeleted(storage.getSavedGames());
  };

  const onDownload = (game: SavedGame) => {
    const blob = new Blob([game.pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fancy-chess-${game.id}.pgn`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Saved Games</h2>

      {games.length === 0 ? <p className="text-xs text-slate-400">No saved games yet.</p> : null}

      <div className="max-h-56 space-y-2 overflow-auto pr-1">
        {games.map((game) => (
          <div key={game.id} className="rounded-md border border-slate-700 bg-slate-800 p-2 text-xs">
            <p className="font-medium text-slate-100">{new Date(game.date).toLocaleString()}</p>
            <p className="text-slate-300">{game.difficulty} • {game.playerColor === 'w' ? 'White' : 'Black'} • {game.result}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded bg-blue-600 px-2 py-1 hover:bg-blue-500" onClick={() => onLoad(game)} type="button">Load</button>
              <button className="rounded bg-indigo-600 px-2 py-1 hover:bg-indigo-500" onClick={() => onDownload(game)} type="button">PGN</button>
              <button className="rounded bg-rose-700 px-2 py-1 hover:bg-rose-600" onClick={() => onDelete(game.id)} type="button">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
