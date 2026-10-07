import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogById,formatCoordinates } from './catalog.ts';
import { matchesPoint } from './search.ts';
import { clusterPoints } from '../features/map/clustering.ts';
import { baseScale,fitCamera } from '../features/map/geometry.ts';
import type { PointOfInterest } from '../types/domain';

const pack=JSON.parse(readFileSync(new URL('../../public/data/points.json',import.meta.url),'utf8'))as{rows:[string,number,string,string,number,number,number,number,number,number|null][];strings:string[]};
const manifest=JSON.parse(readFileSync(new URL('../../public/data/manifest.json',import.meta.url),'utf8'))as{total:number;counts:Record<string,number>};
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
    const viewport={width:360,height:450},camera=fitCamera(viewport);
    const groups=clusterPoints(points,camera,viewport,null);assert.equal(groups.length,1);assert.equal(groups[0].points.length,1000);
    const selected=clusterPoints(points,camera,viewport,'point-1');assert.equal(selected.length,2);assert.equal(selected.reduce((sum,group)=>sum+group.points.length,0),1000);
    const zoomed={scale:baseScale(viewport)*64,x:-50000,y:-50000};assert.equal(clusterPoints(points,zoomed,viewport,null).length,0);
  });
  it('三层本地概览瓦片已保存，路径与图层一致',()=>{
    for(const layer of ['Ground','Sky','Depths'])for(let x=0;x<3;x++)for(let y=0;y<3;y++){
      const tile=readFileSync(new URL(`../../public/maps/${layer}/2/${x}/${y}.webp`,import.meta.url));assert.equal(tile.subarray(0,4).toString(),'RIFF');assert.equal(tile.subarray(8,12).toString(),'WEBP');
    }
  });
});
