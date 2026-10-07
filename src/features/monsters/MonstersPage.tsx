import { useMemo,useState } from 'react';
import type { MapLayer,PointOfInterest } from '../../types/domain';
import { LAYER_LABELS,MONSTER_LABELS } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { Icon } from '../../components/Icon';
import { BOSS_KEYS,formatCoordinates } from '../../data/catalog';
import { matchesPoint } from '../../data/search';

export function MonstersPage({points,store,onLocate}:{points:readonly PointOfInterest[];store:PlayerStore;onLocate:(point:PointOfInterest)=>void}){
  const [search,setSearch]=useState('');
  const [layer,setLayer]=useState<MapLayer|'all'>('all');
  const [monsterType,setMonsterType]=useState('bosses');
  const [limit,setLimit]=useState(24);
  const monsters=useMemo(()=>points.filter((point)=>point.category==='monster'),[points]);
  const hinox=monsters.filter((point)=>point.monsterType==='hinox'||point.monsterType==='stalnox').length;
  const lynel=monsters.filter((point)=>point.monsterType==='lynel').length;
  const visible=useMemo(()=>monsters.filter((point)=>(layer==='all'||point.layer===layer)&&(monsterType==='all'||(monsterType==='bosses'?BOSS_KEYS.includes(point.monsterType??''):monsterType==='hinox-all'?['hinox','stalnox'].includes(point.monsterType??''):point.monsterType===monsterType))&&matchesPoint(point,search)),[monsters,layer,monsterType,search]);
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">FIND YOUR NEXT CHALLENGE</p><h1>怪物分布</h1></div><span className="heading-icon warm"><Icon name="monster" size={26}/></span></div>
    <p className="page-intro">按种类、图层找目标，点击即可定位到真实地图。</p>
    <div className="monster-stats"><button onClick={()=>{setMonsterType('hinox-all');setLayer('all');setSearch('');setLimit(24);}}><strong>{hinox}</strong><span>西诺克斯 · 含骷髅</span></button><button onClick={()=>{setMonsterType('lynel');setLayer('all');setSearch('');setLimit(24);}}><strong>{lynel}</strong><span>莱尼尔 · 人马</span></button></div>
    <label className="search-field"><Icon name="search"/><input type="search" aria-label="搜索怪物" placeholder="名称、区域或 X, Y 坐标…" value={search} onChange={(event)=>{setSearch(event.target.value);setLimit(24);}}/></label>
    <div className="field-pair select-pair"><label>所在图层<select aria-label="筛选怪物图层" value={layer} onChange={(event)=>{setLayer(event.target.value as MapLayer|'all');setLimit(24);}}><option value="all">全部图层</option>{(Object.keys(LAYER_LABELS)as MapLayer[]).map((key)=><option value={key} key={key}>{LAYER_LABELS[key]}</option>)}</select></label><label>怪物种类<select aria-label="筛选怪物种类" value={monsterType} onChange={(event)=>{setMonsterType(event.target.value);setLimit(24);}}><option value="bosses">大型怪物</option><option value="all">所有敌方对象</option><option value="hinox-all">西诺克斯（含骷髅）</option>{Object.entries(MONSTER_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></div>
    <div className="section-label"><span>固定放置地点</span><span data-testid="monster-count">{visible.length.toLocaleString()} 处</span></div>
    <div className="monster-list">{visible.slice(0,limit).map((point)=><article key={point.id} className="monster-card" aria-label={point.name}><div className="card-heading"><div className="monster-title"><span className="monster-art"><Icon name="monster" size={25}/></span><div><span className="small-label">{point.monsterType?MONSTER_LABELS[point.monsterType]:'怪物'}</span><h2>{point.originalName??point.name}</h2></div></div><span className={`layer-tag tag-${point.layer}`}>{LAYER_LABELS[point.layer]}</span></div><p><code>{formatCoordinates(point)}</code><br/>{point.region}</p><div className="monster-actions"><button className="primary-button" onClick={()=>onLocate(point)}><Icon name="map" size={17}/>地图定位</button><button className={`icon-button ${store.isFavorite(`poi:${point.id}`)?'is-saved':''}`} aria-label={store.isFavorite(`poi:${point.id}`)?`取消收藏${point.name}`:`收藏${point.name}`} aria-pressed={store.isFavorite(`poi:${point.id}`)} onClick={()=>store.toggleFavorite(`poi:${point.id}`)}><Icon name="bookmark"/></button></div></article>)}</div>
    {visible.length>limit&&<button className="outline-button load-more" onClick={()=>setLimit((value)=>value+24)}>显示更多（已显示 {limit} / {visible.length}）</button>}
    {!visible.length&&<div className="empty-state"><Icon name="monster" size={32}/><h2>没有匹配的怪物地点</h2><p>调整图层、种类或搜索关键词。</p></div>}
    <p className="page-footnote">显示社区固定对象资料；实际等级、剧情变体和出现状态可能随游戏进度变化。巨龙只列固定初始对象，不表示当前路线。</p>
  </div>;
}
