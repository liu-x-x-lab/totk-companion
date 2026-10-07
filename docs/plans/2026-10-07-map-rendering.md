# Android Map Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复用户 APK 截图中的地图缺块、缩放卡顿和文字 / 标记模糊，完成优化后发布可覆盖安装的 0.1.1。

**Architecture:** 用原生图片瓦片在屏幕范围内裁切、合成地形，不再缩放一个含所有图片和文字的巨大 DOM 层。包内瓦片经解码后进入有上限的缓存，概览常驻，高清加载期间沿用已解码的各级地形。文字与 SVG 标记以屏幕像素定位；手势逐帧合并，聚合及地名布局低频更新并在手势结束时刷新。

**Tech Stack:** React 19 / TypeScript、原生图片合成、requestAnimationFrame、包内 WebP、Playwright / Node tests、原签名 Android WebView APK。

---

## 调查证据与设计选择

- 用户截图：地底、103%、中心约 1817 / -98，阶梯状深绿色缺块；不能把本来就是黑色的地底区域视为缺图。
- 现有包内 29,835 张瓦片及签名包资源校验完整，没有证据表明用户安装包缺资源。
- Pixel 7（DPR 2.625）复现：原生 256 px 瓦片显示为约 417 物理像素，级别计算遗漏 DPR。
- 阻塞下一级瓦片：原先解码的高清层保留数量变成 0，新层 naturalWidth 为 0；概览虽可回退，细节立即丢失。
- 原 DOM 概览包装层高度为 0。主层永久 will-change:transform；文字反向缩放。最大倍率主层约 59,597 × 49,665 CSS px。
- 4 倍 CPU 限速、全元素拖动 / 放大基线：419 次帧间隔中 104 次超过 34 ms，最大 200 ms，118 次主层样式更新、97 个长任务。此诊断是浏览器样本，不代表手机帧率。
- 桌面未能复现 Android GPU 的同形状缺块；确定存在质量 / 衔接 / 主线程问题，但不能宣称已经真机定位 GPU 驱动故障。视口绘制方案消除巨大缩放层及其不确定性，真机体验需要用户复测。

方案比较：只修 CSS 和旧层保留改动小，但继续依赖巨大缩放层；引入地图框架迁移成本高。最初验证视口 Canvas，生产性能比较发现每帧整屏重绘明显更慢，最终采用视口裁切的原生图片合成；继续使用现有地图投影、三层资料、筛选、点击与持久化。

## Task 1: 建立可失败的回归

**Files:** Create `tests/e2e/map-rendering.spec.ts`; Create `src/features/map/rendering.test.ts`。

1. 高 DPR 验证绘制分辨率 / 瓦片密度；地名和标记没有任何缩放祖先，44 px 点击区固定。
2. 阻塞新层图片，验证旧层仍绘制、画布不出现未绘制的透明矩形；释放后高清完成。
3. 快速双指缩放、图层切换及四角拖动，检查画布内容和覆盖，不以空的图片数组假通过。
4. 单测每帧合并、动画打断 / 结束；瓦片级别、边界、预取和缓存解码 / 并发 / 淘汰。
5. Run `npx playwright test tests/e2e/map-rendering.spec.ts`; 旧渲染应失败。

## Task 2: 瓦片解码与屏幕绘制

**Files:** Create `src/features/map/tile-grid.ts`, `src/features/map/tile-cache.ts`, `src/features/map/TileRenderer.ts`; Modify `src/features/map/Tiles.tsx`。

1. 级别采用屏幕实际物理像素：`ceil(log2(WORLD_SIZE * scale * pixelRatio / 24000) + 7)`，限制 2–7。
2. 瓦片空间边界仍是原地图 24000 × 20000，预取一圈；按 DPR 选择足够的瓦片分辨率，过大视口限制细节像素总量。
3. 最多 8 个并发读取，概览优先；未 decode 的图片不参与绘制。已解码瓦片保留至 LRU 淘汰，概览及当前可见细节优先保留。
4. 按级别由低到高原生合成，移动只更新图像位置；没有新高清时仍绘制旧地形。瓦片物理像素边界向外取整消除细缝。
5. 读取失败有限重试，保留回退地图；仅明确最终缺失后显示资源提示。切层 / 卸载清理回调。

## Task 3: 手势与清晰叠加层

**Files:** Create `src/features/map/camera-motion.ts`; Modify `MapCanvas.tsx`, `MapLabels.tsx`, `clustering.ts`, `src/styles/global.css`。

1. 合并一帧内多次指针 / 滚轮事件；缩放按钮约 180 ms 渐变，遵守减少动态效果偏好。触摸开始立即打断动画。
2. 地形与叠加坐标由同一帧驱动。DOM 地名、矢量图标均为固定屏幕尺寸，只移动位置，按物理像素对齐。
3. 地点建立空间索引；密集聚合和地名避让约 100 ms 刷新，松手立即刷新，完整地点不丢弃。
4. 保留最小覆盖、64 倍上限、缩放锚点、单指 / 双指、选中、定位、恢复、旋转和层切换。
5. Run focused Node and Playwright regressions; compare同条件 CPU 限速轨迹，并保存高 DPR 截图。

补充：图片边缘透明填充仅在首次解码时裁切，避免边缘半透明像素。裁切容器大小始终不超过视口；缓存按实际可见数量在 192–384 个解码图像之间调整，最多 8 个并发。正常手机保持原生 DPR，超大视口有 500 万细节像素预算。

## Task 4: 验收与发布

**Files:** Modify `scripts/verify-offline.mjs`, `scripts/capture-preview.mjs`, `package.json`, `package-lock.json`, `android/AndroidManifest.xml`, `scripts/build-android.py`, `docs/offline-install.md`, `docs/requirements.md`; Add validation report。

1. 将生产断网验证改为检查真实 已解码图片对屏幕的真实覆盖 / 当前可见高清瓦片状态，使用手机 DPR；确认三层首次进入四角均无需外网。
2. Run `npm run check`, `npm run test:e2e`; 仅有新失败或改动时再次运行相关检查。
3. 版本 0.1.1 / versionCode 2，保持包名、origin、数据结构和签名密钥；Run `python3 scripts/build-android.py`。
4. 检查签名与旧包相同、包内资源全量、版本码递增、局域网完整下载的字节数及 SHA-256。
5. 更新现有 8788 下载页 / 说明，保持服务运行，提交源码和测试 / 文档，不提交资源、密钥或安装包。

**验收边界：** 没有连接安卓设备；不能把桌面高 DPR、CPU 限速和合成触摸验证描述成安卓真机测试。最大倍率超出原地形原生分辨率后，地形本身不能无限清晰；文字与矢量标记保持屏幕原生尺寸。
