(() => {
  const PIECES = {
    wk: '♔',
    wq: '♕',
    wr: '♖',
    wb: '♗',
    wn: '♘',
    wp: '♙',
    bk: '♚',
    bq: '♛',
    br: '♜',
    bb: '♝',
    bn: '♞',
    bp: '♟'
  };

  const DIFFICULTY = {
    easy: { minDepth: 1, maxDepth: 2, randomMistakeChance: 0.3 },
    normal: { minDepth: 5, maxDepth: 8, randomMistakeChance: 0 },
    hard: { minDepth: 12, maxDepth: 15, randomMistakeChance: 0 },
    hell: { minDepth: 20, maxDepth: 22, randomMistakeChance: 0 }
  };

  class ChessGame {
    constructor() {
      this.chess = new Chess();
      this.audio = new AudioManager();
      this.effects = new EffectsManager();
      this.ai = new StockfishAI();

      this.playerColor = 'w';
      this.aiColor = 'b';
      this.selected = null;
      this.validMoves = [];
      this.lastMove = null;
      this.hoverSquare = null;
      this.animation = null;
      this.pendingPromotion = null;
      this.capturedByWhite = [];
      this.capturedByBlack = [];
      this.currentDifficulty = 'normal';
      this.aiThinking = false;
      this.gameOver = false;
      this.statusMessage = '';
      this.gameId = 0;

      this.canvas = document.getElementById('chess-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.boardWrapper = document.getElementById('board-wrapper');
      this.moveHistoryEl = document.getElementById('move-history');
      this.capturedByWhiteEl = document.getElementById('captured-by-white');
      this.capturedByBlackEl = document.getElementById('captured-by-black');
      this.statusBar = document.getElementById('status-bar');
      this.promotionOverlay = document.getElementById('promotion-overlay');
      this.promotionOptions = document.getElementById('promotion-options');

      this.squareSize = 0;
      this.boardSize = 0;
      this.boardTexture = null;

      this.bindUI();
      this.resizeCanvas();
      this.loop();
      window.addEventListener('resize', () => this.resizeCanvas());
    }

    bindUI() {
      document.querySelectorAll('.difficulty-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.audio.click();
          this.currentDifficulty = btn.dataset.level;
          this.startNewGame();
          document.getElementById('start-screen').classList.remove('active');
          document.getElementById('game-screen').classList.add('active');
        });
      });

      document.getElementById('new-game-btn').addEventListener('click', () => {
        this.audio.click();
        this.startNewGame();
      });

      document.getElementById('undo-btn').addEventListener('click', () => {
        this.audio.click();
        this.undoMove();
      });

      document.getElementById('resign-btn').addEventListener('click', () => {
        this.audio.click();
        this.resign();
      });

      this.canvas.addEventListener('mousemove', (e) => {
        const sq = this.squareFromEvent(e);
        this.hoverSquare = sq;
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.hoverSquare = null;
      });

      this.canvas.addEventListener('click', async (e) => {
        this.audio.ensure();

        if (this.gameOver || this.aiThinking || this.promotionOverlayVisible()) {
          return;
        }

        if (this.chess.turn() !== this.playerColor) {
          return;
        }

        const square = this.squareFromEvent(e);
        if (!square) {
          return;
        }

        await this.handleSquareClick(square);
      });
    }

    startNewGame() {
      this.invalidateGameState();
      this.chess = new Chess();
      this.selected = null;
      this.validMoves = [];
      this.lastMove = null;
      this.hoverSquare = null;
      this.animation = null;
      this.pendingPromotion = null;
      this.capturedByWhite = [];
      this.capturedByBlack = [];
      this.aiThinking = false;
      this.gameOver = false;
      this.statusMessage = `Game started (${this.currentDifficulty.toUpperCase()}). Your turn.`;
      this.updateCapturedUI();
      this.updateMoveHistory();
      this.updateStatus();
      this.hidePromotionOverlay();
    }

    undoMove() {
      if (this.aiThinking || this.gameOver) {
        return;
      }

      let undone = false;
      if (this.chess.history().length > 0) {
        this.chess.undo();
        undone = true;
      }

      if (this.chess.history().length > 0 && this.chess.turn() === this.aiColor) {
        this.chess.undo();
      }

      if (undone) {
        this.invalidateGameState();
        this.rebuildCapturedFromHistory();
        this.selected = null;
        this.validMoves = [];
        this.lastMove = null;
        this.animation = null;
        if (typeof this.effects.reset === 'function') {
          this.effects.reset();
        }
        this.gameOver = false;
        this.statusMessage = 'Move undone.';
        this.updateMoveHistory();
        this.updateStatus();
      }
    }

    resign() {
      if (this.gameOver) {
        return;
      }

      this.invalidateGameState();
      this.gameOver = true;
      this.statusMessage = 'You resigned. Defeat.';
      this.effects.triggerCheckmate('DEFEAT');
      this.audio.checkmate();
      this.updateStatus();
    }

    rebuildCapturedFromHistory() {
      this.capturedByWhite = [];
      this.capturedByBlack = [];
      const replay = new Chess();
      const moves = this.chess.history({ verbose: true });
      replay.reset();
      moves.forEach((mv) => {
        if (mv.captured) {
          const key = mv.color === 'w' ? 'w' : 'b';
          const list = key === 'w' ? this.capturedByWhite : this.capturedByBlack;
          list.push(PIECES[(mv.color === 'w' ? 'b' : 'w') + mv.captured]);
        }
      });
      this.updateCapturedUI();
    }

    async handleSquareClick(square) {
      const piece = this.chess.get(square);

      if (this.selected) {
        const legal = this.validMoves.find((m) => m.to === square);
        if (legal) {
          if (legal.flags.includes('p')) {
            const promotion = await this.choosePromotion();
            if (!promotion) {
              return;
            }
            await this.playMove({ from: legal.from, to: legal.to, promotion }, false);
            this.selected = null;
            this.validMoves = [];
            return;
          }

          await this.playMove({ from: legal.from, to: legal.to }, false);
          this.selected = null;
          this.validMoves = [];
          return;
        }
      }

      if (piece && piece.color === this.playerColor && this.chess.turn() === this.playerColor) {
        this.selected = square;
        this.validMoves = this.chess.moves({ square, verbose: true });
      } else {
        this.selected = null;
        this.validMoves = [];
        this.audio.illegal();
      }
    }

    async playMove(moveObj, byAI) {
      const move = this.chess.move(moveObj);
      if (!move) {
        this.audio.illegal();
        return;
      }

      this.lastMove = { from: move.from, to: move.to };
      this.createMoveAnimation(move);
      this.handleCaptureEffects(move);
      this.updateMoveHistory();
      this.updateStatus();

      if (move.captured) {
        this.audio.capture();
      } else {
        this.audio.move();
      }

      if (this.chess.in_check()) {
        this.audio.check();
      }

      if (this.chess.game_over()) {
        this.finishGame();
        return;
      }

      if (!byAI && this.chess.turn() === this.aiColor) {
        this.aiThinking = true;
        this.updateStatus('AI is thinking...');
        await this.playAIMove(this.gameId);
      }
    }

    createMoveAnimation(move) {
      this.animation = {
        from: move.from,
        to: move.to,
        symbol: PIECES[move.color + move.piece],
        color: move.color,
        startedAt: performance.now(),
        duration: 200
      };
    }

    handleCaptureEffects(move) {
      if (!move.captured) {
        return;
      }

      const captureSquare = move.flags.includes('e') ? `${move.to[0]}${move.from[1]}` : move.to;
      const { x, y } = this.squareCenter(captureSquare);
      this.effects.triggerCapture(x, y);

      const capturedKey = `${move.color === 'w' ? 'b' : 'w'}${move.captured}`;
      if (move.color === 'w') {
        this.capturedByWhite.push(PIECES[capturedKey]);
      } else {
        this.capturedByBlack.push(PIECES[capturedKey]);
      }
      this.updateCapturedUI();
    }

    async playAIMove(expectedGameId = this.gameId) {
      if (expectedGameId !== this.gameId) {
        return;
      }

      const difficulty = DIFFICULTY[this.currentDifficulty];
      const legalMoves = this.chess.moves({ verbose: true });

      if (legalMoves.length === 0) {
        this.aiThinking = false;
        return;
      }

      if (Math.random() < difficulty.randomMistakeChance) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        await this.wait(320);
        if (expectedGameId !== this.gameId) {
          return;
        }
        await this.playMove({ from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion }, true);
        return;
      }

      const depth = this.randomDepth(difficulty.minDepth, difficulty.maxDepth);
      try {
        const best = await this.ai.getBestMove(this.chess.fen(), depth);
        if (expectedGameId !== this.gameId) {
          return;
        }
        if (!best || best === '(none)') {
          return;
        }

        const from = best.slice(0, 2);
        const to = best.slice(2, 4);
        const promotion = best.length > 4 ? best[4] : undefined;
        await this.playMove({ from, to, promotion }, true);
      } catch (err) {
        if (expectedGameId !== this.gameId) {
          return;
        }
        console.error('AI move error:', err);
        const fallback = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        await this.playMove({ from: fallback.from, to: fallback.to, promotion: fallback.promotion }, true);
      } finally {
        if (expectedGameId === this.gameId) {
          this.aiThinking = false;
          this.updateStatus();
        }
      }
    }

    invalidateGameState() {
      this.gameId += 1;
      this.aiThinking = false;
      this.ai.stop();
    }

    finishGame() {
      this.gameOver = true;

      if (this.chess.in_checkmate()) {
        const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
        const playerWon = (winner === 'White' && this.playerColor === 'w') || (winner === 'Black' && this.playerColor === 'b');
        const text = playerWon ? 'VICTORY' : 'DEFEAT';
        this.statusMessage = `Checkmate. ${winner} wins.`;
        this.effects.triggerCheckmate(text);
        this.audio.checkmate();
      } else if (this.chess.in_stalemate()) {
        this.statusMessage = 'Draw by stalemate.';
      } else if (this.chess.in_threefold_repetition()) {
        this.statusMessage = 'Draw by repetition.';
      } else if (this.chess.insufficient_material()) {
        this.statusMessage = 'Draw by insufficient material.';
      } else if (this.chess.in_draw()) {
        this.statusMessage = 'Draw.';
      }

      this.updateStatus();
    }

    updateCapturedUI() {
      this.capturedByWhiteEl.textContent = this.capturedByWhite.join(' ');
      this.capturedByBlackEl.textContent = this.capturedByBlack.join(' ');
    }

    updateMoveHistory() {
      const moves = this.chess.history();
      const rows = [];
      for (let i = 0; i < moves.length; i += 2) {
        const num = i / 2 + 1;
        const white = moves[i] || '';
        const black = moves[i + 1] || '';
        rows.push(`<div class="move-row"><span>${num}.</span><span>${white}</span><span>${black}</span></div>`);
      }
      this.moveHistoryEl.innerHTML = rows.join('');
      this.moveHistoryEl.scrollTop = this.moveHistoryEl.scrollHeight;
    }

    updateStatus(override) {
      if (override) {
        this.statusBar.textContent = override;
        return;
      }

      if (this.statusMessage && (this.gameOver || this.aiThinking)) {
        this.statusBar.textContent = this.statusMessage;
        return;
      }

      const turn = this.chess.turn() === 'w' ? 'White' : 'Black';
      const checkText = this.chess.in_check() ? ' CHECK!' : '';
      this.statusBar.innerHTML = `${this.statusMessage || `${turn} to move.`}<span class="check-status">${checkText}</span>`;
      this.statusMessage = '';
    }

    promotionOverlayVisible() {
      return !this.promotionOverlay.classList.contains('hidden');
    }

    choosePromotion() {
      return new Promise((resolve) => {
        const options = [
          { piece: 'q', symbol: PIECES.wq },
          { piece: 'r', symbol: PIECES.wr },
          { piece: 'b', symbol: PIECES.wb },
          { piece: 'n', symbol: PIECES.wn }
        ];

        this.promotionOptions.innerHTML = '';
        options.forEach((option) => {
          const btn = document.createElement('button');
          btn.className = 'promotion-piece';
          btn.textContent = option.symbol;
          btn.addEventListener('click', () => {
            this.audio.click();
            this.hidePromotionOverlay();
            resolve(option.piece);
          }, { once: true });
          this.promotionOptions.appendChild(btn);
        });

        this.promotionOverlay.classList.remove('hidden');
        this.promotionOverlay.setAttribute('aria-hidden', 'false');
      });
    }

    hidePromotionOverlay() {
      this.promotionOverlay.classList.add('hidden');
      this.promotionOverlay.setAttribute('aria-hidden', 'true');
      this.promotionOptions.innerHTML = '';
    }

    randomDepth(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    squareFromEvent(event) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (x < 0 || y < 0 || x > this.boardSize || y > this.boardSize) {
        return null;
      }

      const fileIndex = Math.floor(x / this.squareSize);
      const rankIndex = Math.floor(y / this.squareSize);
      const files = 'abcdefgh';
      const rank = 8 - rankIndex;
      const file = files[fileIndex];
      return `${file}${rank}`;
    }

    squareToXY(square) {
      const files = 'abcdefgh';
      const file = files.indexOf(square[0]);
      const rank = Number(square[1]);
      const x = file * this.squareSize;
      const y = (8 - rank) * this.squareSize;
      return { x, y };
    }

    squareCenter(square) {
      const { x, y } = this.squareToXY(square);
      return { x: x + this.squareSize / 2, y: y + this.squareSize / 2 };
    }

    resizeCanvas() {
      const size = Math.min(this.boardWrapper.clientWidth, window.innerHeight * 0.78);
      const pixelRatio = window.devicePixelRatio || 1;
      this.boardSize = Math.max(320, Math.floor(size));
      this.squareSize = this.boardSize / 8;
      this.canvas.width = Math.floor(this.boardSize * pixelRatio);
      this.canvas.height = Math.floor(this.boardSize * pixelRatio);
      this.canvas.style.width = `${this.boardSize}px`;
      this.canvas.style.height = `${this.boardSize}px`;
      this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      this.rebuildBoardTexture();
    }

    rebuildBoardTexture() {
      const texture = document.createElement('canvas');
      texture.width = this.boardSize;
      texture.height = this.boardSize;
      const tctx = texture.getContext('2d');
      const tile = this.squareSize;

      for (let rank = 0; rank < 8; rank += 1) {
        for (let file = 0; file < 8; file += 1) {
          const isLight = (file + rank) % 2 === 0;
          const x = file * tile;
          const y = rank * tile;
          const grad = tctx.createLinearGradient(x, y, x + tile, y + tile);
          if (isLight) {
            grad.addColorStop(0, '#7a5f3f');
            grad.addColorStop(1, '#8f704b');
          } else {
            grad.addColorStop(0, '#4e3a24');
            grad.addColorStop(1, '#3f2f1d');
          }
          tctx.fillStyle = grad;
          tctx.fillRect(x, y, tile, tile);

          tctx.fillStyle = 'rgba(255,255,255,0.02)';
          for (let n = 0; n < 3; n += 1) {
            const noiseX = x + Math.random() * tile;
            const noiseY = y + Math.random() * tile;
            tctx.fillRect(noiseX, noiseY, 1, 1);
          }
        }
      }

      this.boardTexture = texture;
    }

    drawBoard(now) {
      const ctx = this.ctx;
      if (!this.boardTexture) {
        this.rebuildBoardTexture();
      }
      ctx.drawImage(this.boardTexture, 0, 0, this.boardSize, this.boardSize);

      if (this.lastMove) {
        this.highlightSquare(this.lastMove.from, 'rgba(255, 215, 79, 0.26)');
        this.highlightSquare(this.lastMove.to, 'rgba(255, 215, 79, 0.26)');
      }

      this.validMoves.forEach((move) => {
        const { x, y } = this.squareCenter(move.to);
        ctx.beginPath();
        ctx.fillStyle = 'rgba(139, 92, 246, 0.44)';
        ctx.arc(x, y, this.squareSize * 0.16, 0, Math.PI * 2);
        ctx.fill();
      });

      if (this.selected) {
        this.highlightSquare(this.selected, 'rgba(141, 206, 255, 0.24)');
      }

      if (this.chess.in_check()) {
        const kingSquare = this.findKingSquare(this.chess.turn());
        if (kingSquare) {
          const pulse = (Math.sin(now / 120) + 1) / 2;
          this.highlightSquare(kingSquare, `rgba(255, 43, 70, ${0.28 + pulse * 0.32})`);
        }
      }

      if (this.hoverSquare) {
        this.highlightSquare(this.hoverSquare, 'rgba(255,255,255,0.08)');
      }
    }

    highlightSquare(square, color) {
      const { x, y } = this.squareToXY(square);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
    }

    findKingSquare(color) {
      const board = this.chess.board();
      const files = 'abcdefgh';
      for (let rank = 0; rank < 8; rank += 1) {
        for (let file = 0; file < 8; file += 1) {
          const piece = board[rank][file];
          if (piece && piece.type === 'k' && piece.color === color) {
            return `${files[file]}${8 - rank}`;
          }
        }
      }
      return null;
    }

    drawPieces(now) {
      const board = this.chess.board();
      const files = 'abcdefgh';
      const anim = this.animation;
      const animProgress = anim ? Math.min(1, (now - anim.startedAt) / anim.duration) : 1;
      const eased = 1 - (1 - animProgress) * (1 - animProgress);

      this.ctx.font = `${Math.floor(this.squareSize * 0.74)}px "Noto Sans Symbols2", "Segoe UI Symbol", serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const piece = board[row][col];
          if (!piece) {
            continue;
          }

          const square = `${files[col]}${8 - row}`;
          if (anim && square === anim.to) {
            continue;
          }

          const symbol = PIECES[piece.color + piece.type];
          const { x, y } = this.squareCenter(square);
          let yOffset = 0;

          if (square === this.hoverSquare && !this.gameOver) {
            yOffset = -3;
            this.ctx.shadowColor = 'rgba(194, 158, 255, 0.45)';
            this.ctx.shadowBlur = 12;
          } else {
            this.ctx.shadowBlur = 0;
          }

          this.ctx.fillStyle = piece.color === 'w' ? '#f8f7fc' : '#10121e';
          this.ctx.strokeStyle = piece.color === 'w' ? '#252a45' : '#8a93bc';
          this.ctx.lineWidth = 2;
          this.ctx.strokeText(symbol, x, y + yOffset + 1);
          this.ctx.fillText(symbol, x, y + yOffset);
        }
      }

      this.ctx.shadowBlur = 0;

      if (anim) {
        const from = this.squareCenter(anim.from);
        const to = this.squareCenter(anim.to);
        const x = from.x + (to.x - from.x) * eased;
        const y = from.y + (to.y - from.y) * eased;

        this.ctx.fillStyle = anim.color === 'w' ? '#f8f7fc' : '#10121e';
        this.ctx.strokeStyle = anim.color === 'w' ? '#252a45' : '#8a93bc';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(anim.symbol, x, y + 1);
        this.ctx.fillText(anim.symbol, x, y);

        if (animProgress >= 1) {
          this.animation = null;
        }
      }
    }

    drawFrame(now) {
      this.ctx.clearRect(0, 0, this.boardSize, this.boardSize);
      this.ctx.save();
      this.effects.applyScreenShake(this.ctx);
      this.drawBoard(now);
      this.drawPieces(now);
      this.ctx.restore();
      this.effects.tick(this.ctx, this.boardSize, this.boardSize);
    }

    loop() {
      const now = performance.now();
      this.drawFrame(now);
      requestAnimationFrame(() => this.loop());
    }

    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
  });
})();
