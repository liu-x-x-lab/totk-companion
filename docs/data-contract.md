# 数据契约与接入规则

当前版本从 `public/data/points.json` 读取地点、从 `public/data/equipment.json` 读取装备，仓库接口定义在 `src/data/repository.ts`。页面从仓库异步读取，不直接绑定第三方网站结构。示例文件 `demo.ts` 不进入运行仓库；地点社区来源为 `unverified`，装备 `verified` 表示已对照资料表与解析结果，不声称逐点或逐件完成游戏内核验。

## 来源

```ts
interface DataSource {
  name: string;
  status: 'demo' | 'unverified' | 'verified';
  url?: string;
  gameVersion?: string;
  checkedAt?: string;
}
```

真实来源除以上字段还应在数据清单中记录许可或使用条件、上游版本、更新日期和资源校验和。地点来源和坐标约定见 `docs/sources.md`；装备来源、版本边界与对照差异见 `docs/equipment-sources.md`。

## 地图

- 图层枚举：`sky`、`surface`、`depths`。
- `mapPosition` 是当前地图资源中 0–1 的归一化横、纵位置，原点在图片左上角。
- `gameCoordinates` 可为 `null`；不从演示归一化坐标编造真实游戏坐标。
- 真实数据接入时通过地图资源边界及转换函数，将游戏坐标映射到像素或瓦片坐标。
- 当前底图为上游三层真实地图瓦片，三层层级 2–7 全部保存在本机，运行时只请求包内路径；`offline-map-manifest.json` 记录完整范围和逐文件 SHA-256。
- 正式地图需要分辨率、边界、层级、归属图层、数据版本等元信息。

## 地点与怪物

稳定 ID 与显示名称分离。地点包括：ID、名称、图层、类别、地图位置、可空游戏坐标、地区、描述、来源。怪物地点额外带 `monsterType` 和可选等级、掉落列表。一个怪物种类可以有多个地点。

收藏使用实体类型与 ID 组合，不以数组索引或中文名称为键。替换数据源时保留稳定 ID，或提供显式迁移。

实际世界 ID 使用 `obj:<Hash>` / `loc:<Hash>`；原始坐标为东、高、南，界面参考坐标为东、北、高，即 `[X, -Z, Y]`。地图归一化与瓦片边界见 `docs/sources.md`，画布宽高比例 6:5。聚合只改变显示，不删除原始记录。

压缩索引包含 `strings` 字典和 `rows`：`[id, 名称索引, 分类, 图层, 原始X, 原始Y, 原始Z, 地区索引, 对象名索引, 来源对象ID, 可选关联物品名称索引列表]`。贤者的遗志和古旧地图由原始宝箱物品字段分类，其余宝箱归入普通宝箱。

## 装备

类别包括 `one-handed`、`two-handed`、`spear`、`bow`、`shield`、`armor`。保留原始 Actor ID、中文名、英文名、形态、游戏显示攻击、内部基础攻击、盾 / 防具防御、基础耐久、说明与来源。

所有未知或不适用属性以 `null` 表示，已知的 0 不转成未知。`variant` 为 `standard` / `pristine` / `decayed`；同名腐朽与无腐蚀武器保留不同 ID。`attackRange` 表示条件攻击范围，魔王之弓不填写任意固定 `attack`。

防具 `baseDurability` 为 `null`，`armorLevels` 保存 0–4 星防御、升级材料和卢比费用；不可强化防具只保存 0 星。全身防具用 `armorSlot: full`，费用与材料保留整体值。`modifiers` 保存带对应词条后的数值区间，不当作额外增量；`fuseExtraDurability` 为武器参数上限，完整融合规则另行建模。

装备包含 `items`（310 个基础条目）、`aliases`（413 个强化 / 外观 ID）和 `legacyNames`（52 个无独立属性的历史名称）。`decodeEquipment` 验证后扩展为 775 个可解析 ID；普通图鉴只显示 `catalogEntry: true` 的条目。历史收藏定位时可显示对应别名，原 ID 与玩家备份格式保持不变。

