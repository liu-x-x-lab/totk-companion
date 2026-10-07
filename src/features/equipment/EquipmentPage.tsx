import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Equipment, EquipmentCategory } from '../../types/domain';
import { EQUIPMENT_LABELS } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { createRecordId } from '../../data/player-data';
import { Icon } from '../../components/Icon';
import { EquipmentArt } from '../../components/EquipmentArt';

const variantLabels = { standard: '普通', pristine: '无腐蚀', decayed: '腐朽' };
const modifierLabels = { attackUp: '攻击提升', attackUpPlus: '攻击提升＋', guardUp: '盾防御提升', guardUpPlus: '盾防御提升＋', durabilityUp: '耐久提升', durabilityUpPlus: '耐久提升＋' };
const effectLabels: Record<string, string> = {
  'Attack Up': '攻击提升', 'Bone': '骨质', 'Torch': '火把', 'Boomerang': '回旋镖',
  'Charge Atk. Stamina Up': '蓄力攻击精力节省', 'Charge Shot': '蓄力射击', 'Quick Charge': '快速蓄力',
  'Long Range': '远距离射击', 'Rapid Fire': '快速射击', '80% Reload Time': '装填时间为通常的 80%',
  'Extra Attack Power While Near Gloom': '接近瘴气时提升攻击', 'Self Inflict Gloom': '瘴气侵蚀自身',
  'Wind Burst': '吹出风', 'Wind Razor': '斩出风刃', 'Shatter Rock x1.5': '击碎岩石伤害 1.5 倍',
  'Shield Bash Attack': '盾击攻击', 'Zonai Attack Power': '左纳乌装置强化',
  'Reuse Bursting Materials': '可重复使用一次性材料', '2 Attack Power per Heart': '攻击随红心上限变化',
  'x2 Attack Power During Flurry Rush': '突击时攻击翻倍', 'x2 Attack Power While Low Durability': '接近损坏时攻击翻倍',
  'x2 Attack Power While Low Health': '低生命时攻击翻倍', 'x2 Attack Power While Wet': '湿润时攻击翻倍',
  'x2 Fuse Attack Power': '融合材料攻击翻倍', 'x2 Sneakstrike Attack Power': '偷袭攻击翻倍',
  'Cold Resistance': '耐寒', 'Heat Resistance': '耐热', 'Flame Guard': '火焰防护', 'Fireproof': '火焰无效',
  'Shock Resistance': '电麻防护', 'Shock Damage Resist': '电伤害减轻', 'Lightning Proof': '雷电无效',
  'Gloom Resistance': '瘴气防护', 'Gloom Attack Resist': '瘴气攻击防护', 'Stealth Up': '安静性提升',
  'Climb Speed Up': '攀登速度提升', 'Climbing Jump Stamina Up': '攀登跳跃精力节省',
  'Swim Speed Up': '游泳速度提升', 'Swim Dash Stamina Up': '游泳冲刺精力节省',
  'Sand Speed Up': '沙地速度提升', 'Snow Speed Up': '雪地速度提升', 'Night Speed Up': '夜间速度提升',
  'Cold Weather Attack': '低温时攻击提升', 'Cold Weather Charge': '低温时蓄力加快',
  'Hot Weather Attack': '高温时攻击提升', 'Hot Weather Charge': '高温时蓄力加快',
  'Stormy Weather Attack': '雷雨时攻击提升', 'Stormy Weather Charge': '雷雨时蓄力加快',
  'Energy Recharge Up': '能源恢复加快', 'Energy Up': '能源持久', 'Zonai Energy Efficiency': '左纳乌能源节省',
  'Glow': '发光', 'Shining Steps': '发光足迹', 'Rupee Padding': '卢比替代伤害',
  'Slip Resistance': '滑落防护', 'Slip Proof': '滑落无效', 'Skydive Mobility Up': '俯冲机动提升',
  'Impact Proof': '落下伤害无效', 'Unfreezable': '冻结无效', 'Master Sword Beam Up': '大师之剑剑气强化',
  'Disguise; Bone Weap. Prof.': '变装与骨武器强化',
};

