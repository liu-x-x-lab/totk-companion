import type { MapLayer } from '../../types/domain';
import type { Camera, Viewport } from './geometry';
import { TileCache, decodeTile } from './tile-cache';
import type { TileRequest } from './tile-cache';
import { renderPixelRatio, layerFolders, tileKey, tileLevel, tileSize, visibleTiles } from './tile-grid';
import type { MapTile } from './tile-grid';

export type TerrainStatus = 'loading' | 'ready' | 'missing';
interface Sprite { element: HTMLDivElement; image: HTMLImageElement }

/** Native image tiles move within viewport-sized clipping boxes; no giant scaled world or per-frame bitmap upload. */
export class TileRenderer {
  private element: HTMLDivElement;
  private cache: TileCache<HTMLImageElement>;
  private sprites = new Map<string, Sprite>();
  private folder: string;
  private status: (value: TerrainStatus) => void;
  private view: { camera: Camera; viewport: Viewport } | null = null;
  private redraw: number | null = null;
  private lastStatus: TerrainStatus | null = null;
  private disposed = false;
  constructor(element: HTMLDivElement, layer: MapLayer, status: (value: TerrainStatus) => void) {
    this.element = element; this.folder = layerFolders[layer]; this.status = status;
    this.cache = new TileCache({ load: decodeTile, capacity: 192, concurrency: 8, onChange: () => {
      if (this.redraw === null && !this.disposed) this.redraw = requestAnimationFrame(() => {
        this.redraw = null; if (this.view) this.render(this.view.camera, this.view.viewport);
      });
    } });
  }
  render(camera: Camera, viewport: Viewport) {
    if (this.disposed || !viewport.width || !viewport.height) return;
    if (this.redraw !== null) cancelAnimationFrame(this.redraw);
    this.redraw = null; this.view = { camera, viewport };
    const ratio = renderPixelRatio(viewport, window.devicePixelRatio);
    const width = Math.ceil(viewport.width * ratio), height = Math.ceil(viewport.height * ratio);
    let level = tileLevel(camera.scale, ratio);
    while (level > 2 && visibleTiles(camera, viewport, level).length > 256) level--;
    const visible = visibleTiles(camera, viewport, level), visibleKeys = new Set(visible.map((tile) => tileKey(this.folder, tile)));
    const requests = new Map<string, TileRequest>();
    const request = (tile: MapTile, priority: number, pin: number) => {
      const key = tileKey(this.folder, tile), previous = requests.get(key);
      requests.set(key, { key, priority: Math.min(previous?.priority ?? Infinity, priority), pin: Math.max(previous?.pin ?? 0, pin) });
    };
    // Keep the overview decoded even for regions the player has not opened yet.
    for (const tile of visibleTiles({ x: 0, y: 0, scale: 1 }, { width: 1000, height: 1000 * 5 / 6 }, 2)) request(tile, 0, 2);
    if (visible.some((tile) => !this.cache.has(tileKey(this.folder, tile)))) for (let fallback = 3; fallback < level; fallback++) {
      for (const tile of visibleTiles(camera, viewport, fallback)) request(tile, 10 + fallback, 0);
    }
    for (const tile of visibleTiles(camera, viewport, level, 1)) {
      const key = tileKey(this.folder, tile), inView = visibleKeys.has(key);
      const distance = Math.hypot((tile.x + .5) * tile.size * camera.scale + camera.x - viewport.width / 2,
        (tile.y + .5) * tile.size * camera.scale + camera.y - viewport.height / 2);
      request(tile, (inView ? 30 : 10000) + distance / Math.max(viewport.width, viewport.height), inView ? 1 : 0);
    }
    this.cache.update([...requests.values()], Math.max(192, Math.min(384, requests.size + 16)));
    const complete = visible.length > 0 && [...visibleKeys].every((key) => this.cache.has(key));
    const entries = this.cache.entries().map(([key, image]) => {
      const parts = key.split('/'); return { key, image, level: Number(parts[3]), x: Number(parts[4]), y: Number(parts[5].split('.')[0]) };
    });
    let painted = 0, fallbackTiles = 0;
    const retained = new Set<string>();
    for (const tile of entries) {
      if (complete && tile.level !== level) continue;
      const size = tileSize(tile.level);
      const left = Math.floor((tile.x * size * camera.scale + camera.x) * ratio);
      const top = Math.floor((tile.y * size * camera.scale + camera.y) * ratio);
      // Constant dimensions during a pan avoid re-rastering an image for a one-pixel size oscillation.
      const right = left + Math.ceil(tile.image.naturalWidth / 256 * size * camera.scale * ratio) + 1;
      const bottom = top + Math.ceil(tile.image.naturalHeight / 256 * size * camera.scale * ratio) + 1;
      if (right <= 0 || bottom <= 0 || left >= width || top >= height) continue;
      let sprite = this.sprites.get(tile.key);
      if (!sprite) {
        const element = document.createElement('div'); element.className = 'map-tile';
        element.dataset.tileKey = tile.key; element.dataset.level = String(tile.level); element.style.zIndex = String(tile.level);
        tile.image.alt = ''; tile.image.draggable = false;
        element.append(tile.image); this.element.append(element);
        sprite = { element, image: tile.image }; this.sprites.set(tile.key, sprite);
      }
      // Clip BEFORE compositing: even a low-res fallback at 64× has a screen-sized layer.
      const clipLeft = Math.max(0, left), clipTop = Math.max(0, top), clipRight = Math.min(width, right), clipBottom = Math.min(height, bottom);
      sprite.element.style.transform = `translate3d(${clipLeft / ratio}px, ${clipTop / ratio}px, 0)`;
      // Browser layout uses 1/64 CSS pixels: round outwards so rotation cannot reveal a thin edge.
      const cssSize = (pixels: number) => Math.ceil(pixels / ratio * 64) / 64;
      sprite.element.style.width = `${cssSize(clipRight - clipLeft)}px`;
      sprite.element.style.height = `${cssSize(clipBottom - clipTop)}px`;
      sprite.image.style.width = `${cssSize(right - left)}px`;
      sprite.image.style.height = `${cssSize(bottom - top)}px`;
      sprite.image.style.left = `${(left - clipLeft) / ratio}px`;
      sprite.image.style.top = `${(top - clipTop) / ratio}px`;
      this.cache.get(tile.key); retained.add(tile.key); painted++; if (tile.level < level) fallbackTiles++;
    }
    for (const [key, sprite] of this.sprites) if (!retained.has(key)) { sprite.element.remove(); this.sprites.delete(key); }
    const failed = [...visibleKeys].some((key) => this.cache.failed(key));
    const overviewReady = visibleTiles(camera, viewport, 2).every((tile) => this.cache.has(tileKey(this.folder, tile)));
    const status = failed ? 'missing' : complete || overviewReady ? 'ready' : 'loading';
    Object.assign(this.element.dataset, { camera: `${camera.x},${camera.y},${camera.scale}`, tileLevel: String(level),
      tilesReady: String(complete), fallbackTiles: String(fallbackTiles), cachedTiles: String(this.cache.size),
      pendingTiles: String(this.cache.pending), pixelRatio: String(ratio), paintedTiles: String(painted),
      viewportWidth: String(viewport.width), viewportHeight: String(viewport.height) });
    if (status !== this.lastStatus) { this.lastStatus = status; this.status(status); }
  }
  dispose() {
    this.disposed = true; if (this.redraw !== null) cancelAnimationFrame(this.redraw);
    this.cache.dispose(); this.sprites.clear(); this.element.replaceChildren(); this.view = null;
  }
}