## 装备图标

装备显示层可包含 `iconId`，基础装备采用自己的 Actor ID，强化 / 外观条目继承对应基础装备 ID。它不替代存档中的装备 ID，也不改变防御或耐久。图标来源单独记录在 `equipment-icons-manifest.json`，包含固定上游提交与 Git 树、原始路径、图片尺寸、文件大小和 SHA-256；没有独立核验图标的历史条目不设置 `iconId`。

## 玩家记录

手动耐久记录包含独立实例 ID、装备 ID、最大耐久、当前耐久和创建时间。用户可创建同一装备的多个实例。验证 `1 <= maximum <= 9999` 与 `0 <= current <= maximum`，不根据演示资料自动声称游戏中的当前耐久。

新记录的最大值与当前值默认预填已知基础耐久，用户可以修改；这只是表单默认值，不是读取主机当前耐久。

本地记录格式：

```json
{
  "schemaVersion": 1,
  "favorites": ["poi:demo-bokoblin-camp", "equipment:demo-sword"],
  "durabilityRecords": [],
  "exportedAt": "2026-10-07T00:00:00.000Z"
}
```

导入必须校验版本、记录字段、范围和重复 ID，失败不得覆盖已有记录。导入成功后以备份替换当前记录，并明确提示。数据源中暂不存在的收藏保留在备份中，界面显示“资料暂不可用”并允许取消。

## 地名与任务

`map-labels.json` 包含 730 个显示标签及 911 个原始地点 ID 的中文映射。地名用 MessageID 匹配 1.2.1 游戏中文文本，保留原名、图层、坐标及来源 ID。显示去重不删除地点；同一个源哈希在不同层复用时按原始 xyz 与实际点位匹配。文字在屏幕上保持固定尺寸，布局随倍率避让，村镇和地区优先显示。

`quests.json` 含 `total`、类别统计、`tutorialTotal`、来源快照及 253 个 `quests`。每项以游戏任务 ID 保存简体中文/英文标题与类别。`guideStatus` 为 `tutorial`（35 篇）或 `index`（218 项）；全部 23 个主线已有教程。教程由项目整理动作摘要，包含起点、前置、准备、后续任务及阶段 `id/title/actions/messageId?`，不导出完整游戏剧情日志。

地图关联使用地名 MessageID 对应的原始地点 ID；此坐标是村镇或遗迹所在区域，不伪装成接任务人物的精确坐标。阶段完成状态为手动记录；不存在于现行教程的旧阶段 ID 保留备份但不计入完成数。

## 新增玩家记录与兼容

继续使用 `schemaVersion: 1` 和原存储键。旧备份没有下列字段时补默认空值，新备份同时保存：

```json
{
  "questProgress": [{"questId":"GetCamera","completedStageIds":["chasm"]}],
  "armorPlans": [{"equipmentId":"Armor_001_Head","currentLevel":2,"targetLevel":4}],
  "ownedMaterials": {"actor:Item_Ore_F":20,"currency:rupees":100}
}
```

升级范围为整数 `0 <= currentLevel < targetLevel <= 4`，每件基础防具最多一个计划，别名/不可强化防具不进入计算。只累加 `currentLevel < level <= targetLevel` 的记录；缺失等级不输出部分总数。材料优先以 `actor:<ID>` 合并，无 ID 时以 `name:<规范化原始名>` 合并，卢比用 `currency:rupees`。持有量为 0–999999 整数，缺口取 `max(0, 总需求 - 已有)`，费用保留全身防具的整体值。

导入限制最多 200 个计划、1000 个任务、每任务 100 个阶段和 2000 个持有数量键；拒绝重复 ID、非法范围、非整数数量和异常结构。导入前预览全部记录数量并由用户确认替换。任务进度与材料持有量不代表 Switch 实时存档。
