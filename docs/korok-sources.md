# 呀哈哈与克洛格任务来源

整理日期：2026-10-07。`public/data/korok-guides.json` 保留原地图的 900 个稳定任务 ID：地表 841、天空 59。

## 任务分类

- 来源：`https://objmap-totk.zeldamods.org/`。
- 查询：`https://radar-totk.zeldamods.org/objs/MainAndMinusField/?q=Korok&limit=-1`。
- 原查询含很多关联植物和物件，只采用带 `korok_type` 的 900 个任务，再对照静态标记的完整 Hash、代码和图层。
- 800 个普通谜题、100 个搬运任务，24 类，共 1000 颗克洛格果实；任务数和果实数分开。
- 单果实 / 双果实奖励规则另对照 Nintendo Life 的完整攻略 `https://www.nintendolife.com/guides/zelda-tears-of-the-kingdom-all-korok-seed-locations`，并非从对象位置字段推算奖励。
- 中文类型和小提示由项目整理，不声称逐点游戏内实测。源未声明版本，保留 `gameVersion: null` 与社区资料 `unverified`。

## 搬运起点和朋友

100 个 `KorokCarryPassenger_Pair` 从 `https://radar-totk.zeldamods.org/obj/{objid}/` 读取完整对象。它的 `Reference Links` 精确关联一个 `KorokCarryProgressKeeper` 和一个 `KorokCarry_Destination`；按 Hash 关联，不用最近距离猜测。

源静态标记是朋友 / 终点，保留原 ID 和终点坐标，另存背包克洛格的起点。两端共用一条任务完成记录，不新增主地点数。地表 98 对，天空 2 对（GSI04、GSI17）。

RP38 示例：任务 `loc:0x95684aa7a4c3b176`；背包对象 `obj:0xf8dfc9c1fe5fe676` 约 `-4260, 2175, 95`；朋友 `obj:0xb79cbdf0366c45af` 约 `-4116, 2416, 92`。原始 `[X,Y,Z]` 转界面 `[X,-Z,Y]`。数字坐标搜索两端均可匹配。

连线仅提示方向，玩家根据地形安排搬运路线。神庙 / 树根可手动点亮，其他地点可完成、撤销并筛选未完成，状态独立于收藏，不读取 Switch 存档。

```bash
python3 scripts/sync-korok-guides.py
python3 scripts/sync-korok-guides.py --offline
```

原始查询与 100 个详细对象缓存于忽略的 `.cache/korok-research/`，目录保留 101 个源文件的地址、SHA-256、核对时间和边界。同步须满足 900 个唯一任务、24 类、100 个唯一关联和坐标一致性。
