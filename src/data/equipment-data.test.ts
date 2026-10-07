import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeEquipment } from './equipment.ts';
import type { EquipmentPack } from './equipment.ts';

const pack = JSON.parse(readFileSync(new URL('../../public/data/equipment.json', import.meta.url), 'utf8')) as EquipmentPack;
const manifest = JSON.parse(readFileSync(new URL('../../public/data/equipment-manifest.json', import.meta.url), 'utf8'));
const equipment = decodeEquipment(pack);
const get = (id: string) => equipment.find((item) => item.id === id)!;

describe('真实装备固定属性', () => {
  it('完整保留 310 件基础图鉴和 775 个已有稳定 ID，中文名与数值有来源', () => {
    const catalog = equipment.filter((item) => item.catalogEntry);
    assert.equal(catalog.length, 310);
    assert.equal(new Set(equipment.map((item) => item.id)).size, 775);
    assert.equal(manifest.catalogTotal, catalog.length);
    assert.deepEqual(manifest.counts, { 'one-handed': 43, 'two-handed': 36, spear: 33, bow: 30, shield: 33, armor: 135 });
    for (const item of catalog) {
      assert.match(item.name, /[\u4e00-\u9fff]/);
      assert.ok(item.originalName && item.source.url && item.source.checkedAt);
      if (item.category !== 'armor') assert.ok(item.baseDurability! > 0);
      else { assert.equal(item.baseDurability, null); assert.ok(item.defense !== null && Number.isFinite(item.defense) && item.defense >= 0); }
      if (item.category !== 'armor' && item.category !== 'shield') assert.ok(item.attack != null || item.attackRange);
    }
  });

  it('无腐蚀旅人之剑为攻击 7 / 耐久 20，腐朽版为 5 / 16，不能混用', () => {
    const intact = get('Weapon_Sword_001'), decayed = get('Weapon_Sword_106');
    assert.deepEqual([intact.attack, intact.baseDurability, intact.variant], [7, 20, 'pristine']);
    assert.deepEqual([decayed.attack, decayed.baseDurability, decayed.variant], [5, 16, 'decayed']);
    assert.notEqual(intact.id, decayed.id);
  });

  it('双手剑和长枪区分显示攻击与内部参数', () => {
    assert.deepEqual([get('Weapon_Lsword_001').attack, get('Weapon_Lsword_001').rawAttack], [9, 10]);
    assert.deepEqual([get('Weapon_Spear_001').attack, get('Weapon_Spear_001').rawAttack], [4, 3]);
  });

  it('海利亚盾防御 90、耐久 800；兽神弓每箭 32、三连射、耐久 45', () => {
    assert.deepEqual([get('Weapon_Shield_030').defense, get('Weapon_Shield_030').baseDurability], [90, 800]);
    assert.deepEqual([get('Weapon_Bow_032').attack, get('Weapon_Bow_032').arrowsPerShot, get('Weapon_Bow_032').baseDurability], [32, 3, 45]);
  });

  it('大师之剑基础 30 / 40，魔王之弓使用条件范围而非任意固定攻击', () => {
    assert.deepEqual([get('Weapon_Sword_070').attack, get('Weapon_Sword_070').baseDurability], [30, 40]);
    assert.equal(get('Weapon_Bow_166').attack, null);
    assert.deepEqual(get('Weapon_Bow_166').attackRange, [2, 60]);
    assert.equal(get('Weapon_Bow_166').baseDurability, 42);
    assert.ok(get('Weapon_Bow_166').attackNote?.includes('红心'));
    assert.ok(get('Weapon_Sword_070_Broken').durabilityNote?.includes('旧 Echo 表为 6'));
  });

  it('防具 0–4 星防御、单件材料费用和旧强化收藏正确关联', () => {
    const hood = get('Armor_001_Head');
    assert.deepEqual(hood.armorLevels?.map((level) => level.defense), [3, 5, 8, 12, 20]);
    assert.deepEqual(hood.armorLevels?.map((level) => level.rupees), [0, 10, 50, 200, 500]);
    assert.deepEqual(hood.armorLevels?.[1].materials.map((material) => [material.id, material.quantity]), [['Item_Enemy_77', 5]]);
    const upgraded = get('Armor_003_Head');
    assert.equal(upgraded.defense, 8); assert.equal(upgraded.upgradeLevel, 2); assert.equal(upgraded.catalogEntry, false);
    assert.equal(upgraded.baseDurability, null);
  });

  it('全身防具保留整体防御、材料与费用；不可强化防具只保留基础值', () => {
    const full = get('Armor_1036_Head');
    assert.equal(full.armorSlot, 'full');
    assert.deepEqual(full.armorLevels?.map((level) => level.defense), [12, 21, 36, 54, 84]);
    assert.equal(full.armorLevels?.[1].rupees, 30);
    assert.equal(full.armorLevels?.[1].materials[0].quantity, 9);
    assert.equal(get('Armor_1043_Upper').armorLevels?.length, 1);
  });

  it('未核验的剧情对象保留历史 ID，不捏造同名装备属性', () => {
    const event = get('Weapon_Sword_070_ForGrabEvent');
    assert.ok(event); assert.equal(event.catalogEntry, false);
    assert.equal(event.attack, null); assert.equal(event.baseDurability, null); assert.equal(event.source.status, 'unverified');
  });

  it('残旧发夹的防御 0 是已知数值，不能当成资料缺失', () => {
    const hairBand = get('Armor_1151_Head');
    assert.equal(hairBand.defense, 0);
    assert.deepEqual(hairBand.armorLevels?.map((level) => level.defense), [0]);
  });

  it('拒绝重复 ID、损坏数值和错误强化关联', () => {
    assert.throws(() => decodeEquipment({ ...pack, items: [...pack.items, pack.items[0]] }));
    assert.throws(() => decodeEquipment({ ...pack, items: [{ ...pack.items[0], baseDurability: -1 }] }));
    assert.throws(() => decodeEquipment({ ...pack, aliases: [{ ...pack.aliases[0], defense: 999 }] }));
  });
});
