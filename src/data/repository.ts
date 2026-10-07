import type { Equipment, MapLabel, PointOfInterest, Quest } from '../types/domain';
import { catalogById } from './catalog';
import { decodeEquipment } from './equipment';
import type { EquipmentPack } from './equipment';
import { decodeQuests } from './quests';
import type { QuestPack } from './quests';

export interface CompanionRepository {
  load(signal?: AbortSignal): Promise<{ points: PointOfInterest[]; equipment: Equipment[]; labels: MapLabel[]; quests: Quest[]; manifest: DataManifest }>;
  isDemo: boolean;
}

export interface DataManifest { schemaVersion: number; updatedAt: string; provider: string; gameVersion: string | null; total: number; counts: Record<string,number>; layers: Record<string,number> }
type Row = [string,number,string,PointOfInterest['layer'],number,number,number,number,number,number|null,number[]?];
interface LabelPack { schemaVersion: number; total: number; labels: MapLabel[]; locations: Record<string, { name: string; originalName: string; layer: PointOfInterest['layer'] }> }

async function json(path: string, signal?: AbortSignal) {
  const response = await fetch(path,{signal});
  if(!response.ok) throw new Error('地点资料暂时无法加载，请重试。');
  return response.json();
}

// 用同一接口替换真实 JSON / API；页面不依赖具体上游格式。
export const repository: CompanionRepository = {
  isDemo: false,
  async load(signal) {
    const [pack, manifest, gear, names, journal] = await Promise.all([json('/data/points.json',signal),json('/data/manifest.json',signal),json('/data/equipment.json',signal),json('/data/map-labels.json',signal),json('/data/quests.json',signal)]) as [{schemaVersion:number;strings:string[];rows:Row[]},DataManifest,EquipmentPack,LabelPack,QuestPack];
    if(pack.schemaVersion!==1 || !Array.isArray(pack.rows) || manifest.total!==pack.rows.length) throw new Error('资料格式或完整性校验失败。');
    if(names.schemaVersion!==1 || !Array.isArray(names.labels) || names.total!==names.labels.length || !names.locations
      || new Set(names.labels.map((label)=>label.id)).size!==names.total
      || names.labels.some((label)=>!label.name || !['sky','surface','depths'].includes(label.layer) || ![label.mapPosition.x,label.mapPosition.y].every((value)=>Number.isFinite(value)&&value>=0&&value<=1))) throw new Error('地名资料格式或完整性校验失败。');
    const regionNames = new Map(names.labels.map((label)=>[label.originalName,label.name]));
    const source = { name:'TotK Object Map · 社区固定地点资料',status:'unverified' as const,url:'https://objmap-totk.zeldamods.org/',checkedAt:manifest.updatedAt };
    const points = pack.rows.map(([id,name,key,layer,x,y,z,region,actor,objid,contents]): PointOfInterest => {
      const definition = catalogById.get(key);
      if(!definition || ![x,y,z].every(Number.isFinite)) throw new Error('地点分类或坐标无效。');
      const originalName = pack.strings[name];
      const localized = names.locations[id];
      return { id,name:localized?.name??(definition.category==='monster'?`${definition.label} · ${originalName}`:key==='korok'?`呀哈哈 · ${originalName}`:originalName),layer:localized?.layer??layer,category:definition.category,monsterType:definition.monsterType,
        mapPosition:{x:(x+6000)/12000,y:(z+5000)/10000},gameCoordinates:{x,y:-z,z:y},rawCoordinates:[x,y,z],originalName,actorName:pack.strings[actor],sourceObjectId:objid??undefined,
        contents:contents?.map((index)=>pack.strings[index]),region:regionNames.get(pack.strings[region])||pack.strings[region]||definition.label,description:'源数据中的固定放置位置。出现状态与等级可能受剧情、时间和游戏进度影响。',source };
    });
    const equipment = decodeEquipment(gear);
    return {points,equipment,labels:names.labels,quests:decodeQuests(journal),manifest};
  },
};
