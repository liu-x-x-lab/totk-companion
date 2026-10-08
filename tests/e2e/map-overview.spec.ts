import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const load = async (page: Page, width = 390) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/');
  await expect(page.locator('.demo-banner')).toContainText('54,793');
  await expect(page.getByTestId('zoom-level')).toHaveText('100%');
};
const zoom = async (page: Page) => Number((await page.getByTestId('zoom-level').innerText()).replace('%', ''));
const quick = (page: Page) => page.getByRole('group', { name: '地图快捷筛选' });

async function accessibleCluster(page: Page) {
  const position = await page.locator('.cluster-marker').evaluateAll(elements => elements.findIndex(element => {
    const box = element.getBoundingClientRect();
    const toolbar = document.querySelector('.map-toolbar')!.getBoundingClientRect();
    const sheet = document.querySelector('.map-bottom-panel')!.getBoundingClientRect();
    return box.x >= 8 && box.right <= innerWidth - 8 && box.y > toolbar.bottom + 8 && box.bottom < sheet.top - 8
      && document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === element;
  }));
  expect(position).toBeGreaterThanOrEqual(0);
  return page.locator('.cluster-marker').nth(position);
}

for (const width of [360, 390]) test(`${width}px 远景少量区域图标，点一次进入细节，筛选保留全部地点`, async ({ page }) => {
  await load(page, width);
  for (const filter of ['全部元素', '呀哈哈', '神庙']) {
    await quick(page).getByRole('button', { name: filter, exact: true }).click();
    const markers = page.locator('.map-marker');
    expect(await markers.count()).toBeLessThanOrEqual(32);
    const clusters = page.locator('.cluster-marker');
    expect(await clusters.count()).toBeGreaterThan(0);
    expect(await clusters.evaluateAll(elements => elements.every(element => !/\d/.test(element.textContent ?? '')))).toBe(true);
    const stats = await markers.evaluateAll(elements => {
      const boxes = elements.map(element => element.getBoundingClientRect());
      let overlaps = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (Math.abs(boxes[i].x - boxes[j].x) < 44 && Math.abs(boxes[i].y - boxes[j].y) < 44) overlaps++;
      }
      return { overlaps, minWidth: Math.min(...elements.map(element => (element as HTMLElement).offsetWidth)), minHeight: Math.min(...elements.map(element => (element as HTMLElement).offsetHeight)) };
    });
    expect(stats.overlaps).toBe(0);
    expect(stats.minWidth).toBeGreaterThanOrEqual(44);
    expect(stats.minHeight).toBeGreaterThanOrEqual(44);
    const count = await page.getByTestId('filtered-count').innerText();
    const marker = await accessibleCluster(page);
    const anchor = await marker.evaluate(element => ({ x: Number((element as HTMLElement).dataset.mapX), y: Number((element as HTMLElement).dataset.mapY) }));
    await marker.tap();
    await expect.poll(() => zoom(page)).toBeGreaterThanOrEqual(400);
    await expect(page.getByTestId('filtered-count')).toHaveText(count);
    await expect.poll(async () => page.getByTestId('map-world').evaluate((element, target) => {
      const [cameraX, cameraY, scale] = (element as HTMLElement).dataset.camera!.split(',').map(Number);
      const y = target.y * (1000 * 5 / 6) * scale + cameraY;
      const x = target.x * 1000 * scale + cameraX;
      const toolbar = document.querySelector('.map-toolbar')!.getBoundingClientRect();
      const panel = document.querySelector('.map-bottom-panel')!.getBoundingClientRect();
      return x >= 22 && x <= innerWidth - 22 && y >= toolbar.bottom + 22 && y <= panel.top - 22;
    }, anchor)).toBe(true);
    await page.getByRole('button', { name: '恢复地图视野', exact: true }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
  }
  const layers = page.getByRole('group', { name: '地图图层' });
  await quick(page).getByRole('button', { name: '全部元素', exact: true }).click();
  for (const layer of ['天空', '地底', '地表']) {
    await layers.getByRole('button', { name: layer, exact: true }).click();
    expect(await page.locator('.map-marker').count()).toBeLessThanOrEqual(32);
    expect(await page.locator('.cluster-marker').evaluateAll(elements => elements.every(element => !/\d/.test(element.textContent ?? '')))).toBe(true);
    await expect(page.getByTestId('map-label-layer')).toBeVisible();
  }
});

async function blankPoint(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector('[data-testid="map-viewport"]')!.getBoundingClientRect();
    const toolbar = document.querySelector('.map-toolbar')!.getBoundingClientRect();
    const sheet = document.querySelector('.map-bottom-panel')!.getBoundingClientRect();
    for (let y = (toolbar.bottom + sheet.top) / 2; y < sheet.top - 40; y += 36) {
      for (let x = 60; x < innerWidth - 80; x += 36) {
        const element = document.elementFromPoint(x, y);
        if (element?.closest('[data-testid="map-viewport"]') && !element.closest('button')) return { x, y, frameX: frame.x, frameY: frame.y };
      }
    }
    throw new Error('没有找到可轻点的空白地图区域');
  });
}

test('手机空白地图单击不缩放，双击放大所点区域，拖动和双指不误触发', async ({ page, context }) => {
  await load(page);
  const target = await blankPoint(page);
  const before = (await page.getByTestId('map-world').getAttribute('data-camera'))!.split(',').map(Number);
  const world = { x: (target.x - target.frameX - before[0]) / before[2], y: (target.y - target.frameY - before[1]) / before[2] };
  await page.touchscreen.tap(target.x, target.y);
  await expect(page.getByTestId('zoom-level')).toHaveText('100%');
  await page.touchscreen.tap(target.x, target.y);
  await expect.poll(() => zoom(page)).toBeGreaterThanOrEqual(400);
  await expect.poll(async () => page.getByTestId('map-world').evaluate((element, point) => {
    const [x, y, scale] = (element as HTMLElement).dataset.camera!.split(',').map(Number);
    const toolbar = document.querySelector('.map-toolbar')!.getBoundingClientRect();
    const sheet = document.querySelector('.map-bottom-panel')!.getBoundingClientRect();
    return Math.abs(point.x * scale + x - innerWidth / 2) < 2 && point.y * scale + y > toolbar.bottom + 22 && point.y * scale + y < sheet.top - 22;
  }, world)).toBe(true);

  await page.getByRole('button', { name: '恢复地图视野', exact: true }).click();
  await expect(page.getByTestId('zoom-level')).toHaveText('100%');
  const blank = await blankPoint(page);
  await page.touchscreen.tap(blank.x, blank.y);
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.move(blank.x + 20, blank.y + 20, { steps: 3 });
  await page.mouse.up();
  await page.touchscreen.tap(blank.x + 20, blank.y + 20);
  await expect(page.getByTestId('zoom-level')).toHaveText('100%');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: blank.x, y: blank.y }, { x: blank.x + 45, y: blank.y + 45 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.touchscreen.tap(blank.x, blank.y);
  await expect(page.getByTestId('zoom-level')).toHaveText('100%');
  await cdp.detach();
});

test('桌面空白地图双击也可进入区域，地名与离线地形继续显示', async ({ page }) => {
  await load(page);
  const blank = await blankPoint(page);
  await page.mouse.dblclick(blank.x, blank.y);
  await expect.poll(() => zoom(page)).toBeGreaterThanOrEqual(400);
  await expect(page.getByTestId('map-label-layer')).toBeVisible();
  await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
});
