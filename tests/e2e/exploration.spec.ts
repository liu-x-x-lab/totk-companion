import { expect,test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function ready(page:Page){await page.goto('/');await expect(page.locator('.demo-banner')).toContainText('已载入');}
const quick=(page:Page)=>page.getByRole('group',{name:'地图快捷筛选'});
async function shrine(page:Page){
  await quick(page).getByRole('button',{name:'神庙',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('塔吉卡兹神庙');
  await page.locator('.location-list').getByRole('button').first().click();
}

test('手动点亮有地图徽记，刷新保存，可筛掉已完成并撤销，收藏独立',async({page})=>{
  await page.setViewportSize({width:360,height:800});await ready(page);await shrine(page);
  const completed=page.getByTestId('point-completion');
  await expect(completed).toHaveText('标记为已点亮');await completed.click();
  await expect(completed).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.map-marker.selected')).toHaveClass(/is-completed/);
  await expect(page.locator('.map-marker.selected .completion-marker')).toBeVisible();
  await expect(page.getByRole('link',{name:'打开塔吉卡兹神庙视频攻略',exact:true})).toBeInViewport();
  expect((await completed.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'收藏',exact:true}).click();
  await expect(page.getByTestId('completed-points-count')).toContainText('1 个地点');
  await expect(page.locator('.saved-summary').first()).toContainText('00');
  await page.reload();await expect(page.locator('.demo-banner')).toContainText('已载入');await shrine(page);
  await expect(completed).toHaveAttribute('aria-pressed','true');
  await quick(page).getByRole('button',{name:'只看未完成',exact:true}).click();
  await expect(page.getByTestId('filtered-count')).toHaveText('0 处');
  await expect(page.locator('.map-marker')).toHaveCount(0);
  await quick(page).getByRole('button',{name:'只看未完成',exact:true}).click();
  await expect(page.getByTestId('filtered-count')).toHaveText('1 处');
  await completed.click();await expect(completed).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.map-marker.selected .completion-marker')).toHaveCount(0);
});

test('树根可手动点亮，备份包含完成记录，旧备份与非法导入安全处理',async({page})=>{
  await ready(page);
  const nav=page.getByRole('navigation',{name:'主导航'});
  await nav.getByRole('button',{name:'收藏',exact:true}).click();
  const records={schemaVersion:1,favorites:['poi:loc:0x3370bc5cc790fa0d'],durabilityRecords:[],completedPoints:['future-point']};
  await page.getByLabel('选择记录备份文件').setInputFiles({name:'complete.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(records))});
  await expect(page.locator('.import-review')).toContainText('1 个地点完成记录');
  await page.getByRole('button',{name:'确认替换',exact:true}).click();
  await expect(page.getByTestId('completed-points-count')).toContainText('1 个地点');
  await page.getByLabel('选择记录备份文件').setInputFiles({name:'duplicate.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...records,completedPoints:['future-point','future-point']}))});
  await expect(page.getByRole('alert')).toContainText('完成记录');
  await expect(page.getByTestId('completed-points-count')).toContainText('1 个地点');
  await nav.getByRole('button',{name:'地图',exact:true}).click();
  await quick(page).getByRole('button',{name:'分类',exact:true}).click();
  const panel=page.getByRole('region',{name:'游戏元素分类'});
  await panel.getByRole('button',{name:'清空',exact:true}).click();await panel.getByRole('checkbox',{name:/^树根/}).check();
  await page.getByRole('group',{name:'地图图层'}).getByRole('button',{name:'地底',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('CheckPoint000');
  await page.locator('.location-list').getByRole('button').first().click();
  await page.getByTestId('point-completion').click();
  await expect(page.locator('.map-marker.selected')).toHaveClass(/is-completed/);
  await expect(page.locator('.map-marker.selected .game-map-icon')).toHaveAttribute('src','/ui/map/lightroot.svg');
  const downloadWait=page.waitForEvent('download');await nav.getByRole('button',{name:'收藏',exact:true}).click();await page.getByRole('button',{name:'导出记录',exact:true}).click();
  const download=await downloadWait;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream!)chunks.push(chunk);
  const backup=JSON.parse(Buffer.concat(chunks).toString());expect(backup.completedPoints).toHaveLength(2);expect(backup.completedPoints).toContain('future-point');expect(backup.favorites).toEqual(records.favorites);
});

test('900 个呀哈哈按类型/图层筛选，搬运的起点与朋友显示方向并共用完成记录',async({page})=>{
  await page.setViewportSize({width:360,height:800});await ready(page);
  await quick(page).getByRole('button',{name:'呀哈哈',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('841 处');
  await page.getByRole('button',{name:'查看地点列表',exact:true}).click();
  await page.getByLabel('筛选克洛格任务类型').selectOption('Korok Friends');await expect(page.getByTestId('filtered-count')).toHaveText('98 处');
  await page.getByRole('group',{name:'地图图层'}).getByRole('button',{name:'天空',exact:true}).click();await expect(page.getByTestId('filtered-count')).toHaveText('2 处');
  await page.getByRole('group',{name:'地图图层'}).getByRole('button',{name:'地表',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('RP38');await page.locator('.location-list').getByRole('button').first().click();
  const guide=page.getByTestId('korok-task-guide');await expect(guide).toContainText('2 颗克洛格果实');
  await expect(page.getByTestId('korok-start-coordinates')).toHaveText('-4260, 2175, 95');await expect(page.getByTestId('korok-destination-coordinates')).toHaveText('-4116, 2416, 92');
  await expect(page.getByTestId('korok-route')).toBeVisible();await expect(page.getByTestId('korok-start-marker')).toBeInViewport();
  const frame=(await page.getByTestId('map-viewport').boundingBox())!;
  const toolbar=(await page.locator('.map-toolbar').boundingBox())!,sheet=(await page.locator('.map-bottom-panel').boundingBox())!;
  for(const marker of [page.getByTestId('korok-start-marker'),page.locator('.map-marker.selected')]){
    const bounds=(await marker.boundingBox())!;expect(bounds.y+bounds.height/2).toBeGreaterThan(toolbar.y+toolbar.height);expect(bounds.y+bounds.height/2).toBeLessThan(sheet.y);
  }
  await page.mouse.move(frame.x+12,frame.y+330);await page.mouse.down();await page.mouse.move(frame.x+30,frame.y+350,{steps:4});await page.mouse.up();
  const start=(await page.getByTestId('korok-start-marker').boundingBox())!;
  const line=page.getByTestId('korok-route').locator('line');
  expect(Math.abs(Number(await line.getAttribute('x1'))-(start.x+start.width/2))).toBeLessThan(.5);
  expect(Math.abs(Number(await line.getAttribute('y1'))-(start.y+start.height/2))).toBeLessThan(.5);
  await guide.getByRole('button',{name:'定位背包克洛格',exact:true}).click();await expect(page.getByTestId('zoom-level')).toHaveText('1600%');
  await guide.getByRole('button',{name:'定位朋友位置',exact:true}).click();
  await page.getByTestId('point-completion').click();
  await expect(page.getByTestId('korok-start-marker')).toHaveClass(/is-completed/);await expect(page.locator('.map-marker.selected')).toHaveClass(/is-completed/);
  await quick(page).getByRole('button',{name:'只看未完成',exact:true}).click();await expect(page.getByTestId('korok-route')).toHaveCount(0);await expect(page.getByTestId('filtered-count')).toHaveText('0 处');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'收藏',exact:true}).click();await expect(page.getByTestId('completed-points-count')).toContainText('1 个地点');
});

test('搬运起点坐标也可搜索，中文谜题类型能直接搜索定位',async({page})=>{
  await ready(page);await quick(page).getByRole('button',{name:'呀哈哈',exact:true}).click();
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('-4260,2175');
  await page.locator('.location-list').getByRole('button').filter({hasText:'RP38'}).click();await expect(page.getByTestId('korok-task-guide')).toContainText('搬运克洛格');
  await page.getByRole('searchbox',{name:'搜索地图地点'}).fill('方块拼图');await expect(page.locator('.location-list').getByRole('button').first()).toContainText('方块拼图');
  await page.locator('.location-list').getByRole('button').first().click();await expect(page.getByTestId('korok-task-guide')).toContainText('方块拼图');await expect(page.getByTestId('korok-route')).toHaveCount(0);
});
