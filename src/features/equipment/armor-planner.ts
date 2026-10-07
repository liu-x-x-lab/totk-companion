import type { ArmorLevel, ArmorUpgradePlan, Equipment } from '../../types/domain';

export const RUPEES_KEY = 'currency:rupees';
export interface MaterialRequirement {
  key: string; name: string; originalName: string; required: number; owned: number; missing: number;
}
export function materialKey(material: ArmorLevel['materials'][number]): string {
  return material.id ? `actor:${material.id}` : `name:${material.originalName.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}
export function canUpgrade(item: Equipment): boolean {
  return item.category === 'armor' && item.catalogEntry !== false && !!item.armorLevels?.some((level) => level.level > 0);
}
export function planMaterials(equipment: readonly Equipment[], plans: readonly ArmorUpgradePlan[], owned: Record<string, number>) {
  const items = new Map(equipment.map((item) => [item.id, item]));
  const materials = new Map<string, MaterialRequirement>();
  const seen = new Set<string>();
  const errors: string[] = [];
  let rupees = 0, upgradeCount = 0;
  const holding = (key: string) => Number.isInteger(owned[key]) && owned[key] >= 0 && owned[key] <= 999999 ? owned[key] : 0;
  for (const plan of plans) {
    const item = items.get(plan.equipmentId);
    if (!item || !canUpgrade(item) || seen.has(plan.equipmentId)
      || ![plan.currentLevel, plan.targetLevel].every((value) => Number.isInteger(value) && value >= 0 && value <= 4)
      || plan.targetLevel <= plan.currentLevel) {
      errors.push(`${item?.name ?? plan.equipmentId}：升级范围或资料不可用`); continue;
    }
    seen.add(plan.equipmentId);
    const levels: ArmorLevel[] = [];
    for (let level = plan.currentLevel + 1; level <= plan.targetLevel; level++) {
      const record = item.armorLevels!.find((entry) => entry.level === level);
      if (record) levels.push(record);
    }
    if (levels.length !== plan.targetLevel - plan.currentLevel) { errors.push(`${item.name}：升级等级资料不完整`); continue; }
    for (const level of levels) {
      rupees += level.rupees; upgradeCount++;
      for (const material of level.materials) {
        const key = materialKey(material);
        const entry = materials.get(key) ?? { key, name: material.name, originalName: material.originalName, required: 0, owned: holding(key), missing: 0 };
        entry.required += material.quantity;
        entry.missing = Math.max(0, entry.required - entry.owned);
        materials.set(key, entry);
      }
    }
  }
  const rows = [...materials.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const currency = { key: RUPEES_KEY, name: '卢比', originalName: 'Rupees', required: rupees, owned: holding(RUPEES_KEY), missing: Math.max(0, rupees - holding(RUPEES_KEY)) };
  return { materials: rows, currency, upgradeCount, errors, shortageCount: rows.filter((row) => row.missing > 0).length };
}
