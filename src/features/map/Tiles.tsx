import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { MapLayer } from '../../types/domain';
import type { Camera, Viewport } from './geometry';
import { TileRenderer } from './TileRenderer';
import type { TerrainStatus } from './TileRenderer';

export interface TilesHandle { render: (camera: Camera, viewport: Viewport) => void }
export const Tiles = forwardRef<TilesHandle, { layer: MapLayer }>(function Tiles({ layer }, ref) {
  const element = useRef<HTMLDivElement>(null);
  const renderer = useRef<TileRenderer | null>(null);
  const [status, setStatus] = useState<TerrainStatus>('loading');
  useLayoutEffect(() => {
    const next = new TileRenderer(element.current!, layer, setStatus); renderer.current = next;
    return () => { next.dispose(); renderer.current = null; };
  }, [layer]);
  useImperativeHandle(ref, () => ({ render: (camera, viewport) => renderer.current?.render(camera, viewport) }), []);
  return <>
    <div ref={element} className="map-world map-overview" data-testid="map-world" data-layer={layer} aria-hidden="true" />
    {status === 'loading' && <span className="map-loading-status" role="status">正在读取离线地图…</span>}
    {status === 'missing' && <span className="tile-fallback-status" role="status">离线高清资源缺失，请重新安装完整包</span>}
  </>;
});
