import { expect,test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const goTo=(page:Page,label:string)=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:label,exact:true}).click();
const sourceManifest=JSON.parse(readFileSync(new URL('../../public/data/manifest.json',import.meta.url),'utf8'))as{total:number;layers:Record<string,number>};
const loaded=async(page:Page)=>{await page.goto('/');await expect(page.getByText(`已载入 ${sourceManifest.total.toLocaleString()} 条地点`,{exact:false})).toBeVisible();};
const swordName='旅人之剑';
const swordId='equipment-Weapon_Sword_001';
const openSword=async(page:Page)=>{await goTo(page,'装备');await page.getByRole('searchbox',{name:'搜索装备'}).fill(swordName);return page.getByTestId(swordId);};
const tile=readFileSync(new URL('../../public/maps/Ground/2/0/0.webp',import.meta.url));

test.beforeEach(async({page})=>{
  // 手势、状态与分类检查使用本地瓦片，避免在线底图影响行为断言。
  await page.route('https://objmap-totk.zeldamods.org/game_files/map/**',route=>route.fulfill({contentType:'image/webp',body:tile}));
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
  await loaded(page);const zoom=page.getByTestId('zoom-level');await expect(zoom).toHaveText('100%');await page.getByRole('button',{name:'放大地图',exact:true}).click();await expect(zoom).toHaveText('150%');
  const area=page.getByTestId('map-viewport');await area.scrollIntoViewIfNeeded();const bounds=(await area.boundingBox())!;
  const before=await page.getByTestId('map-world').getAttribute('style');
  await page.mouse.move(bounds.x+8,bounds.y+60);await page.mouse.down();await page.mouse.move(bounds.x+35,bounds.y+95,{steps:6});await page.mouse.up();await expect(page.getByTestId('map-world')).not.toHaveAttribute('style',before!);
  for(let i=0;i<10;i++)await page.getByRole('button',{name:'放大地图',exact:true}).click();await expect(zoom).toHaveText('6400%');await expect(page.getByRole('button',{name:'放大地图',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'恢复地图视野'}).click();await expect(zoom).toHaveText('100%');await expect(page.getByRole('button',{name:'缩小地图',exact:true})).toBeDisabled();
});

test('双指缩放地图，浏览器页面保持原比例',async({page,context})=>{
  await loaded(page);const area=page.getByTestId('map-viewport');await area.scrollIntoViewIfNeeded();const bounds=(await area.boundingBox())!;const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width*.25,y:bounds.y+40,id:1},{x:bounds.x+bounds.width*.75,y:bounds.y+40,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bounds.x+bounds.width*.15,y:bounds.y+40,id:1},{x:bounds.x+bounds.width*.85,y:bounds.y+40,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>Number((await page.getByTestId('zoom-level').innerText()).replace('%',''))).toBeGreaterThan(100);expect(await page.evaluate(()=>window.visualViewport?.scale)).toBe(1);await cdp.detach();
});

test('怪物列表跨页面定位到地底',async({page})=>{
  await loaded(page);await goTo(page,'怪物');await page.getByLabel('筛选怪物图层').selectOption('depths');await page.getByLabel('筛选怪物种类').selectOption('lynel');await expect(page.getByTestId('monster-count')).toHaveText('19 处');
  await page.getByRole('button',{name:'地图定位',exact:true}).first().click();await expect(page.getByRole('group',{name:'地图图层'}).getByRole('button',{name:'地底',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('article',{name:'地点详情'})).toContainText('莱尼尔');await expect(page.getByTestId('zoom-level')).toHaveText('1600%');
});

test('真实装备收藏和手动耐久刷新后保留',async({page})=>{
  await loaded(page);const sword=await openSword(page);await sword.getByRole('button',{name:`收藏${swordName}`,exact:true}).click();await sword.getByRole('button',{name:'新增手动耐久记录'}).click();
  await sword.getByLabel('最大耐久',{exact:true}).fill('30');await sword.getByLabel('剩余耐久',{exact:true}).fill('22');await sword.getByRole('button',{name:'保存记录'}).click();await sword.getByRole('button',{name:'消耗一次耐久'}).click();await expect(sword.getByLabel('记录剩余耐久')).toHaveText('21 / 30');
  await page.reload();await expect(page.getByText(`已载入 ${sourceManifest.total.toLocaleString()} 条地点`,{exact:false})).toBeVisible();await openSword(page);await expect(sword.getByLabel('记录剩余耐久')).toHaveText('21 / 30');await goTo(page,'收藏');await expect(page.getByRole('heading',{name:swordName,exact:true})).toBeVisible();
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

test('线上高清底图瓦片服务可用',async({request})=>{
  for(const layer of ['Ground','Sky','Depths']){
    const response=await request.get(`https://objmap-totk.zeldamods.org/game_files/map/${layer}/maptex/7/46/39.webp`);expect(response.ok()).toBe(true);expect((await response.body()).subarray(8,12).toString()).toBe('WEBP');
  }
});
test('保存手机真实地图视觉预览',async({page})=>{await loaded(page);await expect.poll(()=>page.locator('.map-overview img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).naturalWidth>0))).toBe(true);await page.screenshot({path:'test-results/mobile-map.png',fullPage:false});});
