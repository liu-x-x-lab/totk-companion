import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Equipment } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { Icon } from '../../components/Icon';
import { EquipmentArt } from '../../components/EquipmentArt';
import { canUpgrade, planMaterials } from './armor-planner';

export function starLabel(level: number) { return level === 0 ? '未强化' : `${level} 星`; }
export function ArmorPlanner({ equipment, store, open, onOpen }: { equipment: readonly Equipment[]; store: PlayerStore; open: boolean; onOpen: (open: boolean) => void }) {
  const armors = useMemo(() => equipment.filter(canUpgrade).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [equipment]);
  const [selected, setSelected] = useState('Armor_001_Head');
  const [current, setCurrent] = useState(0), [target, setTarget] = useState(4);
  const [shortagesOnly, setShortagesOnly] = useState(false);
  const summary = useMemo(() => planMaterials(equipment, store.data.armorPlans, store.data.ownedMaterials), [equipment, store.data.armorPlans, store.data.ownedMaterials]);
  const selectedItem = armors.find((item) => item.id === selected) ?? armors[0];
  const rows = [summary.currency, ...summary.materials].filter((row) => !shortagesOnly || row.missing > 0);
  const maxLevel = Math.max(1, ...(selectedItem?.armorLevels?.map((entry) => entry.level) ?? []));
  function add(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem || current >= target || target > maxLevel) return;
    store.setArmorPlan({ equipmentId: selectedItem.id, currentLevel: current, targetLevel: target });
  }
  return <section className="armor-planner" aria-label="防具升级备料" id="armor-planner" data-testid="armor-planner">
    <button className="planner-heading" aria-expanded={open} aria-controls="planner-content" onClick={() => onOpen(!open)}>
      <span className="heading-icon"><Icon name="shield" size={22}/></span><span><strong>防具升级备料</strong><small>{store.data.armorPlans.length ? `${store.data.armorPlans.length} 件计划 · 还缺 ${summary.shortageCount} 种材料` : '选择防具，合并材料与卢比'}</small></span><Icon name={open ? 'minus' : 'plus'} size={18}/>
    </button>
    {open && <div id="planner-content" className="planner-content">
      <p className="planner-note">从当前星级算到目标星级。多件防具合并同种材料，已有数量由你填写。</p>
      <form className="planner-form" onSubmit={add}>
        <label>选择防具<select aria-label="备料防具" value={selectedItem?.id ?? ''} onChange={(event) => { setSelected(event.target.value); setCurrent(0); setTarget(Math.max(...armors.find((item) => item.id === event.target.value)!.armorLevels!.map((level) => level.level))); }}>{armors.map((item) => <option key={item.id} value={item.id}>{item.name}{item.armorSlot === 'full' ? '（全身）' : ''}</option>)}</select></label>
        <div className="field-pair"><label>当前星级<select aria-label="备料当前星级" value={current} onChange={(event) => { const level = Number(event.target.value); setCurrent(level); if (target <= level) setTarget(level + 1); }}>{Array.from({ length: maxLevel }, (_, level) => <option key={level} value={level}>{starLabel(level)}</option>)}</select></label><label>目标星级<select aria-label="备料目标星级" value={target} onChange={(event) => setTarget(Number(event.target.value))}>{Array.from({ length: maxLevel - current }, (_, index) => current + index + 1).map((level) => <option key={level} value={level}>{starLabel(level)}</option>)}</select></label></div>
        <button className="primary-button" type="submit" disabled={!selectedItem}><Icon name="plus" size={16}/>加入或更新计划</button>
      </form>
      <div className="planned-armor-list">{store.data.armorPlans.map((plan) => {
        const item = armors.find((entry) => entry.id === plan.equipmentId);
        const maximum = Math.max(...(item?.armorLevels?.map((entry) => entry.level) ?? [4]));
        return <article key={plan.equipmentId} className="planned-armor" data-testid={`armor-plan-${plan.equipmentId}`}>
          {item && <EquipmentArt item={item}/>}<div><h3>{item?.name ?? '防具资料暂不可用'}</h3><div className="plan-levels">
            <select aria-label={`${item?.name ?? plan.equipmentId}当前星级`} value={plan.currentLevel} onChange={(event) => { const level = Number(event.target.value); store.setArmorPlan({ ...plan, currentLevel: level, targetLevel: Math.max(plan.targetLevel, level + 1) }); }}>{Array.from({ length: maximum }, (_, level) => <option key={level} value={level}>{starLabel(level)}</option>)}</select>
            <Icon name="arrow" size={14}/><select aria-label={`${item?.name ?? plan.equipmentId}目标星级`} value={plan.targetLevel} onChange={(event) => store.setArmorPlan({ ...plan, targetLevel: Number(event.target.value) })}>{Array.from({ length: maximum - plan.currentLevel }, (_, index) => plan.currentLevel + index + 1).map((level) => <option key={level} value={level}>{starLabel(level)}</option>)}</select>
          </div></div><button className="icon-button" aria-label={`移除${item?.name ?? plan.equipmentId}备料计划`} onClick={() => store.removeArmorPlan(plan.equipmentId)}><Icon name="close" size={17}/></button>
        </article>;
      })}</div>
      {summary.errors.length > 0 && <p className="form-error" role="alert">{summary.errors.join('；')}</p>}
      {store.data.armorPlans.length > 0 ? <>
        <div className="planner-totals"><div><small>需要卢比</small><strong data-testid="planner-rupees">{summary.currency.required.toLocaleString()}</strong></div><div><small>还缺材料种类</small><strong data-testid="planner-shortage-count">{summary.shortageCount}</strong></div></div>
        <div className="card-heading"><h2>合并备料清单</h2><button className={`filter-chip ${shortagesOnly ? 'active' : ''}`} aria-pressed={shortagesOnly} onClick={() => setShortagesOnly(!shortagesOnly)}>只看缺少</button></div>
        <div className="material-column-labels" aria-hidden="true"><span>材料 / 所需</span><span>已有</span><span>还缺</span></div>
        <div className="material-requirements" aria-label="合并材料清单">{rows.map((row) => <div key={row.key} className={`material-row ${row.missing === 0 ? 'ready' : ''}`} data-testid={`material-${row.key}`}>
          <div><strong>{row.name}</strong><small>需要 {row.required.toLocaleString()}</small></div>
          <input type="number" inputMode="numeric" min="0" max="999999" step="1" aria-label={`已有${row.name}`} value={row.owned || ''} placeholder="0" onChange={(event) => store.setOwnedMaterial(row.key, Number(event.target.value))}/>
          <output aria-label={`${row.name}还缺`} data-testid="material-shortage">{row.missing > 0 ? row.missing.toLocaleString() : <span><Icon name="check" size={16}/>备齐</span>}</output>
        </div>)}</div>
        {rows.length === 0 && <p className="success-message">材料和卢比已备齐，可以去大妖精处强化了。</p>}
        <p className="planner-note">每次强化后，手动调整上方当前星级和已有数量。升级星级需要解锁相应数量的大妖精。</p>
      </> : <div className="planner-empty"><Icon name="shield" size={24}/><p>添加想升级的防具<br/>一次列出全部材料</p></div>}
    </div>}
  </section>;
}
