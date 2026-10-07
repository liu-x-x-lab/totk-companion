import type { DurabilityRecord, PlayerData } from '../types/domain';

export const STORAGE_KEY = 'totk-companion:player:v1';
export const emptyPlayerData = (): PlayerData => ({ schemaVersion: 1, favorites: [], durabilityRecords: [] });

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
  return {
    schemaVersion: 1,
    favorites: [...data.favorites] as string[],
    durabilityRecords: data.durabilityRecords.map((record) => ({
      id: record.id, equipmentId: record.equipmentId, maximum: record.maximum,
      current: record.current, createdAt: record.createdAt,
    })),
  };
}

export function serializeBackup(data: PlayerData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

export function createRecordId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
