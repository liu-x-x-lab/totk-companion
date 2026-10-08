# 项目协作约定

- 所有改动限定在本项目，主要使用场景是手机竖屏。
- 先阅读 `docs/requirements.md` 和 `docs/data-contract.md`。
- 保持中文界面，触控区域至少 44 × 44 CSS px，兼顾安全区和无障碍。
- 示例地图、坐标、怪物和装备数值必须明确标为演示，不能冒充已核验的游戏资料。
- 真实数据必须记录来源、适用游戏版本、核验状态；未知数值用 `null` 表示。
- 装备基础耐久与玩家手动记录的剩余耐久分开；防具使用防御和升级字段。
- 不默认声称能够读取 Switch 实时背包或当前耐久。
- App 本阶段使用前端本地存储，不引入账号、收费、后端或公网网页部署；GitHub 源码发布按下方约定执行。
- 提交前运行 `npm run check`；涉及地图手势或移动布局时运行 `npm run test:e2e`。
- 不要提交 `node_modules`、构建产物、存档、密钥或未经核验的游戏资源。

## GitHub 发布约定

- 用户已授权本项目公开发布，固定仓库为 `https://github.com/liu-x-x-lab/totk-companion`，账号为 `liu-x-x-lab`，平台为 GitHub（`github.com`）。
- 仓库保持 Public，默认分支为 `main`，`origin` 的 fetch / push 地址为 `https://github.com/liu-x-x-lab/totk-companion.git`。
- 后续用户要求上传、推送或同步本项目时，沿用上述仓库和分支，无需再次询问账号或仓库地址；只有用户明确要求更换时才修改目标或新建仓库。
- 本项目原创源码和原创 UI 采用 `GPL-3.0-only`；第三方资源的来源、权利和许可范围按 `THIRD_PARTY_NOTICES.md` 保留独立说明。
