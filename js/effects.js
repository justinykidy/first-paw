(() => {
  class EffectsManager {
    constructor() {
      this.particles = [];
      this.flashes = [];
      this.shakeUntil = 0;
      this.shakeMagnitude = 0;
      this.fullScreenFlash = 0;
      this.mateEffect = null;
      this.lastUpdate = performance.now();
      this.showerTimer = 0;
    }

    now() {
      return performance.now();
    }

    triggerCapture(x, y) {
      const count = 22 + Math.floor(Math.random() * 9);
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 220;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.35,
          size: 2 + Math.random() * 4,
          color: Math.random() > 0.4 ? '255,210,120' : '196,151,255'
        });
      }

      this.flashes.push({ x, y, life: 0, maxLife: 0.2, radius: 16 });
      this.triggerShake(100, 4.5);
    }

    triggerShake(durationMs, magnitude) {
      this.shakeUntil = this.now() + durationMs;
      this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    }

    triggerCheckmate(text) {
      this.fullScreenFlash = 1;
      this.mateEffect = {
        text,
        startedAt: this.now(),
        duration: 2600
      };
      this.showerTimer = 0;
      this.triggerShake(500, 8);
    }

    applyScreenShake(ctx) {
      if (this.now() > this.shakeUntil) {
        this.shakeMagnitude = 0;
        return;
      }

      const m = this.shakeMagnitude;
      const dx = (Math.random() - 0.5) * m;
      const dy = (Math.random() - 0.5) * m;
      ctx.translate(dx, dy);
    }

    update(dt, viewWidth, viewHeight) {
      const gravity = 260;
      this.particles = this.particles.filter((p) => {
        p.life += dt;
        if (p.life >= p.maxLife) {
          return false;
        }
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return true;
      });

      this.flashes = this.flashes.filter((f) => {
        f.life += dt;
        f.radius += 210 * dt;
        return f.life < f.maxLife;
      });

      if (this.fullScreenFlash > 0) {
        this.fullScreenFlash = Math.max(0, this.fullScreenFlash - dt * 2.8);
      }

      if (this.mateEffect) {
        this.showerTimer -= dt;
        while (this.showerTimer <= 0) {
          this.spawnShowerParticle(viewWidth, viewHeight);
          this.showerTimer += 0.01;
        }

        const elapsed = this.now() - this.mateEffect.startedAt;
        if (elapsed > this.mateEffect.duration) {
          this.mateEffect = null;
        }
      }
    }

    spawnShowerParticle(width) {
      const x = Math.random() * width;
      this.particles.push({
        x,
        y: -14,
        vx: -55 + Math.random() * 110,
        vy: 85 + Math.random() * 140,
        life: 0,
        maxLife: 1.4 + Math.random() * 1.6,
        size: 2 + Math.random() * 5,
        color: Math.random() > 0.5 ? '255,226,145' : '218,177,255'
      });
    }

    renderOverlay(ctx, viewWidth, viewHeight) {
      for (const p of this.particles) {
        const alpha = 1 - p.life / p.maxLife;
        ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const f of this.flashes) {
        const alpha = 1 - f.life / f.maxLife;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
        grad.addColorStop(0, `rgba(255, 240, 180, ${alpha * 0.65})`);
        grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.fullScreenFlash > 0) {
        ctx.fillStyle = `rgba(255, 246, 221, ${this.fullScreenFlash * 0.45})`;
        ctx.fillRect(0, 0, viewWidth, viewHeight);
      }

      if (this.mateEffect) {
        const elapsed = this.now() - this.mateEffect.startedAt;
        const t = Math.min(1, elapsed / 500);
        const scale = 0.8 + t * 0.25;
        const alpha = Math.min(1, t * 1.3);
        ctx.save();
        ctx.translate(viewWidth / 2, viewHeight / 2);
        ctx.scale(scale, scale);
        ctx.fillStyle = `rgba(255, 237, 193, ${alpha})`;
        ctx.strokeStyle = `rgba(120, 79, 231, ${alpha * 0.8})`;
        ctx.lineWidth = 6;
        ctx.font = '700 58px Cinzel';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(this.mateEffect.text, 0, 0);
        ctx.fillText(this.mateEffect.text, 0, 0);
        ctx.restore();
      }
    }

    tick(ctx, viewWidth, viewHeight) {
      const now = this.now();
      const dt = Math.min(0.033, (now - this.lastUpdate) / 1000);
      this.lastUpdate = now;
      this.update(dt, viewWidth, viewHeight);
      this.renderOverlay(ctx, viewWidth, viewHeight);
    }

    reset() {
      this.particles = [];
      this.flashes = [];
      this.shakeUntil = 0;
      this.shakeMagnitude = 0;
      this.fullScreenFlash = 0;
      this.mateEffect = null;
      this.showerTimer = 0;
      this.lastUpdate = this.now();
    }
  }

  window.EffectsManager = EffectsManager;
})();
