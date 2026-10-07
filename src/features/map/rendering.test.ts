import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CameraMotion } from './camera-motion.ts';
import { TileCache } from './tile-cache.ts';
import { tileLevel, visibleTiles, renderPixelRatio, tileSize } from './tile-grid.ts';
import { coverCamera, focusCamera, WORLD_SIZE, zoomCamera } from './geometry.ts';

function clock() {
  let time = 0, id = 0;
  const callbacks = new Map<number, (time: number) => void>();
  return { now: () => time, request: (fn: (time: number) => void) => { callbacks.set(++id, fn); return id; },
    cancel: (handle: number) => { callbacks.delete(handle); },
    tick: (elapsed = 16) => { time += elapsed; const work = [...callbacks.values()]; callbacks.clear(); work.forEach((fn) => fn(time)); },
    get pending() { return callbacks.size; } };
}

describe('地图逐帧相机', () => {
  it('同一帧的密集手势只绘制一次，保留最新位置，松手同步最终布局', () => {
    const scheduler = clock(), motion = new CameraMotion({ x: 0, y: 0, scale: 1 }, scheduler);
    const renders: { x: number; settled: boolean }[] = [];
    motion.subscribe((camera, settled) => renders.push({ x: camera.x, settled }));
    for (let x = 1; x <= 240; x++) motion.move({ x, y: 0, scale: 1 });
    assert.equal(scheduler.pending, 1); assert.equal(renders.length, 0);
    scheduler.tick(); assert.deepEqual(renders, [{ x: 240, settled: false }]);
    motion.move({ x: 260, y: 0, scale: 1 }); motion.flush();
    assert.equal(scheduler.pending, 0); assert.deepEqual(renders.at(-1), { x: 260, settled: true });
  });
  it('按钮动画保留缩放锚点，连续点击以目标倍率累积，到达精确终点', () => {
    const scheduler = clock(), camera = { x: -100, y: -80, scale: 1 }, anchor = { x: 190, y: 380 };
    const motion = new CameraMotion(camera, scheduler);
    motion.animate(zoomCamera(motion.destination, 1.5, anchor, 1, 64), 180);
    scheduler.tick(45); assert.ok(motion.camera.scale > 1 && motion.camera.scale < 1.5);
    assert.ok(Math.abs((anchor.x - motion.camera.x) / motion.camera.scale - (anchor.x - camera.x) / camera.scale) < .000001);
    motion.animate(zoomCamera(motion.destination, 1.5, anchor, 1, 64), 180);
    scheduler.tick(180); assert.equal(motion.camera.scale, 2.25); assert.equal(scheduler.pending, 0);
  });
  it('触摸可打断动画，旧动画和卸载回调不会覆盖新视野', () => {
    const scheduler = clock(), motion = new CameraMotion({ x: 0, y: 0, scale: 1 }, scheduler);
    motion.animate({ x: -100, y: -100, scale: 4 }, 180); scheduler.tick(30);
    motion.move({ x: -20, y: -50, scale: 2 }); scheduler.tick(300);
    assert.deepEqual(motion.camera, { x: -20, y: -50, scale: 2 });
    motion.animate({ x: -500, y: -500, scale: 8 }, 180); motion.destroy(); scheduler.tick(300);
    assert.equal(motion.camera.scale, 2); assert.equal(scheduler.pending, 0);
  });
});

