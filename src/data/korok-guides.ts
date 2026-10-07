import type { GameCoordinates, KorokGuide, MapPoint } from '../types/domain';

export interface KorokGuidePack { schemaVersion: number; total: number; carryTotal: number; seedTotal: number; typeTotal: number; guides: KorokGuide[] }

export function decodeKorokGuides(pack: KorokGuidePack): KorokGuide[] {
  if (pack.schemaVersion !== 1 || pack.total !== 900 || pack.carryTotal !== 100 || pack.seedTotal !== 1000 || pack.typeTotal !== 24
    || !Array.isArray(pack.guides) || pack.guides.length !== 900) throw new Error('呀哈哈任务目录不完整。');
  const ids = new Set<string>(), codes = new Set<string>(), starts = new Set<string>(), destinations = new Set<string>();
  for (const guide of pack.guides) {
    if (!/^loc:0x[\da-f]+$/.test(guide.pointId) || ids.has(guide.pointId) || !/^[A-Z]+\d+$/.test(guide.code) || codes.has(guide.code)
      || !guide.name || !guide.type || !guide.typeName || !guide.hint || !['surface','sky'].includes(guide.layer)
      || ![1,2].includes(guide.rewardSeeds) || (guide.rewardSeeds===2)!==!!guide.pair
      || (guide.type==='Korok Friends')!==!!guide.pair) throw new Error('呀哈哈任务资料无效。');
    if (guide.pair) {
      if (guide.pair.association !== 'explicit-source-links') throw new Error('克洛格搬运任务关联无效。');
      for (const endpoint of [guide.pair.start,guide.pair.destination]) {
        const xyz=endpoint.rawCoordinates;
        if (!/^obj:0x[\da-f]+$/.test(endpoint.sourceId) || !Number.isSafeInteger(endpoint.sourceObjectId) || endpoint.sourceObjectId<=0
          || !Array.isArray(xyz) || xyz.length!==3 || !xyz.every(Number.isFinite) || Math.abs(xyz[0])>6000 || Math.abs(xyz[2])>5000) throw new Error('克洛格搬运任务坐标无效。');
      }
      if(starts.has(guide.pair.start.sourceId)||destinations.has(guide.pair.destination.sourceId)||guide.pair.start.sourceId===guide.pair.destination.sourceId) throw new Error('克洛格搬运任务重复关联。');
      starts.add(guide.pair.start.sourceId);destinations.add(guide.pair.destination.sourceId);
    }
    ids.add(guide.pointId);codes.add(guide.code);
  }
  if(starts.size!==100 || new Set(pack.guides.map(guide=>guide.type)).size!==24 || pack.guides.reduce((sum,guide)=>sum+guide.rewardSeeds,0)!==1000) throw new Error('呀哈哈任务分类不完整。');
  return pack.guides;
}

export function korokMapPosition(xyz: readonly [number, number, number]): MapPoint {
  return {x:(xyz[0]+6000)/12000,y:(xyz[2]+5000)/10000};
}

export function korokCoordinates(xyz: readonly [number, number, number]): GameCoordinates {
  return {x:xyz[0],y:-xyz[2],z:xyz[1]};
}

export function korokCoordinateText(xyz: readonly [number, number, number]): string {
  return [xyz[0],-xyz[2],xyz[1]].map(value=>Math.round(value)).join(', ');
}
