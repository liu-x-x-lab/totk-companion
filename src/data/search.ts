import type { PointOfInterest } from '../types/domain';
import { formatCoordinates,pointDefinition } from './catalog.ts';

export function matchesPoint(point:PointOfInterest,query:string):boolean {
  const text=query.trim().toLowerCase();if(!text)return true;
  const numbers=text.split(/[\s,，]+/).map(Number);
  if((numbers.length===2||numbers.length===3)&&numbers.every(Number.isFinite)&&point.gameCoordinates){
    const locations=[point.gameCoordinates];
    const start=point.korokGuide?.pair?.start.rawCoordinates;
    if(start)locations.push({x:start[0],y:-start[2],z:start[1]});
    return locations.some(p=>Math.abs(p.x-numbers[0])<=50&&Math.abs(p.y-numbers[1])<=50&&(numbers.length===2||Math.abs(p.z-numbers[2])<=50));
  }
  return `${point.name} ${point.originalName??''} ${point.actorName??''} ${point.shrineGuide?.puzzle??''} ${point.korokGuide?.type??''} ${point.korokGuide?'克洛格':''} ${point.region} ${pointDefinition(point).label} ${formatCoordinates(point)}`.toLowerCase().includes(text);
}
