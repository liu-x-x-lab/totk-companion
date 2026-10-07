export type MapLayer = 'sky' | 'surface' | 'depths';
export type Page = 'map' | 'equipment' | 'monsters' | 'saved';
export type PoiCategory = 'monster' | 'shrine' | 'tower' | 'cave' | 'root' | 'well' | 'chasm' | 'korok' | 'tear' | 'chest' | 'sages-will' | 'old-map' | 'settlement' | 'stable' | 'shop' | 'lab' | 'dispenser' | 'landmark' | 'plant' | 'fruit' | 'mushroom' | 'material' | 'monster-material' | 'ore' | 'fish' | 'insect' | 'animal' | 'weapon' | 'arrow' | 'npc' | 'zonai' | 'other-object';
export type EquipmentCategory = 'one-handed' | 'two-handed' | 'spear' | 'bow' | 'shield' | 'armor';
export type MonsterType = keyof typeof MONSTER_LABELS;

export interface DataSource {
  name: string;
  status: 'demo' | 'unverified' | 'verified';
  url?: string;
  gameVersion?: string;
  checkedAt?: string;
}

export interface MapPoint { x: number; y: number }
export interface GameCoordinates { x: number; y: number; z: number }

export interface PointOfInterest {
  id: string;
  name: string;
  layer: MapLayer;
  category: PoiCategory;
  mapPosition: MapPoint;
  gameCoordinates: GameCoordinates | null;
  region: string;
  description: string;
  monsterType?: MonsterType;
  originalName?: string;
  actorName?: string;
  rawCoordinates?: [number, number, number];
  sourceObjectId?: number;
  contents?: string[];
  source: DataSource;
}

export interface Equipment {
  id: string;
  iconId?: string;
  name: string;
  category: EquipmentCategory;
  attack: number | null;
  defense: number | null;
  baseDurability: number | null;
  description: string;
  source: DataSource;
  originalName?: string;
  catalogEntry?: boolean;
  variant?: 'standard' | 'pristine' | 'decayed';
  rawAttack?: number | null;
  attackRange?: [number, number] | null;
  attackNote?: string;
  durabilityNote?: string;
  arrowsPerShot?: number;
  bowRange?: number;
  fuseExtraDurability?: number | null;
  fuseDurabilityNote?: string;
  effects?: string[];
  modifiers?: Partial<Record<'attackUp' | 'attackUpPlus' | 'guardUp' | 'guardUpPlus' | 'durabilityUp' | 'durabilityUpPlus', [number, number]>>;
  armorSlot?: 'head' | 'upper' | 'lower' | 'full';
  armorLevels?: ArmorLevel[];
  upgradeLevel?: number;
}

export interface ArmorLevel {
  level: number;
  defense: number;
  rupees: number;
  materials: { id: string | null; name: string; originalName: string; quantity: number }[];
}

export interface DurabilityRecord {
  id: string;
  equipmentId: string;
  maximum: number;
  current: number;
  createdAt: string;
}

export interface PlayerData {
  schemaVersion: 1;
  favorites: string[];
  durabilityRecords: DurabilityRecord[];
}

export const LAYER_LABELS: Record<MapLayer, string> = { sky: '天空', surface: '地表', depths: '地底' };
export const CATEGORY_LABELS: Record<PoiCategory, string> = { monster:'怪物',shrine:'神庙',tower:'鸟望台',cave:'洞窟入口',root:'树根',well:'水井入口',chasm:'深穴',korok:'呀哈哈',tear:'龙之泪',chest:'普通宝箱','sages-will':'贤者的遗志','old-map':'古旧地图',settlement:'城镇与聚落',stable:'驿站',shop:'商店',lab:'研究所',dispenser:'扭蛋机',landmark:'地名与遗迹',plant:'植物',fruit:'水果',mushroom:'蘑菇',material:'其他材料','monster-material':'怪物材料',ore:'矿床与矿石',fish:'鱼类',insect:'昆虫与小动物',animal:'野生动物',weapon:'装备拾取点',arrow:'箭',npc:'人物',zonai:'左纳乌装置','other-object':'其他对象' };
export const MONSTER_LABELS = { hinox:'西诺克斯',stalnox:'骷髅西诺克斯',lynel:'莱尼尔（人马）',talus:'岩石巨人',gleeok:'古栗欧克',flux:'方块魔像',frox:'巨霸',molduga:'莫尔德拉吉克',bokoblin:'波克布林','boss-bokoblin':'首领波克布林',moblin:'莫力布林',lizalfos:'蜥蜴战士',construct:'兵队与队长魔像',chuchu:'丘丘',keese:'蝙蝠', 'like-like':'莱克莱克',wizzrobe:'长袍魔法师',octorok:'八爪怪',aerocuda:'卡库达',gibdo:'吉波得',horablin:'霍拉布林',bubbulfrog:'魔犹伊',evermean:'树怪',yiga:'依盖队',pebblit:'小岩石怪','little-frox':'小巨霸','gloom-spawn':'瘴气之手／幻影加侬据点','phantom-ganon':'幻影加侬','temple-boss':'神殿首领',dragon:'巨龙初始位置','story-boss':'剧情首领','other-enemy':'其他敌方对象' } as const;
export const EQUIPMENT_LABELS: Record<EquipmentCategory, string> = { 'one-handed': '单手武器', 'two-handed': '双手武器', spear: '长柄武器', bow: '弓', shield: '盾', armor: '防具' };
