# Companion Core P0 Implementation Plan

**Goal:** 抽出 `packages/companion-core`：LLM/配置/存储端口 + 纯逻辑迁入；现应用薄依赖，行为不变。

**选择:** 本仓 `packages/companion-core`（推荐 A）。

## 范围

- 迁入：traits、companion-state、decide、rhythm、character-config、crisis（持久化经端口）
- 新增：`LlmClient`、`KvStore`（冷静窗等）、OpenAI 兼容适配器
- 现 `src/server` 从 core re-export / 改 import
- 单测指向 core

## 不做（P1+）

编排（reply-scheduler/followup/proactive）、自行启动 HTTP、发公开 npm。
