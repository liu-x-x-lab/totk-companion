import { CATEGORY_LABELS, MONSTER_LABELS } from '../types/domain.ts';
import type { MonsterType, PointOfInterest, PoiCategory } from '../types/domain';
import type { IconName } from '../components/Icon';

export interface MarkerDefinition { id: string; label: string; group: string; category: PoiCategory; monsterType?: MonsterType; icon: IconName; color: string; glyph?: string }
export const BOSS_KEYS = ['hinox','stalnox','lynel','talus','gleeok','flux','frox','molduga'];
const exploration = ['shrine','root','tower','cave','well','chasm','korok','tear','chest','sages-will','old-map','settlement','stable','shop','lab','dispenser','landmark'];
const resource = ['plant','fruit','mushroom','material','monster-material','ore','fish','insect','animal'];
const symbols: Partial<Record<PoiCategory,IconName>> = { shrine:'shrine',root:'spark',tower:'tower',cave:'cave',well:'cave',chasm:'layers',korok:'spark',tear:'spark',chest:'bookmark',weapon:'sword',dispenser:'layers',animal:'mountain',ore:'spark',zonai:'layers' };
const bossSymbols:Record<string,[string,string]>={hinox:['西','#9b643d'],stalnox:['骷','#7b7968'],lynel:['马','#87553c'],talus:['岩','#687657'],gleeok:['龙','#94813e'],flux:['方','#3d8077'],frox:['巨','#735e81'],molduga:['沙','#a27b3c']};
export const markerCatalog: MarkerDefinition[] = [
  ...Object.entries(MONSTER_LABELS).map(([id,label]) => ({ id,label,group:BOSS_KEYS.includes(id)?'大型怪物':'其他怪物',category:'monster' as const,monsterType:id as MonsterType,icon:'monster' as const,color:bossSymbols[id]?.[1]??'#9b7e5a',glyph:bossSymbols[id]?.[0] })),
  ...Object.entries(CATEGORY_LABELS).filter(([id])=>id!=='monster').map(([id,label])=>({ id,label,group:exploration.includes(id)?'探索与收集':resource.includes(id)?'材料与动物':'装备、人物与装置',category:id as PoiCategory,icon:symbols[id as PoiCategory]??'map',color:resource.includes(id)?'#7a8850':'#427963' })),
];
export const catalogById = new Map(markerCatalog.map((entry)=>[entry.id,entry]));
export const pointFilterKey = (point: PointOfInterest) => point.category==='monster' ? point.monsterType??'other-enemy' : point.category;
export const pointDefinition = (point: PointOfInterest) => catalogById.get(pointFilterKey(point))!;
export function formatCoordinates(point: PointOfInterest): string {
  const p = point.gameCoordinates;
  return p ? [p.x,p.y,p.z].map((value)=>Math.round(value).toString()).join(', ') : '坐标待核验';
}
