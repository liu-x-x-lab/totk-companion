# UI 视觉与资源

## 原创界面

视觉为海拉鲁探险手册：深玉石绿、暖纸色、金色细边，配圆环印记、几何刻线和物品栏底座。纹样保存在 `public/ui/ancient-ring.svg`、`public/ui/engraved-rule.svg`，以 SVG 和 CSS 实现，不从游戏界面截取装饰背景。

## 装备图标

- 上游：`https://github.com/TOTKSheet/TOTKImages`，装备资料表配套的物品图标仓库。
- 本地文件：`public/images/equipment/{ActorId}.png`。仅保存 310 件基础图鉴中存在且上游唯一匹配的图片。
- 来源快照、源路径、尺寸、大小、SHA-256 与核验时间：`public/data/equipment-icons-manifest.json`。
- 同步时核对上游提交与 Git 树、每张图片的 Git blob SHA、完整 PNG 分块校验和与尺寸。不是用相似图标代替同名装备。
- 强化防具沿用基础防具图标，强化等级和数值仍独立展示。历史未知对象显示类别符号；图标请求失败时也回退为类别符号。
- 图片在本地提供，懒加载，不依赖玩家访问 GitHub。仓库中的 `Armor/BOTW/` 表示沿用的物品外观，装备数值仍来自本项目《王国之泪》资料表。
- 游戏物品图像的权利归原权利人；上游来源记录用于追溯，不代表取得官方授权。此 App 为本地非官方辅助工具。

重新同步：

```bash
python3 scripts/sync-equipment-icons.py
```

## 实际页面预览

运行中的页面地址为本机 5178 端口；手机在同一局域网可访问该主机地址。运行 `node scripts/capture-preview.mjs` 保存 390 × 844 CSS px 的真实 Chromium 页面截图到 `docs/previews/`，包含地表、天空神庙、地底人马、装备和防具。`capture.json` 记录拍摄时间与视口。

预览为本地开发服务，当前未发布公网站点。

## 神庙与树根符号

- 来源：`zeldamods/objmap-totk` 提交 `3c37e5317c5fce3b4edf1bb2daf49c5607871a8f`，`public/icons/shrine.svg` 与 `lightroot.svg`，Git blob 均核对通过。
- 本地：`public/ui/map/shrine.svg`、`lightroot.svg`。保留形状路径、变换、填色与描边，移除模糊光晕及编辑器元数据，裁紧 viewBox。
- 为社区绘制的游戏地图符号，不声称官方导出。GPL-3.0 许可随包保存在 `public/licenses/objmap-totk-GPL-3.0.txt`；来源和转换哈希见 `public/data/map-icons-manifest.json`。
- 保留 44 px 点击范围，取消原圆底座；未点亮较暗，点亮恢复色彩并显示清楚的完成徽记。图标保持固定屏幕尺寸。
- 同步：`python3 scripts/sync-map-icons.py`，离线复现加 `--offline`。

## 原创 App 图标

用户已允许改用其他元素。0.1.3 的生产图标由项目原创绘制：玉石绿底色、断续暖金圆环、折叠地图、探索剑与导航光点。没有采用上次角色图；先前的审核拒绝没有说明具体原因，不将其断言为版权原因。

- 源文件：`public/icons/app.svg`。所有形状均为本项目绘制，未截取游戏徽章或角色素材。
- 导出：`public/icons/app-192.png`、`app-512.png` 和 `android/res/drawable/ic_emblem.xml`，网页与安卓使用相同路径和配色。安卓前景背景分离，主体留在中央安全区域。
- 同步：`node scripts/sync-app-icon.mjs`，使用项目已有 Chromium 导出 PNG；清单 `public/data/app-icon-manifest.json` 保存源文件和导出资源 SHA-256。构建时核对清单与安卓前景。
- 预览：`docs/previews/app-icon-variants.png` 为完整图标、两种裁切和 48 / 72 / 96 px 视觉检查，不是安卓真机截图。
- `docs/previews/app-logo-mobile.png` 来自实际 React 装备页，390 × 844 CSS px；页头图标保持原 36 px 尺寸，已核对服务提供的图标内容与本地清单一致。
- 本次内置 imagegen 也尝试了原创元素方案，但未返回可读的新文件。最终资源属于原创矢量绘制，没有调用 CLI / API，也没有把矢量或旧图标标为本次 AI 生成位图。
