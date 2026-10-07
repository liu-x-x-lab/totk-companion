import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const ready = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('.demo-banner')).toContainText('已载入');
  await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
};

async function painted(page: Page) {
  return page.getByTestId('map-world').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const rectangles = [...element.querySelectorAll<HTMLElement>('.map-tile')].flatMap((tile) => {
      const image = tile.querySelector('img');
      return image?.complete && image.naturalWidth > 0 ? [tile.getBoundingClientRect()] : [];
    });
    let holes = 0;
    // Decoded image rectangles must cover the screen, including all four exact edges.
    const xs = [...Array.from({ length: Math.ceil(bounds.width / 11) }, (_, i) => i * 11), bounds.width - .001];
    const ys = [...Array.from({ length: Math.ceil(bounds.height / 11) }, (_, i) => i * 11), bounds.height - .001];
    for (const y of ys) for (const x of xs) if (!rectangles.some((r) =>
      x + bounds.x >= r.left - .001 && x + bounds.x < r.right + .001 && y + bounds.y >= r.top - .001 && y + bounds.y < r.bottom + .001)) holes++;
    return { holes, width: bounds.width, height: bounds.height, images: rectangles.length };
  });
}

test('高分屏地形使用物理像素，文字和矢量标记没有缩放祖先', async ({ page }) => {
  await ready(page);
  await page.getByRole('group', { name: '地图快捷筛选' }).getByRole('button', { name: '人马', exact: true }).click();
  const label = page.getByTestId('map-place-label').filter({ hasText: '监视堡垒' });
  await expect(label).toBeVisible();
  const labelHeight = (await label.boundingBox())!.height;
  const stats = await page.getByTestId('map-world').evaluate((element) => {
    const images = [...element.querySelectorAll('img')];
    return { images: images.length, nativeResolution: images.every((image) =>
      image.naturalWidth >= image.getBoundingClientRect().width * devicePixelRatio - 1 &&
      image.naturalHeight >= image.getBoundingClientRect().height * devicePixelRatio - 1) };
  });
  expect(stats.images).toBeGreaterThan(0); expect(stats.nativeResolution).toBe(true);
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  await expect(page.getByTestId('zoom-level')).toHaveText('150%');
  expect((await label.boundingBox())!.height).toBeCloseTo(labelHeight, 1);
  const overlay = await page.locator('.map-marker, .map-place-label').evaluateAll((elements) => elements.map((element) => {
    let scaledAncestor = false;
    for (let node: Element | null = element; node; node = node.parentElement) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      if (Math.abs(matrix.a - 1) > .001 || Math.abs(matrix.d - 1) > .001) scaledAncestor = true;
    }
    const box = element.getBoundingClientRect();
    return { marker: element.classList.contains('map-marker'), width: box.width, height: box.height, scaledAncestor };
  }));
  expect(overlay.length).toBeGreaterThan(0);
  expect(overlay.every((item) => !item.scaledAncestor)).toBe(true);
  expect(overlay.filter((item) => item.marker).every((item) => item.width >= 44 && item.height >= 44)).toBe(true);
  expect((await painted(page)).holes).toBe(0);
});

test('高清瓦片慢加载时沿用已解码地形，连续缩放不产生透明缺块', async ({ page }) => {
  await ready(page);
  const map = page.getByTestId('map-world');
  const nextLevel = Number(await map.getAttribute('data-tile-level')) + 1;
  const held: Route[] = [];
  let blocking = true;
  await page.route('**/maps/**', (route) => {
    const level = Number(new URL(route.request().url()).pathname.split('/')[3]);
    if (blocking && level === nextLevel) held.push(route);
    else return route.continue();
  });
  try {
    await page.getByRole('button', { name: '放大地图', exact: true }).click();
    await page.getByRole('button', { name: '放大地图', exact: true }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('225%');
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await expect(map).toHaveAttribute('data-tiles-ready', 'false');
    expect(Number(await map.getAttribute('data-fallback-tiles'))).toBeGreaterThan(0);
    expect((await painted(page)).holes).toBe(0);
    await page.getByRole('button', { name: '缩小地图', exact: true }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('150%');
    expect((await painted(page)).holes).toBe(0);
  } finally {
    blocking = false;
    await Promise.all(held.map((route) => route.continue().catch(() => undefined)));
  }
  await expect(map).toHaveAttribute('data-tiles-ready', 'true');
  expect((await painted(page)).holes).toBe(0);
});

test('三层快速双指缩放、拖动四角和旋转后仍有完整离线地形', async ({ page }) => {
  await ready(page);
  const session = await page.context().newCDPSession(page);
  const layers = page.getByRole('group', { name: '地图图层' });
  for (const layer of ['地底', '天空', '地表']) {
    await layers.getByRole('button', { name: layer, exact: true }).click();
    await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
    await page.getByRole('button', { name: '收起地图工具', exact: true }).click();
    const frame = (await page.getByTestId('map-viewport').boundingBox())!;
    const center = { x: frame.width / 2, y: frame.height / 2 };
    const touches = (radius: number) => [{ x: center.x - radius, y: center.y, id: 0 }, { x: center.x + radius, y: center.y, id: 1 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(35) });
    for (const radius of [40, 55, 80, 100, 130, 75, 65, 110, 150]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(radius) });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(Number((await page.getByTestId('zoom-level').innerText()).replace('%', ''))).toBeGreaterThan(100);
    await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
    expect((await painted(page)).holes).toBe(0);
    for (const [dx, dy] of [[20000, 20000], [-20000, 0], [0, -20000], [20000, 0]]) {
      await page.mouse.move(20, frame.height / 2); await page.mouse.down();
      await page.mouse.move(20 + dx, frame.height / 2 + dy, { steps: 3 }); await page.mouse.up();
      await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
      expect((await painted(page)).holes).toBe(0);
    }
    await page.getByRole('button', { name: '展开地图工具', exact: true }).click();
    await page.getByRole('button', { name: '恢复地图视野', exact: true }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
  }
  for (const size of [{ width: 850, height: 393 }, { width: 393, height: 850 }]) {
    await page.setViewportSize(size);
    await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
    await expect.poll(async () => (await painted(page)).holes).toBe(0);
  }
});

test.describe('更高屏幕密度的资源预算', () => {
  test.use({ deviceScaleFactor: 4 });
  test('DPR 4 手机及大视口不会因缓存容量不足反复加载', async ({ page }) => {
    await ready(page);
    for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(size);
      const map = page.getByTestId('map-world');
      await expect.poll(() => map.evaluate((element) => {
        return Math.abs(Number((element as HTMLElement).dataset.viewportWidth) - element.getBoundingClientRect().width) < 1;
      })).toBe(true);
      await expect(map).toHaveAttribute('data-tiles-ready', 'true');
      await expect(map).toHaveAttribute('data-pending-tiles', '0');
      expect(Number(await map.getAttribute('data-cached-tiles'))).toBeLessThanOrEqual(384);
      expect((await painted(page)).holes).toBe(0);
    }
  });
});
