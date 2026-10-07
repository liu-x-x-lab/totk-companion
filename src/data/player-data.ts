import type { ArmorUpgradePlan, DurabilityRecord, PlayerData, QuestProgress } from '../types/domain';

export const STORAGE_KEY = 'totk-companion:player:v1';
export const emptyPlayerData = (): PlayerData => ({ schemaVersion: 1, favorites: [], durabilityRecords: [], questProgress: [], armorPlans: [], ownedMaterials: {}, completedPoints: [] });

function validId(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 200; }
function level(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4; }
function isPlan(value: unknown): value is ArmorUpgradePlan {
  return isObject(value) && validId(value.equipmentId) && level(value.currentLevel) && level(value.targetLevel) && value.currentLevel < value.targetLevel;
}
function isProgress(value: unknown): value is QuestProgress {
  return isObject(value) && validId(value.questId) && Array.isArray(value.completedStageIds)
    && value.completedStageIds.length <= 100 && value.completedStageIds.every(validId)
    && new Set(value.completedStageIds).size === value.completedStageIds.length;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is DurabilityRecord {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 200 &&
    typeof value.equipmentId === 'string' && value.equipmentId.length > 0 && value.equipmentId.length <= 200 &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.maximum === 'number' && Number.isInteger(value.maximum) && value.maximum >= 1 && value.maximum <= 9999 &&
    typeof value.current === 'number' && Number.isInteger(value.current) && value.current >= 0 && value.current <= value.maximum;
}

export function parsePlayerData(text: string): PlayerData {
  const data: unknown = JSON.parse(text);
  if (!isObject(data) || data.schemaVersion !== 1 || !Array.isArray(data.favorites) || !Array.isArray(data.durabilityRecords)) {
    throw new Error('备份格式或版本不受支持。');
  }
  if (data.favorites.length > 10_000 || data.durabilityRecords.length > 5_000) throw new Error('备份记录数量超过限制。');
  if (!data.favorites.every((item: unknown) => typeof item === 'string' && /^(poi|equipment):.{1,200}$/.test(item))) {
    throw new Error('备份中的收藏格式不正确。');
  }
  if (new Set(data.favorites).size !== data.favorites.length) throw new Error('备份包含重复的收藏。');
  if (!data.durabilityRecords.every(isRecord)) throw new Error('备份中的耐久记录不正确。');
  if (new Set(data.durabilityRecords.map((record) => record.id)).size !== data.durabilityRecords.length) throw new Error('备份包含重复的耐久记录。');
  const plans = data.armorPlans === undefined ? [] : data.armorPlans;
  const progress = data.questProgress === undefined ? [] : data.questProgress;
  const owned = data.ownedMaterials === undefined ? {} : data.ownedMaterials;
  const completed = data.completedPoints === undefined ? [] : data.completedPoints;
  if (!Array.isArray(completed) || completed.length > 100000 || !completed.every(validId)
    || new Set(completed).size !== completed.length) throw new Error('备份中的地点完成记录不正确。');
  if (!Array.isArray(plans) || plans.length > 200 || !plans.every(isPlan)
    || new Set(plans.map((plan) => plan.equipmentId)).size !== plans.length) throw new Error('备份中的防具升级计划不正确。');
  if (!Array.isArray(progress) || progress.length > 1000 || !progress.every(isProgress)
    || new Set(progress.map((entry) => entry.questId)).size !== progress.length) throw new Error('备份中的任务进度不正确。');
  if (!isObject(owned) || Object.keys(owned).length > 2000 || !Object.entries(owned).every(([key, value]) =>
    validId(key) && /^(actor:|name:|currency:)/.test(key) && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999999)) throw new Error('备份中的持有材料数量不正确。');
  return {
    schemaVersion: 1,
    favorites: [...data.favorites] as string[],
    durabilityRecords: data.durabilityRecords.map((record) => ({
      id: record.id, equipmentId: record.equipmentId, maximum: record.maximum,
      current: record.current, createdAt: record.createdAt,
    })),
    armorPlans: plans.map(({ equipmentId, currentLevel, targetLevel }) => ({ equipmentId, currentLevel, targetLevel })),
    questProgress: progress.map(({ questId, completedStageIds }) => ({ questId, completedStageIds: [...completedStageIds] })),
    ownedMaterials: Object.fromEntries(Object.entries(owned)) as Record<string, number>,
    completedPoints: [...completed] as string[],
  };
}

export function serializeBackup(data: PlayerData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export function createRecordId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
