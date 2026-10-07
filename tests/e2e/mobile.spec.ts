import { expect,test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const goTo=(page:Page,label:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:label,exact:true}).click();
const sourceManifest=JSON.parse(readFileSync(new URL('../../public/data/manifest.json',import.meta.url),'utf8'))as{total:number;layers:Record<string,number>};
const loaded=async(page:Page)=>{await page.goto('/');await expect(page.locator('.demo-banner')).toContainText(`已载入 ${sourceManifest.total.toLocaleString()} 条地点`);};
const swordName='旅人之剑';
const swordId='equipment-Weapon_Sword_001';
const openSword=async(page:Page)=>{await goTo(page,'装备');await page.getByRole('searchbox',{name:'搜索装备'}).fill(swordName);return page.getByTestId(swordId);};
test.beforeEach(async({page})=>{
  // 运行时只能读取本地资源，地图不允许回退到上游服务。
  await page.route('https://objmap-totk.zeldamods.org/**',route=>route.abort());
});

for (const [width, height] of [[360, 800], [390, 844], [844, 390], [1280, 900]]) test(`${width}×${height} 地图铺满导航以上的屏幕，初始地形覆盖画布`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await loaded(page);
  const viewport = page.getByTestId('map-viewport');
  await expect.poll(async () => (await viewport.boundingBox())?.height).toBe(height - 74);
  const bounds = (await viewport.boundingBox())!;
  const navigation = (await page.getByRole('navigation', { name: '主导航' }).boundingBox())!;
  expect(bounds.x).toBe(0); expect(bounds.y).toBe(0); expect(bounds.width).toBe(width);
  expect(bounds.height).toBe(navigation.y);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await expect.poll(async () => {
    const world = (await page.getByTestId('map-world').boundingBox())!;
    return world.x <= .01 && world.y <= .01 && world.x + world.width >= width - .01 && world.y + world.height >= navigation.y - .01;
  }).toBe(true);
});

test('地图工具和地点面板可收起，展开详情不缩小地图，导航往返恢复全屏', async ({ page }) => {
  await loaded(page);
  const viewport = page.getByTestId('map-viewport');
  const bounds = await viewport.boundingBox();
  await page.getByRole('button', { name: '收起地图工具', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: '搜索地图地点' })).toBeHidden();
  await page.getByRole('button', { name: '展开地图工具', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: '搜索地图地点' })).toBeVisible();
  await page.getByRole('button', { name: '查看地点列表', exact: true }).click();
  await expect(page.getByRole('region', { name: '地点列表' })).toBeVisible();
  await page.locator('.location-list').getByRole('button').first().click();
  await expect(page.getByRole('article', { name: '地点详情' })).toBeVisible();
  expect(await viewport.boundingBox()).toEqual(bounds);
  const camera = await page.getByTestId('map-world').getAttribute('style');
  await page.getByRole('button', { name: '收起地点详情', exact: true }).click();
  await expect(page.getByRole('article', { name: '地点详情' })).toBeHidden();
  await expect(page.getByTestId('map-world')).toHaveAttribute('style', camera!);
  await goTo(page, '装备'); await expect(page.getByRole('heading', { name: '装备图鉴', exact: true })).toBeVisible();
  await goTo(page, '地图'); expect(await viewport.boundingBox()).toEqual(bounds);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});
