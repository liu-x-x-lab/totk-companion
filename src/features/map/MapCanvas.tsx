import { useEffect,useMemo,useRef,useState } from 'react';
import type { CSSProperties,PointerEvent as ReactPointerEvent } from 'react';
import type { MapLabel,MapLayer,MapPoint,PointOfInterest } from '../../types/domain';
import { Icon } from '../../components/Icon';
import { formatCoordinates,pointDefinition } from '../../data/catalog';
import { baseScale,constrainCamera,coverCamera,focusCamera,MAX_ZOOM,MIN_ZOOM,pinchCamera,resizeCamera,WORLD_HEIGHT,WORLD_SIZE,zoomCamera } from './geometry';
import type { Camera,Viewport } from './geometry';
import { clusterPoints } from './clustering';
import { Tiles } from './Tiles';
import { MapLabels } from './MapLabels';

interface Props { layer:MapLayer;points:readonly PointOfInterest[];labels:readonly MapLabel[];selectedId:string|null;onSelect:(id:string)=>void;focusTarget:{point:PointOfInterest;token:number}|null }
export function MapCanvas({layer,points,labels,selectedId,onSelect,focusTarget}:Props){
  const viewportRef=useRef<HTMLDivElement>(null);
  const pointers=useRef(new Map<number,MapPoint>());
  const starts=useRef(new Map<number,MapPoint>());
  const dragged=useRef(false);
  const [viewport,setViewport]=useState<Viewport>({width:360,height:400});
  const [camera,setCamera]=useState<Camera>(coverCamera(viewport));
  const [clusterItems,setClusterItems]=useState<PointOfInterest[]>([]);
  const [showLabels,setShowLabels]=useState(true);
  const cameraRef=useRef(camera);
  const previousViewport=useRef(viewport);
  const applyCamera=(next:Camera)=>{cameraRef.current=next;setCamera(next);};
  useEffect(()=>{
    const element=viewportRef.current;if(!element)return;
    const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.width>0&&entry.contentRect.height>0)setViewport({width:entry.contentRect.width,height:entry.contentRect.height});});
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{pointers.current.clear();starts.current.clear();setClusterItems([]);const next=resizeCamera(cameraRef.current,previousViewport.current,viewport);previousViewport.current=viewport;cameraRef.current=next;setCamera(next);},[viewport.width,viewport.height]);
  useEffect(()=>{pointers.current.clear();starts.current.clear();setClusterItems([]);},[layer]);
  useEffect(()=>{
    if(focusTarget&&focusTarget.point.layer===layer){
      const element=viewportRef.current,frame=element?.getBoundingClientRect(),page=element?.closest('.map-page');
      const toolbar=page?.querySelector('.map-toolbar')?.getBoundingClientRect();
      const sheet=page?.querySelector('.map-bottom-panel.is-open')?.getBoundingClientRect();
      const controls=page?.querySelector('.map-controls')?.getBoundingClientRect();
      const top=frame&&toolbar?toolbar.bottom-frame.top+12:0;
      const bottom=frame&&sheet?Math.min(sheet.top,controls?.top??sheet.top)-frame.top-12:viewport.height;
      const anchor={x:viewport.width/2,y:bottom-top>=24?(top+bottom)/2:viewport.height/2};
      const next=focusCamera(focusTarget.point.mapPosition,viewport,16,anchor);cameraRef.current=next;setCamera(next);
    }
  },[focusTarget?.token,focusTarget?.point.id,layer]);
  useEffect(()=>{
    const element=viewportRef.current;if(!element)return;
    function wheel(event:WheelEvent){event.preventDefault();const rect=element!.getBoundingClientRect();const min=baseScale(viewport);const next=constrainCamera(zoomCamera(cameraRef.current,Math.exp(-event.deltaY*.002),{x:event.clientX-rect.left,y:event.clientY-rect.top},min,min*MAX_ZOOM),viewport);cameraRef.current=next;setCamera(next);}
    element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
  },[viewport.width,viewport.height]);
  function localPoint(event:ReactPointerEvent):MapPoint{const rect=viewportRef.current!.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function pointerDown(event:ReactPointerEvent<HTMLDivElement>){
    if((event.pointerType==='mouse'&&event.button!==0)||pointers.current.size>=2)return;
    if(pointers.current.size===0)dragged.current=false;
    const point=localPoint(event);starts.current.set(event.pointerId,point);pointers.current.set(event.pointerId,point);
    // 标记上的短按仍可点击；开始移动后再捕获指针，密集标记也能拖动地图。
    if(!(event.target as Element).closest('button')){event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}
  }
  function pointerMove(event:ReactPointerEvent<HTMLDivElement>){
    const previous=pointers.current.get(event.pointerId);if(!previous)return;
    const start=starts.current.get(event.pointerId)!;const currentPoint=localPoint(event);
    if(pointers.current.size<2&&!dragged.current&&Math.hypot(currentPoint.x-start.x,currentPoint.y-start.y)<5)return;
    dragged.current=true;event.preventDefault();
    if(!event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.setPointerCapture(event.pointerId);
    const before=[...pointers.current.values()];const point=localPoint(event);pointers.current.set(event.pointerId,point);const after=[...pointers.current.values()];const min=baseScale(viewport)*MIN_ZOOM;
    const next=before.length===2?pinchCamera(cameraRef.current,before as[MapPoint,MapPoint],after as[MapPoint,MapPoint],min,min*MAX_ZOOM):{...cameraRef.current,x:cameraRef.current.x+point.x-previous.x,y:cameraRef.current.y+point.y-previous.y};
    applyCamera(constrainCamera(next,viewport));
  }
  function pointerEnd(event:ReactPointerEvent<HTMLDivElement>){pointers.current.delete(event.pointerId);starts.current.delete(event.pointerId);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  function zoom(factor:number){const min=baseScale(viewport);applyCamera(constrainCamera(zoomCamera(cameraRef.current,factor,{x:viewport.width/2,y:viewport.height/2},min,min*MAX_ZOOM),viewport));}
  const zoomLevel=camera.scale/baseScale(viewport);
  const clusters=useMemo(()=>clusterPoints(points,camera,viewport,selectedId),[points,camera,viewport,selectedId]);
  const layerLabels=useMemo(()=>labels.filter((label)=>label.layer===layer),[labels,layer]);
  const centerX=Math.round(((viewport.width/2-camera.x)/camera.scale/WORLD_SIZE)*12000-6000);
  const centerY=Math.round(5000-((viewport.height/2-camera.y)/camera.scale/WORLD_HEIGHT)*10000);
  return <div className={`map-frame map-${layer}`}>
    <div ref={viewportRef} className="map-viewport" role="group" aria-label="可拖动和双指缩放的游戏地图" data-testid="map-viewport" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={(event)=>pointers.current.delete(event.pointerId)} onClickCapture={(event)=>{if(dragged.current&&event.detail!==0){event.preventDefault();event.stopPropagation();dragged.current=false;}}}>
      <div className="map-world" data-testid="map-world" style={{transform:`translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,'--inverse-scale':1/camera.scale}as CSSProperties}>
        <Tiles key={layer} layer={layer} camera={camera} viewport={viewport}/>
        {showLabels&&<MapLabels labels={layerLabels} camera={camera} viewport={viewport} markers={clusters}/>}
        {clusters.map((cluster)=>{const point=cluster.points[0],definition=pointDefinition(point),isGroup=cluster.points.length>1;return <button key={cluster.id} className={`map-marker ${isGroup?'cluster-marker':''} ${selectedId===point.id&&!isGroup?'selected':''}`} style={{left:`${cluster.x*100}%`,top:`${cluster.y*100}%`}} aria-label={isGroup?`放大查看${cluster.points.length}个地点`:`查看${point.name}，坐标${formatCoordinates(point)}`} aria-pressed={!isGroup&&selectedId===point.id} onClick={()=>{
          if(!isGroup){onSelect(point.id);return;}
          if(zoomLevel<MAX_ZOOM-.01)applyCamera(focusCamera({x:cluster.x,y:cluster.y},viewport,Math.min(MAX_ZOOM,zoomLevel*2)));
          else setClusterItems(cluster.points);
        }}><span style={{background:isGroup?'#294e3a':definition.color}}>{isGroup?cluster.points.length:definition.glyph??<Icon name={definition.icon} size={17}/>}</span></button>;})}
      </div>
    </div>
    <span className="map-demo-label">真实地形 · TotK Object Map</span>
    <div className="map-compass" aria-hidden="true"><span>N</span><i/></div>
    <div className="map-controls"><button aria-label="放大地图" onClick={()=>zoom(1.5)} disabled={zoomLevel>=MAX_ZOOM-.01}><Icon name="plus"/></button><output aria-label="地图缩放比例" data-testid="zoom-level">{Math.round(zoomLevel*100)}%</output><button aria-label="缩小地图" onClick={()=>zoom(1/1.5)} disabled={zoomLevel<=MIN_ZOOM+.01}><Icon name="minus"/></button><button aria-label="恢复地图视野" className="reset-map" onClick={()=>applyCamera(coverCamera(viewport))}><Icon name="target"/></button><button aria-label="显示地图地名" className="map-label-toggle" aria-pressed={showLabels} onClick={()=>setShowLabels(!showLabels)}>地名</button></div>
    <div className="map-footer"><span>中心 {centerX}, {centerY}</span><span>{points.length.toLocaleString()} 处 · 聚合后放大展开</span></div>
    {clusterItems.length>0&&<div className="cluster-panel" role="dialog" aria-label="重合地点"><div className="card-heading"><h2>此处有 {clusterItems.length} 个对象</h2><button className="icon-button" aria-label="关闭重合地点" onClick={()=>setClusterItems([])}><Icon name="close"/></button></div><div>{clusterItems.map((point)=><button key={point.id} className="location-row" onClick={()=>{onSelect(point.id);setClusterItems([]);}}><span><strong>{point.name}</strong><small>{formatCoordinates(point)}</small></span></button>)}</div></div>}
  </div>;
}
