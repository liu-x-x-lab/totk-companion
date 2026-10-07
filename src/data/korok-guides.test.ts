import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeKorokGuides,korokMapPosition,korokCoordinates,korokCoordinateText } from './korok-guides.ts';
import type { KorokGuidePack } from './korok-guides.ts';
import { focusPairCamera,baseScale,WORLD_SIZE,WORLD_HEIGHT } from '../features/map/geometry.ts';

const pack=JSON.parse(readFileSync(new URL('../../public/data/korok-guides.json',import.meta.url),'utf8'))as KorokGuidePack;
const guides=decodeKorokGuides(pack);
const points=JSON.parse(readFileSync(new URL('../../public/data/points.json',import.meta.url),'utf8'))as{strings:string[];rows:[string,number,string,string,number,number,number,number,number][]};

describe('呀哈哈与搬运克洛格任务',()=>{
  it('900 个任务匹配全部源 ID、代码与图层，24 种谜题和 1000 颗奖励保留',()=>{
    const index=new Map(points.rows.filter(row=>row[2]==='korok').map(row=>[row[0],row]));
    assert.equal(guides.length,900);assert.equal(new Set(guides.map(guide=>guide.type)).size,24);
    assert.equal(guides.filter(guide=>guide.layer==='sky').length,59);
    assert.equal(guides.reduce((sum,guide)=>sum+guide.rewardSeeds,0),1000);
    for(const guide of guides){const point=index.get(guide.pointId)!;assert.ok(point);assert.equal(guide.code,points.strings[point[8]]);assert.equal(guide.layer,point[3]);}
  });
  it('100 个搬运任务起终点独立，静态地图标记是朋友位置，共用任务稳定 ID',()=>{
    const pairs=guides.filter(guide=>guide.pair);assert.equal(pairs.length,100);
    for(const guide of pairs){
      const point=points.rows.find(row=>row[0]===guide.pointId)!;
      assert.deepEqual(guide.pair!.destination.rawCoordinates,point.slice(4,7));
      assert.equal(guide.pair!.association,'explicit-source-links');
      assert.notEqual(guide.pair!.start.sourceId,guide.pair!.destination.sourceId);
      assert.equal(guide.rewardSeeds,2);
    }
    const guide=pairs.find(guide=>guide.code==='RP38')!;
    assert.equal(guide.pointId,'loc:0x95684aa7a4c3b176');
    assert.equal(guide.pair!.start.sourceId,'obj:0xf8dfc9c1fe5fe676');
    assert.equal(guide.pair!.destination.sourceId,'obj:0xb79cbdf0366c45af');
    assert.equal(korokCoordinateText(guide.pair!.start.rawCoordinates),'-4260, 2175, 95');
    assert.equal(korokCoordinateText(guide.pair!.destination.rawCoordinates),'-4116, 2416, 92');
  });
  it('坐标转换始终为东、北、高，不把原始南向坐标当成北向',()=>{
    const raw:[number,number,number]=[-4260.5,94.756134,-2175];
    assert.deepEqual(korokCoordinates(raw),{x:-4260.5,y:2175,z:94.756134});
    const point=korokMapPosition(raw);assert.ok(point.x<.5&&point.y<.5);
  });
  it('搬运视野在两端之间取景，全部 100 对手机初始视野包含两端且底图仍覆盖',()=>{
    for(const viewport of [{width:360,height:726},{width:390,height:770}])for(const guide of guides.filter(guide=>guide.pair)){
      const endpoints=[guide.pair!.start,guide.pair!.destination].map(endpoint=>korokMapPosition(endpoint.rawCoordinates));
      const camera=focusPairCamera(endpoints[0],endpoints[1],viewport,190,430);
      assert.ok(camera.scale>=baseScale(viewport)&&camera.scale<=baseScale(viewport)*16);
      assert.ok(camera.x<=0&&camera.y<=0);assert.ok(camera.x+camera.scale*WORLD_SIZE>=viewport.width-.001);assert.ok(camera.y+camera.scale*WORLD_HEIGHT>=viewport.height-.001);
      for(const point of endpoints){const x=point.x*WORLD_SIZE*camera.scale+camera.x,y=point.y*WORLD_HEIGHT*camera.scale+camera.y;assert.ok(x>=20&&x<=viewport.width-20);assert.ok(y>=190&&y<=430);}
    }
  });
  it('拒绝错配、重复、无坐标、错误奖励及把最近距离当作关联依据',()=>{
    for(const mutate of [
      (p:KorokGuidePack)=>{p.guides.pop();},
      (p:KorokGuidePack)=>{p.guides[1].pointId=p.guides[0].pointId;},
      (p:KorokGuidePack)=>{p.guides.find(guide=>guide.pair)!.rewardSeeds=1;},
      (p:KorokGuidePack)=>{p.guides.find(guide=>guide.pair)!.pair!.start.rawCoordinates[0]=7000;},
      (p:KorokGuidePack)=>{p.guides.find(guide=>guide.pair)!.pair!.association='nearest' as 'explicit-source-links';},
    ]){const broken=structuredClone(pack);mutate(broken);assert.throws(()=>decodeKorokGuides(broken));}
  });
});
