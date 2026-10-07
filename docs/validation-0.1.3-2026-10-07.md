# 0.1.3 原创探索图标验收

打包时间：2026-10-07 23:42 UTC（北京时间 2026-10-08 07:42）。局域网全量下载核对：2026-10-07 23:43 UTC。版本 0.1.3 / versionCode 4，包名 `app.hyrule.companion`。

## 图标来源与最终资源

用户已允许改用其他元素。生产图标为本项目原创 SVG 路径绘制，通过 `scripts/sync-app-icon.mjs` 导出 Android VectorDrawable 与网页 192 / 512 px PNG。15 个前景路径逐一与安卓资源对应，网页和安卓背景均为 `#173e37`。新图标替换网页页头、favicon、Manifest 与安卓桌面入口，下载页展示同一图标。

本次内置 imagegen 尝试未返回可用的新文件；检查到的角色图片是上次尝试的迟到文件，不是本次结果，没有使用。没有调用 CLI / API，没有将矢量资源冒充该次生成位图。提示词保存在 `docs/plans/2026-10-07-app-icon.md`，来源、输出类型及文件 SHA-256 保存在 `public/data/app-icon-manifest.json`。

## 检查结果

| 验证 | 结果 |
| --- | --- |
| 源图与原生前景 | 15 个路径的坐标、填充和描边逐一一致；原生资源编译通过；APK 含 `ic_emblem.xml` 与自适应 `ic_launcher.xml` |
| PNG / Manifest | 192 × 192、512 × 512 PNG 尺寸正确，Manifest 引用与资源清单一致，全部图标哈希通过打包校验 |
| 视觉检查 | 完整、圆形、方圆形和 48 / 72 / 96 px 预览已检查；主体不被预览裁切；不是 Android 真机截图 |
| 实际手机页面 | Chromium 390 × 844 CSS px，页头 Logo 36 × 36 px，无横向溢出；服务提供的 SVG / PNG 与资源哈希一致 |
| `npm run check` | 类型检查、80 项单元测试及生产构建通过 |
| `npm run test:e2e` | 重启开发服务后 47 项全部通过，包括地图手势、图层、备份、点亮和原有资料功能 |
| 生产断网 | Android 相同 origin、DPR 3、三层原生第 7 级四角、装备、教程、克洛格与记录刷新通过；1110 个不同包内资源，0 外部请求、0 页面错误 |
| 完整 APK | 29,835 张地图瓦片、310 个装备图标及所有目录核对；30,173 个签名 APK 资产逐个与最终 `dist` 一致 |
| 签名 / 版本 | 0.1.0–0.1.3 证书一致，v2 / v3 签名通过、zip alignment 通过；包名不变，versionCode 增至 4，无权限 |
| 局域网下载 | 下载页 / 清单指向 0.1.3，展示正确新图标；APK 全量下载 HTTP 200，MIME / attachment、大小、SHA-256 全部匹配 |

首轮回归期间，原有 Vite 进程以 139 退出，随后浏览器请求出现连接重置 / 拒绝；首次仅 13 项通过。具体进程崩溃原因未确定，没有据此修改应用渲染代码。保留首轮日志、首个地图失败轨迹及退出报告，重启服务后完整复测 47 / 47 通过。生产 APK 不依赖 Vite，独立的生产断网检查已通过。

没有连接 Android 设备，没有声称实测桌面启动器外观、安装升级、手势帧率或系统文件选择器。沿用原签名、origin、存储键和记录结构，支持覆盖安装保留记录。

证书 SHA-256：`08ae9424a350b2aa4379cd22fca8e11b3a26d3e5eab596526fbf743319523561`。

## 交付

- 下载页：`http://192.168.2.142:8788/`。
- APK：`hyrule-companion-0.1.3-android-offline.apk`，88,447,201 bytes（84.3 MiB）。
- APK SHA-256：`de00c3ecba34b95632a2747dec2f1a2cc22d325f122dd931be7b1d1ec71e3e08`。
- ZIP：`hyrule-companion-0.1.3-offline-web.zip`，85,519,711 bytes（81.6 MiB）。
- ZIP SHA-256：`4e133efcc6d8b7caa91ab0039231e1f4b3489107e27add7b524a47bb5ee44777`。

构建产物和校验报告在忽略的 `releases/`、`.cache/verification/`；源码只提交原创图标、转换脚本、来源清单、说明与实际预览。原签名材料未变更。
