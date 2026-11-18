# Companion Core P2 Implementation Plan

> 确认后再 Do。本轮只规划。

**Goal:** 闭环「两个插口 + 两种运行方式」：库调用已有；补齐**默认可换存储**与**自行启动**（最小 HTTP），空项目约 10 分钟能接上本地/API 跑通收发。

**落地选型:** C1 `app.listen`；省略 `store` → 内存；落盘用 `createSqliteMessageStore`。

**Spec 锚点:** 可复用运行时（非再做一个聊天站）；鉴权/React/Push 仍留现宿主。

**前置:** P0/P1 已落地 `createCompanion` + MessageStore + 编排。

---

## 拆分

| 块 | 做 | 不做 |
|---|---|---|
| **A 默认存储适配** | core 提供可选 `createSqliteMessageStore(path)`（或独立 `@companion/sqlite` 薄包），`createCompanion` 可省略 `store` 时落到 sqlite/内存之一（须写清默认） | 不把 better-sqlite3 硬绑进编排逻辑；不删现应用自己的 db |
| **B 库 API 打磨** | 对外稳定面：`handleUserMessage` / `tickProactive`（或 `tick`）/ 读消息列表；README 最小示例与 env 说明 | 不发公开 npm；不迁 React |
| **C 自行启动** | `listen({ port })` **或** `bin: companion start`：最小 HTTP（健康检查 + 发消息 + 拉消息），启动 proactive loop | 不做口令登录、不做 Web Push、不做现网 Nginx |
| **D example** | `examples/minimal/`：复制 character 配置 + 一段 `index.ts` / 启动命令 | 不替换现 `src/server` 产品应用 |

顺序：**A → B → C → D**（C 依赖 A/B 默认能跑）。

**自行启动选型（待确认二选一，默认建议 C1）**

| 方案 | 内容 | 利弊 |
|---|---|---|
| **C1 HTTP listen** | `app.listen({ port })` 用 Node `http` 或极薄 hono（若引入须声明依赖边界） | 与示意一致；易 curl 验收 |
| **C2 CLI only** | `companion start` 读 env，内部 listen | 入口清晰；多一层 bin 打包 |

---

## Plan（确认后 do）

```text
目标 | 双运行态闭环：库调用文档化 + 默认存储 + 最小自行启动；现 Web 宿主行为基本不变

改哪些
1. packages/companion-core
   → 可选 SQLite MessageStore 适配（或子路径导出），默认策略写清
   → createCompanion 返回/补齐 listen 或配套 start 入口
   → README：库调用 + 自行启动两段示例
2. examples/minimal（新）
   → character 配置（可链到 examples/character）+ 启动脚本
3. 单测
   → listen 或 CLI：内存/临时 sqlite 发一句 pending；健康检查 200
4. 文档
   → docs/superpowers/plans 本文件勾选落地说明

不改什么 | 现 React UI；口令鉴权；Web Push；现网部署脚本；公开发 npm
禁区 | core 编排仍不依赖 React/web-push；不把 APP_PASSWORD 写入 character；不为测开业务后门
验收
1. npm test 全绿
2. examples/minimal：仅配 API Key + 配置目录，能收发一句（curl 或 CLI）
3. 现应用 npm run build / 本地聊一句仍可用
风险 | sqlite 原生依赖进 core 的安装面；listen 与现 Hono 应用双端口混淆（example 端口默认错开）
回退 | conversation tag
硬门槛 | plan→do；最小够用；写完再测；不造第二套编排
本轮 Skill | 无
```

## 回退点

Do 完成后打注解标签（未要求提交分支则用游离快照）。
