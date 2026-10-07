# 神庙中文名与视频入口来源

整理日期：2026-10-07。`public/data/shrine-guides.json` 覆盖 152 座神庙：地表 120、天空 32。

## 中文游戏文本

- 来源：`https://github.com/sh0wer1ee/TotkText`，固定提交 `1c66ac1a02edf2d73d10b0dc6f0f2de29da7b119`，游戏版本 1.2.1。
- 文件：`data/chunks/LocationMsg/Dungeon/0000.json`–`0003.json`。
- 以 `Dungeon000`–`Dungeon151` 对应键 `0000`–`0151` 的 CNzh / USen；谜题名使用 `2000`–`2151`。
- 英文名、Actor、稳定地点 ID 与图层均和原地图核对，不改坐标和收藏 ID。

## 视频分集

- 平台与作者：B 站，努力收集的A秋君。
- 合集：`https://www.bilibili.com/video/BV1Ru41147ca/`。
- 标题：《【塞尔达传说王国之泪】全152个神庙/神庙挑战位置解谜跑图宝箱全收集攻略》。
- 元数据：`https://api.bilibili.com/x/web-interface/view?bvid=BV1Ru41147ca`。
- 共 154 个分 P，前 2 个为索引，P3–P154 为 152 座神庙。每项保存 BVID、页码、CID、标题、作者、时长和核对时间。
- 匹配完整神庙名字字段，避免乔尼乌 / 乔乔尼乌、乔高乌 / 希哈乔高乌、诺乌达 / 塔尼诺乌达的子串错配。

`title-matched` 表示名称与平台分集标题、元数据相符，未逐集观看或在游戏中逐项实测。内容和平台可用性可能变化，保留 B 站名称搜索作为备用。

## 抖音与离线边界

未找到可逐座核对的完整抖音直接视频集，`douyinVideo` 为 `null`，直接视频数为 0。每项生成 `王国之泪 + 中文神庙名 + 攻略` 的 HTTPS 抖音搜索，界面写“抖音搜索”，不算已核验的视频。

目录和分集资料在离线包内；点击视频或搜索才交给外部浏览器 / 平台，需要网络。不嵌入播放器、不下载视频、不添加 APK 网络权限。视频权利归创作者，游戏文本归原权利人，只保存必要元数据和链接。

```bash
python3 scripts/sync-shrine-guides.py
python3 scripts/sync-shrine-guides.py --offline
```

原始响应缓存于忽略的 `.cache/shrine-research/`；来源记录每个文件 SHA-256。同步须满足 152 个唯一 Actor / 地点 / 分集、完整中文名匹配和 32 个天空神庙，否则停止。
