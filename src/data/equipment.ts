import type { DataSource, Equipment, EquipmentCategory } from '../types/domain';
import { EQUIPMENT_LABELS } from '../types/domain.ts';

export interface EquipmentPack {
  schemaVersion: number;
  source: DataSource;
  items: Omit<Equipment, 'source'>[];
  aliases: { id: string; targetId: string; upgradeLevel: number; defense: number }[];
  legacyNames: Record<string, string>;
}

export function decodeEquipment(pack: EquipmentPack): Equipment[] {
  if (pack.schemaVersion !== 1 || !Array.isArray(pack.items) || !Array.isArray(pack.aliases) || !pack.source?.name) {
    throw new Error('装备资料格式不受支持。');
  }
  const ids = new Set<string>();
  const known = (value: number | null) => value === null || Number.isFinite(value) && value >= 0;
  const equipment = pack.items.map((item): Equipment => {
    if (!item.id || !item.name || ids.has(item.id) || !(item.category in EQUIPMENT_LABELS)
      || ![item.attack, item.defense, item.baseDurability].every(known)
      || item.category !== 'armor' && !(item.baseDurability !== null && item.baseDurability > 0)
      || item.attackRange && (!item.attackRange.every(Number.isFinite) || item.attackRange[0] > item.attackRange[1])) {
      throw new Error('装备属性或稳定 ID 无效。');
    }
    ids.add(item.id);
    return { ...item, iconId: item.id, catalogEntry: true, source: pack.source };
  });
  const bases = new Map(equipment.map((item) => [item.id, item]));
  for (const alias of pack.aliases) {
    const base = bases.get(alias.targetId);
    if (!base || base.category !== 'armor' || ids.has(alias.id)
      || !base.armorLevels?.some((level) => level.level === alias.upgradeLevel && level.defense === alias.defense)) {
      throw new Error('防具强化资料关联无效。');
    }
    ids.add(alias.id);
    equipment.push({ ...base, id: alias.id, catalogEntry: false, upgradeLevel: alias.upgradeLevel,
      name: `${base.name}（${alias.upgradeLevel ? '★'.repeat(alias.upgradeLevel) : '外观变体'}）`, defense: alias.defense });
  }
  // Preserve old saves without inventing properties for event-only/NPC actors.
  for (const [id, name] of Object.entries(pack.legacyNames)) {
    if (ids.has(id)) throw new Error('历史装备 ID 重复。');
    const lowered = id.toLowerCase();
    const category: EquipmentCategory = lowered.startsWith('armor') ? 'armor' : lowered.includes('lsword') ? 'two-handed'
      : lowered.includes('spear') ? 'spear' : lowered.includes('bow') ? 'bow' : lowered.includes('shield') ? 'shield' : 'one-handed';
    ids.add(id);
    equipment.push({ id, name, category, attack: null, defense: null, baseDurability: null, catalogEntry: false,
      description: '历史名称条目，可能属于剧情、外观或 NPC 对象；没有独立基础属性资料。原收藏和手动记录继续保留。',
      source: { name: 'TotK Object Map · 历史名称索引', status: 'unverified', url: 'https://objmap-totk.zeldamods.org/' } });
  }
  return equipment;
}
