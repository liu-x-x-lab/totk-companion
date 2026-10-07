# 真实地图与地点数据来源

接入日期：2026-10-07。来源为公开的 TotK Object Map / ZeldaMods 社区数据，不是主机实时状态。

装备属性、基础耐久与强化材料使用独立资料表，见 `docs/equipment-sources.md`。

- 项目与资料入口：`https://github.com/zeldamods/objmap-totk`、`https://objmap-totk.zeldamods.org/`。
- 固定对象查询：`https://radar-totk.zeldamods.org/objs/MainAndMinusField/`，使用 `actor:^Enemy_` 等明确对象查询，`limit=-1`，覆盖 MainField（包括 Sky 区域）和 MinusField。
- 补充查询：`actor:^MiasmaSwarm`，保留不以 Enemy_ 开头的瘴气之手 / 幻影加侬据点；不是当前已生成的每个个体。
- 探索地点：`game_files/map_summary/MainField/static.json`。
- 名称索引：`game_files/names.json` 与 `game_files/text/StaticMsg/LocationMarker.json`。
- 底图：`game_files/map/{Ground|Sky|Depths}/maptex/{z}/{x}/{y}.webp`，原生瓦片层级 2–7。
- 本地清单 `public/data/manifest.json` 保存查询地址、抓取时间和各原始文件 SHA-256。
- 原项目代码许可为 GPL-3.0；本项目自行实现渲染与手势，不复制该项目代码。地点索引和地图资源保留上游来源说明，游戏内容归原权利人。

## 完整性核验

怪物使用对象名匹配，不用全文 `Enemy_Giant` 搜索；全文查询还会匹配关联物体，造成两个错误的西诺克斯记录。固定对象索引中的 49 个西诺克斯、20 个骷髅西诺克斯，以及 34 个人马均保留稳定 Hash ID。

神庙 152、树根 120、鳥望台 15、呀哈哈标记 900。洞窟按入口记录，同一洞窟可以有多个入口，不能把入口数量说成洞窟数量。神庙图层使用来源中的天空神庙 ID 集合（32 个），不单靠高度判断。

方块魔像以 `Enemy_Zonau_BlockMaster` 匹配（35 个），`Enemy_Zonau_Golem` 是队长魔像，不能混入这一类。宝箱的 `Obj_SageWill` 和 `Obj_TreasureMap_` 内容分别归入贤者的遗志（20）与古旧地图（31）。水井同样按入口记录（59 条），不声称是 59 口不同水井。

怪物和 NPC 的等级、出现时间、剧情阶段可能随游戏状态变化。同位置的不同来源对象仍保留，不冒充当前游戏中的实时对象。当前范围为三层世界固定对象及上游全部探索标记，不包含神庙内部、动态生成的每个个体或实时巨龙路线。

## 坐标

保留原始 `[X, Y, Z]`：X 向东，Y 为高度，Z 向南。界面参考坐标按东、北、高显示，即 `[X, -Z, Y]`，整数展示为约值，CSV 保留小数原值。

地图边界：原始 X 为 -6000 至 6000，原始 Z 为 -5000 至 5000；原生画布 24000 × 20000。归一化位置为 `((X + 6000) / 12000, (Z + 5000) / 10000)`。以多个鸟望台、神庙和相同横坐标的神庙 / 树根对照核验方向。

## 更新

```bash
python3 scripts/sync-data.py --tiles
```

脚本会联网更新资料和三层概览瓦片，完整保留来源。原始快照缓存在 `.cache/sources/`，不提交；生成地点索引、分类统计和 CSV。首轮断言保护关键怪物和探索标记数量，来源变动时需要先核对再调整基线。

## 完整离线瓦片与中文地名

三层地图所有 2–7 级共 29,835 张 WebP 均已保存，每层 9 / 30 / 120 / 480 / 1880 / 7426 张，原始图片合计约 62.8 MiB。`offline-map-manifest.json` 逐张记录尺寸、文件大小、上游路径和 SHA-256。`sync-map-tiles.py` 校验图片格式、原生 24000 × 20000 范围、完整行列及哈希，支持断点补齐；运行时只使用本机文件。

```bash
python3 -m pip install -r scripts/requirements-tools.txt
python3 scripts/sync-map-tiles.py
python3 scripts/sync-map-labels.py
```

中文地名来自 `https://github.com/sh0wer1ee/TotkText` 的 1.2.1 游戏文字，固定快照 `1c66ac1a02edf2d73d10b0dc6f0f2de29da7b119`，`LocationMsg/Location/0000.json`–`0014.json`。按上游固定标记的 MessageID 精确匹配，730 个显示标签（地表 581、天空 48、地底 101），映射 911 个原始地点 ID。重复标签只在显示层去重；原始坐标和稳定 ID 保留。

天空地名高度恰好为 1000 的边界按上游 MessageID 判定。相同源哈希在地表与地底魔人像复用时，使用实际 xyz 对应记录，不能只凭哈希覆盖图层。源 `Bargainer` 图标不当作村镇；村镇与地区优先排版，细小地名可移动避让，但不改变真实坐标。排版偏移只改变标签位置。

离线生产验证在完全断网的浏览器中按 APK 相同本机源请求实际 `dist/` 文件，访问三层第 7 级四个未浏览角落、中文搜索、装备图标、教程与材料计划。APK 构建随后逐个比对资产与生产文件，避免完整网页包与安装包不一致。
