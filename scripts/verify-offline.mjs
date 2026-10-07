import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, 'dist');
const origin = 'https://appassets.androidplatform.net';
const manifest = JSON.parse(await readFile(resolve(directory, 'data/manifest.json'), 'utf8'));
const resources = JSON.parse(await readFile(resolve(directory, 'data/offline-map-manifest.json'), 'utf8'));
if (resources.total !== 29835) throw new Error('The production offline map is incomplete');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.csv': 'text/csv', '.webmanifest': 'application/manifest+json' };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, offline: true });
const page = await context.newPage();
const errors = [], external = [], loaded = new Set();
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) { external.push(url.origin + url.pathname); await route.abort(); return; }
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const path = resolve(directory, '.' + pathname);
  if (!path.startsWith(directory + sep)) throw new Error('Asset path left the package');
  try {
    const body = await readFile(path);
    const extension = pathname.substring(pathname.lastIndexOf('.'));
    loaded.add(pathname);
    await route.fulfill({ status: 200, contentType: types[extension] ?? 'application/octet-stream', body,
      headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-src 'none'" } });
  } catch (error) {
    errors.push(`Missing local asset: ${pathname} (${error.code ?? error.message})`);
    await route.fulfill({ status: 404, body: 'Missing asset' });
  }
});

const navigation = page.getByRole('navigation', { name: '主导航' });
const layers = page.getByRole('group', { name: '地图图层' });
async function readyTiles(folder) {
  const terrain = page.getByTestId('map-world');
  await expect(terrain).toHaveAttribute('data-layer', { Ground: 'surface', Sky: 'sky', Depths: 'depths' }[folder]);
  await expect(terrain).toHaveAttribute('data-tile-level', '7');
  await expect(terrain).toHaveAttribute('data-tiles-ready', 'true');
  const pixels = await terrain.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const rectangles = [...element.querySelectorAll('.map-tile')].flatMap(tile => {
      const image = tile.querySelector('img'); return image?.complete && image.naturalWidth > 0 ? [tile.getBoundingClientRect()] : [];
    });
    let holes = 0;
    const xs = [...Array.from({ length: Math.ceil(bounds.width / 11) }, (_, i) => i * 11), bounds.width - .001];
    const ys = [...Array.from({ length: Math.ceil(bounds.height / 11) }, (_, i) => i * 11), bounds.height - .001];
    for (const y of ys) for (const x of xs) if (!rectangles.some(r => x + bounds.x >= r.left - .001 && x + bounds.x < r.right + .001 && y + bounds.y >= r.top - .001 && y + bounds.y < r.bottom + .001)) holes++;
    return { holes, width: bounds.width, height: bounds.height, images: rectangles.length };
  });
  if (pixels.holes || pixels.width !== 390 || pixels.height !== 770 || pixels.images === 0) throw new Error(`Incomplete high-DPR terrain: ${JSON.stringify(pixels)}`);
  await expect(page.getByText('离线高清资源缺失，请重新安装完整包')).toHaveCount(0);
  const world = await page.getByTestId('map-world').boundingBox();
  const frame = await page.getByTestId('map-viewport').boundingBox();
  if (world.x > frame.x + .1 || world.y > frame.y + .1 || world.x + world.width < frame.x + frame.width - .1 || world.y + world.height < frame.y + frame.height - .1) throw new Error(`The map exposed an empty viewport margin: ${JSON.stringify({ world, frame })}`);
}

