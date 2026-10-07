# 防具升级备料 Implementation Plan

**Goal:** 手机上选择多件防具的当前与目标星级，合并材料、卢比和已有数量，得到可保存的缺口清单。

**Architecture:** 复用已核对的逐星 `armorLevels`，仅累加当前星级之后到目标星级的费用。材料按 Actor ID 合并，没有 ID 时按原始名称合并。计划与持有数量通过现有玩家记录保存、备份，旧备份缺少新增字段时补空值。

**Tech Stack:** React、TypeScript、本地 JSON、localStorage、Node 业务测试和 Playwright 手机验证。

用户已要求整理材料方便准备；结合先前指定的 Android 离线使用，直接完成此功能。静态表便于查单件但不能合并；选择升级范围并计算缺口适合本次需求；自动读取游戏背包没有数据接口，不纳入实现。

1. `src/types/domain.ts` 与 `src/data/player-data.ts`：新增升级计划、持有数量、任务阶段字段；严格校验范围、数量与重复项，兼容旧备份。
2. `src/features/equipment/armor-planner.ts`：实现纯计算，验证三件海利亚防具合并、已完成等级排除、古代勇者全身费用、不可升级条目和不足数量。
3. `ArmorPlanner.tsx` 和 `EquipmentPage.tsx`：可展开的备料面板、选择防具、当前与目标等级、每项所需/已有/还缺；图鉴可直接加入计划。移动触控至少 44px。
4. `usePlayerData.ts` 和收藏页：保存并备份全部新增记录，导入确认显示计划和任务数量。
5. 更新资料契约、需求、手机截图与离线生产验证，然后打包 APK。

执行 `npm run check`、`npm run test:e2e`、`npm run test:offline`。仅对计算、数据兼容及关键手机流程增加业务测试。
