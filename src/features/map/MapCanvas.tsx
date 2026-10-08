import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { KorokGuide, MapLabel, MapLayer, MapPoint, PointOfInterest } from '../../types/domain';
import { Icon } from '../../components/Icon';
import { formatCoordinates, pointDefinition } from '../../data/catalog';
import { baseScale, constrainCamera, coverCamera, focusCamera, focusPairCamera, MAX_ZOOM, MIN_ZOOM, pinchCamera, resizeCamera, WORLD_HEIGHT, WORLD_SIZE, zoomCamera } from './geometry';
import { korokMapPosition } from '../../data/korok-guides';
import type { Camera, Viewport } from './geometry';
import { clusterFocusCamera, clusterPoints, createPointIndex, OVERVIEW_ZOOM } from './clustering';
import { CameraMotion } from './camera-motion';
import { Tiles } from './Tiles';
import type { TilesHandle } from './Tiles';
import { MapLabels } from './MapLabels';

interface Props { layer: MapLayer; points: readonly PointOfInterest[]; labels: readonly MapLabel[]; selectedPoint: PointOfInterest|null; completedPointIds: ReadonlySet<string>; selectedId: string | null; onSelect: (id: string) => void; focusTarget: { point: PointOfInterest; token: number; endpoint?:'start'|'destination' } | null }
interface OverlayAnchor { element: HTMLElement; x: number; y: number; offset: number; width: number; height: number }