try {
  await page.goto(origin + '/');
  await expect(page.locator('.demo-banner')).toContainText(`已载入 ${manifest.total.toLocaleString()} 条地点`);
  await expect(page.getByTestId('map-label-layer')).toContainText('中央海拉鲁');
  await expect(page.getByTestId('map-label-layer')).toContainText('监视堡垒');
  for (let i = 0; i < 11; i++) await page.getByRole('button', { name: '放大地图', exact: true }).click();
  await expect(page.getByTestId('zoom-level')).toHaveText('6400%');
  for (const [layer, folder] of [['地表', 'Ground'], ['天空', 'Sky'], ['地底', 'Depths']]) {
    await layers.getByRole('button', { name: layer, exact: true }).click();
    await readyTiles(folder);
    await page.getByRole('button', { name: '收起地图工具', exact: true }).click();
    const frame = await page.getByTestId('map-viewport').boundingBox();
    for (const [dx, dy] of [[100000, 100000], [-100000, 0], [0, -100000], [100000, 0]]) {
      await page.mouse.move(frame.x + 10, frame.y + frame.height / 2);
      await page.mouse.down();
      await page.mouse.move(frame.x + 10 + dx, frame.y + frame.height / 2 + dy, { steps: 3 });
      await page.mouse.up();
      await readyTiles(folder);
    }
    await page.getByRole('button', { name: '展开地图工具', exact: true }).click();
    console.log(`Offline verified: ${layer}, native level 7, all four previously unseen corners`);
  }
  await layers.getByRole('button', { name: '天空', exact: true }).click();
  await page.getByRole('button', { name: '恢复地图视野', exact: true }).click();
  await expect(page.getByTestId('map-label-layer')).toContainText('初始空岛');
  await layers.getByRole('button', { name: '地表', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索地图地点' }).fill('卡卡利科村');
  await page.locator('.location-list').getByRole('button').filter({ hasText: '卡卡利科村' }).first().click();
  await expect(page.getByRole('article', { name: '地点详情' })).toContainText('卡卡利科村');
  await expect(page.getByTestId('point-coordinates')).toHaveText('1817, -988, 224');
  await expect(page.getByTestId('zoom-level')).toHaveText('1600%');
  await navigation.getByRole('button', { name: '怪物', exact: true }).click();
  await page.getByLabel('筛选怪物图层').selectOption('depths');
  await page.getByLabel('筛选怪物种类').selectOption('lynel');
  await expect(page.getByTestId('monster-count')).toHaveText('19 处');
  await page.getByRole('button', { name: '地图定位', exact: true }).first().click();
  await expect(page.getByRole('article', { name: '地点详情' })).toContainText('莱尼尔');
  await navigation.getByRole('button', { name: '装备', exact: true }).click();
  await expect(page.getByTestId('equipment-count')).toHaveText('310 / 310 件');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('海利亚盾');
  const shield = page.getByTestId('equipment-Weapon_Shield_030');
  await expect(shield.getByTestId('equipment-durability')).toHaveText('800');
  await expect.poll(() => shield.locator('.equipment-art img').evaluate(image => image.naturalWidth)).toBe(256);
  await page.getByRole('button', { name: /防具升级备料/ }).click();
  for (const id of ['Armor_001_Head', 'Armor_001_Upper', 'Armor_001_Lower']) {
    await page.getByLabel('备料防具', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: '加入或更新计划', exact: true }).click();
  }
  await expect(page.getByTestId('planner-rupees')).toHaveText('2,280');
  await page.getByLabel('已有琥珀', { exact: true }).fill('60');
  await expect(page.getByTestId('material-actor:Item_Ore_F').getByTestId('material-shortage')).toHaveText('90');
  await navigation.getByRole('button', { name: '任务', exact: true }).click();
  await expect(page.getByTestId('quest-count')).toHaveText('35 个有教程的任务');
  await page.getByRole('searchbox', { name: '搜索任务' }).fill('给地底人拍照');
  await page.getByRole('button', { name: '查看任务：给地底人拍照！', exact: true }).click();
  await page.getByRole('checkbox', { name: '完成阶段：从指定深穴下到地底', exact: true }).check();
  await expect(page.getByTestId('quest-progress')).toHaveText('1 / 3');
  await page.getByRole('button', { name: '地图定位', exact: true }).click();
  await expect(page.getByRole('article', { name: '地点详情' })).toContainText('监视堡垒');
  await page.reload(); await expect(page.locator('.demo-banner')).toContainText('已载入');
  await navigation.getByRole('button', { name: '装备', exact: true }).click();
  await expect(page.getByLabel('已有琥珀', { exact: true })).toHaveValue('60');
  await navigation.getByRole('button', { name: '任务', exact: true }).click();
  await page.getByLabel('筛选任务进度').selectOption('started');
  await expect(page.getByTestId('quest-count')).toHaveText('1 个有教程的任务');
  await page.getByRole('button', { name: '查看任务：给地底人拍照！', exact: true }).click();
  await expect(page.getByTestId('quest-progress')).toHaveText('1 / 3');
  if (external.length || errors.length) throw new Error(JSON.stringify({ external, errors }));
  const report = { checkedAt: new Date().toISOString(), browserOffline: true, origin, mapTiles: resources.total,
    devicePixelRatio: 3, renderer: 'viewport-clipped native image tiles, decoded cache and unscaled DOM overlays',
    tested: ['All three layers and four corners at native level 7', 'Decoded image coverage at DPR 3 including every viewport edge', 'Offline Chinese labels and place search', 'Depths Lynel filter and coordinates', 'Fixed equipment durability and local icon', 'Three-piece armor material aggregation, owned quantities and persistence', 'Offline quest tutorials, stage progress, map links and persistence'],
    distinctAssetsRequested: loaded.size, externalRequests: external, errors,
    nativeDeviceTest: 'No Android device attached; native installation and document chooser not yet tested on a device' };
  await mkdir(resolve(root, '.cache/verification'), { recursive: true });
  await writeFile(resolve(root, '.cache/verification/offline-test.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Production offline verification passed; ${loaded.size} different packaged assets, zero external requests`);
} finally { await browser.close(); }
