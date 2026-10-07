import { useMemo, useState } from 'react';
import type { MapLayer } from '../../types/domain';
import type { Camera,Viewport } from './geometry';
import { WORLD_SIZE } from './geometry';

const layerFolders = {surface:'Ground',sky:'Sky',depths:'Depths'};
export function visibleTiles(camera:Camera,viewport:Viewport,level:number){
  const factor=2**(level-7);
  const tileSize=WORLD_SIZE*256/(24000*factor);
  const columns=Math.ceil(24000*factor/256),rows=Math.ceil(20000*factor/256);
  const x0=Math.max(0,Math.floor(-camera.x/camera.scale/tileSize));
  const x1=Math.min(columns-1,Math.floor((viewport.width-camera.x)/camera.scale/tileSize));
  const y0=Math.max(0,Math.floor(-camera.y/camera.scale/tileSize));
  const y1=Math.min(rows-1,Math.floor((viewport.height-camera.y)/camera.scale/tileSize));
  const tiles=[];
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)tiles.push({x,y,size:tileSize});
  return tiles;
}

export function Tiles({layer,camera,viewport}:{layer:MapLayer;camera:Camera;viewport:Viewport}){
  const [failed,setFailed]=useState(false);
  const folder=layerFolders[layer];
  const level=Math.min(7,Math.max(2,Math.ceil(Math.log2(WORLD_SIZE*camera.scale/24000)+7)));
  const tiles=useMemo(()=>visibleTiles(camera,viewport,level),[camera.x,camera.y,camera.scale,viewport.width,viewport.height,level]);
  const baseSize=WORLD_SIZE*256/750;
  return <>
    <div className="map-overview" data-layer={layer}>{Array.from({length:9},(_,i)=>{const x=i%3,y=Math.floor(i/3);return <img key={`${folder}:${i}`} alt="" draggable={false} src={`/maps/${folder}/2/${x}/${y}.webp`} style={{left:x*baseSize,top:y*baseSize,width:baseSize+.1,height:baseSize+.1}}/>;})}</div>
    {level>2&&<div className="map-detail-tiles">{tiles.map((tile)=><img key={`${folder}:${level}:${tile.x}:${tile.y}`} alt="" draggable={false} src={`/maps/${folder}/${level}/${tile.x}/${tile.y}.webp`} data-testid="detail-tile" style={{left:tile.x*tile.size,top:tile.y*tile.size,width:tile.size+.05,height:tile.size+.05}} onError={()=>setFailed(true)}/>)}</div>}
    {failed&&<span className="tile-fallback-status" role="status">离线高清资源缺失，请重新安装完整包</span>}
  </>;
}
