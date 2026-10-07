import { useEffect, useState } from 'react';
import type { Equipment, Page, PointOfInterest } from '../types/domain';
import { repository } from '../data/repository';
import type { DataManifest } from '../data/repository';
import { usePlayerData } from '../hooks/usePlayerData';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MapPage } from '../features/map/MapPage';
import type { MapFocus } from '../features/map/MapPage';
import { EquipmentPage } from '../features/equipment/EquipmentPage';
import { MonstersPage } from '../features/monsters/MonstersPage';
import { SavedPage } from '../features/saved/SavedPage';

const navigation: { page: Page; label: string; icon: IconName }[] = [
  { page: 'map', label: '地图', icon: 'map' }, { page: 'equipment', label: '装备', icon: 'sword' },
  { page: 'monsters', label: '怪物', icon: 'monster' }, { page: 'saved', label: '收藏', icon: 'bookmark' },
];

export function App() {
  const [page, setPage] = useState<Page>('map');
  const [focusTarget, setFocusTarget] = useState<MapFocus | null>(null);
  const [equipmentFocus, setEquipmentFocus] = useState<string | null>(null);
  const store = usePlayerData();
  const [points,setPoints] = useState<PointOfInterest[]>([]);
  const [equipment,setEquipment] = useState<Equipment[]>([]);
  const [manifest,setManifest] = useState<DataManifest|null>(null);
  const [dataError,setDataError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    const controller = new AbortController();
    setDataError('');
    repository.load(controller.signal).then((data)=>{setPoints(data.points);setEquipment(data.equipment);setManifest(data.manifest);}).catch((error:unknown)=>{
      if(!controller.signal.aborted) setDataError(error instanceof Error?error.message:'资料加载失败。');
    });
    return ()=>controller.abort();
  },[retry]);

  function navigate(next: Page) {
    if (next === 'equipment') setEquipmentFocus(null);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function locate(point: PointOfInterest) {
    setFocusTarget((previous) => ({ point, token: (previous?.token ?? 0) + 1 }));
    navigate('map');
  }

  return <div className="app-shell">
    <header className="app-header"><div className="brand"><img src="/icons/app.svg" width="39" height="39" alt=""/><div><strong>海拉鲁探险手册</strong><span>王国之泪 · 随身探索助手</span></div></div><span className="prototype-badge"><i/>三层地图</span></header>
    <div className="demo-banner"><Icon name="spark" size={15}/><span>{manifest?`已载入 ${manifest.total.toLocaleString()} 条地点 · ${equipment.filter((item)=>item.catalogEntry!==false).length} 件基础装备`:'正在载入地点资料…'}</span></div>
    {dataError&&<div className="storage-warning" role="alert">{dataError}<button className="text-button" onClick={()=>setRetry((value)=>value+1)}>重新加载</button></div>}
    {store.storageWarning && <div className="storage-warning" role="alert">{store.storageWarning}</div>}
    <main id="main-content">
      <section hidden={page !== 'map'} aria-label="地图页面"><MapPage points={points} store={store} focusTarget={focusTarget}/></section>
      {page === 'equipment' && <EquipmentPage equipment={equipment} store={store} focusId={equipmentFocus}/>}
      {page === 'monsters' && <MonstersPage points={points} store={store} onLocate={locate}/>}
      {page === 'saved' && <SavedPage points={points} equipment={equipment} store={store} onLocate={locate} onEquipment={(id) => { setEquipmentFocus(id); setPage('equipment'); window.scrollTo({ top: 0, behavior: 'instant' }); }}/>}
    </main>
    <nav className="bottom-nav" aria-label="主导航">{navigation.map((item) => <button key={item.page} className={page === item.page ? 'active' : ''} aria-current={page === item.page ? 'page' : undefined} onClick={() => navigate(item.page)}><span className="nav-icon"><Icon name={item.icon} size={22}/>{item.page === 'saved' && store.data.favorites.length > 0 && <i/>}</span><span>{item.label}</span></button>)}</nav>
  </div>;
}
