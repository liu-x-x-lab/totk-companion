import type { PointOfInterest } from '../../types/domain';
import type { Camera, Viewport } from './geometry';
import { baseScale, focusCamera, MAX_ZOOM, WORLD_HEIGHT, WORLD_SIZE } from './geometry.ts';

export interface MarkerCluster { id: string; x: number; y: number; points: PointOfInterest[] }

// Build once per filter change. A frame only visits buckets near the screen.
export function createPointIndex(points: readonly PointOfInterest[]) {
  const count = 64, cells = new Map<string, PointOfInterest[]>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    const x = Math.floor(point.mapPosition.x * count), y = Math.floor(point.mapPosition.y * count), key = `${x}:${y}`;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const bucket = cells.get(key); if (bucket) bucket.push(point); else cells.set(key, [point]);
  }
  return { query(camera: Camera, viewport: Viewport) {
    const x0 = Math.floor((-camera.x - 44) / camera.scale / WORLD_SIZE * count);
    const x1 = Math.floor((viewport.width - camera.x + 44) / camera.scale / WORLD_SIZE * count);
    const y0 = Math.floor((-camera.y - 44) / camera.scale / WORLD_HEIGHT * count);
    const y1 = Math.floor((viewport.height - camera.y + 44) / camera.scale / WORLD_HEIGHT * count);
    const nearby: PointOfInterest[] = [];
    for (let y = Math.max(minY, y0); y <= Math.min(maxY, y1); y++) for (let x = Math.max(minX, x0); x <= Math.min(maxX, x1); x++) {
      const bucket = cells.get(`${x}:${y}`); if (bucket) nearby.push(...bucket);
    }
    return nearby;
  } };
}
export const OVERVIEW_ZOOM = 4;

function clusterCellSize(camera: Camera, viewport: Viewport): number {
  const zoom = camera.scale / baseScale(viewport);
  const budget = zoom < OVERVIEW_ZOOM ? 32 : zoom < 12 ? 64 : 120;
  let size = zoom < OVERVIEW_ZOOM ? 112 : zoom < 12 ? 80 : 56;
  // Include the padded query edges and an independent selected point.
  const cells = (extent: number) => Math.ceil((extent + 88) / size) + 1;
  while (cells(viewport.width) * cells(viewport.height) + 1 > budget) size += 8;
  return size;
}

export function clusterPoints(points: readonly PointOfInterest[],camera:Camera,viewport:Viewport,selectedId:string|null,cellSize=clusterCellSize(camera,viewport)):MarkerCluster[] {
  const groups = new Map<string,MarkerCluster>();
  for(const point of points){
    const x = point.mapPosition.x*WORLD_SIZE*camera.scale+camera.x;
    const y = point.mapPosition.y*WORLD_HEIGHT*camera.scale+camera.y;
    if(x< -44||y< -44||x>viewport.width+44||y>viewport.height+44) continue;
    // Anchor the grid to the world so panning does not move its boundaries.
    const key=point.id===selectedId?`selected:${point.id}`:`${Math.floor((x-camera.x)/cellSize)}:${Math.floor((y-camera.y)/cellSize)}`;
    const group=groups.get(key);
    if(group){group.x+=point.mapPosition.x;group.y+=point.mapPosition.y;group.points.push(point);}
    else groups.set(key,{id:key,x:point.mapPosition.x,y:point.mapPosition.y,points:[point]});
  }
  const clusters = [...groups.values()].map((group)=>({...group,x:group.x/group.points.length,y:group.y/group.points.length}));
  // Grid neighbours can have almost identical centroids. Merge the closest
  // colliding pair until all ordinary 44px hit targets have an 8px gap.
  for (;;) {
    let first = -1, second = -1, nearest = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].id.startsWith('selected:')) continue;
      for (let j = i + 1; j < clusters.length; j++) {
        if (clusters[j].id.startsWith('selected:')) continue;
        const dx = (clusters[i].x - clusters[j].x) * WORLD_SIZE * camera.scale;
        const dy = (clusters[i].y - clusters[j].y) * WORLD_HEIGHT * camera.scale;
        if (Math.abs(dx) >= 52 || Math.abs(dy) >= 52) continue;
        const distance = dx * dx + dy * dy;
        if (distance < nearest) { first = i; second = j; nearest = distance; }
      }
    }
    if (first < 0) return clusters;
    const a = clusters[first], b = clusters[second], total = a.points.length + b.points.length;
    a.x = (a.x * a.points.length + b.x * b.points.length) / total;
    a.y = (a.y * a.points.length + b.y * b.points.length) / total;
    a.points.push(...b.points);
    clusters.splice(second, 1);
  }
}

export function clusterFocusCamera(cluster: MarkerCluster, camera: Camera, viewport: Viewport, top = 0, bottom = viewport.height): Camera {
  const area = bottom - top >= 44 ? { top, bottom } : { top: 0, bottom: viewport.height };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of cluster.points) {
    minX = Math.min(minX, point.mapPosition.x); maxX = Math.max(maxX, point.mapPosition.x);
    minY = Math.min(minY, point.mapPosition.y); maxY = Math.max(maxY, point.mapPosition.y);
  }
  const fitScale = Math.min(Math.max(44, viewport.width - 88) / Math.max(.001, (maxX - minX) * WORLD_SIZE),
    Math.max(44, area.bottom - area.top - 88) / Math.max(.001, (maxY - minY) * WORLD_HEIGHT));
  const base = baseScale(viewport), current = camera.scale / base;
  const zoom = Math.min(MAX_ZOOM, Math.max(OVERVIEW_ZOOM, current * 2, Math.min(current * 6, fitScale / base)));
  return focusCamera(cluster, viewport, zoom, { x: viewport.width / 2, y: (area.top + area.bottom) / 2 });
}
