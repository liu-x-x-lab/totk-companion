# Fullscreen Map Implementation Plan

**Goal:** 地图填满手机可用屏幕，把工具与资料面板浮在地图上。

**Architecture:** 应用壳仅在地图页启用固定视口布局，地图与浮动工具、筛选、底部面板分层。相机以覆盖视口作为初始与最小状态，保留 64 倍上限；缩放、四向拖动、图层切换与屏幕旋转均不露出空白。

**Tech Stack:** React、TypeScript、CSS 动态视口与安全区、Playwright。

---

1. 在 `src/features/map/geometry.test.ts` 增加竖屏 / 横屏覆盖视口、边界与旋转的几何验收，实现 `coverCamera`、严格边界和 `resizeCamera`。在 `MapCanvas.tsx` 用覆盖相机初始化与复位，不提供会产生留白的全图模式。
2. 在 `App.tsx` 给地图页添加布局状态，保留数据加载公告。重排 `MapPage.tsx`，加入可收起工具栏、浮动分类以及结果 / 详情底部面板。
3. 在 `src/styles/global.css` 定义全视口画布、安全区、浮层大小与独立滚动。面板展开不改变地图尺寸；地图页不出现页面纵向滚动。
4. 更新 `tests/e2e/mobile.spec.ts`，校验地图边界、底部面板、工具收起与导航往返，并保留缩放、分类、定位、收藏和耐久回归。
5. 运行 `npm run check`、`npm run test:e2e`，用 `scripts/capture-preview.mjs` 更新真实截图，完善需求文档并提交改动。保持本地预览服务运行。
