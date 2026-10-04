export interface MotionStatus {
  readonly playing: boolean;
  readonly reducedMotion: boolean;
}

type MotionStatusListener = (status: MotionStatus) => void;

interface Particle {
  readonly offset: number;
  readonly lane: number;
  readonly size: number;
  readonly alpha: number;
}

const PARTICLE_COUNT = 22;
const MAX_DPR = 1.5;

export class DataFlowAnimator {
  private readonly context: CanvasRenderingContext2D | null;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver | null;
  private readonly motionQuery: MediaQueryList;
  private readonly particles: readonly Particle[];
  private width = 0;
  private height = 0;
  private pixelRatio = 1;
  private frameId = 0;
  private lastTimestamp = 0;
  private elapsedSeconds = 0;
  private speed = 1;
  private accent = "#d7ef87";
  private playing: boolean;
  private visible = document.visibilityState === "visible";
  private inViewport = true;

  private readonly handleFrame = (timestamp: number): void => {
    if (!this.playing || !this.visible || !this.inViewport || this.motionQuery.matches) {
      this.frameId = 0;
      return;
    }

    if (this.lastTimestamp > 0) {
      this.elapsedSeconds += Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    }
    this.lastTimestamp = timestamp;
    this.draw();
    this.frameId = window.requestAnimationFrame(this.handleFrame);
  };

  private readonly handleVisibilityChange = (): void => {
    this.visible = document.visibilityState === "visible";
    if (this.visible) {
      this.lastTimestamp = 0;
      this.requestFrame();
    } else {
      this.cancelFrame();
      this.draw();
    }
  };

  private readonly handleMotionPreferenceChange = (): void => {
    if (this.motionQuery.matches) {
      this.cancelFrame();
      this.lastTimestamp = 0;
      this.draw();
    } else if (this.playing) {
      this.requestFrame();
    }
    this.onStatusChange({
      playing: this.playing && !this.motionQuery.matches,
      reducedMotion: this.motionQuery.matches,
    });
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onStatusChange: MotionStatusListener,
  ) {
    this.context = canvas.getContext("2d", { alpha: true });
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.playing = !this.motionQuery.matches;
    this.particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      offset: index / PARTICLE_COUNT,
      lane: (index % 5) - 2,
      size: 1.15 + (index % 3) * 0.42,
      alpha: 0.35 + (index % 4) * 0.14,
    }));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    if ("IntersectionObserver" in window) {
      this.inViewport = false;
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const isInViewport = entries.some((entry) => entry.target === canvas && entry.isIntersecting);
        if (isInViewport === this.inViewport) return;

        this.inViewport = isInViewport;
        this.lastTimestamp = 0;
        if (this.inViewport) {
          this.requestFrame();
        } else {
          this.cancelFrame();
        }
      });
      this.intersectionObserver.observe(canvas);
    } else {
      this.intersectionObserver = null;
    }
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.motionQuery.addEventListener("change", this.handleMotionPreferenceChange);
    window.addEventListener("pagehide", this.destroy, { once: true });

    this.resize();
    this.onStatusChange({ playing: this.playing && !this.motionQuery.matches, reducedMotion: this.motionQuery.matches });
    this.requestFrame();
  }

  readonly toggle = (): void => {
    if (this.motionQuery.matches) return;

    this.playing = !this.playing;
    this.lastTimestamp = 0;
    if (this.playing) {
      this.requestFrame();
    } else {
      this.cancelFrame();
      this.draw();
    }
    this.onStatusChange({ playing: this.playing, reducedMotion: this.motionQuery.matches });
  };

  readonly setScenario = (intensityFLOPPerByte: number, accent: string): void => {
    this.speed = 0.62 + Math.min(1.75, Math.log10(Math.max(1, intensityFLOPPerByte)) * 0.32);
    this.accent = accent;
  };

  readonly destroy = (): void => {
    this.cancelFrame();
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.motionQuery.removeEventListener("change", this.handleMotionPreferenceChange);
    window.removeEventListener("pagehide", this.destroy);
  };

  private readonly resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.width = rect.width;
    this.height = rect.height;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context?.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.draw();
  };

  private requestFrame(): void {
    if (
      this.frameId === 0 &&
      this.playing &&
      this.visible &&
      this.inViewport &&
      !this.motionQuery.matches &&
      this.context !== null
    ) {
      this.frameId = window.requestAnimationFrame(this.handleFrame);
    }
  }

  private cancelFrame(): void {
    if (this.frameId !== 0) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private draw(): void {
    const context = this.context;
    if (!context || this.width <= 0 || this.height <= 0) return;

    context.clearRect(0, 0, this.width, this.height);
    const midY = this.height * 0.5;
    const startX = 5;
    const endX = Math.max(startX + 1, this.width - 8);

    for (const particle of this.particles) {
      const progress = (this.elapsedSeconds * this.speed * 0.32 + particle.offset) % 1;
      const x = startX + progress * (endX - startX);
      const wave = Math.sin(progress * Math.PI * 5 + particle.offset * 9) * 1.7;
      const y = midY + particle.lane * 1.6 + wave;
      const pulse = 0.72 + Math.sin(this.elapsedSeconds * 4 + particle.offset * 10) * 0.18;

      context.globalAlpha = particle.alpha * pulse;
      context.fillStyle = this.accent;
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  }
}
