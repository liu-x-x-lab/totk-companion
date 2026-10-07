import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeQuests } from './quests.ts';
import { emptyPlayerData } from './player-data.ts';
import { completedStages, questStatus } from '../features/quests/quests.ts';
import type { QuestPack } from './quests.ts';
import type { MapLabel } from '../types/domain';

const pack = JSON.parse(readFileSync(new URL('../../public/data/quests.json', import.meta.url), 'utf8')) as QuestPack;
const labels = JSON.parse(readFileSync(new URL('../../public/data/map-labels.json', import.meta.url), 'utf8')).labels as MapLabel[];
const quests = decodeQuests(pack);
const get = (id: string) => quests.find((quest) => quest.id === id)!;
describe('任务目录和阶段教程', () => {
  it('253 个真实名称稳定 ID，四种分类与 35 篇离线教程明确区分', () => {
    assert.equal(quests.length, 253); assert.equal(pack.tutorialTotal, 35);
    assert.deepEqual(pack.counts, { main: 23, adventure: 60, shrine: 31, side: 139 });
    assert.ok(quests.filter((quest) => quest.category === 'main').every((quest) => quest.guideStatus === 'tutorial'));
    assert.equal(quests.filter((quest) => quest.guideStatus === 'index').length, 218);
  });
  it('每篇教程的接取与阶段定位均对应已有真实地名，天空和地表神殿不混淆', () => {
    for (const quest of quests.filter((entry) => entry.guideStatus === 'tutorial')) {
      for (const place of [quest.start!, ...quest.stages!]) if (place.messageId) assert.ok(labels.some((label) => label.messageId === place.messageId), `${quest.id}: ${place.messageId}`);
    }
    const layer = (id: string) => labels.find((label) => label.messageId === get(id).start!.messageId)!.layer;
    assert.equal(layer('Connect_FirstIsland'), 'surface'); assert.equal(layer('LookingForLightSpot'), 'sky');
    assert.equal(get('SageOfSoul').start!.messageId, 'ZonauTriedForceSkyIsland');
  });
  it('关键任务要求和跨层水晶路线保留，避免错误的岩石巨人步骤', () => {
    assert.ok(JSON.stringify(get('GetMasterSword')).includes('两圈基础精力'));
    assert.ok(JSON.stringify(get('MainChallenge')).includes('四颗基础红心'));
    assert.ok(JSON.stringify(get('Hateno_LetUsElection')).includes('放晴的白天'));
    assert.ok(JSON.stringify(get('GotoFironeZonauRemains')).includes('十颗基础红心'));
    const lake = JSON.stringify(get('CarryToShrine06'));
    assert.ok(lake.includes('漩涡') && lake.includes('空岛')); assert.ok(!lake.includes('岩石巨人'));
  });
  it('只用有效阶段计算进度，旧阶段 ID 不虚增完成数', () => {
    const quest = get('GetCamera'), data = emptyPlayerData();
    assert.equal(questStatus(quest, data), 'new');
    data.questProgress = [{ questId: quest.id, completedStageIds: [quest.stages![0].id, 'retired-stage'] }];
    assert.equal(questStatus(quest, data), 'started'); assert.equal(completedStages(quest, data).length, 1);
    data.questProgress[0].completedStageIds = quest.stages!.map((stage) => stage.id);
    assert.equal(questStatus(quest, data), 'done');
  });
  it('拒绝重复任务、缺失行动步骤和错误后续关联', () => {
    assert.throws(() => decodeQuests({ ...pack, quests: [...quests.slice(1), quests[1]] }));
    assert.throws(() => decodeQuests({ ...pack, quests: [{ ...quests[0], stages: [] }, ...quests.slice(1)] }));
    assert.throws(() => decodeQuests({ ...pack, quests: [{ ...quests[0], nextQuestIds: ['nonexistent'] }, ...quests.slice(1)] }));
  });
});
