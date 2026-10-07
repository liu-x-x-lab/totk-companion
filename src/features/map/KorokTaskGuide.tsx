import { Icon } from '../../components/Icon';
import { korokCoordinateText } from '../../data/korok-guides';
import type { KorokGuide } from '../../types/domain';

export function KorokTaskGuide({guide,onLocate}:{guide:KorokGuide;onLocate:(endpoint:'start'|'destination')=>void}){
  return <section className="korok-task-guide" data-testid="korok-task-guide" aria-label="克洛格任务">
    <div className="card-heading"><h3>{guide.typeName}</h3><span>{guide.rewardSeeds} 颗克洛格果实</span></div><p>{guide.hint}</p>
    {guide.pair&&<><div className="korok-endpoint-row"><span><strong>起点 · 背包克洛格</strong><code data-testid="korok-start-coordinates">{korokCoordinateText(guide.pair.start.rawCoordinates)}</code></span><button className="text-button" onClick={()=>onLocate('start')} aria-label="定位背包克洛格"><Icon name="target" size={16}/>定位</button></div>
    <div className="korok-endpoint-row"><span><strong>终点 · 朋友位置</strong><code data-testid="korok-destination-coordinates">{korokCoordinateText(guide.pair.destination.rawCoordinates)}</code></span><button className="text-button" onClick={()=>onLocate('destination')} aria-label="定位朋友位置"><Icon name="target" size={16}/>定位</button></div>
    <p className="korok-route-note">地图连线提示方向，需根据地形选择搬运路线。起点和终点共用一条完成记录。</p></>}
  </section>;
}
