import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlayerData, parsePlayerData, serializeBackup } from './player-data.ts';

const record = { id: 'instance-1', equipmentId: 'demo-sword', maximum: 30, current: 22, createdAt: '2026-10-07T00:00:00.000Z' };

describe('玩家备份', () => {
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
