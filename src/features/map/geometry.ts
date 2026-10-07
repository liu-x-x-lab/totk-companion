import type { MapPoint } from '../../types/domain';

export const WORLD_SIZE = 1000;
export const WORLD_HEIGHT = WORLD_SIZE * 5 / 6;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;
export interface Camera { x: number; y: number; scale: number }
export interface Viewport { width: number; height: number }

export function baseScale(viewport: Viewport): number {
  return Math.max(.001, Math.min(viewport.width / WORLD_SIZE, viewport.height / WORLD_HEIGHT));
}

export function fitCamera(viewport: Viewport): Camera {
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
  function constrain(value: number, available: number, extent: number): number {
    return extent <= available ? (available - extent) / 2 : Math.max(available - extent - 24, Math.min(24, value));
  }
  return { ...camera, x: constrain(camera.x, viewport.width, WORLD_SIZE * camera.scale), y: constrain(camera.y, viewport.height, WORLD_HEIGHT * camera.scale) };
}

export function focusCamera(point: MapPoint, viewport: Viewport, zoom = 16): Camera {
  const scale = baseScale(viewport) * Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  return constrainCamera({ x: viewport.width / 2 - point.x * WORLD_SIZE * scale, y: viewport.height / 2 - point.y * WORLD_HEIGHT * scale, scale }, viewport);
}
