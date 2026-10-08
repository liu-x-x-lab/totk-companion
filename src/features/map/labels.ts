import type { MapLabel, MapPoint } from '../../types/domain';
import { baseScale, WORLD_HEIGHT, WORLD_SIZE } from './geometry.ts';
import type { Camera, Viewport } from './geometry.ts';

export interface PositionedLabel { label: MapLabel; size: number; offset: number }

export function minimumLabelZoom(label: MapLabel): number {
  if (label.kind === 'region' || label.kind === 'town') return 1;
  const levels = label.showLevel.split(',');
  if (levels.includes('Farthest') || levels.includes('Far')) return 1;
  if (label.messageId === 'BeginningIsland' || label.messageId === 'Rito_SkyHighIsland') return 1;
  if (label.kind === 'stable' || label.messageId.startsWith('SkyIslands_')) return 1.5;
  if (label.kind === 'lab') return 3;
  if (levels.includes('Near')) return 4;
  if (levels.includes('Nearest')) return 8;
  return 2;
}

// Labels stay the same physical size. Reserve screen rectangles for labels and marker dots.
export function layoutLabels(labels: readonly MapLabel[], camera: Camera, viewport: Viewport, markers: readonly MapPoint[] = []): PositionedLabel[] {
  const zoom = camera.scale / baseScale(viewport);
  const candidates = labels.filter((label) => zoom + .001 >= minimumLabelZoom(label))
    .sort((a, b) => minimumLabelZoom(a) - minimumLabelZoom(b) || priority(a) - priority(b) || a.id.localeCompare(b.id));
  const markerBoxes = markers.map((point) => ({ x: point.x * WORLD_SIZE * camera.scale + camera.x - 18,
    y: point.y * WORLD_HEIGHT * camera.scale + camera.y - 18, width: 36, height: 36 }));
  const occupied: typeof markerBoxes = [];
  const result: PositionedLabel[] = [];
  for (const label of candidates) {
    const size = label.kind === 'region' ? 16 : label.kind === 'town' ? 14 : 12;
    const important = label.kind === 'region' || label.kind === 'town';
    const width = [...label.name].reduce((sum, char) => sum + (/[^\u0000-\u007f]/.test(char) ? size : size * .62) + (label.kind === 'region' ? 2 : .5), 0) + 12;
    const height = size + 10;
    const x = label.mapPosition.x * WORLD_SIZE * camera.scale + camera.x - width / 2;
    if (x < 6 || x + width > viewport.width - 6) continue;
    if (result.some(({ label: placed }) => Math.hypot((placed.mapPosition.x - label.mapPosition.x) * WORLD_SIZE * camera.scale, (placed.mapPosition.y - label.mapPosition.y) * WORLD_HEIGHT * camera.scale) < 12)) continue;
    // 源标签常取多个入口的中点。避让附近标记时尝试其他方向，不能直接丢掉地名。
    const offsets = label.kind === 'region' ? [0, -40, 40, -64, 64] : [-36, -60, 36, -84, 60];
    // Important names also avoid icons. Only fall back to overlapping a marker
    // if every available position is blocked, so a dense region keeps its name.
    let placed = false;
    for (const allowMarkerOverlap of important ? [false, true] : [false]) {
      for (const offset of offsets) {
        const y = label.mapPosition.y * WORLD_HEIGHT * camera.scale + camera.y + offset - height / 2;
        if (y < 6 || y + height > viewport.height - 6) continue;
        const overlaps = (box: typeof markerBoxes[number]) => x < box.x + box.width + 5 && x + width + 5 > box.x && y < box.y + box.height + 5 && y + height + 5 > box.y;
        if (occupied.some(overlaps) || !allowMarkerOverlap && markerBoxes.some(overlaps)) continue;
        result.push({ label, size, offset }); occupied.push({ x, y, width, height }); placed = true; break;
      }
      if (placed) break;
    }
  }
  return result;
}

function priority(label: MapLabel): number {
  return label.kind === 'region' ? 0 : label.kind === 'town' ? 1 : label.kind === 'stable' ? 2 : 3;
}
