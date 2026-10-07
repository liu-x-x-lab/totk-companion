import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeEquipment } from '../../data/equipment.ts';
import { materialKey, planMaterials, RUPEES_KEY } from './armor-planner.ts';
import type { Equipment } from '../../types/domain';

const equipment = decodeEquipment(JSON.parse(readFileSync(new URL('../../../public/data/equipment.json', import.meta.url), 'utf8')));
const hood = 'Armor_001_Head';
describe('防具升级备料', () => {
  it('三件海利亚防具合并材料和逐星费用', () => {
    const result = planMaterials(equipment, ['Head', 'Upper', 'Lower'].map((slot) => ({ equipmentId: `Armor_001_${slot}`, currentLevel: 0, targetLevel: 4 })), {});
    assert.equal(result.currency.required, 2280);
    assert.equal(result.upgradeCount, 12);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Ore_F')?.required, 150);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Enemy_02')?.required, 24);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Enemy_77')?.required, 15);
    assert.equal(result.errors.length, 0);
  });
  it('从二星到四星不重复算已完成的一、二星，持有量扣除且缺口不为负', () => {
    const result = planMaterials(equipment, [{ equipmentId: hood, currentLevel: 2, targetLevel: 4 }], { 'actor:Item_Ore_F': 60, 'actor:Item_Enemy_02': 2, [RUPEES_KEY]: 100 });
    assert.equal(result.currency.required, 700); assert.equal(result.currency.missing, 600);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Ore_F')?.missing, 0);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Enemy_02')?.missing, 6);
    assert.ok(!result.materials.some((row) => row.key === 'actor:Item_Enemy_77'));
  });
  it('古代勇者全身防具按原始整体材料和费用计算一次', () => {
    const result = planMaterials(equipment, [{ equipmentId: 'Armor_1036_Head', currentLevel: 0, targetLevel: 4 }], {});
    assert.equal(result.currency.required, 2280);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Ore_M')?.required, 25);
    assert.equal(result.materials.find((row) => row.key === 'actor:Item_Enemy_157')?.required, 9);
  });
  it('无效、重复、别名和不可强化防具不会产生虚假的费用', () => {
    const plans = ['missing', 'Armor_1043_Upper', 'Armor_003_Head', hood, hood].map((equipmentId) => ({ equipmentId, currentLevel: 0, targetLevel: 1 }));
    const result = planMaterials(equipment, plans, {});
    assert.equal(result.currency.required, 10); assert.equal(result.errors.length, 4);
    assert.equal(planMaterials(equipment, [{ equipmentId: hood, currentLevel: 4, targetLevel: 0 }], {}).currency.required, 0);
  });
  it('缺失等级不输出部分总数，缺失材料 ID 使用原始名而非中文翻译', () => {
    const item = equipment.find((entry) => entry.id === hood)!;
    const incomplete: Equipment = { ...item, armorLevels: item.armorLevels!.filter((entry) => entry.level !== 2) };
    const result = planMaterials([incomplete], [{ equipmentId: hood, currentLevel: 0, targetLevel: 4 }], {});
    assert.equal(result.currency.required, 0); assert.equal(result.errors.length, 1);
    assert.equal(materialKey({ id: null, name: '甲', originalName: '  Same Material  ', quantity: 1 }), 'name:same material');
  });
});
