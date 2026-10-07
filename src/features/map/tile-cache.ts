export interface TileRequest { key: string; priority: number; pin: number }
interface Options<T> { load: (key: string) => Promise<T>; onChange?: () => void; capacity?: number; concurrency?: number }
interface Job { key: string; attempts: number; failed: boolean }

/** Decoded images survive level changes. Requests are replaced, not accumulated while panning. */
export class TileCache<T> {
  private values = new Map<string, { value: T; used: number }>();
  private requests = new Map<string, TileRequest>();
  private jobs = new Map<string, Job>();
  private loading = new Set<string>();
  private sequence = 0;
  private disposed = false;
  private options: Options<T>;
  constructor(options: Options<T>) { this.options = options; }
  get size() { return this.values.size; }
  get pending() { return this.loading.size; }
  get(key: string) { const entry = this.values.get(key); if (entry) entry.used = ++this.sequence; return entry?.value; }
  has(key: string) { return this.values.has(key); }
  failed(key: string) { return this.jobs.get(key)?.failed ?? false; }
  entries() { return [...this.values].map(([key, entry]) => [key, entry.value] as const); }
  update(requests: readonly TileRequest[], capacity = this.options.capacity ?? 192) {
    if (this.disposed) return;
    this.options.capacity = capacity;
    this.requests = new Map(requests.map((request) => [request.key, request]));
    this.trim();
    for (const key of this.jobs.keys()) if (!this.requests.has(key) && !this.loading.has(key)) this.jobs.delete(key);
    for (const { key } of requests) if (!this.values.has(key) && !this.jobs.has(key)) this.jobs.set(key, { key, attempts: 0, failed: false });
    this.pump();
  }
  dispose() { this.disposed = true; this.values.clear(); this.requests.clear(); this.jobs.clear(); this.loading.clear(); }
  private trim() {
    const capacity = this.options.capacity ?? 192;
    while (this.values.size > capacity) {
      const oldest = [...this.values].sort(([a, x], [b, y]) =>
        (this.requests.get(a)?.pin ?? 0) - (this.requests.get(b)?.pin ?? 0) || x.used - y.used)[0];
      this.values.delete(oldest[0]);
    }
  }
  private pump() {
    if (this.disposed) return;
    const next = [...this.jobs.values()].filter((job) => !job.failed && !this.loading.has(job.key) && this.requests.has(job.key))
      .sort((a, b) => this.requests.get(a.key)!.priority - this.requests.get(b.key)!.priority);
    for (const job of next) {
      if (this.loading.size >= (this.options.concurrency ?? 8)) break;
      this.loading.add(job.key); job.attempts++;
      void this.options.load(job.key).then((value) => {
        if (this.disposed) return;
        this.values.set(job.key, { value, used: ++this.sequence }); this.jobs.delete(job.key); this.trim();
      }, () => { if (!this.disposed && job.attempts >= 2) job.failed = true; }).finally(() => {
        if (this.disposed) return;
        this.loading.delete(job.key);
        if (!this.requests.has(job.key)) this.jobs.delete(job.key);
        this.pump(); this.options.onChange?.();
      });
    }
  }
}
export function decodeTile(key: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.decoding = 'async';
    image.onerror = () => reject(new Error(`Cannot load offline tile: ${key}`));
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      void decoded.then(() => {
        if (image.naturalWidth !== 256 || image.naturalHeight !== 256) { reject(new Error(`Invalid offline tile dimensions: ${key}`)); return; }
        const match = key.match(/\/([2-7])\/(\d+)\/(\d+)\.webp$/)!;
        const factor = 2 ** (Number(match[1]) - 7);
        const width = Math.min(256, 24000 * factor - Number(match[2]) * 256);
        const height = Math.min(256, 20000 * factor - Number(match[3]) * 256);
        if (width === 256 && height === 256) { resolve(image); return; }
        // Crop transparent native edge padding ONCE during decode, never during a gesture.
        const crop = document.createElement('canvas'); crop.width = width; crop.height = height;
        crop.getContext('2d')!.drawImage(image, 0, 0);
        const clipped = new Image(); clipped.decoding = 'async';
        clipped.onerror = reject;
        clipped.onload = () => { void clipped.decode().then(() => resolve(clipped), reject); };
        clipped.src = crop.toDataURL('image/png');
      }, reject);
    };
    image.src = key;
  });
}
