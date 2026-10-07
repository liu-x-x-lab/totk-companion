# 装备属性与耐久资料来源

接入日期：2026-10-07。生成资料为公开参数整理表中的事实与数值，不包含上游代码或装备图片。游戏内容归原权利人；中文名称保留整理者来源。

## 原始资料

- Phil 的 TotK Data Spreadsheet：`https://docs.google.com/spreadsheets/d/1fBvQ17WHP3ASgtO8ode_rf1g4DfEHErMrHwwLppNTJM/edit`。ReadMe 明确说明是整理后的游戏参数资料，供玩家与开发者使用；本项目导入 Weapons、Bows、Shields、Armor、Materials 的数值字段。
- Echocolat 的 TotK Data Sheet v5：`https://docs.google.com/spreadsheets/d/18pNtDx3z-8CwGJRmlW574xbQ6VphQOkvpZhClpOEVDA/edit`。用于对照攻击、防御、耐久和防具升级费用；作者说明此表已停止更新，并推荐 Phil 表。
- 中文名称：`https://github.com/marcrobledo/savegame-editors/blob/master/zelda-totk/locale/zelda-totk.locale.zh.js`。署名 tingod、eUnisk、rcyggdra，按 Actor ID 读取简体中文词条。只解析静态词条，不执行下载的 JavaScript。
- 差异参考：`https://github.com/savage13/totk-dc/blob/main/src/weapon_data.json`。该项目由 Phil 原始伤害计算器派生，相关参数资源标为 Product.142；本次用于对照朽坏大师之剑的耐久 4，不视为独立游戏内测试。

`public/data/equipment-manifest.json` 保存完整来源地址、快照 SHA-256、生成时间、数量和差异。原始表没有统一声明所有字段对应的游戏版本，清单 `gameVersion` 保持 `null`，不以抓取日期冒充游戏版本。

## 覆盖与对照

基础图鉴共 310 个条目：单手 43、双手 36、长柄 33、弓 30、盾 33、防具 135。全部有中文名和英文名。防具含 547 个等级记录，413 个强化 / 外观别名；另保留 52 个历史剧情、NPC 或外观名称，合计原有 775 个稳定 ID。

两份原始表对照 1,005 个可直接比较的数值字段，1,004 个相同。朽坏大师之剑的 Phil 耐久为 4、Echo 为 6；采用 Phil 的 4，参考数据包也为 4，界面和清单保留旧表差异。`verified` 表示数据表对照与导入校验已完成，尚未逐件在游戏内测量。

## 数值约定

- 近战主数值采用游戏显示攻击。双手武器和长枪的内部参数另存，不直接替换面板值。
- 腐朽与无腐蚀按不同 Actor ID 保留；例如旅人之剑分别为 5 / 16 与 7 / 20（攻击 / 基础耐久）。
- 基础耐久不包含词条、融合或使用时的特殊消耗。词条区间为带词条后的完整数值，融合额外耐久为武器参数上限；完整融合计算尚未实现。
- 魔王之弓根据红心上限增加攻击，采用表中 2–60 的范围与规则；基础耐久仍为 42。旧表中的常数 25 不作为当前固定攻击。
- 大师之剑采用常态基础攻击 30、耐久 40，并注明特殊状态、恢复与融合例外；不会把特殊战斗数值当作常态值。
- 弓的攻击按每箭显示，连射箭数单独记录。盾防御是 Guard Strength；防具防御按部位记录，全身防具保留整体值。
- 每个防具升级等级的材料与费用独立保存。古代勇者之魂为全身防具，一级费用 30 卢比，不能统一按普通单件的 10 卢比处理。残旧发夹的防御 0 是已知值，不是缺失。

## 更新与导出

```bash
python3 scripts/sync-equipment.py
python3 scripts/sync-equipment.py --offline
```

仅使用 Python 标准库。联网更新原始快照到 `.cache/equipment/`，离线模式从该缓存重建。脚本检查列名、条目数、名称覆盖、数值差异与别名关联，再生成 `equipment.json`、`equipment.csv` 和 `equipment-manifest.json`。异常的新差异会中止更新，核对来源后再调整基线。

CSV 包含全部 310 个基础条目，强化等级和词条区间用 JSON 单元格保留。装备页提供下载入口。旧收藏与手动记录不迁移、不删除，仍按原 ID 解析。
