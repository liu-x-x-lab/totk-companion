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

export function focusPairCamera(a: MapPoint, b: MapPoint, viewport: Viewport, top = 0, bottom = viewport.height): Camera {
  const available = bottom - top;
  const areaTop=available>=44?top:0,areaBottom=available>=44?bottom:viewport.height;
  const minX=Math.min(a.x,b.x)*WORLD_SIZE,maxX=Math.max(a.x,b.x)*WORLD_SIZE;
  const minY=Math.min(a.y,b.y)*WORLD_HEIGHT,maxY=Math.max(a.y,b.y)*WORLD_HEIGHT;
  // Fit the endpoints and the whole viewport simultaneously. Near a world edge,
  // covering the viewport imposes a minimum scale that a midpoint-only fit misses.
  for(const padding of [20,8,0]){
    const left=44,right=Math.max(left+1,viewport.width-44),upper=areaTop+padding,lower=areaBottom-padding;
    if(lower<=upper)continue;
    const maximum=Math.min(baseScale(viewport)*16,(right-left)/Math.max(.001,maxX-minX),(lower-upper)/Math.max(.001,maxY-minY));
    const minimum=Math.max(baseScale(viewport),left/Math.max(.001,minX),(viewport.width-right)/Math.max(.001,WORLD_SIZE-maxX),upper/Math.max(.001,minY),(viewport.height-lower)/Math.max(.001,WORLD_HEIGHT-maxY));
    if(minimum>maximum)continue;
    const scale=maximum;
    const xMin=Math.max(viewport.width-WORLD_SIZE*scale,left-minX*scale),xMax=Math.min(0,right-maxX*scale);
    const yMin=Math.max(viewport.height-WORLD_HEIGHT*scale,upper-minY*scale),yMax=Math.min(0,lower-maxY*scale);
    return {scale,x:Math.max(xMin,Math.min(xMax,viewport.width/2-(minX+maxX)*scale/2)),y:Math.max(yMin,Math.min(yMax,(areaTop+areaBottom)/2-(minY+maxY)*scale/2))};
  }
  return focusCamera(midpoint(a,b),viewport,1,{x:viewport.width/2,y:(areaTop+areaBottom)/2});
}
