import type { DataSource, Equipment, PointOfInterest } from '../types/domain';

export const demoSource: DataSource = { name: '项目演示数据 · 尚未接入真实资料', status: 'demo' };

export const demoPoints: PointOfInterest[] = [
  { id: 'demo-bokoblin-camp', name: '波克布林营地', layer: 'surface', category: 'monster', mapPosition: { x: .37, y: .55 }, gameCoordinates: null, region: '平原 · 示意位置', monsterType: 'bokoblin', description: '演示怪物营地。位置、数量和掉落将在真实数据接入后补齐。', source: demoSource },
  { id: 'demo-lynel', name: '莱尼尔出没地', layer: 'surface', category: 'monster', mapPosition: { x: .68, y: .38 }, gameCoordinates: null, region: '山地 · 示意位置', monsterType: 'lynel', description: '用于验证怪物筛选和地图定位，不代表游戏中的真实地点。', source: demoSource },
  { id: 'demo-lizalfos', name: '蜥蜴战士营地', layer: 'surface', category: 'monster', mapPosition: { x: .62, y: .72 }, gameCoordinates: null, region: '湿地 · 示意位置', monsterType: 'lizalfos', description: '用于演示水边怪物标记，真实坐标和怪物等级待接入。', source: demoSource },
  { id: 'demo-moblin', name: '莫力布林营地', layer: 'surface', category: 'monster', mapPosition: { x: .24, y: .34 }, gameCoordinates: null, region: '丘陵 · 示意位置', monsterType: 'moblin', description: '示例营地。后续支持怪物等级、掉落和已探索标记。', source: demoSource },
  { id: 'demo-shrine', name: '平原神庙', layer: 'surface', category: 'shrine', mapPosition: { x: .46, y: .38 }, gameCoordinates: null, region: '平原 · 示意位置', description: '用于演示神庙图层，名称与位置均为占位信息。', source: demoSource },
  { id: 'demo-tower', name: '平原鸟望台', layer: 'surface', category: 'tower', mapPosition: { x: .52, y: .62 }, gameCoordinates: null, region: '平原 · 示意位置', description: '用于验证不同地点图标与收藏，真实资料待接入。', source: demoSource },
  { id: 'demo-cave', name: '山麓洞窟', layer: 'surface', category: 'cave', mapPosition: { x: .74, y: .59 }, gameCoordinates: null, region: '山地 · 示意位置', description: '演示洞窟入口。后续可增加洞窟内部、魔犹伊和材料。', source: demoSource },
  { id: 'demo-sky-construct', name: '天空魔像据点', layer: 'sky', category: 'monster', mapPosition: { x: .47, y: .46 }, gameCoordinates: null, region: '空岛 · 示意位置', monsterType: 'construct', description: '天空图层的示例怪物据点，尚未对应真实游戏坐标。', source: demoSource },
  { id: 'demo-sky-shrine', name: '空岛神庙', layer: 'sky', category: 'shrine', mapPosition: { x: .68, y: .30 }, gameCoordinates: null, region: '空岛 · 示意位置', description: '用于验证天空地点过滤和定位。', source: demoSource },
  { id: 'demo-depths-lynel', name: '地底莱尼尔', layer: 'depths', category: 'monster', mapPosition: { x: .40, y: .43 }, gameCoordinates: null, region: '地底 · 示意位置', monsterType: 'lynel', description: '地底怪物分布占位，真实位置与环境待接入。', source: demoSource },
  { id: 'demo-depths-bokoblin', name: '地底波克布林', layer: 'depths', category: 'monster', mapPosition: { x: .67, y: .60 }, gameCoordinates: null, region: '地底 · 示意位置', monsterType: 'bokoblin', description: '用于演示切换图层后仅显示该层标记。', source: demoSource },
];

export const demoEquipment: Equipment[] = [
  { id: 'demo-sword', name: '旅行者之剑（示例）', category: 'one-handed', attack: null, defense: null, baseDurability: null, description: '单手武器图鉴占位。攻击力与基础耐久接入真实资料后显示。', source: demoSource },
  { id: 'demo-claymore', name: '士兵双手剑（示例）', category: 'two-handed', attack: null, defense: null, baseDurability: null, description: '双手武器图鉴占位，可提前验证收藏与手动耐久记录。', source: demoSource },
  { id: 'demo-spear', name: '骑士之枪（示例）', category: 'spear', attack: null, defense: null, baseDurability: null, description: '长柄武器图鉴占位，后续补充武器状态与获取方式。', source: demoSource },
  { id: 'demo-bow', name: '旅行者之弓（示例）', category: 'bow', attack: null, defense: null, baseDurability: null, description: '弓图鉴占位，后续增加箭数、射程和获取地点。', source: demoSource },
  { id: 'demo-shield', name: '士兵之盾（示例）', category: 'shield', attack: null, defense: null, baseDurability: null, description: '盾图鉴占位，基础防御与耐久等待真实数据。', source: demoSource },
  { id: 'demo-armor', name: '海利亚服（示例）', category: 'armor', attack: null, defense: null, baseDurability: null, description: '防具使用防御和强化资料，初始化阶段预留字段。', source: demoSource },
];
