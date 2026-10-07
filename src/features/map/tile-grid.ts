import type { Camera, Viewport } from './geometry';
import { WORLD_SIZE } from './geometry.ts';

export const layerFolders = { surface: 'Ground', sky: 'Sky', depths: 'Depths' };
export interface MapTile { x: number; y: number; level: number; size: number }
export const tileSize = (level: number) => WORLD_SIZE * 256 / (24000 * 2 ** (level - 7));
export function tileLevel(scale: number, pixelRatio = 1) {
  return Math.min(7, Math.max(2, Math.ceil(Math.log2(WORLD_SIZE * scale * pixelRatio / 24000) + 7)));
}
// Phone DPR stays native. Bound the backing surface on unusually large external displays.
export function renderPixelRatio(viewport: Viewport, deviceRatio: number) {
  return Math.min(Math.max(1, deviceRatio || 1), Math.sqrt(5_000_000 / Math.max(1, viewport.width * viewport.height)));
}
export function visibleTiles(camera: Camera, viewport: Viewport, level: number, margin = 0): MapTile[] {
  const factor = 2 ** (level - 7), size = tileSize(level);
  const columns = Math.ceil(24000 * factor / 256), rows = Math.ceil(20000 * factor / 256);
  const x0 = Math.max(0, Math.floor(-camera.x / camera.scale / size) - margin);
  const x1 = Math.min(columns - 1, Math.floor((viewport.width - camera.x) / camera.scale / size) + margin);
  const y0 = Math.max(0, Math.floor(-camera.y / camera.scale / size) - margin);
  const y1 = Math.min(rows - 1, Math.floor((viewport.height - camera.y) / camera.scale / size) + margin);
  const tiles: MapTile[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ x, y, level, size });
  return tiles;
}
export function tileKey(folder: string, tile: Pick<MapTile, 'level' | 'x' | 'y'>) {
  return `/maps/${folder}/${tile.level}/${tile.x}/${tile.y}.webp`;
}
