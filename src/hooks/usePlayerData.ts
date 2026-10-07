import { useEffect, useState } from 'react';
import type { ArmorUpgradePlan, DurabilityRecord, PlayerData } from '../types/domain';
import { emptyPlayerData, parsePlayerData, STORAGE_KEY } from '../data/player-data';

function readStoredData(): { data: PlayerData; warning: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { data: saved ? parsePlayerData(saved) : emptyPlayerData(), warning: null };
  } catch {
    return { data: emptyPlayerData(), warning: '本地记录读取失败，请从备份恢复；新操作仅在本次会话保留。' };
  }
}

export function usePlayerData() {
  const [initial] = useState(readStoredData);
  const [data, setData] = useState<PlayerData>(initial.data);
  const [storageWarning, setStorageWarning] = useState<string | null>(initial.warning);
  const [storageEnabled, setStorageEnabled] = useState(initial.warning === null);

  useEffect(() => {
    if (!storageEnabled) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch {
      setStorageEnabled(false);
      setStorageWarning('本地存储不可用，当前记录仅在本次会话保留，请导出备份。');
    }
  }, [data, storageEnabled]);

  return {
    data,
    storageWarning,
    togglePointCompleted: (id: string) => setData((current) => ({ ...current,
      completedPoints: current.completedPoints.includes(id) ? current.completedPoints.filter(pointId => pointId !== id) : [...current.completedPoints, id],
    })),
    isFavorite: (key: string) => data.favorites.includes(key),
    toggleFavorite: (key: string) => setData((current) => ({
      ...current,
      favorites: current.favorites.includes(key) ? current.favorites.filter((item) => item !== key) : [...current.favorites, key],
    })),
    addRecord: (record: DurabilityRecord) => setData((current) => ({ ...current, durabilityRecords: [...current.durabilityRecords, record] })),
    updateRecord: (id: string, value: number) => setData((current) => ({
      ...current,
      durabilityRecords: current.durabilityRecords.map((record) => record.id === id ? { ...record, current: Math.max(0, Math.min(record.maximum, value)) } : record),
    })),
    removeRecord: (id: string) => setData((current) => ({ ...current, durabilityRecords: current.durabilityRecords.filter((record) => record.id !== id) })),
    setArmorPlan: (plan: ArmorUpgradePlan) => setData((current) => ({ ...current,
      armorPlans: [...current.armorPlans.filter((entry) => entry.equipmentId !== plan.equipmentId), plan],
    })),
    removeArmorPlan: (id: string) => setData((current) => ({ ...current, armorPlans: current.armorPlans.filter((plan) => plan.equipmentId !== id) })),
    setOwnedMaterial: (key: string, value: number) => {
      if (!Number.isInteger(value) || value < 0 || value > 999999) return;
      setData((current) => ({ ...current, ownedMaterials: { ...current.ownedMaterials, [key]: value } }));
    },
    toggleQuestStage: (questId: string, stageId: string) => setData((current) => {
      const completed = current.questProgress.find((entry) => entry.questId === questId)?.completedStageIds ?? [];
      const next = completed.includes(stageId) ? completed.filter((id) => id !== stageId) : [...completed, stageId];
      return { ...current, questProgress: [...current.questProgress.filter((entry) => entry.questId !== questId), { questId, completedStageIds: next }] };
    }),
    restore: (backup: PlayerData) => {
      setData(backup);
      // 手动恢复允许重新尝试持久化，读取异常不应阻断整个会话。
      setStorageWarning(null);
      setStorageEnabled(true);
    },
  };
}

export type PlayerStore = ReturnType<typeof usePlayerData>;
