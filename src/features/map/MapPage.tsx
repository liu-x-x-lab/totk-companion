import { useEffect,useMemo,useRef,useState } from 'react';
import type { MapLabel,MapLayer,PointOfInterest } from '../../types/domain';
import { LAYER_LABELS } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { Icon } from '../../components/Icon';
import { BOSS_KEYS,formatCoordinates,markerCatalog,pointDefinition,pointFilterKey } from '../../data/catalog';
import { matchesPoint } from '../../data/search';
import { MapCanvas } from './MapCanvas';
import { copyText } from '../../platform/offline';

export interface MapFocus { point:PointOfInterest;token:number }
export function MapPage({points,labels,store,focusTarget}:{points:readonly PointOfInterest[];labels:readonly MapLabel[];store:PlayerStore;focusTarget:MapFocus|null}){
  const [layer,setLayer]=useState<MapLayer>('surface');
  const [keys,setKeys]=useState<string[]>(BOSS_KEYS);
  const [search,setSearch]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showFilters,setShowFilters]=useState(false);
  const [toolsCollapsed,setToolsCollapsed]=useState(false);
  const [panelOpen,setPanelOpen]=useState(false);
  const [limit,setLimit]=useState(30);
  const [localFocus,setLocalFocus]=useState<MapFocus|null>(null);
  const [copied,setCopied]=useState('');
  const counter=useRef(0);
  const pageRef=useRef<HTMLDivElement>(null);
  const toolbarRef=useRef<HTMLDivElement>(null);
  const panelRef=useRef<HTMLDivElement>(null);
  const sheetRef=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const toolbar=toolbarRef.current;if(!toolbar)return;
    const observer=new ResizeObserver(()=>{const height=toolbar.getBoundingClientRect().height;if(height>0)pageRef.current?.style.setProperty('--map-toolbar-height',`${height}px`);});
    observer.observe(toolbar);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const sheet=sheetRef.current;if(!sheet)return;
    const observer=new ResizeObserver(()=>{const height=sheet.getBoundingClientRect().height;if(height>0)pageRef.current?.style.setProperty('--map-panel-height',`${height}px`);});
    observer.observe(sheet);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!focusTarget)return;
    setLayer(focusTarget.point.layer);setKeys([pointFilterKey(focusTarget.point)]);setSearch('');setSelectedId(focusTarget.point.id);setLocalFocus({point:focusTarget.point,token:++counter.current});
    setPanelOpen(true);setShowFilters(false);
  },[focusTarget?.token]);
  useEffect(()=>{setLimit(30);setCopied('');if(panelRef.current)panelRef.current.scrollTop=0;},[layer,keys,search,selectedId]);
  const layerPoints=useMemo(()=>points.filter((point)=>point.layer===layer),[points,layer]);
  const counts=useMemo(()=>{const result:Record<string,number>={};for(const point of layerPoints){const key=pointFilterKey(point);result[key]=(result[key]??0)+1;}return result;},[layerPoints]);
  const keySet=useMemo(()=>new Set(keys),[keys]);
  const nameIds=useMemo(()=>new Set(labels.flatMap((label)=>label.sourceIds)),[labels]);
  const visiblePoints=useMemo(()=>layerPoints.filter((point)=>(keySet.has(pointFilterKey(point))||(!!search.trim()&&nameIds.has(point.id)))&&matchesPoint(point,search)),[layerPoints,keySet,search,nameIds]);
  const selected=visiblePoints.find((point)=>point.id===selectedId);
  const groups=useMemo(()=>[...new Set(markerCatalog.map((entry)=>entry.group))],[]);
  function preset(next:string[]){setKeys(next);setSelectedId(null);setSearch('');setPanelOpen(false);}
  function selectPoint(id:string){setSelectedId(id);setPanelOpen(true);setShowFilters(false);}
  function locate(point:PointOfInterest){selectPoint(point.id);setLocalFocus({point,token:++counter.current});searchRef.current?.blur();}
  function toggle(key:string){setSelectedId(null);setPanelOpen(false);setKeys((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key]);}
  async function copy(point:PointOfInterest){try{await copyText(formatCoordinates(point));setCopied('坐标已复制');}catch{setCopied('请长按坐标选择并复制');}}
  return <div ref={pageRef} className={`page map-page ${toolsCollapsed?'tools-collapsed':''} ${panelOpen?'panel-expanded':''}`}>
    <div id="world-map"><MapCanvas layer={layer} points={visiblePoints} labels={labels} selectedId={selectedId} onSelect={selectPoint} focusTarget={localFocus}/></div>
    <div ref={toolbarRef} className="map-toolbar">
    <div className="page-heading"><div><p className="eyebrow">HYRULE EXPLORER'S ATLAS</p><h1>探索海拉鲁</h1></div><button className="icon-button map-tools-toggle" aria-label={toolsCollapsed?'展开地图工具':'收起地图工具'} aria-expanded={!toolsCollapsed} aria-controls="map-tools-content" onClick={()=>{setToolsCollapsed(!toolsCollapsed);setShowFilters(false);}}><Icon name={toolsCollapsed?'layers':'chevron'} size={17}/></button></div>
    <div id="map-tools-content" className="map-tools-content" hidden={toolsCollapsed}>
    <div className="layer-tabs" role="group" aria-label="地图图层">{(Object.keys(LAYER_LABELS)as MapLayer[]).map((item)=><button key={item} className={layer===item?'active':''} aria-pressed={layer===item} onClick={()=>{setLayer(item);setSelectedId(null);setPanelOpen(false);}}><Icon name={item==='sky'?'spark':item==='surface'?'mountain':'layers'} size={15}/>{LAYER_LABELS[item]}</button>)}</div>
    <label className="search-field"><Icon name="search" size={17}/><input ref={searchRef} type="search" value={search} onChange={(event)=>{setSearch(event.target.value);setSelectedId(null);setPanelOpen(!!event.target.value.trim());setShowFilters(false);}} placeholder="搜地名、怪物或 X, Y 坐标…" aria-label="搜索地图地点"/></label>
    <div className="filter-row" role="group" aria-label="地图快捷筛选">
      <button className={`filter-chip ${keys.length===2&&keys.includes('hinox')?'active':''}`} aria-pressed={keys.length===2&&keys.includes('hinox')} onClick={()=>preset(['hinox','stalnox'])}>西诺克斯</button>
      <button className={`filter-chip ${keys.length===1&&keys[0]==='lynel'?'active':''}`} aria-pressed={keys.length===1&&keys[0]==='lynel'} onClick={()=>preset(['lynel'])}>人马</button>
      <button className="filter-chip" onClick={()=>preset(markerCatalog.filter((item)=>item.category==='monster').map((item)=>item.id))}>全怪物</button>
      <button className="filter-chip" onClick={()=>preset(markerCatalog.map((item)=>item.id))}>全部元素</button>
      <button className={`filter-chip ${showFilters?'active':''}`} aria-expanded={showFilters} onClick={()=>{setShowFilters(!showFilters);setPanelOpen(false);}}><Icon name="layers" size={13}/>分类</button>
    </div>
    </div>
    </div>
    {showFilters&&<section className="category-panel" aria-label="游戏元素分类"><div className="card-heading"><h2>游戏元素分类</h2><button className="icon-button" aria-label="关闭分类筛选" onClick={()=>setShowFilters(false)}><Icon name="close" size={17}/></button></div><div className="category-actions"><button className="text-button" onClick={()=>preset(BOSS_KEYS)}>大型怪物</button><button className="text-button" onClick={()=>preset(markerCatalog.filter((item)=>item.group==='探索与收集').map((item)=>item.id))}>探索收集</button><button className="text-button" onClick={()=>preset(markerCatalog.map((item)=>item.id))}>全选</button><button className="text-button" onClick={()=>preset([])}>清空</button></div><div className="category-scroll">{groups.map((group)=><fieldset key={group}><legend>{group}</legend><div>{markerCatalog.filter((entry)=>entry.group===group).map((entry)=><label key={entry.id} className="category-option"><input type="checkbox" checked={keys.includes(entry.id)} onClick={()=>searchRef.current?.blur()} onChange={()=>toggle(entry.id)}/><span>{entry.label}</span><small>{counts[entry.id]??0}</small></label>)}</div></fieldset>)}</div></section>}
    <div ref={sheetRef} className={`map-bottom-panel ${panelOpen?'is-open':''}`}>
    <button className="map-panel-toggle" data-testid="map-panel-toggle" aria-label={panelOpen?(selected?'收起地点详情':'收起地点列表'):(selected?'展开地点详情':'查看地点列表')} aria-expanded={panelOpen} aria-controls="map-panel-content" onClick={()=>{setPanelOpen(!panelOpen);setShowFilters(false);}}><i className="sheet-grabber"/><span className="map-panel-title"><small>{selected?`${LAYER_LABELS[layer]} · ${pointDefinition(selected).label}`:'点击查看地点与坐标'}</small><strong>{selected?selected.name:`筛选结果 · ${LAYER_LABELS[layer]}`}</strong></span><span className="map-panel-count" data-testid="filtered-count">{visiblePoints.length.toLocaleString()} 处</span><Icon name="chevron" size={15}/></button>
    <div ref={panelRef} id="map-panel-content" className="map-panel-content" hidden={!panelOpen} role="region" aria-label={selected?'地点详情面板':'地点列表'}>
    {selected&&<button className="text-button map-back-to-list" onClick={()=>setSelectedId(null)}><Icon name="chevron" size={13}/>返回地点列表</button>}
    <div className="marker-legend" aria-label="当前标记图例">{markerCatalog.filter((entry)=>keys.includes(entry.id)&&(counts[entry.id]??0)>0).slice(0,10).map((entry)=><span key={entry.id}><i style={{background:entry.color}}>{entry.glyph??<Icon name={entry.icon} size={11}/>}</i>{entry.label}</span>)}</div>
    {selected?<article className="detail-card" aria-label="地点详情"><div className="card-heading"><div><span className="small-label">{LAYER_LABELS[selected.layer]} / {pointDefinition(selected).label}</span><h2>{selected.name}</h2></div><button className={`icon-button ${store.isFavorite(`poi:${selected.id}`)?'is-saved':''}`} aria-label={store.isFavorite(`poi:${selected.id}`)?`取消收藏${selected.name}`:`收藏${selected.name}`} aria-pressed={store.isFavorite(`poi:${selected.id}`)} onClick={()=>store.toggleFavorite(`poi:${selected.id}`)}><Icon name="bookmark"/></button></div>
      <div className="coordinate-box"><span>参考坐标 · 东 / 北 / 高（约）</span><code data-testid="point-coordinates">{formatCoordinates(selected)}</code><button className="text-button" onClick={()=>copy(selected)}>复制坐标</button></div>{copied&&<p className="success-message" role="status">{copied}</p>}
      <p>{selected.description}</p>{!!selected.contents?.length&&<p>关联物品：{selected.contents.join('、')}</p>}<div className="card-bottom"><span>{selected.region}</span><a href={`https://radar-totk.zeldamods.org/obj/${selected.sourceObjectId??''}`} target="_blank" rel="noreferrer" hidden={!selected.sourceObjectId}>查看原始对象</a></div><details className="raw-details"><summary>原始坐标与来源</summary><p>原始 X / Y / Z：{selected.rawCoordinates?.join(', ')}</p><p>对象：{selected.actorName}</p><p>ID：{selected.id}</p><p>{selected.source.name}</p></details>
    </article>:<>
    <div className="map-hint"><span className="hint-icon"><Icon name={visiblePoints.length?'target':'search'} size={17}/></span><div><strong>{visiblePoints.length?'点标记看坐标，点聚合数字放大':'当前筛选没有匹配的地点'}</strong><p>{visiblePoints.length?'天空、地表、地底分别筛选，双指即可缩放。':'切换分类、图层，或点击“全部元素”重新查找。'}</p></div></div>
    <div className="location-list">{visiblePoints.slice(0,limit).map((point)=><button key={point.id} className="location-row" onClick={()=>locate(point)}><span className="location-icon"><Icon name={pointDefinition(point).icon}/></span><span><strong>{point.name}</strong><small>{formatCoordinates(point)} · {point.region}</small></span><Icon name="chevron" size={17}/></button>)}</div>
    {visiblePoints.length>limit&&<button className="outline-button load-more" onClick={()=>setLimit((value)=>value+30)}>显示更多（已显示 {limit} / {visiblePoints.length}）</button>}
    </>}
    <p className="page-footnote">已载入 {points.length.toLocaleString()} 条地点。固定放置资料，不表示实时游戏状态。洞窟和水井按入口记录，同地点可能存在剧情变体。三层高清底图和中文地名均在本机。</p>
    </div>
    </div>
  </div>;
}