describe('高分屏瓦片投影', () => {
  it('手机高 DPR 选取足够的原生瓦片；超过原图级别时停在 7', () => {
    const viewport = { width: 393, height: 776 };
    for (const dpr of [1, 2, 2.625, 3, 4]) for (const zoom of [1, 1.03, 1.5, 8, 16, 64]) {
      const camera = focusCamera({ x: .65, y: .51 }, viewport, zoom), level = tileLevel(camera.scale, dpr);
      assert.ok(level >= 2 && level <= 7);
      if (level < 7) assert.ok(tileSize(level) * camera.scale * dpr <= 256.0001);
    }
    assert.ok(tileLevel(coverCamera(viewport).scale, 2.625) > tileLevel(coverCamera(viewport).scale, 1));
  });
  it('预取一圈仍限制在包内坐标范围，边缘可见瓦片覆盖画布', () => {
    const viewport = { width: 390, height: 770 };
    for (const point of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }]) {
      const camera = focusCamera(point, viewport, 64);
      const visible = visibleTiles(camera, viewport, 7), prefetched = visibleTiles(camera, viewport, 7, 1);
      assert.ok(visible.length > 0); assert.ok(prefetched.length >= visible.length);
      assert.ok(prefetched.every((tile) => tile.x >= 0 && tile.x < 94 && tile.y >= 0 && tile.y < 79));
      const bounds = visible.map((tile) => ({ x: tile.x * tile.size * camera.scale + camera.x, y: tile.y * tile.size * camera.scale + camera.y, size: tile.size * camera.scale }));
      assert.ok(Math.min(...bounds.map((r) => r.x)) <= 0); assert.ok(Math.min(...bounds.map((r) => r.y)) <= 0);
      assert.ok(Math.max(...bounds.map((r) => r.x + r.size)) >= viewport.width);
      assert.ok(Math.max(...bounds.map((r) => r.y + r.size)) >= viewport.height);
    }
  });
  it('地图清晰度预算随屏幕大小计算，巨大视口有上限', () => {
    assert.equal(renderPixelRatio({ width: 393, height: 776 }, 2.625), 2.625);
    const huge = { width: 3840, height: 2160 }, ratio = renderPixelRatio(huge, 4);
    assert.ok(WORLD_SIZE > 0); assert.ok(huge.width * huge.height * ratio ** 2 <= 5_000_001);
  });
});

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('包内瓦片缓存', () => {
  it('高清延迟解码时旧图仍可使用，并发读取有上限', async () => {
    const resolvers = new Map<string, (image: string) => void>();
    const cache = new TileCache<string>({ capacity: 8, concurrency: 2,
      load: (key) => new Promise((resolve) => resolvers.set(key, resolve)) });
    cache.update([{ key: 'overview', priority: 0, pin: 2 }, { key: 'old', priority: 1, pin: 1 }]);
    assert.equal(resolvers.size, 2); assert.equal(cache.get('old'), undefined);
    resolvers.get('overview')!('overview pixels'); resolvers.get('old')!('old pixels'); await settle();
    cache.update([{ key: 'overview', priority: 0, pin: 2 }, ...['new1', 'new2', 'new3', 'new4'].map((key) => ({ key, priority: 1, pin: 1 }))]);
    assert.equal(cache.get('old'), 'old pixels'); assert.equal(cache.get('new1'), undefined);
    assert.equal(cache.pending, 2); assert.equal(resolvers.has('new3'), false);
    resolvers.get('new1')!('new pixels'); await settle();
    assert.equal(cache.get('new1'), 'new pixels'); assert.equal(resolvers.has('new3'), true);
    cache.dispose();
  });
  it('缓存限制内存，概览和当前可见细节优先保留', async () => {
    const cache = new TileCache<string>({ capacity: 3, concurrency: 2, load: async (key) => key });
    cache.update([{ key: 'overview', priority: 0, pin: 2 }, { key: 'old1', priority: 1, pin: 1 }, { key: 'old2', priority: 1, pin: 1 }]); await settle();
    cache.update([{ key: 'overview', priority: 0, pin: 2 }, { key: 'new1', priority: 1, pin: 1 }, { key: 'new2', priority: 1, pin: 1 }]); await settle();
    assert.equal(cache.size, 3); assert.equal(cache.get('overview'), 'overview');
    assert.equal(cache.get('new1'), 'new1'); assert.equal(cache.get('new2'), 'new2');
    assert.equal(cache.get('old1'), undefined); cache.dispose();
  });
  it('临时读取失败重试成功，卸载后迟到解码不再触发绘制', async () => {
    let attempts = 0, changes = 0, late: ((image: string) => void) | undefined;
    const cache = new TileCache<string>({ capacity: 4, concurrency: 2, onChange: () => changes++, load: (key) => {
      if (key === 'late') return new Promise((resolve) => { late = resolve; });
      if (++attempts === 1) return Promise.reject(new Error('temporary read failure'));
      return Promise.resolve('pixels');
    } });
    cache.update([{ key: 'temporary', priority: 0, pin: 1 }, { key: 'late', priority: 1, pin: 0 }]); await settle();
    assert.equal(attempts, 2); assert.equal(cache.get('temporary'), 'pixels');
    cache.dispose(); const previous = changes; late!('late pixels'); await settle();
    assert.equal(changes, previous); assert.equal(cache.size, 0);
  });
});
