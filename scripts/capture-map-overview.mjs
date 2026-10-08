import { chromium, devices, expect } from '@playwright/test';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseURL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5178';
const directory = fileURLToPath(new URL('../docs/previews/', import.meta.url));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const frames = [], errors = [];
try {
  for (const width of [360, 390]) {
    const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    await expect(page.locator('.demo-banner')).toContainText('54,793');
    await page.getByRole('group', { name: '地图快捷筛选' }).getByRole('button', { name: '全部元素', exact: true }).click();
    const capture = async name => {
      await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
      await expect(page.getByTestId('map-world')).toHaveAttribute('data-viewport-width', String(width));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: directory + name, scale: 'css' });
      frames.push({ file: name, viewport: page.viewportSize(), zoom: await page.getByTestId('zoom-level').innerText(),
        filtered: await page.getByTestId('filtered-count').innerText(), markers: await page.locator('.map-marker').count() });
    };
    await capture(`map-overview-${width}.png`);
    const index = await page.locator('.cluster-marker').evaluateAll(elements => elements.findIndex(element => {
      const box = element.getBoundingClientRect(), toolbar = document.querySelector('.map-toolbar').getBoundingClientRect(), sheet = document.querySelector('.map-bottom-panel').getBoundingClientRect();
      return box.x >= 8 && box.right <= innerWidth - 8 && box.y > toolbar.bottom + 8 && box.bottom < sheet.top - 8
        && document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === element;
    }));
    if (index < 0) throw new Error('No accessible cluster');
    await page.locator('.cluster-marker').nth(index).tap();
    await expect.poll(async () => Number((await page.getByTestId('zoom-level').innerText()).replace('%', ''))).toBeGreaterThanOrEqual(400);
    await capture(`map-region-${width}.png`);
    await page.getByRole('button', { name: '恢复地图视野', exact: true }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
    await page.getByRole('button', { name: '收起地图工具', exact: true }).click();
    await capture(`map-overview-immersive-${width}.png`);
    await context.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await copyFile('.cache/verification/map-baseline-390-all.png', directory + 'map-overview-before-390.png');
  await writeFile(directory + 'map-overview-capture.json', JSON.stringify({ capturedAt: new Date().toISOString(),
    scale: 'css', source: 'Real React app captured by Chromium, mobile viewport; no mockup overlays',
    baseline: 'map-overview-before-390.png (0.1.3, 108 count markers at 100%)', frames }, null, 2) + '\n');
  console.log(`Saved ${frames.length} real map screenshots and baseline`);
} finally { await browser.close(); }
