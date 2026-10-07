import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Equipment, EquipmentCategory } from '../../types/domain';
import { EQUIPMENT_LABELS } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { createRecordId } from '../../data/player-data';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';

const equipmentIcons: Record<EquipmentCategory, IconName> = { 'one-handed': 'sword', 'two-handed': 'sword', spear: 'sword', bow: 'bow', shield: 'shield', armor: 'shield' };

function RecordForm({ item, store, onClose }: { item: Equipment; store: PlayerStore; onClose: () => void }) {
  const [maximum, setMaximum] = useState('');
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const max = Number(maximum), value = Number(current);
    if (!maximum.trim() || !current.trim() || !Number.isInteger(max) || !Number.isInteger(value) || max < 1 || max > 9999 || value < 0 || value > max) {
      setError('请输入整数，剩余耐久应在 0 和最大耐久之间。');
      return;
    }
    store.addRecord({ id: createRecordId(), equipmentId: item.id, maximum: max, current: value, createdAt: new Date().toISOString() });
    onClose();
  }
  return <form className="record-form" aria-label="新增手动耐久记录" onSubmit={submit}>
    <p>按你掌握的数值填写，仅作为手动记录。</p>
    <div className="field-pair"><label>最大耐久<input type="number" inputMode="numeric" min="1" max="9999" step="1" required value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="手动填写"/></label><label>剩余耐久<input type="number" inputMode="numeric" min="0" max={Number(maximum) || 9999} step="1" required value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="手动填写"/></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">保存记录</button></div>
  </form>;
}

export function EquipmentPage({ equipment, store, focusId }: { equipment: readonly Equipment[]; store: PlayerStore; focusId: string | null }) {
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [limit,setLimit]=useState(24);
  useEffect(()=>setLimit(24),[category,search]);
  useEffect(() => {
    const focused = equipment.find((item) => item.id === focusId);
    if (focused) { setSearch(focused.name); setCategory('all'); }
  }, [focusId, equipment]);
  const visible = equipment.filter((item) => (category === 'all' || item.category === category) && item.name.includes(search.trim()));
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">KNOW YOUR GEAR</p><h1>装备图鉴</h1></div><span className="heading-icon"><Icon name="sword" size={26}/></span></div>
    <p className="page-intro">查装备，记耐久，为下一次战斗做好准备。</p>
    <label className="search-field"><Icon name="search"/><input type="search" aria-label="搜索装备" placeholder="搜索武器、弓、盾、防具…" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
    <div className="filter-row" role="group" aria-label="装备分类"><button className={`filter-chip ${category === 'all' ? 'active' : ''}`} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>全部</button>{(Object.keys(EQUIPMENT_LABELS) as EquipmentCategory[]).map((type) => <button key={type} className={`filter-chip ${category === type ? 'active' : ''}`} aria-pressed={category === type} onClick={() => setCategory(type)}>{EQUIPMENT_LABELS[type]}</button>)}</div>
    <div className="info-note"><Icon name="spark" size={17}/><p>真实属性待核验。手动记录由你填写，不读取游戏当前耐久。</p></div>
    <div className="equipment-list">{visible.slice(0,limit).map((item) => {
      const saved = store.isFavorite(`equipment:${item.id}`);
      const records = store.data.durabilityRecords.filter((record) => record.equipmentId === item.id);
      return <article key={item.id} data-testid={`equipment-${item.id}`} className="equipment-card" aria-label={item.name}>
        <div className="card-heading"><div className="equipment-title"><span className={`equipment-art equipment-${item.category}`}><Icon name={equipmentIcons[item.category]} size={32}/></span><div><span className="small-label">{EQUIPMENT_LABELS[item.category]}</span><h2>{item.name}</h2></div></div><button className={`icon-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? `取消收藏${item.name}` : `收藏${item.name}`} aria-pressed={saved} onClick={() => store.toggleFavorite(`equipment:${item.id}`)}><Icon name="bookmark"/></button></div>
        <div className="equipment-stats"><div><small>{item.category === 'shield' || item.category === 'armor' ? '防御力' : '攻击力'}</small><strong>{(item.category === 'shield' || item.category === 'armor' ? item.defense : item.attack) ?? '待核验'}</strong></div><div><small>{item.category === 'armor' ? '强化资料' : '基础耐久'}</small><strong>{item.category === 'armor' ? '待接入' : item.baseDurability ?? '待核验'}</strong></div></div>
        <p className="equipment-description">{item.description}</p>
        {records.map((record, index) => <div key={record.id} className="durability-record" aria-label={`手动耐久记录 ${index + 1}`}>
          <div className="record-heading"><span>手动记录 {index + 1}</span><output aria-label="记录剩余耐久">{record.current} <small>/ {record.maximum}</small></output></div>
          <input type="range" min="0" max={record.maximum} value={record.current} aria-label={`调整${item.name}的手动耐久`} onChange={(event) => store.updateRecord(record.id, Number(event.target.value))}/>
          <div className="record-actions"><button className="text-button" aria-label="消耗一次耐久" disabled={record.current === 0} onClick={() => store.updateRecord(record.id, record.current - 1)}>−1 次</button><button className="text-button" onClick={() => store.updateRecord(record.id, record.maximum)}>记录为满</button><button className="text-button muted-button" aria-label="删除这条耐久记录" onClick={() => store.removeRecord(record.id)}>删除记录</button></div>
        </div>)}
        {item.category !== 'armor' && (recordingId === item.id ? <RecordForm item={item} store={store} onClose={() => setRecordingId(null)}/> : <button className="outline-button record-trigger" onClick={() => setRecordingId(item.id)}><Icon name="plus" size={16}/>新增手动耐久记录</button>)}
        <p className="source-line">{item.source.name}</p>
      </article>;
    })}</div>
    {visible.length>limit&&<button className="outline-button load-more" onClick={()=>setLimit((value)=>value+24)}>显示更多（已显示 {limit} / {visible.length}）</button>}
    {!visible.length && <div className="empty-state"><Icon name="search" size={32}/><h2>没有找到装备</h2><p>试试其他名称或切换分类。</p></div>}
  </div>;
}
