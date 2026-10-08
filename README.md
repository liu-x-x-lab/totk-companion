# 海拉鲁探险手册 · 王国之泪辅助 App

主要在安卓手机使用的中文探索助手。地图、地点、装备和已有任务教程全部随离线 APK 打包，无需账号或服务器。

## 启动与构建

```bash
cd /data/totk-companion
npm ci
npm run dev                # 0.0.0.0:5178，手机局域网预览
npm run check              # 类型、业务测试、生产构建
npm run test:e2e           # 手机布局与手势
npm run test:offline       # 生产资源完全断网验证
npm run build:android      # Android SDK / JDK 17 本机打包
python3 scripts/serve-releases.py --port 8788  # 局域网 APK 下载页
```

环境：Node.js 22.12+。浏览器测试首次使用需 `npx playwright install chromium`；安卓构建需 platform 35、build-tools 34.0.0 和 JDK 17。支持 Android 8.0+，安装说明见 [offline-install.md](docs/offline-install.md)。APK、离线网页 ZIP 和校验文件生成在 `releases/`，密钥在忽略的 `.cache/android/signing/`，后续覆盖更新需保留密钥。

## 功能与覆盖

- 地图铺满导航上方的屏幕，最小缩放覆盖视口，四向拖动不露出留白；支持双指、按钮、1–64 倍、横竖屏与视野保留。
- 地表、天空、地底所有 2–7 级瓦片共 29,835 张保存在本机，第一次去任何区域也能离线放大。没有联网瓦片回退。
- 730 个中文地名，缩放时文字保持可读，可开关、搜索；怪物过滤与地名显示独立。
- 54,793 条固定地点，西诺克斯系列 69、人马 34（地表 15、地底 19）、神庙 152、树根 120；怪物、收集、洞窟、材料、装备拾取等分类与聚合。
- 神庙、树根使用本地矢量地图符号，可手动点亮；其他地点可标记完成或撤销，按“只看未完成”筛选，刷新保留。
- 152 座神庙的中文名、谜题名与 B 站对应攻略分集；抖音按名称搜索。目录离线可查，视频在外部平台联网播放。
- 900 个呀哈哈任务按 24 类筛选，100 个搬运任务显示背包起点、朋友终点、坐标与方向连线，两端共用一条完成记录。
- 搜名称、地区或坐标，查看和复制东/北/高与原始坐标，列表跳地图；完整地点 CSV 可导出。
- 310 件基础装备及本地对应图标，攻击/防御、基础耐久、腐朽/无腐蚀、弓箭数与词条区间；保留全部 775 个历史 ID。
- 135 件防具及 547 个等级记录，逐星强化材料、防御和卢比。多件升级范围自动合并，填写已有量，查看缺口，刷新保存。
- 253 项任务目录，35 篇离线教程覆盖全部 23 主线和 12 项实用任务；接取、前置、准备、阶段操作、地图跳转与手动进度。218 项仅索引明确标注待整理。
- 收藏、地点点亮与完成、手动耐久、任务阶段、升级计划和材料数量统一备份；旧备份兼容，导入预览后确认替换。
- 玉石绿、纸色、金色刻线与原创古代圆环；紧凑而可读的手机文字，触控至少 44px。
- 原创探索 App 徽章，网页、主屏幕 Manifest 与 Android 自适应桌面图标同步，保留小尺寸清晰度。

资料是社区固定放置记录，不表示当前游戏中的实时生成、等级、剧情状态或巨龙位置。装备耐久为基础值，实际剩余耐久手动填写；完整融合规则和主机存档读取不在本轮实现范围。任务教程和克洛格类型提示为整理的行动摘要，未进行游戏内逐点实测。神庙视频核对了完整名称与分集标题，未逐集观看。资料来源见 [sources.md](docs/sources.md)、[equipment-sources.md](docs/equipment-sources.md)、[quest-sources.md](docs/quest-sources.md)、[shrine-video-sources.md](docs/shrine-video-sources.md)、[korok-sources.md](docs/korok-sources.md)。

安卓容器不申请网络或共享存储权限；备份和 CSV 用系统文件选择器，复制坐标用本机剪贴板。外部参考链接由手机浏览器打开，需联网。浏览器自动化、原生编译和 APK 签名/资产验证已纳入交付流程；当前环境未连接安卓真机，安装与文件选择器仍待手机实测。

## 效果截图

截图来自运行中的 React App，390 × 844 CSS px，使用 `node scripts/capture-preview.mjs` 更新。

[满屏地图](docs/previews/map-mobile.png) · [沉浸地图](docs/previews/map-immersive-mobile.png) · [装备](docs/previews/equipment-mobile.png) · [任务手册](docs/previews/quests-mobile.png) · [阶段教程](docs/previews/quest-guide-mobile.png) · [升级计划](docs/previews/armor-planner-mobile.png) · [合并材料](docs/previews/armor-materials-mobile.png)

0.1.4 手机远景聚合不再铺满数字，点击区域标记或双击即可进入细节。真实 390 px 页面：[优化前](docs/previews/map-overview-before-390.png) · [远景](docs/previews/map-overview-390.png) · [点一次放大](docs/previews/map-region-390.png) · [收起工具](docs/previews/map-overview-immersive-390.png)。

[神庙点亮](docs/previews/map-shrine-lit-mobile.png) · [神庙视频入口](docs/previews/map-shrine-video-mobile.png) · [搬运克洛格](docs/previews/map-korok-carry-mobile.png)

[App 图标及裁切预览](docs/previews/app-icon-variants.png) · [实际手机页头](docs/previews/app-logo-mobile.png)

## 项目结构

```text
src/app/                 应用壳与五栏导航
src/features/map/        满屏地图、地名、手势与坐标
src/features/equipment/  固定图鉴、手动耐久与防具备料
src/features/quests/     目录、阶段教程与地图关联
src/features/monsters/   怪物分布列表
src/features/saved/      收藏、统一备份与兼容恢复
src/data/                本地资料解析和玩家记录
public/maps/             三层完整离线瓦片
public/data/             来源清单、JSON 和 CSV
android/                 本机 WebView 容器与系统文件接口
scripts/                 资料更新、离线验证、截图和 APK 构建
docs/                    需求、来源、设计与安装说明
```

## 更新资料

```bash
python3 -m pip install -r scripts/requirements-tools.txt
python3 scripts/sync-data.py --tiles
python3 scripts/sync-map-labels.py
python3 scripts/sync-map-tiles.py
python3 scripts/sync-equipment.py
python3 scripts/sync-equipment-icons.py
python3 scripts/sync-quests.py
python3 scripts/sync-map-icons.py
python3 scripts/sync-shrine-guides.py
python3 scripts/sync-korok-guides.py
node scripts/sync-app-icon.mjs
```

地图资源脚本使用 Pillow 校验图片与完整边界；其余生成脚本主要使用 Python 标准库。原始快照在 `.cache/`，输出保留 SHA-256。来源变动导致断言失败时先核对资料，不直接放宽完整性条件。React、TypeScript 和 Vite 前端，不需要后端。
