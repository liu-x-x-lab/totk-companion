import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogById,formatCoordinates } from './catalog.ts';
import { matchesPoint } from './search.ts';
import { clusterFocusCamera, clusterPoints, createPointIndex } from '../features/map/clustering.ts';
import { baseScale,coverCamera,focusCamera,WORLD_SIZE,WORLD_HEIGHT } from '../features/map/geometry.ts';
import type { PointOfInterest } from '../types/domain';

const pack=JSON.parse(readFileSync(new URL('../../public/data/points.json',import.meta.url),'utf8'))as{rows:[string,number,string,string,number,number,number,number,number,number|null][];strings:string[]};
const manifest=JSON.parse(readFileSync(new URL('../../public/data/manifest.json',import.meta.url),'utf8'))as{total:number;counts:Record<string,number>};
const approximately=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<.000001,`${actual} should equal ${expected}`);
describe('真实世界资料与地图投影',()=>{
  it('全部源记录有唯一稳定 ID、有限坐标和可显示分类',()=>{
    assert.equal(pack.rows.length,manifest.total);assert.equal(new Set(pack.rows.map((row)=>row[0])).size,pack.rows.length);
    for(const row of pack.rows){assert.ok(catalogById.has(row[2]),row[2]);assert.ok([row[4],row[5],row[6]].every(Number.isFinite));assert.ok(Math.abs(row[4])<=6000&&Math.abs(row[6])<=5000);assert.ok(['surface','sky','depths'].includes(row[3]));}
  });
  it('保存全部 69 个西诺克斯系列、34 个人马及三层探索索引',()=>{
    assert.equal(manifest.counts.hinox+manifest.counts.stalnox,69);assert.equal(manifest.counts.lynel,34);assert.equal(manifest.counts.shrine,152);assert.equal(manifest.counts.root,120);assert.equal(manifest.counts.korok,900);assert.equal(manifest.counts.tower,15);
    assert.equal(manifest.counts.flux,35);assert.equal(manifest.counts.talus,87);
    assert.equal(manifest.counts['sages-will'],20);assert.equal(manifest.counts['old-map'],31);assert.equal(manifest.counts['gloom-spawn'],49);
    for(const row of pack.rows.filter((row)=>row[2]==='flux'))assert.ok(pack.strings[row[8]].startsWith('Enemy_Zonau_BlockMaster'));
    assert.equal(pack.rows.filter((row)=>row[2]==='lynel'&&row[3]==='surface').length,15);assert.equal(pack.rows.filter((row)=>row[2]==='lynel'&&row[3]==='depths').length,19);
    assert.equal(pack.rows.filter((row)=>row[2]==='shrine'&&row[3]==='sky').length,32);assert.equal(pack.rows.filter((row)=>row[2]==='root'&&row[3]==='depths').length,120);
  });
  const point:PointOfInterest={id:'test-lynel',name:'莱尼尔（人马）',originalName:'Blue-Maned Lynel',actorName:'Enemy_Lynel_Middle',layer:'surface',category:'monster',monsterType:'lynel',mapPosition:{x:(-4535.54+6000)/12000,y:(-2683.47+5000)/10000},gameCoordinates:{x:-4535.54,y:2683.47,z:333.56},rawCoordinates:[-4535.54,333.56,-2683.47],region:'Rospro Pass',description:'',source:{name:'test',status:'unverified'}};
  it('来源坐标转换保留北向符号与高度，不互换高度和南北方向',()=>{
    assert.equal(formatCoordinates(point),'-4536, 2683, 334');assert.ok(point.mapPosition.x<.5&&point.mapPosition.y<.5);
    assert.ok(matchesPoint(point,'-4536,2683'));assert.ok(matchesPoint(point,'-4536,2683,334'));assert.ok(!matchesPoint(point,'-4536,-2683'));assert.ok(matchesPoint(point,'人马'));assert.ok(matchesPoint(point,'blue-maned'));
  });
  it('聚合保留所有对象，离开视野的对象不创建标记，选中对象独立显示',()=>{
    const points=Array.from({length:1000},(_,i)=>({...point,id:`point-${i}`,mapPosition:{x:.5,y:.5}}));
    const viewport={width:360,height:450},camera=coverCamera(viewport);
    const groups=clusterPoints(points,camera,viewport,null);assert.equal(groups.length,1);assert.equal(groups[0].points.length,1000);
    const selected=clusterPoints(points,camera,viewport,'point-1');assert.equal(selected.length,2);assert.equal(selected.reduce((sum,group)=>sum+group.points.length,0),1000);
    const zoomed={scale:baseScale(viewport)*64,x:-50000,y:-50000};assert.equal(clusterPoints(points,zoomed,viewport,null).length,0);
  });
  it('全屏视口密集标记少于 150 个，视野内的对象全部保留',()=>{
    const points=Array.from({length:10000},(_,i)=>({...point,id:`dense-${i}`,mapPosition:{x:(i%100)/99,y:Math.floor(i/100)/99}}));
    for(const viewport of [{width:390,height:770},{width:844,height:316},{width:1280,height:826}]){
      const camera=coverCamera(viewport);
      const selected=points.find((entry)=>entry.mapPosition.x>.49&&entry.mapPosition.x<.51&&entry.mapPosition.y>.49&&entry.mapPosition.y<.51)!;
      const groups=clusterPoints(points,camera,viewport,selected.id);
      assert.ok(groups.length<150,`${viewport.width}×${viewport.height}: ${groups.length} 个标记`);
      const visible=points.filter((entry)=>{
        const x=entry.mapPosition.x*WORLD_SIZE*camera.scale+camera.x,y=entry.mapPosition.y*WORLD_HEIGHT*camera.scale+camera.y;
        return x>=-44&&x<=viewport.width+44&&y>=-44&&y<=viewport.height+44;
      });
      const retained=new Set(groups.flatMap((group)=>group.points.map((entry)=>entry.id)));
      assert.equal(retained.size,visible.length);
      assert.ok(visible.every((entry)=>retained.has(entry.id)));
      assert.equal(groups.find((group)=>group.points.some((entry)=>entry.id===selected.id))!.points.length,1);
    }
  });
  it('真实三层手机远景最多 32 个标记，包含全部视野记录与独立选中点',()=>{
    for(const width of [360,390])for(const layer of ['surface','sky','depths']as const){
      const viewport={width,height:770},camera=coverCamera(viewport);
      const points=pack.rows.filter(row=>row[3]===layer).map(row=>({...point,id:row[0],layer,mapPosition:{x:(row[4]+6000)/12000,y:(row[6]+5000)/10000}}));
      const visible=points.filter(entry=>{
        const x=entry.mapPosition.x*WORLD_SIZE*camera.scale+camera.x,y=entry.mapPosition.y*WORLD_HEIGHT*camera.scale+camera.y;
        return x>=-44&&x<=width+44&&y>=-44&&y<=viewport.height+44;
      });
      const selected=visible[Math.floor(visible.length/2)];
      const groups=clusterPoints(createPointIndex(points).query(camera,viewport),camera,viewport,selected.id);
      assert.ok(groups.length<=32,`${width}px ${layer}: ${groups.length} 个远景标记`);
      const retained=groups.flatMap(group=>group.points.map(entry=>entry.id)).sort();
      assert.deepEqual(retained,visible.map(entry=>entry.id).sort());
      assert.equal(groups.find(group=>group.points.some(entry=>entry.id===selected.id))!.points.length,1);
    }
  });
  it('相邻网格边缘的 44px 触控区域合并，不丢点也不拆开选中对象',()=>{
    const viewport={width:360,height:400},camera={x:0,y:0,scale:1};
    const points=[79,81,130,161].map((x,i)=>({...point,id:`border-${i}`,mapPosition:{x:x/WORLD_SIZE,y:210/WORLD_HEIGHT}}));
    const groups=clusterPoints(points,camera,viewport,null,80);
    for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const dx=Math.abs(groups[i].x-groups[j].x)*WORLD_SIZE,dy=Math.abs(groups[i].y-groups[j].y)*WORLD_HEIGHT;
      assert.ok(dx>=52||dy>=52,`相邻触控区域太近：${dx}, ${dy}`);
    }
    assert.deepEqual(groups.flatMap(group=>group.points.map(entry=>entry.id)).sort(),points.map(entry=>entry.id).sort());
    const selected=clusterPoints(points,camera,viewport,'border-1',80);
    assert.equal(selected.find(group=>group.points.some(entry=>entry.id==='border-1'))!.points.length,1);
  });
  it('远景合并的地点放大后逐步展开，原始坐标不变',()=>{
    const viewport={width:390,height:770};
    const points=Array.from({length:9},(_,i)=>({...point,id:`near-${i}`,mapPosition:{x:.488+(i%3)*.012,y:.488+Math.floor(i/3)*.012}}));
    const before=JSON.stringify(points);
    const distant=clusterPoints(points,coverCamera(viewport),viewport,null);
    const nearby=clusterPoints(points,focusCamera({x:.5,y:.5},viewport,16),viewport,null);
    assert.ok(nearby.length>distant.length);
    assert.equal(nearby.reduce((count,group)=>count+group.points.length,0),points.length);
    assert.equal(JSON.stringify(points),before);
  });
  it('聚合定位进入可用区域中心，快速展开并限制最高倍率和地图边界',()=>{
    const viewport={width:390,height:770},top=242,bottom=680;
    const points=[{...point,mapPosition:{x:.48,y:.51}},{...point,id:'focus-second',mapPosition:{x:.49,y:.52}}];
    const cluster={id:'focus-cluster',x:.485,y:.515,points};
    const distant=clusterFocusCamera(cluster,coverCamera(viewport),viewport,top,bottom);
    assert.ok(distant.scale/baseScale(viewport)>=4);
    approximately(distant.x+cluster.x*WORLD_SIZE*distant.scale,viewport.width/2);
    approximately(distant.y+cluster.y*WORLD_HEIGHT*distant.scale,(top+bottom)/2);
    const nearby=clusterFocusCamera(cluster,focusCamera(cluster,viewport,48),viewport,top,bottom);
    assert.equal(nearby.scale/baseScale(viewport),64);
    for(const target of [{x:0,y:0},{x:1,y:1}]){
      const edge={...cluster,...target,points:points.map(entry=>({...entry,mapPosition:target}))};
      const camera=clusterFocusCamera(edge,coverCamera(viewport),viewport,top,bottom);
      assert.ok(camera.x<=0&&camera.y<=0);
      assert.ok(camera.x+WORLD_SIZE*camera.scale>=viewport.width&&camera.y+WORLD_HEIGHT*camera.scale>=viewport.height);
    }
  });
  it('三层本地概览瓦片已保存，路径与图层一致',()=>{
    for(const layer of ['Ground','Sky','Depths'])for(let x=0;x<3;x++)for(let y=0;y<3;y++){
      const tile=readFileSync(new URL(`../../public/maps/${layer}/2/${x}/${y}.webp`,import.meta.url));assert.equal(tile.subarray(0,4).toString(),'RIFF');assert.equal(tile.subarray(8,12).toString(),'WEBP');
    }
  });
  it('空间索引保留边界附近全部对象，没有相邻行索引碰撞或重复',()=>{
    const coordinates=[-.02,0,.01,.5,.99,1,1.02];
    const points=coordinates.flatMap((x,i)=>coordinates.map((y,j)=>({...point,id:`edge-${i}-${j}`,mapPosition:{x,y}})));
    const viewport={width:1000,height:WORLD_HEIGHT},camera=coverCamera(viewport);
    const direct=clusterPoints(points,camera,viewport,null).flatMap((group)=>group.points.map((entry)=>entry.id)).sort();
    const indexed=clusterPoints(createPointIndex(points).query(camera,viewport),camera,viewport,null).flatMap((group)=>group.points.map((entry)=>entry.id)).sort();
    assert.deepEqual(indexed,direct);assert.equal(new Set(indexed).size,indexed.length);
  });
});
