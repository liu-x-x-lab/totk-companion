import type { PointOfInterest } from '../../types/domain';
import type { Camera, Viewport } from './geometry';
import { WORLD_HEIGHT, WORLD_SIZE } from './geometry.ts';

export interface MarkerCluster { id: string; x: number; y: number; points: PointOfInterest[] }
export function clusterPoints(points: readonly PointOfInterest[],camera:Camera,viewport:Viewport,selectedId:string|null,cellSize=48):MarkerCluster[] {
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