for(const width of [360,390])test(`${width}px 手机页面没有横向溢出`,async({page})=>{
  await page.setViewportSize({width,height:844});await loaded(page);
  for(const [tab,heading]of [['地图','探索海拉鲁'],['装备','装备图鉴'],['怪物','怪物分布'],['收藏','我的收藏']]){
    await goTo(page,tab);await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
});

test('三层真实底图与西诺克斯、人马完整筛选',async({page})=>{
  await loaded(page);
  const quick=page.getByRole('group',{name:'地图快捷筛选'}),layers=page.getByRole('group',{name:'地图图层'});
  await quick.getByRole('button',{name:'西诺克斯',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('40 处');
  await layers.getByRole('button',{name:'地底',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('29 处');
  await expect(page.locator('.map-overview')).toHaveAttribute('data-layer','depths');
  await quick.getByRole('button',{name:'人马',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('19 处');
  await layers.getByRole('button',{name:'地表',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('15 处');
  await layers.getByRole('button',{name:'天空',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('0 处');
  await expect(page.locator('.map-overview')).toHaveAttribute('data-layer','sky');
  await expect.poll(()=>page.locator('.map-overview img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).naturalWidth>0))).toBe(true);
});

test('游戏元素分类覆盖天空神庙和地底树根，聚合限制手机标记数量',async({page})=>{
  await loaded(page);const quick=page.getByRole('group',{name:'地图快捷筛选'}),layers=page.getByRole('group',{name:'地图图层'});
  await quick.getByRole('button',{name:'全部元素',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText(`${sourceManifest.layers.surface.toLocaleString()} 处`);
  expect(await page.getByTestId('map-viewport').getByRole('button').count()).toBeLessThan(150);
  await quick.getByRole('button',{name:'分类',exact:true}).click();await page.getByRole('button',{name:'清空',exact:true}).click();
  const panel=page.getByRole('region',{name:'游戏元素分类'});
  await panel.getByRole('checkbox',{name:/^神庙/}).check();await layers.getByRole('button',{name:'天空',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('32 处');
  await panel.getByRole('checkbox',{name:/^神庙/}).uncheck();await panel.getByRole('checkbox',{name:/^树根/}).check();await layers.getByRole('button',{name:'地底',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('120 处');
});

test('用真实坐标搜索并定位，详情保留原始坐标',async({page})=>{
  await loaded(page);await page.getByRole('group',{name:'地图快捷筛选'}).getByRole('button',{name:'人马',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('-4536,2683');await expect(page.getByTestId('filtered-count')).toHaveText('1 处');
  await page.locator('.location-list').getByRole('button').click();
  await expect(page.getByTestId('point-coordinates')).toHaveText('-4536, 2683, 334');
  await expect(page.getByTestId('zoom-level')).toHaveText('1600%');
  await page.getByText('原始坐标与来源',{exact:true}).click();await expect(page.getByText('原始 X / Y / Z：-4535.54, 333.56, -2683.47')).toBeVisible();
});

test('地图放大、拖动、64倍边界及复位',async({page})=>{
  await loaded(page);const zoom=page.getByTestId('zoom-level');await expect(zoom).toHaveText('100%');await expect(page.getByRole('button',{name:'缩小地图',exact:true})).toBeDisabled();await page.getByRole('button',{name:'放大地图',exact:true}).click();await expect(zoom).toHaveText('150%');
  const area=page.getByTestId('map-viewport');await area.scrollIntoViewIfNeeded();const bounds=(await area.boundingBox())!;
  const before=await page.getByTestId('map-world').getAttribute('style');
  await page.mouse.move(bounds.x+8,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+35,bounds.y+bounds.height*.55,{steps:6});await page.mouse.up();await expect(page.getByTestId('map-world')).not.toHaveAttribute('style',before!);
  for(let i=0;i<10;i++)await page.getByRole('button',{name:'放大地图',exact:true}).click();await expect(zoom).toHaveText('6400%');await expect(page.getByRole('button',{name:'放大地图',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'恢复地图视野'}).click();await expect(zoom).toHaveText('100%');await expect(page.getByRole('button',{name:'缩小地图',exact:true})).toBeDisabled();
});

test('缩小、四向拖动、图层切换和横竖屏变化都不露出画布空白', async ({ page }) => {
  await loaded(page);
  await page.getByRole('button', { name: '收起地图工具', exact: true }).click();
  const viewport = page.getByTestId('map-viewport');
  const zoom = page.getByTestId('zoom-level');
  const covered = async () => {
    await expect.poll(async () => {
      const frame = (await viewport.boundingBox())!;
      const world = (await page.getByTestId('map-world').boundingBox())!;
      return world.x <= frame.x + .1 && world.y <= frame.y + .1 && world.x + world.width >= frame.x + frame.width - .1 && world.y + world.height >= frame.y + frame.height - .1;
    }).toBe(true);
  };
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await covered();
    const frame = (await viewport.boundingBox())!;
    for (const [dx, dy] of [[9000, 9000], [-9000, -9000], [9000, -9000], [-9000, 9000]]) {
      await page.mouse.move(frame.x + 10, frame.y + frame.height * .5);
      await page.mouse.down();
      await page.mouse.move(frame.x + 10 + dx, frame.y + frame.height * .5 + dy, { steps: 4 });
      await page.mouse.up();
      await covered();
    }
    await page.getByRole('button', { name: '放大地图', exact: true }).click();
    await covered();
    await page.getByRole('button', { name: '缩小地图', exact: true }).click();
    await expect(zoom).toHaveText('100%');
    await covered();
  }
  await page.getByRole('button', { name: '展开地图工具', exact: true }).click();
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  const camera = await page.getByTestId('map-world').getAttribute('style');
  for (const label of ['天空', '地底', '地表']) {
    await page.getByRole('group', { name: '地图图层' }).getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByTestId('map-world')).toHaveAttribute('style', camera!);
    await covered();
  }
});

test('中文地名随三层地图显示，怪物筛选保留地名并可直接搜索村镇', async ({ page }) => {
  await loaded(page);
  const names = page.getByTestId('map-label-layer');
  await expect(names).toContainText('中央海拉鲁');
  await expect(names).toContainText('监视堡垒');
  const toggle = page.getByRole('button', { name: '显示地图地名', exact: true });
  await page.getByRole('group', { name: '地图快捷筛选' }).getByRole('button', { name: '人马', exact: true }).click();
  await expect(names).toContainText('监视堡垒');
  const count = await page.getByTestId('filtered-count').innerText();
  await toggle.click(); await expect(names).toHaveCount(0);
  await expect(page.getByTestId('filtered-count')).toHaveText(count);
  await toggle.click(); await expect(names).toContainText('监视堡垒');
  await page.getByRole('searchbox', { name: '搜索地图地点' }).fill('卡卡利科村');
  await page.locator('.location-list').getByRole('button').filter({ hasText: '卡卡利科村' }).first().click();
  await expect(page.getByTestId('point-coordinates')).toHaveText('1817, -988, 224');
  const town = names.locator('[data-message-id="Kakariko"]');
  await expect(town).toHaveText('卡卡利科村');
  await expect.poll(async () => {
    const marker = (await page.locator('.map-marker.selected').boundingBox())!;
    const toolbar = (await page.locator('.map-toolbar').boundingBox())!;
    const sheet = (await page.locator('.map-bottom-panel').boundingBox())!;
    return marker.y >= toolbar.y + toolbar.height && marker.y + marker.height < sheet.y;
  }).toBe(true);
  const height = (await town.boundingBox())!.height;
  await page.getByRole('button', { name: '放大地图', exact: true }).click();
  expect((await town.boundingBox())!.height).toBeCloseTo(height, 1);
  await page.getByRole('group', { name: '地图图层' }).getByRole('button', { name: '天空', exact: true }).click();
  await page.getByRole('button', { name: '恢复地图视野', exact: true }).click();
  await expect(names).toContainText('初始空岛');
  await expect(names).not.toContainText('卡卡利科村');
  await page.getByRole('group', { name: '地图图层' }).getByRole('button', { name: '地底', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索地图地点' }).fill('水上竞技场');
  await page.locator('.location-list').getByRole('button').filter({ hasText: '水上竞技场' }).first().click();
  await expect(names).toContainText('水上竞技场');
});

test('安卓接口导出真实备份和 CSV，坐标复制走本机剪贴板', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: { method: string; args: string[] }[] = [];
    Object.assign(window, { nativeCalls: calls, TotkAndroid: {
      saveTextFile: (...args: string[]) => calls.push({ method: 'text', args }),
      saveBundledFile: (...args: string[]) => calls.push({ method: 'asset', args }),
      copyText: (...args: string[]) => calls.push({ method: 'copy', args }),
    } });
  });
  await loaded(page);
  await page.getByRole('searchbox', { name: '搜索地图地点' }).fill('卡卡利科村');
  await page.locator('.location-list').getByRole('button').filter({ hasText: '卡卡利科村' }).first().click();
  await page.getByRole('button', { name: '复制坐标', exact: true }).click();
  await expect(page.getByText('坐标已复制', { exact: true })).toBeVisible();
  const sword = await openSword(page);
  await sword.getByRole('button', { name: `收藏${swordName}`, exact: true }).click();
  await page.getByRole('link', { name: '下载装备属性 CSV', exact: true }).click();
  await goTo(page, '收藏');
  await page.getByRole('button', { name: '导出记录', exact: true }).click();
  await expect(page.getByText('请选择备份文件的保存位置。', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '下载完整地点坐标 CSV', exact: true }).click();
  const calls = await page.evaluate(() => Reflect.get(window, 'nativeCalls')) as { method: string; args: string[] }[];
  expect(calls.find((call) => call.method === 'copy')?.args).toEqual(['1817, -988, 224']);
  expect(calls.filter((call) => call.method === 'asset').map((call) => call.args[0])).toEqual(['/data/equipment.csv', '/data/coordinates.csv']);
  const exported = calls.find((call) => call.method === 'text')!;
  expect(exported.args[0]).toMatch(/^totk-records-[0-9-]+\.json$/);
  expect(exported.args[1]).toBe('application/json');
  expect(JSON.parse(exported.args[2]).favorites).toContain('equipment:Weapon_Sword_001');
});

test('双指缩放地图，浏览器页面保持原比例',async({page,context})=>{
  await loaded(page);const area=page.getByTestId('map-viewport');await area.scrollIntoViewIfNeeded();const bounds=(await area.boundingBox())!;const cdp=await context.newCDPSession(page);const initial=Number((await page.getByTestId('zoom-level').innerText()).replace('%',''));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width*.25,y:bounds.y+bounds.height*.5,id:1},{x:bounds.x+bounds.width*.75,y:bounds.y+bounds.height*.5,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bounds.x+bounds.width*.15,y:bounds.y+bounds.height*.5,id:1},{x:bounds.x+bounds.width*.85,y:bounds.y+bounds.height*.5,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>Number((await page.getByTestId('zoom-level').innerText()).replace('%',''))).toBeGreaterThan(initial);expect(await page.evaluate(()=>window.visualViewport?.scale)).toBe(1);await cdp.detach();
});

test('怪物列表跨页面定位到地底',async({page})=>{
  await loaded(page);await goTo(page,'怪物');await page.getByLabel('筛选怪物图层').selectOption('depths');await page.getByLabel('筛选怪物种类').selectOption('lynel');await expect(page.getByTestId('monster-count')).toHaveText('19 处');
  await page.getByRole('button',{name:'地图定位',exact:true}).first().click();await expect(page.getByRole('group',{name:'地图图层'}).getByRole('button',{name:'地底',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('article',{name:'地点详情'})).toContainText('莱尼尔');await expect(page.getByTestId('zoom-level')).toHaveText('1600%');
});

test('真实装备收藏和手动耐久刷新后保留',async({page})=>{
  await loaded(page);const sword=await openSword(page);await sword.getByRole('button',{name:`收藏${swordName}`,exact:true}).click();await sword.getByRole('button',{name:'新增手动耐久记录'}).click();
  await sword.getByLabel('最大耐久',{exact:true}).fill('30');await sword.getByLabel('剩余耐久',{exact:true}).fill('22');await sword.getByRole('button',{name:'保存记录'}).click();await sword.getByRole('button',{name:'消耗一次耐久'}).click();await expect(sword.getByLabel('记录剩余耐久')).toHaveText('21 / 30');
  await page.reload();await expect(page.locator('.demo-banner')).toContainText(`已载入 ${sourceManifest.total.toLocaleString()} 条地点`);await openSword(page);await expect(sword.getByLabel('记录剩余耐久')).toHaveText('21 / 30');await goTo(page,'收藏');await expect(page.getByRole('heading',{name:swordName,exact:true})).toBeVisible();
});

test('无效导入保留已有记录，合法导入确认后替换',async({page})=>{
  await loaded(page);const sword=await openSword(page);await sword.getByRole('button',{name:`收藏${swordName}`,exact:true}).click();await goTo(page,'收藏');const input=page.getByLabel('选择记录备份文件');
  await input.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":2}')});await expect(page.getByRole('alert')).toContainText('导入失败');await expect(page.getByRole('heading',{name:swordName,exact:true})).toBeVisible();
  const file={name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,favorites:['poi:obj:0x12403d6950759515'],durabilityRecords:[]}))};
  await input.setInputFiles(file);await expect(page.getByRole('button',{name:'确认替换',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:swordName,exact:true})).toBeVisible();await page.getByRole('button',{name:'取消导入',exact:true}).click();await expect(page.getByRole('heading',{name:swordName,exact:true})).toBeVisible();
  await input.setInputFiles(file);await page.getByRole('button',{name:'确认替换',exact:true}).click();await expect(page.locator('.saved-list')).toContainText('莱尼尔');
});

test('存储不可用时可继续收藏，损坏记录不会被空数据覆盖',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Disabled','SecurityError');}}));await loaded(page);await expect(page.getByRole('alert')).toContainText('本次会话');const sword=await openSword(page);await sword.getByRole('button',{name:`收藏${swordName}`,exact:true}).click();await goTo(page,'收藏');await expect(page.getByRole('heading',{name:swordName,exact:true})).toBeVisible();
});
test('损坏记录保留原文以便恢复',async({page})=>{await page.addInitScript(()=>localStorage.setItem('totk-companion:player:v1','corrupted-data'));await loaded(page);await expect(page.getByRole('alert')).toContainText('读取失败');expect(await page.evaluate(()=>localStorage.getItem('totk-companion:player:v1'))).toBe('corrupted-data');});

test('中文装备固定数值、英文搜索和基础耐久自动预填', async ({ page }) => {
  await loaded(page); await goTo(page, '装备');
  await expect(page.getByTestId('equipment-count')).toHaveText('310 / 310 件');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('HYLIAN SHIELD');
  const shield = page.getByTestId('equipment-Weapon_Shield_030');
  await expect(shield.getByRole('heading', { name: '海利亚盾', exact: true })).toBeVisible();
  await expect(shield.getByTestId('equipment-power')).toHaveText('90');
  await expect(shield.getByTestId('equipment-durability')).toHaveText('800');
  await expect(shield.locator('.equipment-art img')).toHaveAttribute('src', '/images/equipment/Weapon_Shield_030.png');
  await expect.poll(() => shield.locator('.equipment-art img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/mobile-equipment.png', fullPage: true });
  await shield.getByRole('button', { name: '新增手动耐久记录' }).click();
  await expect(shield.getByLabel('最大耐久', { exact: true })).toHaveValue('800');
  await expect(shield.getByLabel('剩余耐久', { exact: true })).toHaveValue('800');
  await shield.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(shield.getByLabel('记录剩余耐久')).toHaveText('800 / 800');
});

test('腐朽和无腐蚀武器分别筛选，游戏显示攻击与内部值区分', async ({ page }) => {
  await loaded(page); await goTo(page, '装备');
  const search = page.getByRole('searchbox', { name: '搜索装备' });
  await search.fill('旅人之剑');
  await page.getByLabel('筛选武器形态').selectOption('pristine');
  await expect(page.getByTestId('equipment-Weapon_Sword_001').getByTestId('equipment-durability')).toHaveText('20');
  await expect(page.getByTestId('equipment-Weapon_Sword_106')).toHaveCount(0);
  await page.getByLabel('筛选武器形态').selectOption('decayed');
  await expect(page.getByTestId('equipment-Weapon_Sword_106').getByTestId('equipment-durability')).toHaveText('16');
  await expect(page.getByTestId('equipment-Weapon_Sword_001')).toHaveCount(0);
  await page.getByLabel('筛选武器形态').selectOption('all'); await search.fill('Weapon_Lsword_001');
  const claymore = page.getByTestId('equipment-Weapon_Lsword_001');
  await expect(claymore.getByTestId('equipment-power')).toHaveText('9');
  await claymore.getByText('查看词条与装备资料', { exact: true }).click();
  await expect(claymore).toContainText('内部基础攻击参数：10');
  await expect(claymore).toContainText('融合额外耐久上限：+25');
});

test('防具展示各星级防御与升级材料，360px 展开后不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loaded(page); await goTo(page, '装备');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('海利亚兜帽');
  const hood = page.getByTestId('equipment-Armor_001_Head');
  await expect(hood.getByTestId('equipment-power')).toHaveText('3');
  await expect(hood.getByTestId('equipment-durability')).toHaveText('20');
  await expect(hood.getByRole('button', { name: '新增手动耐久记录' })).toHaveCount(0);
  await hood.getByText('查看强化防御与材料', { exact: true }).click();
  const table = hood.getByRole('table');
  await expect(table.getByRole('row', { name: /★★★★/ })).toContainText('白银波克布林的犄角 × 5');
  await expect(table.getByRole('row', { name: /★★★★/ })).toContainText('500 卢比');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-armor.png', fullPage: true });
});

test('全身防具的材料费用独立保存，不统一假设每级 10 卢比', async ({ page }) => {
  await loaded(page); await goTo(page, '装备');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('古代勇者之魂');
  const full = page.getByTestId('equipment-Armor_1036_Head');
  await expect(full.getByTestId('equipment-power')).toHaveText('12');
  await expect(full.getByTestId('equipment-durability')).toHaveText('84');
  await expect(full).toContainText('全身防具');
  await full.getByText('查看强化防御与材料', { exact: true }).click();
  await expect(full.getByRole('table').getByRole('row', { name: /^★\s/ })).toContainText('30 卢比');
});

test('条件攻击力与弓的每箭攻击明确展示', async ({ page }) => {
  await loaded(page); await goTo(page, '装备');
  const search = page.getByRole('searchbox', { name: '搜索装备' });
  await search.fill('Weapon_Bow_166');
  const demon = page.getByTestId('equipment-Weapon_Bow_166');
  await expect(demon.getByTestId('equipment-power')).toHaveText('2–60');
  await expect(demon).toContainText('红心上限');
  await expect(demon.getByTestId('equipment-durability')).toHaveText('42');
  await search.fill('兽神弓');
  const lynel = page.getByTestId('equipment-Weapon_Bow_032');
  await expect(lynel.getByTestId('equipment-power')).toHaveText('32');
  await expect(lynel).toContainText('每次 3 支箭');
  await search.fill('大师之剑');
  const master = page.getByTestId('equipment-Weapon_Sword_070');
  await expect(master.getByTestId('equipment-power')).toHaveText('30');
  await expect(master.getByTestId('equipment-durability')).toHaveText('40');
});

test('旧强化防具收藏保持 ID，能打开对应星级数值', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('totk-companion:player:v1', JSON.stringify({ schemaVersion: 1, favorites: ['equipment:Armor_003_Head'], durabilityRecords: [] })));
  await loaded(page); await goTo(page, '收藏');
  await expect(page.getByRole('heading', { name: '海利亚兜帽（★★）', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看装备', exact: true }).click();
  await expect(page.getByTestId('equipment-Armor_003_Head').getByTestId('equipment-power')).toHaveText('8');
  await expect(page.getByTestId('equipment-Armor_003_Head')).toContainText('当前星级防御');
  await expect(page.getByTestId('equipment-Armor_003_Head').locator('.equipment-art img')).toHaveAttribute('src', '/images/equipment/Armor_001_Head.png');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('totk-companion:player:v1')!).favorites[0])).toBe('equipment:Armor_003_Head');
});

test('装备 CSV 可下载，包含真实属性而非空字段', async ({ page }) => {
  await loaded(page); await goTo(page, '装备');
  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载装备属性 CSV', exact: true }).click();
  const download = await downloading;
  await download.saveAs('test-results/equipment.csv');
  const csv = readFileSync('test-results/equipment.csv', 'utf8');
  expect(csv.split('\n').length - 2).toBe(310);
  expect(csv).toContain('Weapon_Shield_030,海利亚盾,Hylian Shield,shield,standard,,,,90,800');
});

test('装备图标暂不可用时显示类别符号，装备数值和收藏仍可使用', async ({ page }) => {
  await page.route('**/images/equipment/Weapon_Shield_030.png', route => route.fulfill({ status: 404, body: 'Unavailable' }));
  await loaded(page); await goTo(page, '装备');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('海利亚盾');
  const shield = page.getByTestId('equipment-Weapon_Shield_030');
  await expect(shield.locator('.equipment-art svg')).toBeVisible();
  await expect(shield.locator('.equipment-art img')).toHaveCount(0);
  await expect(shield.getByTestId('equipment-durability')).toHaveText('800');
  await shield.getByRole('button', { name: '收藏海利亚盾', exact: true }).click();
  await goTo(page, '收藏');
  await expect(page.getByRole('heading', { name: '海利亚盾', exact: true })).toBeVisible();
});

test('三层最高精度底图由本地完整包提供',async({request})=>{
  for(const layer of ['Ground','Sky','Depths']){
    const response=await request.get(`/maps/${layer}/7/46/39.webp`);expect(response.ok()).toBe(true);expect((await response.body()).subarray(8,12).toString()).toBe('WEBP');
  }
  const response=await request.get('/data/offline-map-manifest.json');expect(response.ok()).toBe(true);
  const manifest=await response.json();expect(manifest.total).toBe(29835);expect(manifest.levels).toEqual([2,3,4,5,6,7]);
});
test('保存手机真实地图视觉预览',async({page})=>{await loaded(page);await expect.poll(()=>page.locator('.map-overview img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).naturalWidth>0))).toBe(true);await page.screenshot({path:'test-results/mobile-map.png',fullPage:false});});

test('360px 防具备料合并当前到目标范围，已有数量与计划刷新保存', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await loaded(page); await goTo(page, '装备');
  await page.getByRole('button', { name: /防具升级备料/ }).click();
  const panel = page.getByTestId('armor-planner');
  for (const id of ['Armor_001_Head', 'Armor_001_Upper', 'Armor_001_Lower']) {
    await page.getByLabel('备料防具', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: '加入或更新计划', exact: true }).click();
  }
  await expect(page.getByTestId('planner-rupees')).toHaveText('2,280');
  const amber = page.getByTestId('material-actor:Item_Ore_F');
  await expect(amber).toContainText('需要 150');
  await page.getByLabel('已有琥珀', { exact: true }).fill('60');
  await expect(amber.getByTestId('material-shortage')).toHaveText('90');
  await page.getByLabel('海利亚兜帽当前星级', { exact: true }).selectOption('2');
  await expect(page.getByTestId('planner-rupees')).toHaveText('2,220');
  await expect(page.getByTestId('material-actor:Item_Enemy_77')).toContainText('需要 10');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await expect(page.locator('.demo-banner')).toContainText('已载入'); await goTo(page, '装备');
  await expect(panel.getByLabel('已有琥珀', { exact: true })).toHaveValue('60');
  await expect(page.getByLabel('海利亚兜帽当前星级', { exact: true })).toHaveValue('2');
  await expect(page.getByTestId('planner-rupees')).toHaveText('2,220');
  await page.getByRole('button', { name: '移除海利亚裤子备料计划', exact: true }).click();
  await expect(page.getByTestId('planner-rupees')).toHaveText('1,460');
});

test('防具图鉴可直接加入备料，不可强化防具不提供升级计划', async ({ page }) => {
  await loaded(page); await goTo(page, '装备');
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('海利亚兜帽');
  await page.getByTestId('equipment-Armor_001_Head').getByRole('button', { name: '加入备料清单', exact: true }).click();
  await expect(page.getByTestId('armor-plan-Armor_001_Head')).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索装备' }).fill('残旧发夹');
  await expect(page.getByTestId('equipment-Armor_1151_Head').getByRole('button', { name: '加入备料清单', exact: true })).toHaveCount(0);
});

test('360px 任务教程进度勾选、地图往返与刷新保留，目录有覆盖提示', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await loaded(page); await goTo(page, '任务');
  await expect(page.getByTestId('quest-count')).toHaveText('35 个有教程的任务');
  await page.getByRole('group', { name: '任务分类' }).getByRole('button', { name: '主线', exact: true }).click();
  await expect(page.getByTestId('quest-count')).toHaveText('23 个有教程的任务');
  await page.getByRole('searchbox', { name: '搜索任务' }).fill('给地底人拍照');
  await page.getByRole('button', { name: '查看任务：给地底人拍照！', exact: true }).click();
  await expect(page.getByTestId('quest-progress')).toHaveText('0 / 3');
  await page.getByRole('checkbox', { name: '完成阶段：从指定深穴下到地底', exact: true }).check();
  await expect(page.getByTestId('quest-progress')).toHaveText('1 / 3');
  await expect(page.getByTestId('quest-stage-robbie')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: '地图定位', exact: true }).click();
  await expect(page.getByRole('article', { name: '地点详情' })).toContainText('监视堡垒');
  await goTo(page, '任务'); await expect(page.getByTestId('quest-progress')).toHaveText('1 / 3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload(); await expect(page.locator('.demo-banner')).toContainText('已载入'); await goTo(page, '任务');
  await page.getByLabel('筛选任务进度', { exact: true }).selectOption('started');
  await expect(page.getByTestId('quest-count')).toHaveText('1 个有教程的任务');
  await page.getByRole('button', { name: '查看任务：给地底人拍照！', exact: true }).click();
  await expect(page.getByTestId('quest-progress')).toHaveText('1 / 3');
  await page.getByTestId('quest-stage-chasm').locator('summary').click();
  await page.getByRole('checkbox', { name: '完成阶段：从指定深穴下到地底', exact: true }).uncheck();
  await expect(page.getByTestId('quest-progress')).toHaveText('0 / 3');
});

test('任务索引明确区分无教程条目，地表遗迹与天空任务定位准确', async ({ page }) => {
  await loaded(page); await goTo(page, '任务');
  await page.getByRole('button', { name: '只看有教程', exact: true }).click();
  await expect(page.getByTestId('quest-count')).toHaveText('253 个任务');
  await page.getByRole('searchbox', { name: '搜索任务' }).fill('来自地底的呼唤');
  await page.getByRole('button', { name: '查看任务：来自地底的呼唤', exact: true }).click();
  await page.getByRole('button', { name: '地图定位', exact: true }).click();
  await expect(page.getByRole('article', { name: '地点详情' })).toContainText('时之神殿遗迹');
  await expect(page.getByRole('group', { name: '地图图层' }).getByRole('button', { name: '地表', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await goTo(page, '任务'); await page.getByRole('button', { name: '‹ 返回任务列表', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索任务' }).fill('紧闭之门');
  await page.getByRole('button', { name: '查看任务：紧闭之门', exact: true }).click();
  await page.getByRole('button', { name: '地图定位', exact: true }).click();
  await expect(page.getByRole('group', { name: '地图图层' }).getByRole('button', { name: '天空', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('新备份包含任务与备料，导入后恢复材料缺口与阶段', async ({ page }) => {
  await loaded(page); await goTo(page, '收藏');
  const file = { schemaVersion: 1, favorites: [], durabilityRecords: [], armorPlans: [{ equipmentId: 'Armor_001_Head', currentLevel: 2, targetLevel: 4 }], ownedMaterials: { 'actor:Item_Ore_F': 20 }, questProgress: [{ questId: 'GetCamera', completedStageIds: ['chasm'] }] };
  await page.getByLabel('选择记录备份文件').setInputFiles({ name: 'new-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.import-review')).toContainText('1 条任务进度、1 件防具计划');
  await page.getByRole('button', { name: '确认替换', exact: true }).click();
  await goTo(page, '装备'); await expect(page.getByTestId('material-actor:Item_Ore_F').getByTestId('material-shortage')).toHaveText('30');
  await goTo(page, '任务'); await page.getByLabel('筛选任务进度').selectOption('started');
  await page.getByRole('button', { name: '查看任务：给地底人拍照！', exact: true }).click();
  await expect(page.getByTestId('quest-progress')).toHaveText('1 / 3');
});