function EquipmentFacts({ item }: { item: Equipment }) {
  return <details className="equipment-details">
    <summary>{item.category === 'armor' ? '查看强化防御与材料' : '查看词条与装备资料'}</summary>
    {item.effects?.length ? <p className="gear-effects">{item.effects.map((effect) => effectLabels[effect.trim()] ?? effect.trim()).join(' · ')}</p> : null}
    {item.armorLevels && (item.armorLevels.length > 1 ? <table className="armor-upgrades" aria-label={`${item.name}强化资料`}>
      <thead><tr><th scope="col">等级</th><th scope="col">防御</th><th scope="col">材料与费用</th></tr></thead>
      <tbody>{item.armorLevels.map((level) => <tr key={level.level}>
        <th scope="row">{level.level ? '★'.repeat(level.level) : '基础'}</th><td>{level.defense}</td>
        <td>{level.materials.map((material) => <span key={material.originalName}>{material.name} × {material.quantity}</span>)}<span>{level.level ? `${level.rupees} 卢比` : '无须升级'}</span></td>
      </tr>)}</tbody>
    </table> : <p>这件防具无法强化。</p>)}
    {item.rawAttack != null && item.rawAttack !== item.attack && <p>内部基础攻击参数：{item.rawAttack}。图鉴上方采用游戏显示值。</p>}
    {item.modifiers && Object.entries(item.modifiers).length > 0 && <dl className="modifier-values">
      {Object.entries(item.modifiers).map(([key, values]) => <div key={key}><dt>{modifierLabels[key as keyof typeof modifierLabels]}</dt><dd>{values!.join('–')}</dd></div>)}
    </dl>}
    {item.modifiers && Object.keys(item.modifiers).length > 0 && <p className="gear-footnote">以上区间是带对应词条后的数值。</p>}
    {item.fuseExtraDurability != null && <p>融合额外耐久上限：+{item.fuseExtraDurability}</p>}
    {item.fuseDurabilityNote && <p className="gear-footnote">{item.fuseDurabilityNote}</p>}
    <p className="gear-actor">装备 ID：{item.id}</p>
    <p className="gear-footnote">资料表未统一声明游戏版本；采用当前保存的数据快照。</p>
  </details>;
}

function RecordForm({ item, store, onClose }: { item: Equipment; store: PlayerStore; onClose: () => void }) {
  const defaultValue = item.baseDurability == null ? '' : String(item.baseDurability);
  const [maximum, setMaximum] = useState(defaultValue);
  const [current, setCurrent] = useState(defaultValue);
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
    <p>{item.baseDurability == null ? '按你掌握的数值填写，仅作为手动记录。' : `已按基础耐久 ${item.baseDurability} 预填。词条或融合后的装备，可修改最大值与剩余值。`}</p>
    <div className="field-pair"><label>最大耐久<input type="number" inputMode="numeric" min="1" max="9999" step="1" required value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="手动填写"/></label><label>剩余耐久<input type="number" inputMode="numeric" min="0" max={Number(maximum) || 9999} step="1" required value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="手动填写"/></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">保存记录</button></div>
  </form>;
}

