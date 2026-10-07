import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('.demo-banner')).toContainText('已载入');
}

async function openShrine(page: Page, name: string, layer: string) {
  await page.getByRole('group', { name: '地图快捷筛选' }).getByRole('button', { name: '神庙', exact: true }).click();
  await page.getByRole('group', { name: '地图图层' }).getByRole('button', { name: layer, exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索地图地点' }).fill(name);
  await page.locator('.location-list').getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click();
  await expect(page.getByRole('article', { name: '地点详情' })).toContainText(name);
}

for (const [name, layer, part, puzzle] of [['塔吉卡兹神庙', '地表', 27, '平衡之形'], ['乌可乌侯神庙', '天空', 3, '创造之力']] as const) {
  test(`360px ${name}对应具体分集，抖音为名称搜索，图标保持清晰与触控尺寸`, async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 800 }); await ready(page);
    await openShrine(page, name, layer);
    const guide = page.getByTestId('shrine-video-guide');
    await expect(guide).toContainText(puzzle); await expect(guide).toContainText('视频需联网');
    const video = guide.getByRole('link', { name: `观看${name}攻略（B站第${part}集）`, exact: true });
    await expect(video).toHaveAttribute('href', `https://www.bilibili.com/video/BV1Ru41147ca/?p=${part}`);
    const douyin = guide.getByRole('link', { name: '抖音搜索', exact: true });
    const url = new URL((await douyin.getAttribute('href'))!);
    expect(decodeURIComponent(url.pathname)).toBe(`/search/王国之泪 ${name} 攻略`);
    expect(url.searchParams.get('type')).toBe('video');
    for (const link of [video, douyin, guide.getByRole('link', { name: 'B站搜索', exact: true })]) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const marker = page.locator('.map-marker.selected');
    const icon = marker.locator('img.game-map-icon');
    await expect(icon).toHaveAttribute('src', '/ui/map/shrine.svg');
    await expect.poll(()=>icon.evaluate(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0)).toBe(true);
    const box = (await icon.boundingBox())!; expect(box.width).toBe(32); expect(box.height).toBe(32);
    expect((await marker.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: '放大地图', exact: true }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('2400%');
    expect((await icon.boundingBox())!.height).toBeCloseTo(32, 3);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // Intercept only the explicitly clicked destination; no platform is loaded as part of map rendering.
    await context.route('https://www.bilibili.com/**', route=>route.fulfill({ status:200,body:'Selected video platform' }));
    const popupWait = page.waitForEvent('popup'); await video.click(); const popup=await popupWait;
    await popup.waitForURL(`https://www.bilibili.com/video/BV1Ru41147ca/?p=${part}`); await popup.close();
    await expect(guide).toContainText(puzzle);
  });
}

test('相似中文神庙名仍跳转各自视频，不以名称子串匹配', async ({ page }) => {
  await ready(page);
  for (const [name, layer, part] of [['乔尼乌神庙','地表',102],['乔乔尼乌神庙','地表',14],['乔高乌神庙','地表',93],['希哈乔高乌神庙','天空',142],['诺乌达神庙','地表',39],['塔尼诺乌达神庙','天空',129]] as const) {
    await openShrine(page, name, layer);
    await expect(page.getByTestId('shrine-video-guide').getByRole('link', { name: /^观看/ })).toHaveAttribute('href', `https://www.bilibili.com/video/BV1Ru41147ca/?p=${part}`);
  }
});

test('树根使用独立游戏地图矢量符号，非神庙无解谜视频区', async ({ page }) => {
  await ready(page);
  await page.getByRole('button',{ name:'分类',exact:true }).click();
  const categories=page.getByRole('region',{name:'游戏元素分类'});
  await categories.getByRole('button',{name:'清空',exact:true}).click();
  await categories.getByRole('checkbox',{name:/^树根/}).check();
  await page.getByRole('group',{name:'地图图层'}).getByRole('button',{name:'地底',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('CheckPoint000');
  await expect(page.getByTestId('filtered-count')).toHaveText('1 处');
  await page.locator('.location-list').getByRole('button').first().click();
  const icon=page.locator('.map-marker.selected img.game-map-icon');
  await expect(icon).toHaveAttribute('src','/ui/map/lightroot.svg');
  await expect.poll(()=>icon.evaluate(image=>(image as HTMLImageElement).naturalWidth>0)).toBe(true);
  await expect(page.getByTestId('shrine-video-guide')).toHaveCount(0);
  await page.getByRole('group',{name:'地图快捷筛选'}).getByRole('button',{name:'西诺克斯',exact:true}).click();
  await page.getByRole('button',{name:'查看地点列表',exact:true}).click();
  await page.locator('.location-list').getByRole('button').first().click();
  await expect(page.getByTestId('shrine-video-guide')).toHaveCount(0);
  await expect(page.locator('.map-marker.selected img.game-map-icon')).toHaveCount(0);
});
