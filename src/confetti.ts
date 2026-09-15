const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffffff', '#27dbef'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: 0 | 1;
  fade: number;
}

interface Burst {
  x: number;
  y: number;
  spreadFromCenter: boolean;
}

/** Dependency-free canvas confetti burst for the Display's win celebration. */
export class ConfettiController {
  private readonly ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private rafId: number | null = null;
  private deadline = 0;
  private readonly onResize = (): void => this.resize();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.onResize);
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  fire(reducedMotion: boolean): void {
    this.clear();
    if (!this.ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const particleCount = reducedMotion ? 36 : 180;
    const durationMs = reducedMotion ? 1600 : 5200;
    const bursts: Burst[] = reducedMotion
      ? [{ x: width / 2, y: height * 0.55, spreadFromCenter: true }]
      : [
          { x: width * 0.16, y: height * 0.92, spreadFromCenter: false },
          { x: width * 0.84, y: height * 0.92, spreadFromCenter: false },
          { x: width / 2, y: height * 0.3, spreadFromCenter: true },
        ];

    for (let i = 0; i < particleCount; i += 1) {
      const burst = bursts[i % bursts.length];
      const angle = burst.spreadFromCenter
        ? Math.random() * Math.PI * 2
        : -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = reducedMotion ? 2 + Math.random() * 2.5 : 5 + Math.random() * 9;
      this.particles.push({
        x: burst.x,
        y: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        shape: Math.random() > 0.5 ? 1 : 0,
        fade: 0.55 + Math.random() * 0.35,
      });
    }

    this.deadline = performance.now() + durationMs;
    this.rafId = requestAnimationFrame(this.step);
  }

  private readonly step = (now: number): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    const remainingMs = this.deadline - now;
    const gravity = 0.22;
    const drag = 0.995;
    let alive = false;

    for (const p of this.particles) {
      p.vy += gravity;
      p.vx *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      if (p.y > height + 40 || remainingMs <= 0) continue;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = remainingMs < 900 ? Math.max(0, remainingMs / 900) : p.fade;
      ctx.fillStyle = p.color;
      if (p.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }

    if (alive) {
      this.rafId = requestAnimationFrame(this.step);
    } else {
      this.rafId = null;
      this.particles = [];
      ctx.clearRect(0, 0, width, height);
    }
  };

  /** Stops the animation and wipes the canvas; safe to call at any time. */
  clear(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.particles = [];
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.clear();
    window.removeEventListener('resize', this.onResize);
  }
}
