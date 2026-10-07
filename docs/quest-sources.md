# 任务目录、教程和防具备料来源

整理日期：2026-10-07。任务不是从 Switch 同步，阶段勾选为玩家手动记录。

## 任务标题与分类

任务简体中文、英文名称及稳定 ID 来自公开提取的游戏文本仓库 `https://github.com/sh0wer1ee/TotkText`，固定快照 `1c66ac1a02edf2d73d10b0dc6f0f2de29da7b119`，文本版本 `1.2.1`。使用 `data/chunks/ChallengeMsg/Info_*/0000.json`，只导出名称、阶段 ID 和原始文件 SHA-256，不导出完整剧情日志。

四种类别对照 PowerPyx 的公开清单：

- `https://www.powerpyx.com/zelda-tears-of-the-kingdom-walkthrough-all-quests/`
- `https://www.powerpyx.com/zelda-tears-of-the-kingdom-all-side-adventures-guide/`
- `https://www.powerpyx.com/zelda-tears-of-the-kingdom-all-shrine-quests/`
- `https://www.powerpyx.com/zelda-tears-of-the-kingdom-all-side-quests-guide/`

当前 253 项：主线 23、情节挑战 60、神庙挑战 31、支线 139。标题归一化保留问号与叹号，避免把两项古代都市任务合并；清单中未直接链接的两项水晶任务使用显式别名分类。

## 离线教程的范围

`data/quest-guides.json` 是项目自行整理的行动步骤：全部 23 个主线、相机后续、研究所与平板升级、报社与大妖精、哈特诺奶酪与选举、四眼搬运、鲜奶与海利亚湖水晶，共 35 篇。其余 218 项只有目录，界面标明“离线教程待整理”。

阶段参考游戏日志中的目标，以及任务条目所列的公开攻略。教程不是完整剧情摘录，也不是逐机关图文攻略；未在游戏设备上逐阶段实测。必要的基础红心/精力、标记器地图数量、感应器图鉴数量等条件保留；常规剧情路线的前置不能解释为所有任务都禁止提前探索。

海利亚湖水晶的空岛→漩涡→湖底神庙路线额外核对 `https://www.ign.com/wikis/the-legend-of-zelda-tears-of-the-kingdom/En-oma_Shrine`，不是岩石巨人水晶任务。来自地底的呼唤定位到地表时之神殿遗迹，天空教学神殿使用不同 MessageID。龙头岛与雷鸣之岛也按实际地名区分。

地点绑定 `map-labels.json` 的 MessageID 及真实来源 ID，不填写未经确认的 NPC 精确坐标。村镇/遗迹按钮定位该地点区域，阶段说明指导寻找人物、入口或目标。

## 防具备料

复用 `equipment.json` 的已对照逐星材料、防御及卢比；来源及版本限制见 `equipment-sources.md`。当前 135 件基础防具、547 个等级记录，只有存在强化等级的基础条目可加入计划。

计算只合并选中范围，不改动资料数值。全身防具保留整体费用；缺失材料 ID 时按原始名称合并。已有量由玩家填写，升级后也需自行扣除材料与调整星级。解锁大妖精是游戏内强化条件，备料计算不自动判断游戏进度。

## 更新和验证

```bash
python3 scripts/sync-quests.py
# 使用已经下载的固定快照重新生成：
python3 scripts/sync-quests.py --offline
npm run check
npm run test:e2e
npm run test:offline
```

`quests.json` 记录原文件 SHA-256、文本快照、分类网页校验和、参考链接与教程覆盖数量。业务测试核对分类、教程有效步骤、所有地图关联、关键条件、进度范围和旧备份迁移。手机与断网测试核对定位、勾选保存、备料合并及离线资源。

游戏文字与名称属于原权利人，公开资料入口不等同于授予游戏素材的商业再分发许可。
