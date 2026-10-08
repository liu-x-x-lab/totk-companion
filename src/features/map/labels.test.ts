import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { MapLabel } from '../../types/domain';
import { coverCamera, focusCamera } from './geometry.ts';
import { layoutLabels, minimumLabelZoom } from './labels.ts';

const pack = JSON.parse(readFileSync(new URL('../../../public/data/map-labels.json', import.meta.url), 'utf8')) as { total: number; counts: Record<string, number>; labels: MapLabel[]; locations: Record<string, { layer: string; name: string }> };

describe('中文地图地名', () => {
  it('三层中文名称均有来源 ID 和真实坐标，显示去重不删除原地点', () => {
    assert.equal(pack.total, 730);
    assert.equal(new Set(pack.labels.map((label) => label.id)).size, pack.total);
    assert.equal(Object.keys(pack.locations).length, 911);
    assert.deepEqual(pack.counts, { depths: 101, sky: 48, surface: 581 });
    for (const label of pack.labels) {
      assert.match(label.name, /[\u3400-\u9fff]/);
      assert.ok(label.sourceIds.every((id) => pack.locations[id]));
      assert.equal(label.mapPosition.x, (label.rawCoordinates[0] + 6000) / 12000);
      assert.equal(label.mapPosition.y, (label.rawCoordinates[2] + 5000) / 10000);
    }
  });
  it('村镇、天空岛和地底竞技场按游戏 ID 匹配简体中文', () => {
    for (const [messageId, name, layer] of [['City_BaseCamp', '监视堡垒', 'surface'], ['Kakariko', '卡卡利科村', 'surface'], ['BeginningIsland', '初始空岛', 'sky'], ['MinusField_AncientColosseum', '水上竞技场', 'depths']]) {
      const label = pack.labels.find((item) => item.messageId === messageId)!;
      assert.equal(label.name, name); assert.equal(label.layer, layer);
    }
    const faron = pack.labels.find((label) => label.messageId === 'MapRegion_Firone_Sky')!;
    assert.equal(faron.rawCoordinates[1], 1000); assert.equal(faron.layer, 'sky');
  });
  it('全屏缩小时保留主要地区与村镇，放大显示附近细节', () => {
    const viewport = { width: 390, height: 770 };
    const labels = pack.labels.filter((label) => label.layer === 'surface');
    const visible = layoutLabels(labels, coverCamera(viewport), viewport);
    assert.ok(visible.some(({ label }) => label.messageId === 'MapRegion_HyrulePrairie'));
    assert.ok(visible.some(({ label }) => label.messageId === 'City_BaseCamp'));
    assert.ok(visible.every(({ label }) => minimumLabelZoom(label) <= 1));
    const nearby = labels.find((label) => minimumLabelZoom(label) === 8)!;
    const focused = layoutLabels([nearby], focusCamera(nearby.mapPosition, viewport, 8), viewport);
    assert.equal(focused.length, 1); assert.equal(focused[0].size, 12);
  });
  it('同位置的次要地名不重叠，怪物密集时仍显示地区与村镇', () => {
    const viewport = { width: 390, height: 770 };
    const town = pack.labels.find((label) => label.messageId === 'City_BaseCamp')!;
    const camera = focusCamera(town.mapPosition, viewport, 8);
    const duplicates = Array.from({ length: 30 }, (_, i) => ({ ...town, id: `duplicate-${i}`, kind: 'landmark' as const, name: `地标${i}` }));
    assert.equal(layoutLabels(duplicates, camera, viewport).length, 1);
    assert.equal(layoutLabels([town], camera, viewport, [town.mapPosition]).length, 1);
  });
  it('入口中点的地名尝试移动避让，不因附近两枚标记而消失', () => {
    const viewport = { width: 393, height: 777 };
    const label = pack.labels.find((entry) => entry.messageId === 'MinusField_AncientColosseum')!;
    const camera = focusCamera({ x: .404041, y: .620495 }, viewport);
    const visible = layoutLabels([label], camera, viewport, [{ x: .404041, y: .620495 }, { x: .404012, y: .623905 }]);
    assert.equal(visible.length, 1); assert.notEqual(visible[0].offset, -36);
  });
  it('远景地区名称避开同位置的区域图标，不能让标记压住文字', () => {
    const viewport = { width: 390, height: 770 };
    const region = pack.labels.find(label => label.messageId === 'MapRegion_HyrulePrairie')!;
    const camera = focusCamera(region.mapPosition, viewport, 1);
    const visible = layoutLabels([region], camera, viewport, [region.mapPosition]);
    assert.equal(visible.length, 1);
    assert.ok(Math.abs(visible[0].offset) >= 40);
  });
});
