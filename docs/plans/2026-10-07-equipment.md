# 装备属性与基础耐久 Implementation Plan

> **For Codex:** 用户已明确要求补充装备固定属性，在当前项目完成资料导入、展示与验证。

**Goal:** 把真实装备属性和基础耐久接入现有手机装备图鉴。

**Architecture:** Python 标准库解析公开 XLSX 和中文词条，生成本地装备 JSON、CSV 与来源清单；React 仓库扩展已有领域模型，保留历史 ID，并展示固定属性、变体和防具强化。手动记录继续独立存储。

**Tech Stack:** React、TypeScript、Vite、Python 标准库、Node 测试、Playwright。

---

1. 创建 `scripts/sync-equipment.py`，读取原始资料，检查列名和条目覆盖，输出 `public/data/equipment.json`、`equipment.csv`、`equipment-manifest.json`；记录 SHA-256 和数值差异。
2. 扩展 `src/types/domain.ts`，在 `src/data/repository.ts` 中载入属性库、解析防具强化别名与历史名称；不改动玩家备份格式。
3. 更新 `src/features/equipment/EquipmentPage.tsx`：中文 / 英文 / ID 搜索、腐朽与无腐蚀筛选、基础属性、词条详情、防具强化材料和默认耐久。
4. 更新 `src/app/App.tsx`、`src/features/saved/SavedPage.tsx` 和 `src/styles/global.css`，移除已不适用的全局“属性待核验”，显示装备资料范围和来源。
5. 添加 `src/data/equipment-data.test.ts` 并扩展 `tests/e2e/mobile.spec.ts`；用海利亚盾 90 / 800、旅人之剑 7 / 20、双手剑与长枪显示值、防具 0–4 星等独立预期核验。
6. 更新 README、需求、数据契约、来源与路线；运行 `npm run check`、`npm run test:e2e`、`git diff --check` 后提交。

## 完成记录

2026-10-07：已完成 310 个基础条目的导入和中文展示，包含 547 个防具等级记录；原 775 个名称 ID 保留。已校验游戏显示攻击值、武器形态、耐久预填、旧收藏和装备 CSV。

`npm run check` 通过类型检查、35 项业务测试和生产构建；21 项手机浏览器测试通过，最终星级防御标签修改后对应旧收藏测试再次通过。已检查装备与强化材料的手机截图。联网更新脚本成功运行，更新结果与已测试的条目、别名、历史名称一致；310 行 CSV 逐字段对照 JSON 通过。

来源差异与特殊数值已记录到 `docs/equipment-sources.md`、界面与数据清单。完整融合计算及逐版本游戏内复核为后续范围。
