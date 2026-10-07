import { chromium, devices, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseURL = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5178';
const directory = fileURLToPath(new URL('../docs/previews/', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url), 'utf8'));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.url().startsWith(baseURL) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
const frames = [];
async function capture(filename, resetScroll = true) {
  await page.evaluate(() => document.fonts.ready);
  if (await page.getByTestId('map-world').count()) await expect(page.getByTestId('map-world')).toHaveAttribute('data-tiles-ready', 'true');
  await expect.poll(() => page.locator('.equipment-art img:visible').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  if (resetScroll) await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Horizontal overflow in ${filename}`);
  await page.screenshot({ path: `${directory}/${filename}`, fullPage: false, scale: 'css' });
  frames.push(filename);
}

try {
  await page.goto(baseURL);
  await expect(page.locator('.demo-banner')).toContainText(`已载入 ${manifest.total.toLocaleString()} 条地点`);
  const quick = page.getByRole('group', { name: '地图快捷筛选' });
  const layers = page.getByRole('group', { name: '地图图层' });
  await capture('map-mobile.png');
  await page.getByRole('button', { name: '收起地图工具', exact: true }).click();
  await capture('map-immersive-mobile.png');
  await page.getByRole('button', { name: '展开地图工具', exact: true }).click();
  await quick.getByRole('button', { name: '西诺克斯', exact: true }).click();
  await expect(page.getByTestId('filtered-count')).toHaveText('40 处');
  await capture('hinox-mobile.png');

  await quick.getByRole('button', { name: '分类', exact: true }).click();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('region', { name: '游戏元素分类' }).getByRole('checkbox', { name: /^神庙/ }).check();
  await quick.getByRole('button', { name: '分类', exact: true }).click();
  await layers.getByRole('button', { name: '天空', exact: true }).click();
  await expect(page.getByTestId('filtered-count')).toHaveText('32 处');
  await capture('sky-mobile.png');

  await layers.getByRole('button', { name: '地底', exact: true }).click();
  await quick.getByRole('button', { name: '人马', exact: true }).click();
  await expect(page.getByTestId('filtered-count')).toHaveText('19 处');
  await capture('depths-mobile.png');

  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name: '装备', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('海利亚盾');
  await capture('equipment-mobile.png');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('海利亚兜帽');
  await capture('armor-mobile.png');
  await page.getByRole('button', { name: /防具升级备料/ }).click();
  for (const id of ['Armor_001_Head', 'Armor_001_Upper', 'Armor_001_Lower']) {
    await page.getByLabel('备料防具', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: '加入或更新计划', exact: true }).click();
  }
  await page.getByLabel('已有琥珀', { exact: true }).fill('60');
  await page.getByLabel('已有波克布林的肝脏', { exact: true }).fill('8');
  await page.getByLabel('已有卢比', { exact: true }).fill('1000');
  await capture('armor-planner-mobile.png');
  await page.locator('.planner-totals').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await capture('armor-materials-mobile.png', false);
  await navigation.getByRole('button', { name: '任务', exact: true }).click();
  await capture('quests-mobile.png');
  await page.getByRole('searchbox', { name: '搜索任务' }).fill('给地底人拍照');
  await page.getByRole('button', { name: '查看任务：给地底人拍照！', exact: true }).click();
  await capture('quest-guide-mobile.png');
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${directory}/capture.json`, JSON.stringify({
    capturedAt: new Date().toISOString(), viewport: page.viewportSize(), scale: 'css',
    source: 'Live React app captured by Chromium; no mockups or synthetic overlays', frames,
  }, null, 2) + '\n');
  console.log(`Saved ${frames.length} real mobile screenshots to ${directory}`);
} finally {
  await browser.close();
}
