import type { Camera } from './geometry';

interface FrameClock { request: (callback: (time: number) => void) => number; cancel: (id: number) => void; now: () => number }
type Listener = (camera: Camera, settled: boolean) => void;

/** One camera shared by terrain and overlays. Pointer events accumulate before the next paint. */
export class CameraMotion {
  private clock: FrameClock;
  private listeners = new Set<Listener>();
  private frame: number | null = null;
  private animation: { from: Camera; to: Camera; start: number; duration: number } | null = null;
  private value: Camera;
  private target: Camera;
  constructor(camera: Camera, clock: FrameClock = { request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id), now: () => performance.now() }) {
    this.value = this.target = camera; this.clock = clock;
  }
  get camera() { return this.value; }
  get destination() { return this.target; }
  subscribe(listener: Listener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  move(camera: Camera) { this.animation = null; this.value = this.target = camera; this.schedule(); }
  animate(camera: Camera, duration = 180) {
    if (duration <= 0) { this.move(camera); this.flush(); return; }
    this.animation = { from: this.value, to: camera, start: this.clock.now(), duration };
    this.target = camera; this.schedule();
  }
  stop() { this.animation = null; this.target = this.value; }
  flush() {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null; this.stop(); this.emit(true);
  }
  destroy() {
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null; this.animation = null; this.listeners.clear();
  }
  private emit(settled: boolean) { for (const listener of this.listeners) listener(this.value, settled); }
  private schedule() { if (this.frame === null) this.frame = this.clock.request(this.tick); }
  private tick = (time: number) => {
    this.frame = null;
    const animation = this.animation;
    if (!animation) { this.emit(false); return; }
    const progress = Math.min(1, Math.max(0, (time - animation.start) / animation.duration));
    const eased = 1 - (1 - progress) ** 3;
    this.value = progress === 1 ? animation.to : {
      x: animation.from.x + (animation.to.x - animation.from.x) * eased,
      y: animation.from.y + (animation.to.y - animation.from.y) * eased,
      scale: animation.from.scale + (animation.to.scale - animation.from.scale) * eased,
    };
    if (progress === 1) this.animation = null;
    this.emit(progress === 1);
    if (this.animation) this.schedule();
  };
}
