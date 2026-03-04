// Pawn promotion picker modal.
interface PromotionModalProps {
  open: boolean;
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
}

const labels: Record<'q' | 'r' | 'b' | 'n', string> = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
};

export function PromotionModal({ open, color, onSelect }: PromotionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Choose Promotion</h2>
        <p className="mt-1 text-sm text-slate-300">{color === 'w' ? 'White' : 'Black'} pawn reached the final rank.</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['q', 'r', 'b', 'n'] as const).map((piece) => (
            <button
              key={piece}
              type="button"
              className="rounded-md border border-slate-500 bg-slate-800 px-3 py-2 text-left hover:bg-slate-700"
              onClick={() => onSelect(piece)}
            >
              {labels[piece]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
