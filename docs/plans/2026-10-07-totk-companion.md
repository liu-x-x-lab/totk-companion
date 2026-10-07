# 王国之泪辅助 App Implementation Plan

> **For Codex:** 按本计划逐项直接实施。用户已授权项目初始化，无需另开会话；本环境没有 superpowers 执行技能，采用现有工具完成。

**Goal:** 建立可运行的手机优先辅助 App 项目、需求基线、模块结构和演示交互。

**Architecture:** 使用前端应用壳和按功能分组的模块。地图手势与领域数据独立；演示仓库可被真实资料实现替换。收藏与手动耐久通过版本化本地存储持久化。

**Tech Stack:** React、TypeScript、Vite、Node.js 内置测试、Playwright、CSS、SVG。

---

### Task 1: 项目基线和需求

创建 `README.md`、`AGENTS.md`、`docs/requirements.md`、`docs/data-contract.md`、`docs/roadmap.md` 和设计文档。初始化独立 Git 仓库，不改其他项目。

### Task 2: 工具配置

创建 `package.json`、`tsconfig.json`、`vite.config.ts`、`playwright.config.ts`、`index.html`、`src/main.tsx`、`public/manifest.webmanifest` 和自有图标。安装依赖并生成锁文件。`npm run dev` 使用 5178 端口；`npm run preview` 使用 4178。

### Task 3: 数据与记录

创建 `src/types/domain.ts`、`src/data/demo.ts`、`src/data/repository.ts`、`src/hooks/usePlayerData.ts`、`src/data/player-data.ts` 和 `src/data/player-data.test.ts`。使用稳定 ID 与可空属性；示例来源标为 `demo`。实现校验、持久化、导出与导入。

运行 `npm run test`，验证非法版本、超范围耐久和重复 ID 被拒绝，合法备份能恢复。

### Task 4: 地图几何与手势

创建 `src/features/map/geometry.ts`、`src/features/map/geometry.test.ts` 和 `src/features/map/MapCanvas.tsx`。归一化位置映射到固定 SVG 坐标。支持单指拖动、双指中心锚点缩放、按钮缩放、滚轮、复位和目标定位。

运行 `npm run test`，验证缩放后锚点不漂移、最小最大缩放限制与双指平移。初始地图仅显示示意图。

### Task 5: 手机应用壳与业务页面

创建 `src/app/App.tsx`、`src/components/Icon.tsx`、`src/features/map/MapPage.tsx`、`src/features/equipment/EquipmentPage.tsx`、`src/features/monsters/MonstersPage.tsx`、`src/features/saved/SavedPage.tsx` 和 `src/styles/global.css`。实现中文底部导航、图层、筛选、搜索、详情、收藏、手动耐久和备份。

### Task 6: 手机验证

创建 `tests/e2e/mobile.spec.ts`，验证手机宽度无横向溢出、图层切换、搜索、缩放、拖动、双指缩放、怪物定位、收藏与耐久在刷新后保留。测试备份导入失败不丢失记录。

运行：

```bash
npm run check
npm run test:e2e
```

期望：类型检查、业务测试、生产构建和手机交互检查全部通过。若环境缺少浏览器，安装所需浏览器后重跑，并准确记录尚未覆盖的平台。

### Task 7: 交付

确认 README 与实际命令一致，提交初始化内容。向用户提供项目路径、需求文档、启动命令，明确演示数据现状和真实资料下一步。

## 实施调整

npm 10.9.4 在解析 Vitest 4 的可选浏览器 / Vite 开发工具依赖图时，进入 Arborist `loadPeerSet` 的空节点路径并报 `edgesOut`。业务测试仅需要纯函数与断言，改用 Node.js 22 内置测试，去掉该可选依赖图；不修改系统 npm，也不全局忽略 peer 约束。
