import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { baseScale, constrainCamera, fitCamera, focusCamera, pinchCamera, WORLD_HEIGHT, zoomCamera } from './geometry.ts';

const approximately = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`);

describe('地图交互几何', () => {
  it('保持缩放锚点下的世界坐标', () => {
    const camera = { x: -100, y: -80, scale: .5 };
    const anchor = { x: 170, y: 210 };
    const result = zoomCamera(camera, 1.5, anchor, .3, 2);
    approximately((anchor.x - result.x) / result.scale, (anchor.x - camera.x) / camera.scale);
    approximately((anchor.y - result.y) / result.scale, (anchor.y - camera.y) / camera.scale);
  });
  it('限制放大倍数并保持锚点', () => {
    const result = zoomCamera({ x: 0, y: 0, scale: .4 }, 100, { x: 100, y: 100 }, .4, 2.4);
    assert.equal(result.scale, 2.4);
    assert.equal(zoomCamera(result, .0001, { x: 100, y: 100 }, .4, 2.4).scale, .4);
  });
  it('双指同时平移和放大时跟随新的手指中心', () => {
    const result = pinchCamera({ x: 0, y: 0, scale: 1 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 20, y: 10 }, { x: 220, y: 10 }], .4, 6);
    assert.deepEqual(result, { x: 20, y: 10, scale: 2 });
  });
  it('不允许把地图全部拖出视野', () => {
    const result = constrainCamera({ x: 9000, y: -9000, scale: 1 }, { width: 390, height: 440 });
    assert.equal(result.x,24);
    approximately(result.y,440-WORLD_HEIGHT-24);
  });
  it('手机视口复位后完整展示地图，定位后将目标居中', () => {
    const viewport = { width: 360, height: 400 };
    assert.equal(baseScale(viewport), .36);
    assert.deepEqual(fitCamera(viewport), { x: 0, y: 50, scale: .36 });
    const camera = focusCamera({ x: .5, y: .5 }, viewport);
    approximately(camera.x + 500 * camera.scale, 180);
    approximately(camera.y + WORLD_HEIGHT/2 * camera.scale, 200);
  });
});
