import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { baseScale, constrainCamera, coverCamera, focusCamera, pinchCamera, resizeCamera, WORLD_HEIGHT, WORLD_SIZE, zoomCamera } from './geometry.ts';

const approximately = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`);

describe('地图交互几何', () => {
  it('初始地图覆盖竖屏、横屏和桌面视口，不出现画布留白', () => {
    for (const viewport of [{ width: 390, height: 770 }, { width: 844, height: 316 }, { width: 1280, height: 826 }]) {
      const camera = coverCamera(viewport);
      assert.ok(camera.x <= 0 && camera.y <= 0);
      assert.ok(camera.x + WORLD_SIZE * camera.scale >= viewport.width - .000001);
      assert.ok(camera.y + WORLD_HEIGHT * camera.scale >= viewport.height - .000001);
      approximately(camera.x + WORLD_SIZE * camera.scale / 2, viewport.width / 2);
      approximately(camera.y + WORLD_HEIGHT * camera.scale / 2, viewport.height / 2);
      assert.ok(camera.scale >= baseScale(viewport));
    }
  });
  it('缩到最小和拖动到四周边缘时，地形仍覆盖整个视口', () => {
    for (const viewport of [{ width: 390, height: 770 }, { width: 844, height: 316 }]) {
      const minimum = baseScale(viewport);
      const camera = zoomCamera(coverCamera(viewport), .000001, { x: 30, y: 50 }, minimum, minimum * 64);
      for (const [x, y] of [[10000, 10000], [-10000, -10000], [10000, -10000], [-10000, 10000]]) {
        const bounded = constrainCamera({ ...camera, x, y }, viewport);
        assert.ok(bounded.x <= .000001 && bounded.y <= .000001);
        assert.ok(bounded.x + WORLD_SIZE * bounded.scale >= viewport.width - .000001);
        assert.ok(bounded.y + WORLD_HEIGHT * bounded.scale >= viewport.height - .000001);
      }
    }
  });
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
    assert.equal(result.x,0);
    approximately(result.y,440-WORLD_HEIGHT);
  });
  it('手机视口复位后铺满地图，定位后将目标居中', () => {
    const viewport = { width: 360, height: 400 };
    assert.equal(baseScale(viewport), .48);
    assert.deepEqual(coverCamera(viewport), { x: -60, y: 0, scale: .48 });
    const camera = focusCamera({ x: .5, y: .5 }, viewport);
    approximately(camera.x + 500 * camera.scale, 180);
    approximately(camera.y + WORLD_HEIGHT/2 * camera.scale, 200);
  });
  it('横竖屏切换保留中心位置与相对倍率，地图继续铺满', () => {
    const previous={width:390,height:770},next={width:844,height:316};
    const camera=focusCamera({x:.6,y:.4},previous,4);
    const resized=resizeCamera(camera,previous,next);
    approximately(resized.scale/baseScale(next),4);
    approximately((next.width/2-resized.x)/resized.scale,(previous.width/2-camera.x)/camera.scale);
    approximately((next.height/2-resized.y)/resized.scale,(previous.height/2-camera.y)/camera.scale);
    assert.ok(resized.x<=0&&resized.y<=0);
    assert.ok(resized.x+WORLD_SIZE*resized.scale>=next.width&&resized.y+WORLD_HEIGHT*resized.scale>=next.height);
  });
});
