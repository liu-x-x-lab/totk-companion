import { useMemo } from 'react';
import type { MapLabel, MapPoint } from '../../types/domain';
import type { Camera, Viewport } from './geometry';
import { layoutLabels } from './labels';

export function MapLabels({ labels, camera, viewport, markers }: { labels: readonly MapLabel[]; camera: Camera; viewport: Viewport; markers: readonly MapPoint[] }) {
  const visible = useMemo(() => layoutLabels(labels, camera, viewport, markers), [labels, camera, viewport, markers]);
  return <div className="map-label-layer" data-testid="map-label-layer" aria-label="地图地名">
    {visible.map(({ label, size, offset }) => <span key={label.id} className={`map-place-label label-${label.kind}`} data-testid="map-place-label" data-message-id={label.messageId} data-map-x={label.mapPosition.x} data-map-y={label.mapPosition.y} data-map-offset={offset} style={{ fontSize: size }} title={label.originalName}>{label.name}</span>)}
  </div>;
}