export function EquipmentPage({ equipment, store, focusId }: { equipment: readonly Equipment[]; store: PlayerStore; focusId: string | null }) {
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [variant, setVariant] = useState<'all' | 'pristine' | 'decayed'>('all');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [limit,setLimit]=useState(24);
  useEffect(()=>setLimit(24),[category,search,variant]);
  useEffect(() => {
    const focused = equipment.find((item) => item.id === focusId);
    if (focused) { setSearch(focused.name); setCategory('all'); setVariant('all'); }
  }, [focusId, equipment]);
  const query = search.trim().toLocaleLowerCase();
  const recordedIds = new Set(store.data.durabilityRecords.map((record) => record.equipmentId));
  const catalogCount = equipment.filter((item) => item.catalogEntry !== false).length;
  const visible = equipment.filter((item) => (item.catalogEntry !== false || item.id === focusId || recordedIds.has(item.id))
    && (category === 'all' || item.category === category) && (variant === 'all' || item.variant === variant)
    && [item.name, item.originalName, item.id].some((name) => name?.toLocaleLowerCase().includes(query)));
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">KNOW YOUR GEAR</p><h1>装备图鉴</h1></div><span className="heading-icon"><Icon name="sword" size={26}/></span></div>
    <p className="page-intro">查装备，记耐久，为下一次战斗做好准备。</p>
    <label className="search-field"><Icon name="search"/><input type="search" aria-label="搜索装备" placeholder="搜索武器、弓、盾、防具…" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
    <div className="filter-row" role="group" aria-label="装备分类"><button className={`filter-chip ${category === 'all' ? 'active' : ''}`} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>全部</button>{(Object.keys(EQUIPMENT_LABELS) as EquipmentCategory[]).map((type) => <button key={type} className={`filter-chip ${category === type ? 'active' : ''}`} aria-pressed={category === type} onClick={() => setCategory(type)}>{EQUIPMENT_LABELS[type]}</button>)}</div>
    <div className="equipment-toolbar"><span data-testid="equipment-count">{visible.length} / {catalogCount} 件</span><label>武器形态<select aria-label="筛选武器形态" value={variant} onChange={(event) => setVariant(event.target.value as typeof variant)}><option value="all">全部形态</option><option value="pristine">无腐蚀</option><option value="decayed">腐朽</option></select></label></div>
    <div className="info-note"><Icon name="spark" size={17}/><p>显示无词条、未融合的基础属性。弓攻击按每箭计算；剩余耐久由你手动记录。</p></div>
    <div className="equipment-list">{visible.slice(0,limit).map((item) => {
      const saved = store.isFavorite(`equipment:${item.id}`);
      const records = store.data.durabilityRecords.filter((record) => record.equipmentId === item.id);
      const armorMaximum = item.armorLevels ? item.armorLevels.length > 1 ? item.armorLevels.at(-1)!.defense : '无法强化' : '待核验';
      return <article key={item.id} data-testid={`equipment-${item.id}`} className="equipment-card" aria-label={item.name}>
        <div className="card-heading"><div className="equipment-title"><EquipmentArt item={item}/><div><span className="small-label">{item.armorSlot === 'full' ? '全身防具' : EQUIPMENT_LABELS[item.category]}{item.variant && item.variant !== 'standard' ? ` · ${variantLabels[item.variant]}` : ''}</span><h2>{item.name}</h2>{item.originalName && <p className="gear-original-name">{item.originalName}</p>}</div></div><button className={`icon-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? `取消收藏${item.name}` : `收藏${item.name}`} aria-pressed={saved} onClick={() => store.toggleFavorite(`equipment:${item.id}`)}><Icon name="bookmark"/></button></div>
        <div className="equipment-stats"><div><small>{item.category === 'shield' ? '盾防御力' : item.category === 'armor' ? item.upgradeLevel ? '当前星级防御' : '基础防御力' : item.category === 'bow' ? '基础攻击（每箭）' : '基础攻击力'}</small><strong data-testid="equipment-power">{item.attackRange ? item.attackRange.join('–') : (item.category === 'shield' || item.category === 'armor' ? item.defense : item.attack) ?? '待核验'}</strong></div><div><small>{item.category === 'armor' ? '最高强化防御' : '基础耐久'}</small><strong data-testid="equipment-durability">{item.category === 'armor' ? armorMaximum : item.baseDurability ?? '待核验'}</strong></div></div>
        {item.arrowsPerShot != null && <p className="bow-meta">每次 {item.arrowsPerShot} 支箭{item.bowRange != null ? ` · 射程参数 ${item.bowRange}` : ''}</p>}
        {item.attackNote && <p className="gear-special-note">{item.attackNote}</p>}
        {item.durabilityNote && <p className="gear-special-note">{item.durabilityNote}</p>}
        <p className="equipment-description">{item.description}</p>
        <EquipmentFacts item={item}/>
        {records.map((record, index) => <div key={record.id} className="durability-record" aria-label={`手动耐久记录 ${index + 1}`}>
          <div className="record-heading"><span>手动记录 {index + 1}</span><output aria-label="记录剩余耐久">{record.current} <small>/ {record.maximum}</small></output></div>
          <input type="range" min="0" max={record.maximum} value={record.current} aria-label={`调整${item.name}的手动耐久`} onChange={(event) => store.updateRecord(record.id, Number(event.target.value))}/>
          <div className="record-actions"><button className="text-button" aria-label="消耗一次耐久" disabled={record.current === 0} onClick={() => store.updateRecord(record.id, record.current - 1)}>−1 次</button><button className="text-button" onClick={() => store.updateRecord(record.id, record.maximum)}>记录为满</button><button className="text-button muted-button" aria-label="删除这条耐久记录" onClick={() => store.removeRecord(record.id)}>删除记录</button></div>
        </div>)}
        {item.category !== 'armor' && (recordingId === item.id ? <RecordForm item={item} store={store} onClose={() => setRecordingId(null)}/> : <button className="outline-button record-trigger" onClick={() => setRecordingId(item.id)}><Icon name="plus" size={16}/>新增手动耐久记录</button>)}
        <p className="source-line">{item.source.url ? <a href={item.source.url} target="_blank" rel="noreferrer">{item.source.name}</a> : item.source.name}</p>
      </article>;
    })}</div>
    {visible.length>limit&&<button className="outline-button load-more" onClick={()=>setLimit((value)=>value+24)}>显示更多（已显示 {limit} / {visible.length}）</button>}
    {!visible.length && <div className="empty-state"><Icon name="search" size={32}/><h2>没有找到装备</h2><p>试试其他名称或切换分类。</p></div>}
    <a className="outline-button gear-download" href="/data/equipment.csv" download><Icon name="download" size={16}/>下载装备属性 CSV</a>
  </div>;
}
