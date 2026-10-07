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
