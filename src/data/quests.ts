import type { Quest, QuestCategory } from '../types/domain';
import { QUEST_LABELS } from '../types/domain.ts';
export interface QuestPack {
  schemaVersion: number; total: number; tutorialTotal: number; updatedAt: string;
  counts: Record<QuestCategory, number>;
  sources: { textSource: string; textSnapshot: string; textGameVersion: string; tutorials: string };
  quests: Quest[];
}
export function decodeQuests(pack: QuestPack): Quest[] {
  if (pack.schemaVersion !== 1 || !Array.isArray(pack.quests) || pack.total !== pack.quests.length || !pack.sources?.textSnapshot) throw new Error('任务资料格式或完整性校验失败。');
  const ids = new Set<string>();
  for (const quest of pack.quests) {
    if (!quest.id || ids.has(quest.id) || !quest.name || !quest.originalName || !(quest.category in QUEST_LABELS)
      || !['tutorial', 'index'].includes(quest.guideStatus) || !/^https:\/\//.test(quest.referenceUrl)) throw new Error('任务标题或分类资料无效。');
    ids.add(quest.id);
    if (quest.guideStatus === 'tutorial' && (!quest.start?.name || !quest.prerequisites?.length || !quest.stages?.length
      || new Set(quest.stages.map((stage) => stage.id)).size !== quest.stages.length
      || quest.stages.some((stage) => !stage.id || !stage.title || !stage.actions?.length || !stage.actions.every((action) => typeof action === 'string' && action.trim().length > 0)))) throw new Error('任务阶段教程不完整。');
  }
  if (pack.quests.filter((quest) => quest.guideStatus === 'tutorial').length !== pack.tutorialTotal
    || Object.keys(QUEST_LABELS).some((category) => pack.quests.filter((quest) => quest.category === category).length !== pack.counts[category as QuestCategory])
    || pack.quests.some((quest) => quest.nextQuestIds?.some((id) => !ids.has(id)))) throw new Error('任务目录关联或分类数量无效。');
  return pack.quests;
}
