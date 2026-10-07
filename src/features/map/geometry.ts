import type { MapPoint } from '../../types/domain';

export const WORLD_SIZE = 1000;
export const WORLD_HEIGHT = WORLD_SIZE * 5 / 6;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;
export interface Camera { x: number; y: number; scale: number }
export interface Viewport { width: number; height: number }

export function baseScale(viewport: Viewport): number {
  return Math.max(.001, viewport.width / WORLD_SIZE, viewport.height / WORLD_HEIGHT);
}

export function coverCamera(viewport: Viewport): Camera {
  const scale = baseScale(viewport);
  return { x: (viewport.width - WORLD_SIZE * scale) / 2, y: (viewport.height - WORLD_HEIGHT * scale) / 2, scale };
}

export function zoomCamera(camera: Camera, factor: number, anchor: MapPoint, minScale: number, maxScale: number): Camera {
  const scale = Math.max(minScale, Math.min(maxScale, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio, scale };
}

function midpoint(a: MapPoint, b: MapPoint): MapPoint { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function distance(a: MapPoint, b: MapPoint): number { return Math.hypot(a.x - b.x, a.y - b.y); }

export function pinchCamera(camera: Camera, before: [MapPoint, MapPoint], after: [MapPoint, MapPoint], minScale: number, maxScale: number): Camera {
  const previousCenter = midpoint(...before);
  const nextCenter = midpoint(...after);
  const factor = distance(...after) / Math.max(1, distance(...before));
  const zoomed = zoomCamera(camera, factor, previousCenter, minScale, maxScale);
  return { ...zoomed, x: zoomed.x + nextCenter.x - previousCenter.x, y: zoomed.y + nextCenter.y - previousCenter.y };
}

export function constrainCamera(camera: Camera, viewport: Viewport): Camera {
  const scale = Math.max(baseScale(viewport), camera.scale);
  function constrain(value: number, available: number, extent: number): number {
    return Math.max(available - extent, Math.min(0, value));
  }
  return { scale, x: constrain(camera.x, viewport.width, WORLD_SIZE * scale), y: constrain(camera.y, viewport.height, WORLD_HEIGHT * scale) };
}

export function resizeCamera(camera: Camera, previous: Viewport, next: Viewport): Camera {
  const center = { x: (previous.width / 2 - camera.x) / camera.scale, y: (previous.height / 2 - camera.y) / camera.scale };
  const scale = baseScale(next) * camera.scale / baseScale(previous);
  return constrainCamera({ scale, x: next.width / 2 - center.x * scale, y: next.height / 2 - center.y * scale }, next);
}

export function focusCamera(point: MapPoint, viewport: Viewport, zoom = 16, anchor: MapPoint = { x: viewport.width / 2, y: viewport.height / 2 }): Camera {
  const scale = baseScale(viewport) * Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  return constrainCamera({ x: anchor.x - point.x * WORLD_SIZE * scale, y: anchor.y - point.y * WORLD_HEIGHT * scale, scale }, viewport);
}
