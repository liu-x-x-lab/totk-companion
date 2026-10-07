import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlayerData, parsePlayerData, serializeBackup } from './player-data.ts';

const record = { id: 'instance-1', equipmentId: 'demo-sword', maximum: 30, current: 22, createdAt: '2026-10-07T00:00:00.000Z' };

describe('玩家备份', () => {
  it('旧版备份迁移新增记录为空，不丢失收藏或耐久', () => {
    const old = { schemaVersion: 1, favorites: ['poi:old'], durabilityRecords: [record] };
    assert.deepEqual(parsePlayerData(JSON.stringify(old)), { ...emptyPlayerData(), ...old });
  });
  it('备份往返保留任务阶段、多个防具计划与材料数量', () => {
    const data = { ...emptyPlayerData(), questProgress: [{ questId: 'GetCamera', completedStageIds: ['descend'] }],
      armorPlans: [{ equipmentId: 'Armor_001_Head', currentLevel: 2, targetLevel: 4 }], ownedMaterials: { 'actor:Item_Ore_F': 50, 'currency:rupees': 700 } };
    assert.deepEqual(parsePlayerData(serializeBackup(data)), data);
  });
  it('地点点亮/完成记录往返保存，旧备份默认未完成，未知地点 ID 保留', () => {
    const data = { ...emptyPlayerData(), completedPoints: ['loc:0x3370bc5cc790fa0d', 'future-point'] };
    assert.deepEqual(parsePlayerData(serializeBackup(data)).completedPoints, data.completedPoints);
    const old = { schemaVersion: 1, favorites: ['poi:old'], durabilityRecords: [record], ownedMaterials: { 'currency:rupees': 20 } };
    assert.deepEqual(parsePlayerData(JSON.stringify(old)).completedPoints, []);
    assert.equal(parsePlayerData(JSON.stringify(old)).ownedMaterials['currency:rupees'],20);
  });
  it('拒绝重复、超长、空值、非字符串及异常结构的完成记录', () => {
    for(const completedPoints of [['a','a'],[''],['x'.repeat(201)],[4],null,{},Array(100001).fill('x')]) {
      assert.throws(()=>parsePlayerData(JSON.stringify({...emptyPlayerData(),completedPoints})),/完成记录/);
    }
  });
  it('拒绝重复计划、非法升级范围、任务阶段和已有材料数量', () => {
    const plan = { equipmentId: 'Armor_001_Head', currentLevel: 0, targetLevel: 4 };
    for (const armorPlans of [[plan, plan], [{ ...plan, targetLevel: 5 }], [{ ...plan, currentLevel: 4 }]]) assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), armorPlans })));
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), questProgress: [{ questId: 'quest', completedStageIds: ['a', 'a'] }] })));
    for (const ownedMaterials of [{ 'actor:Item_Ore_F': -1 }, { 'actor:Item_Ore_F': 1.5 }, { 'currency:rupees': 1000000 }, { unknown: 4 }]) assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), ownedMaterials })));
  });
  it('往返恢复收藏和手动耐久', () => {
    const data = { ...emptyPlayerData(), favorites: ['poi:demo-bokoblin-camp', 'equipment:demo-sword'], durabilityRecords: [record] };
    assert.deepEqual(parsePlayerData(serializeBackup(data)), data);
  });
  for (const schemaVersion of [0, 2, '1', null]) it(`拒绝不支持的版本 ${schemaVersion}`, () => {
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), schemaVersion })));
  });
  for (const current of [-1, 31, 1.5, '22']) it(`拒绝非法剩余耐久 ${current}`, () => {
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), durabilityRecords: [{ ...record, current }] })));
  });
  for (const maximum of [0, -1, 10000, 2.5]) it(`拒绝非法最大耐久 ${maximum}`, () => {
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), durabilityRecords: [{ ...record, maximum }] })));
  });
  it('拒绝重复实例、重复收藏和不完整记录', () => {
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), durabilityRecords: [record, record] })), /重复/);
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), favorites: ['poi:a', 'poi:a'] })), /重复/);
    assert.throws(() => parsePlayerData(JSON.stringify({ ...emptyPlayerData(), durabilityRecords: [{ current: 5 }] })));
  });
  it('保留暂时不存在的稳定 ID，允许后续资料恢复', () => {
    const data = { ...emptyPlayerData(), favorites: ['poi:future-location'] };
    assert.deepEqual(parsePlayerData(serializeBackup(data)).favorites, ['poi:future-location']);
  });
});
