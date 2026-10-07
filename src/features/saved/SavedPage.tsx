import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Equipment, PlayerData, PointOfInterest } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { LAYER_LABELS } from '../../types/domain';
import { parsePlayerData, serializeBackup } from '../../data/player-data';
import { Icon } from '../../components/Icon';

interface Props { points: readonly PointOfInterest[]; equipment: readonly Equipment[]; store: PlayerStore; onLocate: (point: PointOfInterest) => void; onEquipment: (id: string) => void }

export function SavedPage({ points, equipment, store, onLocate, onEquipment }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pendingImport, setPendingImport] = useState<PlayerData | null>(null);
  function exportData() {
    const url = URL.createObjectURL(new Blob([serializeBackup(store.data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `totk-records-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setIsError(false); setMessage('已导出收藏和手动耐久记录。');
  }
  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPendingImport(null);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('备份文件过大，请选择小于 2 MB 的记录文件。');
      const backup = parsePlayerData(await file.text());
      setPendingImport(backup); setIsError(false); setMessage('');
    } catch (error) {
      setIsError(true); setMessage(error instanceof Error ? `导入失败：${error.message}` : '导入失败，请检查备份文件。');
    }
  }

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">YOUR ADVENTURE JOURNAL</p><h1>我的收藏</h1></div><span className="heading-icon"><Icon name="bookmark" size={26}/></span></div>
    <p className="page-intro">把想去的地方、想用的装备，记在这里。</p>
    <div className="saved-summary"><div><strong>{store.data.favorites.length.toString().padStart(2, '0')}</strong><span>收藏项目</span></div><div><strong>{store.data.durabilityRecords.length.toString().padStart(2, '0')}</strong><span>手动耐久记录</span></div></div>
    <div className="section-label"><span>随时回来继续探索</span><Icon name="bookmark" size={15}/></div>
    <div className="saved-list">{store.data.favorites.map((key) => {
      const point = key.startsWith('poi:') ? points.find((item) => item.id === key.slice(4)) : undefined;
      const item = key.startsWith('equipment:') ? equipment.find((entry) => entry.id === key.slice(10)) : undefined;
      return <article key={key} className="saved-card"><span className="saved-art"><Icon name={point ? 'map' : 'sword'} size={22}/></span><div><h2>{point?.name ?? item?.name ?? '资料暂不可用'}</h2><p>{point ? `${LAYER_LABELS[point.layer]} · ${point.region}` : item ? '装备图鉴 · 属性待核验' : '已保留收藏 ID，可等待资料更新'}</p>{(point || item) && <button className="text-button saved-open" onClick={() => point ? onLocate(point) : onEquipment(item!.id)}>{point ? '地图定位' : '查看装备'}<Icon name="arrow" size={15}/></button>}</div><button className="icon-button is-saved" aria-label={`取消收藏${point?.name ?? item?.name ?? key}`} onClick={() => store.toggleFavorite(key)}><Icon name="bookmark"/></button></article>;
    })}</div>
    {!store.data.favorites.length && <div className="empty-state"><span className="empty-illustration"><Icon name="bookmark" size={38}/></span><h2>你的探险手册还很轻</h2><p>在地图或装备页点一下收藏图标，<br/>下次就能在这里找到它。</p></div>}
    <section className="backup-card" aria-label="记录备份"><div className="card-heading"><h2>备份探索记录</h2><Icon name="download" size={19}/></div><p>记录保存在当前浏览器。换手机时，导出再导入即可继续使用。</p><div className="backup-actions"><button className="outline-button" onClick={exportData}><Icon name="download" size={17}/>导出记录</button><button className="outline-button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={17}/>导入备份</button></div><a className="text-button" href="/data/coordinates.csv" download>下载完整地点坐标 CSV</a><input ref={fileRef} type="file" accept=".json,application/json" aria-label="选择记录备份文件" className="visually-hidden" onChange={importData}/>
      {pendingImport && <div className="import-review"><p>备份含 {pendingImport.favorites.length} 项收藏、{pendingImport.durabilityRecords.length} 条耐久记录。确认后替换当前记录。</p><div className="form-actions"><button className="secondary-button" onClick={() => setPendingImport(null)}>取消导入</button><button className="primary-button" onClick={() => { store.restore(pendingImport); setPendingImport(null); setIsError(false); setMessage('已恢复备份记录。'); }}>确认替换</button></div></div>}
      {message && <p role={isError ? 'alert' : 'status'} className={isError ? 'form-error' : 'success-message'}>{message}</p>}
    </section>
  </div>;
}
