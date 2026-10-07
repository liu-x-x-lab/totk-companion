import type { MapLabel, PlayerData, PointOfInterest, Quest } from '../../types/domain';

export function completedStages(quest: Quest, data: PlayerData): string[] {
  const recorded = data.questProgress.find((entry) => entry.questId === quest.id)?.completedStageIds ?? [];
  return recorded.filter((id) => quest.stages?.some((stage) => stage.id === id));
}
export function questStatus(quest: Quest, data: PlayerData): 'new' | 'started' | 'done' {
  const completed = completedStages(quest, data);
  return completed.length === 0 ? 'new' : completed.length === quest.stages?.length ? 'done' : 'started';
}
export function resolveQuestPlace(messageId: string | undefined, labels: readonly MapLabel[], points: readonly PointOfInterest[]): PointOfInterest | undefined {
  const label = labels.find((entry) => entry.messageId === messageId);
  if (!label) return undefined;
  return points.filter((point) => label.sourceIds.includes(point.id) && point.layer === label.layer)
    .sort((a, b) => Math.hypot(a.mapPosition.x - label.mapPosition.x, a.mapPosition.y - label.mapPosition.y) - Math.hypot(b.mapPosition.x - label.mapPosition.x, b.mapPosition.y - label.mapPosition.y))[0];
}
