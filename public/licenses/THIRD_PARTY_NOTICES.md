# 第三方资源与许可说明

本项目自行编写的源代码、原创界面纹样和原创 App 徽章采用 **GPL-3.0-only**，完整条款见 [LICENSE](LICENSE)，版权与适用范围见 [NOTICE](NOTICE)。第三方资源保留原有权利和条款；本项目的源码许可不向使用者授予游戏地图、图片、商标或游戏文字的额外权利。

## 软件与社区符号

| 资源 | 使用范围 | 来源与许可 |
| --- | --- | --- |
| React、React DOM | 前端运行时，依赖通过 npm 安装 | Meta Platforms, Inc. and affiliates；MIT，原样许可保存在 `public/licenses/react-MIT.txt`、`react-dom-MIT.txt` |
| 神庙、树根 SVG | `public/ui/map/shrine.svg`、`lightroot.svg` | [ZeldaMods / objmap-totk](https://github.com/zeldamods/objmap-totk)，快照 `3c37e5317c5fce3b4edf1bb2daf49c5607871a8f`；GPL-3.0，原样上游许可保存在 `public/licenses/objmap-totk-GPL-3.0.txt` |
| 中文装备名称词条 | `equipment.json` 与 CSV 中按 Actor ID 匹配的名称 | [Marc Robledo / savegame-editors](https://github.com/marcrobledo/savegame-editors)，词条署名 tingod、eUnisk、rcyggdra；上游 MIT 许可原样保存在 `public/licenses/savegame-editors-MIT.txt` |

SVG 修改包括移除模糊光晕和编辑器元数据、裁紧 viewBox；形状路径、变换、颜色和描边保留。源地址、原始 Git blob、原始及修改后 SHA-256 均记录于 `public/data/map-icons-manifest.json`；修改源文件和复现脚本 `scripts/sync-map-icons.py` 随本仓库公开。

其他构建和测试工具（TypeScript、Vite、Playwright 等）按 `package-lock.json` 安装，保留各自包内许可。

## 游戏内容与数据

| 内容 | 本地位置 | 来源记录 |
| --- | --- | --- |
| 三层地图瓦片、固定对象与探索地点 | `public/maps/`、`public/data/points.json`、`coordinates.csv`、`korok-guides.json` | ZeldaMods / TotK Object Map；见 `docs/sources.md`、`docs/korok-sources.md` 及逐文件来源清单 |
| 装备物品图片 | `public/images/equipment/` | [TOTKSheet / TOTKImages](https://github.com/TOTKSheet/TOTKImages)；固定提交、原始路径与哈希见 `equipment-icons-manifest.json` 和 `docs/ui-assets.md` |
| 地名、任务和神庙名称、谜题名 | `map-labels.json`、`quests.json`、`shrine-guides.json` | [sh0wer1ee / TotkText](https://github.com/sh0wer1ee/TotkText)，1.2.1 文本快照；见各来源文档 |
| 装备参数、耐久、防具强化数值 | `equipment.json`、`equipment.csv` | Phil、Echocolat 的公开资料表及参数对照；见 `docs/equipment-sources.md`、`equipment-manifest.json` |

这些游戏内容属于 Nintendo 及相应权利人，资料整理者的来源和署名也应保留。公开资料入口和哈希校验不代表取得官方授权，也不把这些素材改为 GPL。涉及游戏图片、提取文字或数据汇编的再次分发，请依据对应权利和上游条款判断；无法从本项目源码 LICENSE 推导出授权。

## 攻略、视频与项目原创内容

- 阶段教程与克洛格中文操作提示为项目整理的行动摘要，参考链接随条目及 `docs/quest-sources.md`、`korok-sources.md` 保留；游戏名称和原始事实仍保留其来源。
- 神庙视频属于 B 站创作者“努力收集的A秋君”，项目仅保存必要元数据和外部链接，不包含视频文件；目录来源见 `docs/shrine-video-sources.md`。
- `docs/previews/` 是项目页面截图，包含的第三方地图与游戏图像仍归相应权利人；截图不作为纯原创素材重新许可。
- 原创 App 徽章、圆环纹样与界面装饰的源文件和清单见 `docs/ui-assets.md`、`public/data/app-icon-manifest.json`，适用本项目源码许可。

本项目为非官方游戏辅助工具，与 Nintendo 无官方关联。各来源记录用于追溯，不构成对未知授权的承诺。
