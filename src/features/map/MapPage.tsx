import { useEffect,useMemo,useRef,useState } from 'react';
import type { MapLayer,PointOfInterest } from '../../types/domain';
import { LAYER_LABELS } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { Icon } from '../../components/Icon';
import { BOSS_KEYS,formatCoordinates,markerCatalog,pointDefinition,pointFilterKey } from '../../data/catalog';
import { matchesPoint } from '../../data/search';
import { MapCanvas } from './MapCanvas';

export interface MapFocus { point:PointOfInterest;token:number }
export function MapPage({points,store,focusTarget}:{points:readonly PointOfInterest[];store:PlayerStore;focusTarget:MapFocus|null}){
  const [layer,setLayer]=useState<MapLayer>('surface');
  const [keys,setKeys]=useState<string[]>(BOSS_KEYS);
  const [search,setSearch]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showFilters,setShowFilters]=useState(false);
  const [limit,setLimit]=useState(30);
  const [localFocus,setLocalFocus]=useState<MapFocus|null>(null);
  const [copied,setCopied]=useState('');
  const counter=useRef(0);
  const mapRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!focusTarget)return;
    setLayer(focusTarget.point.layer);setKeys([pointFilterKey(focusTarget.point)]);setSearch('');setSelectedId(focusTarget.point.id);setLocalFocus({point:focusTarget.point,token:++counter.current});
  },[focusTarget?.token]);
  useEffect(()=>{setLimit(30);setCopied('');},[layer,keys,search,selectedId]);
  const layerPoints=useMemo(()=>points.filter((point)=>point.layer===layer),[points,layer]);
  const counts=useMemo(()=>{const result:Record<string,number>={};for(const point of layerPoints){const key=pointFilterKey(point);result[key]=(result[key]??0)+1;}return result;},[layerPoints]);
  const keySet=useMemo(()=>new Set(keys),[keys]);
  const visiblePoints=useMemo(()=>layerPoints.filter((point)=>keySet.has(pointFilterKey(point))&&matchesPoint(point,search)),[layerPoints,keySet,search]);
  const selected=visiblePoints.find((point)=>point.id===selectedId);
  const groups=useMemo(()=>[...new Set(markerCatalog.map((entry)=>entry.group))],[]);
  function preset(next:string[]){setKeys(next);setSelectedId(null);setSearch('');}
  function locate(point:PointOfInterest){setSelectedId(point.id);setLocalFocus({point,token:++counter.current});mapRef.current?.scrollIntoView({block:'start',behavior:'instant'});}
  function toggle(key:string){setSelectedId(null);setKeys((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key]);}
  async function copy(point:PointOfInterest){try{await navigator.clipboard.writeText(formatCoordinates(point));setCopied('坐标已复制');}catch{setCopied('请长按坐标选择并复制');}}
  return <div className="page map-page">
    <div className="page-heading"><div><p className="eyebrow">YOUR NEXT ADVENTURE</p><h1>探索海拉鲁</h1></div><span className="heading-icon"><Icon name="map" size={26}/></span></div>
    <div className="layer-tabs" role="group" aria-label="地图图层">{(Object.keys(LAYER_LABELS)as MapLayer[]).map((item)=><button key={item} className={layer===item?'active':''} aria-pressed={layer===item} onClick={()=>{setLayer(item);setSelectedId(null);}}><Icon name={item==='sky'?'spark':item==='surface'?'mountain':'layers'} size={17}/>{LAYER_LABELS[item]}</button>)}</div>
    <label className="search-field"><Icon name="search"/><input type="search" value={search} onChange={(event)=>{setSearch(event.target.value);setSelectedId(null);}} placeholder="搜名称，或输入 X, Y 坐标…" aria-label="搜索地图地点"/></label>
    <div className="filter-row" role="group" aria-label="地图快捷筛选">
      <button className={`filter-chip ${keys.length===2&&keys.includes('hinox')?'active':''}`} onClick={()=>preset(['hinox','stalnox'])}>西诺克斯</button>
      <button className={`filter-chip ${keys.length===1&&keys[0]==='lynel'?'active':''}`} onClick={()=>preset(['lynel'])}>人马</button>
      <button className="filter-chip" onClick={()=>preset(markerCatalog.filter((item)=>item.category==='monster').map((item)=>item.id))}>全怪物</button>
      <button className="filter-chip" onClick={()=>preset(markerCatalog.map((item)=>item.id))}>全部元素</button>
      <button className={`filter-chip ${showFilters?'active':''}`} aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}><Icon name="layers" size={14}/>分类</button>
    </div>
    {showFilters&&<section className="category-panel" aria-label="游戏元素分类"><div className="category-actions"><button className="text-button" onClick={()=>preset(BOSS_KEYS)}>大型怪物</button><button className="text-button" onClick={()=>preset(markerCatalog.filter((item)=>item.group==='探索与收集').map((item)=>item.id))}>探索收集</button><button className="text-button" onClick={()=>preset(markerCatalog.map((item)=>item.id))}>全选</button><button className="text-button" onClick={()=>preset([])}>清空</button></div>{groups.map((group)=><fieldset key={group}><legend>{group}</legend><div>{markerCatalog.filter((entry)=>entry.group===group).map((entry)=><label key={entry.id} className="category-option"><input type="checkbox" checked={keys.includes(entry.id)} onChange={()=>toggle(entry.id)}/><span>{entry.label}</span><small>{counts[entry.id]??0}</small></label>)}</div></fieldset>)}</section>}
    <div ref={mapRef} id="world-map"><MapCanvas layer={layer} points={visiblePoints} selectedId={selectedId} onSelect={setSelectedId} focusTarget={localFocus}/></div>
    <div className="marker-legend" aria-label="当前标记图例">{markerCatalog.filter((entry)=>keys.includes(entry.id)&&(counts[entry.id]??0)>0).slice(0,10).map((entry)=><span key={entry.id}><i style={{background:entry.color}}>{entry.glyph??<Icon name={entry.icon} size={11}/>}</i>{entry.label}</span>)}</div>
    {selected?<article className="detail-card" aria-label="地点详情"><div className="card-heading"><div><span className="small-label">{LAYER_LABELS[selected.layer]} / {pointDefinition(selected).label}</span><h2>{selected.name}</h2></div><button className={`icon-button ${store.isFavorite(`poi:${selected.id}`)?'is-saved':''}`} aria-label={store.isFavorite(`poi:${selected.id}`)?`取消收藏${selected.name}`:`收藏${selected.name}`} aria-pressed={store.isFavorite(`poi:${selected.id}`)} onClick={()=>store.toggleFavorite(`poi:${selected.id}`)}><Icon name="bookmark"/></button></div>
      <div className="coordinate-box"><span>参考坐标 · 东 / 北 / 高（约）</span><code data-testid="point-coordinates">{formatCoordinates(selected)}</code><button className="text-button" onClick={()=>copy(selected)}>复制坐标</button></div>{copied&&<p className="success-message" role="status">{copied}</p>}
      <p>{selected.description}</p>{!!selected.contents?.length&&<p>关联物品：{selected.contents.join('、')}</p>}<div className="card-bottom"><span>{selected.region}</span><a href={`https://radar-totk.zeldamods.org/obj/${selected.sourceObjectId??''}`} target="_blank" rel="noreferrer" hidden={!selected.sourceObjectId}>查看原始对象</a></div><details className="raw-details"><summary>原始坐标与来源</summary><p>原始 X / Y / Z：{selected.rawCoordinates?.join(', ')}</p><p>对象：{selected.actorName}</p><p>ID：{selected.id}</p><p>{selected.source.name}</p></details>
    </article>:<div className="map-hint"><span className="hint-icon"><Icon name={visiblePoints.length?'target':'search'}/></span><div><strong>{visiblePoints.length?'点标记看坐标，点聚合数字放大':'当前筛选没有匹配的地点'}</strong><p>{visiblePoints.length?'天空、地表、地底分别筛选，双指即可缩放。':'切换分类、图层，或点击“全部元素”重新查找。'}</p></div></div>}
    <div className="section-label"><span>筛选结果 · {LAYER_LABELS[layer]}</span><span data-testid="filtered-count">{visiblePoints.length.toLocaleString()} 处</span></div>
    <div className="location-list">{visiblePoints.slice(0,limit).map((point)=><button key={point.id} className="location-row" onClick={()=>locate(point)}><span className="location-icon"><Icon name={pointDefinition(point).icon}/></span><span><strong>{point.name}</strong><small>{formatCoordinates(point)} · {point.region}</small></span><Icon name="chevron" size={17}/></button>)}</div>
    {visiblePoints.length>limit&&<button className="outline-button load-more" onClick={()=>setLimit((value)=>value+30)}>显示更多（已显示 {limit} / {visiblePoints.length}）</button>}
    <p className="page-footnote">固定放置资料，不表示实时游戏状态。洞窟和水井按入口记录，同地点可能存在剧情变体。高清底图需联网。</p>
  </div>;
}
