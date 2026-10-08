# 手机远景地图 Implementation Plan

**Goal:** 最小倍率不再铺满聚合数量，手机可直接点区域或双击进入细节。

**Architecture:** 在现有空间索引之上分级聚合，邻近质心合并以避免触控重叠；共享相机继续逐帧绘制，点击 / 双击只改变相机目标，不删地点。地图文字保持固定尺寸，离线资产和玩家数据兼容。

**Tech Stack:** React 19、TypeScript、原生 Pointer Events、Node test、Playwright、现有 Android WebView 构建。

---

1. 在 `src/data/world-data.test.ts` 增加真实三层远景预算、无损与相邻网格测试，在 `tests/e2e/map-overview.spec.ts` 增加 360 / 390 px 数字简化与点聚合至少 400% 的回归，先运行确认旧行为失败。
2. 修改 `src/features/map/clustering.ts`：按倍率分配屏幕网格预算；在世界像素上划分网格，拖动不改变网格原点；仅合并触控过近的普通组；保留选中点和每条可见记录；增加根据组范围计算目标相机的函数。
3. 修改 `src/features/map/MapCanvas.tsx`、`src/features/map/MapPage.tsx`、`src/styles/global.css`：远景区域图标、中近景 `99+`、可用视野定位；通过指针开始 / 结束记录实现双击，拖动和多指清除候选；更新提示。
4. 执行 `node --experimental-strip-types --experimental-test-isolation=none --test src/data/world-data.test.ts`、地图 E2E 子集，再执行 `npm run check` 与 `npm run test:e2e`。只在失败或新风险时追加验证。
5. 用 `.cache/verification/zoom-density.mjs optimized` 重拍前后对照，并在 `docs/previews/` 保存优化后的真实远景 / 区域截图和参数。
6. 更新 `package.json`、`package-lock.json` 与 `android/AndroidManifest.xml` 至 0.1.4 / 5，执行 `python3 scripts/build-android.py`。此流程自带资源完整性和生产断网检查，不读取签名文件。
7. 恢复仅服务 `releases/` 的 8788 局域网下载服务，验证 APK 全量 SHA-256 与下载页。更新需求 / 验收文档，提交源代码并给出覆盖安装下载地址。

用户已要求先优化后打包，本计划在当前会话自主执行，不另启代理或审批流程。