export function MapCanvas({ layer, points, labels, selectedPoint, completedPointIds, selectedId, onSelect, focusTarget }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const terrainRef = useRef<TilesHandle>(null);
  const zoomRef = useRef<HTMLOutputElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const minusRef = useRef<HTMLButtonElement>(null);
  const centerRef = useRef<HTMLSpanElement>(null);
  const anchors = useRef<OverlayAnchor[]>([]);
  const pointers = useRef(new Map<number, MapPoint>());
  const starts = useRef(new Map<number, MapPoint>());
  const dragged = useRef(false);
  const tapEligible = useRef(false);
  const tapStarted = useRef(0);
  const lastTap = useRef<{ point: MapPoint; time: number } | null>(null);
  const gestureRect = useRef<DOMRect | null>(null);
  const idle = useRef<number | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 360, height: 400 });
  const [motion] = useState(() => new CameraMotion(coverCamera({ width: 360, height: 400 })));
  // React only lays out the contents periodically; terrain and anchor positions move every frame.
  const [camera, setCamera] = useState<Camera>(motion.camera);
  const [clusterItems, setClusterItems] = useState<PointOfInterest[]>([]);
  const [showLabels, setShowLabels] = useState(true);
  const previousViewport = useRef(viewport);
  const lastLayout = useRef(0);
  const routeRef=useRef<SVGLineElement>(null);
  const pairRef=useRef<KorokGuide['pair']>(null);
  const pair=selectedPoint?.korokGuide?.pair??null;
  const start=pair?korokMapPosition(pair.start.rawCoordinates):null;
  const destination=pair?korokMapPosition(pair.destination.rawCoordinates):null;
  const paintRef = useRef<(camera: Camera) => void>(() => {});
  const pointIndex = useMemo(() => createPointIndex(points), [points]);
  const clusters = useMemo(() => clusterPoints(pointIndex.query(camera, viewport), camera, viewport, selectedId), [pointIndex, camera, viewport, selectedId]);
  const layerLabels = useMemo(() => labels.filter((label) => label.layer === layer), [labels, layer]);

  useEffect(() => {
    const element = viewportRef.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element); return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const paint = (next: Camera) => {
      terrainRef.current?.render(next, viewport);
      const ratio = window.devicePixelRatio || 1;
      for (const anchor of anchors.current) {
        const x = Math.round((anchor.x * WORLD_SIZE * next.scale + next.x - anchor.width / 2) * ratio) / ratio;
        const y = Math.round((anchor.y * WORLD_HEIGHT * next.scale + next.y + anchor.offset - anchor.height / 2) * ratio) / ratio;
        anchor.element.style.transform = `translate(${x}px, ${y}px)`;
      }
      const currentPair=pairRef.current,line=routeRef.current;
      if(currentPair&&line){
        for(const [index,endpoint]of [currentPair.start,currentPair.destination].entries()){
          const point=korokMapPosition(endpoint.rawCoordinates);
          line.setAttribute(`x${index+1}`,String(Math.round((point.x*WORLD_SIZE*next.scale+next.x)*ratio)/ratio));
          line.setAttribute(`y${index+1}`,String(Math.round((point.y*WORLD_HEIGHT*next.scale+next.y)*ratio)/ratio));
        }
      }
      const zoom = next.scale / baseScale(viewport), destination = motion.destination.scale / baseScale(viewport);
      if (zoomRef.current) zoomRef.current.textContent = `${Math.round(zoom * 100)}%`;
      if (plusRef.current) plusRef.current.disabled = destination >= MAX_ZOOM - .01;
      if (minusRef.current) minusRef.current.disabled = destination <= MIN_ZOOM + .01;
      const x = Math.round(((viewport.width / 2 - next.x) / next.scale / WORLD_SIZE) * 12000 - 6000);
      const y = Math.round(5000 - ((viewport.height / 2 - next.y) / next.scale / WORLD_HEIGHT) * 10000);
      if (centerRef.current) centerRef.current.textContent = `中心 ${x}, ${y}`;
    };
    paintRef.current = paint;
    const unsubscribe = motion.subscribe((next, settled) => {
      paint(next);
      if (settled || performance.now() - lastLayout.current >= 100) {
        lastLayout.current = performance.now(); setCamera({ ...next });
      }
    });
    paint(motion.camera);
    return () => { unsubscribe(); motion.destroy(); if (idle.current !== null) window.clearTimeout(idle.current); };
  }, [motion, viewport.width, viewport.height]);

  useLayoutEffect(() => {
    pointers.current.clear(); starts.current.clear(); gestureRect.current = null; lastTap.current = null; setClusterItems([]);
    const next = resizeCamera(motion.camera, previousViewport.current, viewport);
    previousViewport.current = viewport; motion.move(next); motion.flush();
  }, [viewport.width, viewport.height]);

  useEffect(() => { pointers.current.clear(); starts.current.clear(); gestureRect.current = null; lastTap.current = null; setClusterItems([]); motion.flush(); }, [layer]);
  useEffect(() => { lastTap.current = null; setClusterItems([]); }, [points]);

  useLayoutEffect(() => {
    pairRef.current=pair;
    anchors.current = [...(overlayRef.current?.querySelectorAll<HTMLElement>('[data-map-x]') ?? [])].map((element) => ({
      element, x: Number(element.dataset.mapX), y: Number(element.dataset.mapY), offset: Number(element.dataset.mapOffset ?? 0),
      width: element.offsetWidth, height: element.offsetHeight,
    }));
    // Newly created markers immediately catch up with the live camera, not the layout snapshot.
    paintRef.current(motion.camera);
  }, [clusters, layerLabels, showLabels, camera, layer, pair]);

  function jump(next: Camera) { motion.move(next); motion.flush(); }
  function animate(next: Camera) { motion.animate(next, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180); }
  function focusArea() {
    const element = viewportRef.current, frame = element?.getBoundingClientRect(), page = element?.closest('.map-page');
    const toolbar = page?.querySelector('.map-toolbar')?.getBoundingClientRect();
    const sheet = page?.querySelector('.map-bottom-panel')?.getBoundingClientRect();
    const controls = page?.classList.contains('panel-expanded') ? page.querySelector('.map-controls')?.getBoundingClientRect() : undefined;
    const top = frame && toolbar ? Math.max(0, toolbar.bottom - frame.top + 12) : 0;
    const bottom = frame && sheet ? Math.min(sheet.top, controls?.top ?? sheet.top) - frame.top - 12 : viewport.height;
    return bottom - top >= 44 ? { top, bottom } : { top: 0, bottom: viewport.height };
  }
  useEffect(() => {
    if (!focusTarget || focusTarget.point.layer !== layer) return;
    const element = viewportRef.current, frame = element?.getBoundingClientRect(), page = element?.closest('.map-page');
    const toolbar = page?.querySelector('.map-toolbar')?.getBoundingClientRect();
    const sheet = page?.querySelector('.map-bottom-panel.is-open')?.getBoundingClientRect();
    const controls = page?.querySelector('.map-controls')?.getBoundingClientRect();
    const top = frame && toolbar ? toolbar.bottom - frame.top + 12 : 0;
    const bottom = frame && sheet ? Math.min(sheet.top, controls?.top ?? sheet.top) - frame.top - 12 : viewport.height;
    const anchor = { x: viewport.width / 2, y: bottom - top >= 24 ? (top + bottom) / 2 : viewport.height / 2 };
    const taskPair=focusTarget.point.korokGuide?.pair;
    const pairBottom=frame&&sheet?sheet.top-frame.top-12:viewport.height;
    jump(taskPair&&!focusTarget.endpoint?focusPairCamera(korokMapPosition(taskPair.start.rawCoordinates),korokMapPosition(taskPair.destination.rawCoordinates),viewport,top,pairBottom):focusCamera(focusTarget.point.mapPosition, viewport, 16, anchor));
  }, [focusTarget?.token, focusTarget?.point.id, layer]);

  useEffect(() => {
    const element = viewportRef.current; if (!element) return;
    function wheel(event: WheelEvent) {
      event.preventDefault(); motion.stop();
      const rect = element!.getBoundingClientRect(), min = baseScale(viewport);
      motion.move(constrainCamera(zoomCamera(motion.camera, Math.exp(-event.deltaY * .002), { x: event.clientX - rect.left, y: event.clientY - rect.top }, min, min * MAX_ZOOM), viewport));
      if (idle.current !== null) window.clearTimeout(idle.current);
      idle.current = window.setTimeout(() => { idle.current = null; motion.flush(); }, 100);
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [motion, viewport.width, viewport.height]);

  function localPoint(event: ReactPointerEvent): MapPoint {
    const rect = gestureRect.current ?? viewportRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.pointerType === 'mouse' && event.button !== 0) || pointers.current.size >= 2) return;
    motion.stop(); if (idle.current !== null) { window.clearTimeout(idle.current); idle.current = null; }
    if (pointers.current.size === 0) {
      dragged.current = false; gestureRect.current = event.currentTarget.getBoundingClientRect();
      tapStarted.current = performance.now();
      tapEligible.current = !(event.target as Element).closest('button');
      if (!tapEligible.current) lastTap.current = null;
    } else { tapEligible.current = false; lastTap.current = null; }
    const point = localPoint(event); starts.current.set(event.pointerId, point); pointers.current.set(event.pointerId, point);
    // A short press on a marker still clicks; capture after movement begins.
    if (!(event.target as Element).closest('button')) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId); if (!previous) return;
    const start = starts.current.get(event.pointerId)!, point = localPoint(event);
    if (pointers.current.size < 2 && !dragged.current && Math.hypot(point.x - start.x, point.y - start.y) < 5) return;
    dragged.current = true; event.preventDefault();
    lastTap.current = null;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    const before = [...pointers.current.values()]; pointers.current.set(event.pointerId, point);
    const after = [...pointers.current.values()], min = baseScale(viewport);
    const next = before.length === 2 ? pinchCamera(motion.camera, before as [MapPoint, MapPoint], after as [MapPoint, MapPoint], min, min * MAX_ZOOM)
      : { ...motion.camera, x: motion.camera.x + point.x - previous.x, y: motion.camera.y + point.y - previous.y };
    motion.move(constrainCamera(next, viewport));
  }
  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = localPoint(event);
    const isTap = event.type === 'pointerup' && tapEligible.current && !dragged.current && pointers.current.size === 1 && performance.now() - tapStarted.current <= 280;
    pointers.current.delete(event.pointerId); starts.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!pointers.current.size) {
      gestureRect.current = null; motion.flush();
      if (isTap) {
        const previous = lastTap.current, time = performance.now();
        if (previous && time - previous.time <= 320 && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) <= 28) {
          lastTap.current = null;
          const live = motion.camera, currentZoom = live.scale / baseScale(viewport), area = focusArea();
          animate(focusCamera({ x: (point.x - live.x) / live.scale / WORLD_SIZE, y: (point.y - live.y) / live.scale / WORLD_HEIGHT }, viewport,
            Math.max(OVERVIEW_ZOOM, Math.min(MAX_ZOOM, currentZoom * 2)), { x: viewport.width / 2, y: (area.top + area.bottom) / 2 }));
        } else lastTap.current = { point, time };
      } else lastTap.current = null;
    }
  }
  function zoom(factor: number) {
    const min = baseScale(viewport);
    animate(constrainCamera(zoomCamera(motion.destination, factor, { x: viewport.width / 2, y: viewport.height / 2 }, min, min * MAX_ZOOM), viewport));
  }
  const zoomLevel = camera.scale / baseScale(viewport);
  const overview = zoomLevel < OVERVIEW_ZOOM;
  return <div className={`map-frame map-${layer}`}>
    <div ref={viewportRef} className="map-viewport" role="group" aria-label="可拖动和双指缩放的游戏地图" data-testid="map-viewport"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}
      onClickCapture={(event) => { if (dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}>
      <Tiles ref={terrainRef} key={layer} layer={layer} />
      <div ref={overlayRef} className="map-overlay">
        {pair&&start&&destination&&selectedPoint&&<>
          <svg className="korok-route" aria-hidden="true" data-testid="korok-route"><defs><marker id="korok-route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#f2d384"/></marker></defs><line ref={routeRef} stroke="#f2d384" strokeWidth="2.5" strokeDasharray="7 5" markerEnd="url(#korok-route-arrow)"/></svg>
          <button className={`map-marker korok-start-marker ${completedPointIds.has(selectedPoint.id)?'is-completed':''}`} data-testid="korok-start-marker" data-map-x={start.x} data-map-y={start.y} aria-label={`查看${selectedPoint.korokGuide!.code}背包克洛格起点`} onClick={()=>onSelect(selectedPoint.id)}><span><Icon name="leaf" size={22}/></span>{completedPointIds.has(selectedPoint.id)&&<i className="completion-marker"><Icon name="check" size={11}/></i>}</button>
          <span className="korok-endpoint-label" data-map-x={start.x} data-map-y={start.y} data-map-offset="-34">起点 · 背包</span>
          <span className="korok-endpoint-label" data-map-x={destination.x} data-map-y={destination.y} data-map-offset="30">终点 · 朋友</span>
        </>}
        {showLabels && <MapLabels labels={layerLabels} camera={camera} viewport={viewport} markers={clusters} />}
        {clusters.map((cluster) => {
          const point = cluster.points[0], definition = pointDefinition(point), isGroup = cluster.points.length > 1;
          const gameSymbol = !isGroup && (point.category === 'shrine' || point.category === 'root');
          const completed = cluster.points.every(item=>completedPointIds.has(item.id));
          return <button key={isGroup ? cluster.id : point.id} className={`map-marker ${isGroup ? `cluster-marker ${overview ? 'overview-cluster' : ''}` : ''} ${gameSymbol ? 'game-symbol-marker' : ''} ${completed?'is-completed':''} ${selectedId === point.id && !isGroup ? 'selected' : ''}`}
            data-map-x={cluster.x} data-map-y={cluster.y}
            aria-label={isGroup ? `放大查看${cluster.points.length}个地点` : `查看${point.name}，坐标${formatCoordinates(point)}${completed?'，已完成':''}`} aria-pressed={!isGroup && selectedId === point.id}
            onClick={() => {
              if (!isGroup) { onSelect(point.id); return; }
              const liveZoom = motion.camera.scale / baseScale(viewport);
              const area = focusArea();
              if (liveZoom < MAX_ZOOM - .01) animate(clusterFocusCamera(cluster, motion.camera, viewport, area.top, area.bottom));
              else setClusterItems(cluster.points);
            }}><span style={{ background: gameSymbol ? undefined : isGroup ? '#294e3a' : definition.color }}>{isGroup ? overview ? <Icon name="layers" size={19}/> : cluster.points.length > 99 ? '99+' : cluster.points.length : definition.glyph ?? <Icon name={definition.icon} size={gameSymbol ? 32 : 19} />}</span>{completed&&<i className="completion-marker"><Icon name="check" size={11}/></i>}</button>;
        })}
      </div>
    </div>
    <span className="map-demo-label" data-testid="map-zoom-hint">{overview ? '远景 · 点区域标记或双击放大' : '真实地形 · TotK Object Map'}</span>
    <div className="map-compass" aria-hidden="true"><span>N</span><i /></div>
    <div className="map-controls"><button ref={plusRef} aria-label="放大地图" onClick={() => zoom(1.5)} disabled={zoomLevel >= MAX_ZOOM - .01}><Icon name="plus" /></button>
      <output ref={zoomRef} aria-label="地图缩放比例" data-testid="zoom-level">{Math.round(zoomLevel * 100)}%</output>
      <button ref={minusRef} aria-label="缩小地图" onClick={() => zoom(1 / 1.5)} disabled={zoomLevel <= MIN_ZOOM + .01}><Icon name="minus" /></button>
      <button aria-label="恢复地图视野" className="reset-map" onClick={() => animate(coverCamera(viewport))}><Icon name="target" /></button>
      <button aria-label="显示地图地名" className="map-label-toggle" aria-pressed={showLabels} onClick={() => setShowLabels(!showLabels)}>地名</button></div>
    <div className="map-footer"><span ref={centerRef} /><span>{points.length.toLocaleString()} 处 · 放大后展开地点</span></div>
    {clusterItems.length > 0 && <div className="cluster-panel" role="dialog" aria-label="重合地点"><div className="card-heading"><h2>此处有 {clusterItems.length} 个对象</h2><button className="icon-button" aria-label="关闭重合地点" onClick={() => setClusterItems([])}><Icon name="close" /></button></div><div>{clusterItems.map((point) => <button key={point.id} className="location-row" onClick={() => { onSelect(point.id); setClusterItems([]); }}><span><strong>{point.name}</strong><small>{formatCoordinates(point)}</small></span></button>)}</div></div>}
  </div>;
}
