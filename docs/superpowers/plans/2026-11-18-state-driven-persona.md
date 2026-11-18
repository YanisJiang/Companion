# 状态驱动人设 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 性格五维 + 快变量 → `decide` 出意图；主动链先按意图再调模型；`silence` 不调模型。

**Architecture:** 新建纯函数模块（可单测）承载 traits/state/decide；接线层读 settings、调 `tick`、把意图传给现有 `generateInitiativeText` 扩展；旧额度/streak 暂留安全帽，不本轮删光。

**Tech Stack:** TypeScript、Node `node:test`、现有 Hono/SQLite settings。

**Spec:** `docs/superpowers/specs/2026-11-18-state-driven-persona-design.md`

---

## 文件职责

| 文件 | 职责 |
|---|---|
| `src/server/traits.ts`（新） | 五维类型、默认值、读配置（可先常量） |
| `src/server/companion-state.ts`（新） | 快变量类型、clamp、`tick`/`onUserMessage`/`onInitiativeSent` 纯更新 |
| `src/server/decide.ts`（新） | `decideInitiative` / `decideReply` → intent |
| `tests/traits-state-decide.test.ts`（新） | 系数差→意图差；危机禁 life |
| `src/server/followup.ts` | 主动生成前改走 `decide`；prompt 带意图 |
| `src/server/proactive.ts` | 日问候/总 tick 与 decide 对齐 |
| `src/server/initiative-context.ts` | `decideInitiativeTone` 改为委托 `decide`（或薄封装），保留 streak API |
| `src/server/chat.ts` / `reply-scheduler.ts` | 本轮可选：被动只注入 `reply_soft`/`reply_normal`；不改安静窗主逻辑 |
| `src/server/crisis.ts` | 触发时同步抬 `crisisResidue`（或 decide 仍读冷静窗，二选一写清） |

---

## 拆分

| 块 | 做 | 不做 |
|---|---|---|
| A 纯函数核心 | traits + state + decide + 单测 | 不接 HTTP、不改 UI |
| B 主动链接线 | idle/续话/日问候用 decide；silence 不调模型；prompt 带意图 | 不删日额度/streak 安全帽 |
| C 状态持久化 | settings 存快变量 JSON；proactive/chat 路径 tick | 不做设置页滑杆 UI |
| D 被动轻接（可选同批或下批） | 回你时 intent→prompt 约束长短 | 不改 rhythm 安静窗 |

顺序：**A → B → C**；**D** 可同批末或下一批。

---

## Task A — 纯函数 + 单测

- [ ] **A1** 新增 `traits.ts`：`PersonalityTraits`、`DEFAULT_TRAITS`（cling 0.7…）、`clamp01`
- [ ] **A2** 新增 `companion-state.ts`：`CompanionState`（energy/mood/socialDrive/crisisResidue）；`createInitialState`；`tickState(state, traits, dtMs, hour)` 纯函数
- [ ] **A3** 新增 `decide.ts`：intent 联合类型；`decideInitiative(state, traits, opts?)`；`decideReply(state, traits)`
- [ ] **A4** 单测：同 state 高 chatter→更易 life；crisisResidue 高→禁止 life；socialDrive 低→silence；高 cling 安静后 socialDrive 涨更快（测 tick）
- [ ] **A5** `npm test` 全绿

## Task B — 主动链接线

- [ ] **B1** `decideInitiativeTone` 改为基于当前 state+traits 的 `decideInitiative`（映射 silence/presence/life；check_in/heavy_hold 映射到 presence 或扩展 generate 分支）
- [ ] **B2** `generateInitiativeText`：按意图选 prompt（heavy_hold 禁碎念；life 可带今日；presence 极短）
- [ ] **B3** idle / followup / daily greeting：先 decide，silence 直接 return
- [ ] **B4** 跑既有 `tests/initiative-context.test.ts` / `crisis` 相关；必要时改断言对齐新映射
- [ ] **B5** `npm test` + `tsc` 服务端

## Task C — 持久化与 tick

- [ ] **C1** settings key（如 `companion_state_json`）读写；非法则回初始
- [ ] **C2** `tickProactive` 开头：按墙钟 dt 调 `tickState` 并写回
- [ ] **C3** 用户消息：抬/压 mood、crisis（接 crisis 模块）、清未回时回升 social 逻辑与设计一致
- [ ] **C4** 主动发出后：扣 socialDrive（替代「只靠 streak 计数」的体验主因；streak 仍留作帽）
- [ ] **C5** 单测：序列化 round-trip；跨调用 tick 累加

## Task D — 被动轻接（本轮若做）

- [ ] **D1** `generateReply` 前 `decideReply`，system 或尾指令带「短回/正常」
- [ ] **D2** 不改 `quietDelayMs` / 拆泡硬限主逻辑
- [ ] **D3** 补 1～2 条 decideReply 单测

---

## 本轮 Plan 摘要（确认用）

```text
目标 | 落地状态驱动：五维性格 + 快变量 → decide → 主动链按意图生成

改哪些
1. src/server/traits.ts（新）→ 五维默认与类型
2. src/server/companion-state.ts（新）→ 快变量与 tick 纯更新
3. src/server/decide.ts（新）→ 意图决策纯函数
4. tests/traits-state-decide.test.ts（新）→ 核心单测
5. src/server/initiative-context.ts → tone 委托 decide
6. src/server/followup.ts / proactive.ts → 先 decide 再生成；prompt 带意图
7. chat/crisis 旁路 → 状态读写与 crisisResidue 同步（C）
8. 可选 reply-scheduler/prompt → 被动 reply_soft（D）

不改什么 | 设置页性格滑杆 UI；完整删光日额度/idle 窗/streak；rhythm 安静窗主逻辑；打工/地图模拟；每拍 LLM Agent

禁区 | 不为测试改业务乱开后门；危机后策略层仍须能禁 life；不把口味档案做成决策维

验收
1. npm test：同状态不同系数意图不同；crisis 高禁 life
2. 主动 silence 路径不调 DeepSeek（单测或日志可证）
3. 沉重后 idle/续话不再走 life prompt
4. tsc server 通过

风险/未知 | check_in/heavy_hold 与现 tone 三态映射要定清（建议 B1：heavy_hold→presence 专用 prompt；check_in→life 偏续线 prompt）；数值阈值需真聊微调
回退 | 对话标签；可关新 decide 回退到旧 decideInitiativeTone（若需可留开关，默认不留双轨——本轮直接替换 tone 决策）

本轮硬门槛 | plan-then-confirm-do；最小改动；feature-then-test；改完打 conversation tag
本轮 Skill | 无额外业务 Skill；Do 前对照本 plan + design spec
```

## 回退点

每完成 A/B/C（及可选 D）一组可独立回退改动后，按 `lucky-conversation-tag` 打注解标签（用户未要求 commit 到分支则用游离快照标签）。
