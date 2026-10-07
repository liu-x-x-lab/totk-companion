import type { PointOfInterest } from '../../types/domain';
import type { Camera, Viewport } from './geometry';
import { WORLD_HEIGHT, WORLD_SIZE } from './geometry.ts';

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
function clusterCellSize(viewport: Viewport): number {
  let size = 48;
  const cells = (extent: number) => Math.floor((extent + 44) / size) - Math.floor(-44 / size) + 1;
  while (cells(viewport.width) * cells(viewport.height) + 1 >= 150) size += 8;
  return size;
}

export function clusterPoints(points: readonly PointOfInterest[],camera:Camera,viewport:Viewport,selectedId:string|null,cellSize=clusterCellSize(viewport)):MarkerCluster[] {
  const groups = new Map<string,MarkerCluster>();
  for(const point of points){
    const x = point.mapPosition.x*WORLD_SIZE*camera.scale+camera.x;
    const y = point.mapPosition.y*WORLD_HEIGHT*camera.scale+camera.y;
    if(x< -44||y< -44||x>viewport.width+44||y>viewport.height+44) continue;
    const key=point.id===selectedId?`selected:${point.id}`:`${Math.floor(x/cellSize)}:${Math.floor(y/cellSize)}`;
    const group=groups.get(key);
    if(group){group.x+=point.mapPosition.x;group.y+=point.mapPosition.y;group.points.push(point);}
    else groups.set(key,{id:key,x:point.mapPosition.x,y:point.mapPosition.y,points:[point]});
  }
  return [...groups.values()].map((group)=>({...group,x:group.x/group.points.length,y:group.y/group.points.length}));
}
