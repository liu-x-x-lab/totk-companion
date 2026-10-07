import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeShrineGuides, shrineSearchUrls, videoDuration } from './shrine-guides.ts';
import { matchesPoint } from './search.ts';
import type { ShrineGuidePack } from './shrine-guides.ts';
import type { PointOfInterest } from '../types/domain';

const pack = JSON.parse(readFileSync(new URL('../../public/data/shrine-guides.json', import.meta.url), 'utf8')) as ShrineGuidePack;
const guides = decodeShrineGuides(pack);
const points = JSON.parse(readFileSync(new URL('../../public/data/points.json', import.meta.url), 'utf8')) as { strings: string[]; rows: [string, number, string, string, number, number, number, number, number][] };

describe('神庙中文名与逐分集视频目录', () => {
  it('152 座按真实 Actor、稳定地点 ID、图层和英文名一一对应，页码覆盖全部神庙分集', () => {
    const source = new Map(points.rows.filter(row => row[2] === 'shrine').map(row => [points.strings[row[8]], row]));
    assert.equal(guides.length, 152);
    assert.equal(guides.filter(guide => guide.layer === 'sky').length, 32);
    assert.deepEqual(guides.map(guide => guide.video.page).sort((a,b) => a-b), Array.from({ length: 152 }, (_,i) => i+3));
    for (const guide of guides) {
      const point = source.get(guide.actorId)!;
      assert.equal(guide.pointId, point[0]); assert.equal(guide.layer, point[3]);
      assert.equal(guide.originalName, points.strings[point[1]]);
      assert.match(guide.name, /[\u4e00-\u9fff]+神庙/u); assert.ok(guide.puzzle);
      assert.equal(guide.douyinVideo, null);
    }
  });
  it('完整神庙名避免 乔尼乌/乔乔尼乌、乔高乌/希哈乔高乌、诺乌达/塔尼诺乌达 错配', () => {
    for (const [name, page] of [['乔尼乌神庙',102],['乔乔尼乌神庙',14],['乔高乌神庙',93],['希哈乔高乌神庙',142],['诺乌达神庙',39],['塔尼诺乌达神庙',129]] as const) {
      assert.equal(guides.find(guide=>guide.name===name)?.video.page, page);
    }
    const broken = structuredClone(pack);
    const target = broken.guides.find(guide=>guide.name==='乔高乌神庙')!;
    target.video.title = broken.guides.find(guide=>guide.name==='希哈乔高乌神庙')!.video.title;
    assert.throws(()=>decodeShrineGuides(broken), /对应关系/);
  });
  it('拒绝缺失目录、重复关联、非法网址、未知核对状态与空谜题名', () => {
    for (const mutate of [
      (data: ShrineGuidePack) => { data.guides.pop(); },
      (data: ShrineGuidePack) => { data.guides[1].actorId = data.guides[0].actorId; },
      (data: ShrineGuidePack) => { data.guides[1].pointId = data.guides[0].pointId; },
      (data: ShrineGuidePack) => { data.guides[0].video.url = 'https://example.com/'; },
      (data: ShrineGuidePack) => { data.guides[0].video.page = 1; },
      (data: ShrineGuidePack) => { data.guides[0].video.cid = 0; },
      (data: ShrineGuidePack) => { data.guides[0].video.checkedAt = 'unknown'; },
      (data: ShrineGuidePack) => { data.guides[0].puzzle = ''; },
    ]) { const broken = structuredClone(pack); mutate(broken); assert.throws(()=>decodeShrineGuides(broken)); }
  });
  it('抖音与 B 站备用入口编码完整中文名称，只生成 HTTPS 搜索网址', () => {
    const urls = shrineSearchUrls('塔吉卡兹神庙');
    const douyin = new URL(urls.douyin), bilibili = new URL(urls.bilibili);
    assert.equal(douyin.origin, 'https://www.douyin.com'); assert.equal(douyin.searchParams.get('type'), 'video');
    assert.equal(decodeURIComponent(douyin.pathname), '/search/王国之泪 塔吉卡兹神庙 攻略');
    assert.equal(bilibili.searchParams.get('keyword'), '王国之泪 塔吉卡兹神庙 攻略');
    assert.equal(videoDuration(147), '2:27'); assert.equal(videoDuration(61), '1:01');
  });
  it('中文名、谜题名、英文名和旧 Actor 搜索均可定位神庙', () => {
    const guide = guides.find(guide=>guide.actorId==='Dungeon000')!;
    const point: PointOfInterest = {id:guide.pointId,name:guide.name,originalName:guide.originalName,actorName:guide.actorId,shrineGuide:guide,category:'shrine',layer:'surface',mapPosition:{x:.5,y:.5},gameCoordinates:null,description:'',region:'',source:{name:'test',status:'unverified'}};
    for(const query of ['塔吉卡兹','平衡之形','Tajikats','Dungeon000']) assert.ok(matchesPoint(point, query), query);
    assert.equal(matchesPoint(point,'乌可乌侯'), false);
  });
  it('神庙与树根为本地矢量资源，形状有独立来源及哈希，去除模糊光晕', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../public/data/map-icons-manifest.json',import.meta.url),'utf8'));
    assert.equal(manifest.total,2); assert.equal(manifest.license,'GPL-3.0');
    for(const icon of manifest.icons) {
      const raw = readFileSync(new URL(`../../public${icon.file}`, import.meta.url));
      assert.equal(createHash('sha256').update(raw).digest('hex'),icon.sha256);
      assert.equal(raw.length,icon.bytes); assert.match(raw.toString(), /<svg[^>]+viewBox=/);
      assert.match(raw.toString(), /<path/); assert.doesNotMatch(raw.toString(), /filter:|blur\(/);
      assert.match(icon.gitBlob,/^[\da-f]{40}$/); assert.match(icon.sourceSha256,/^[\da-f]{64}$/);
    }
    assert.match(readFileSync(new URL(`../../public${manifest.licenseFile}`, import.meta.url),'utf8'), /GNU GENERAL PUBLIC LICENSE/);
  });
});
