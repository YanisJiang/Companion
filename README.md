# Companion（陪伴）

两层结构：

1. **`@yanisjiang/companion-core`** — 可复用的陪伴决策内核（npm 库）  
2. **本仓库 Web 宿主** — 私人自托管聊天应用（口令、PWA、SQLite、可选 Web Push、主动找你）

> 英文：*State-driven AI companion runtime (npm) + a private DeepSeek-powered Web/PWA host with login, memory, and gentle proactive messages.*

## npm 内核库

```bash
npm i @yanisjiang/companion-core
```

文档与示例配置：[packages/companion-core/README.md](./packages/companion-core/README.md)

内核提供：性格 / 快变量 / `decide` / 节奏与危机策略 / `createCompanion`（LLM 与存储可插拔）。  
**不包含**产品级部署（Nginx、口令门、PWA、Push）；请自行做宿主，或使用下面的 Web 应用。

## Web 宿主（本仓库）

私人 DeepSeek 陪伴聊天：Web / PWA、口令进门、SQLite 记忆，面向个人自托管。服务端常开才能稳定跑「安静后主动找你」等循环。

### 功能

- 口令登录，HttpOnly 会话 Cookie
- 配置文件人设（`config/character/`），设置页不展示人设正文
- 多轮上下文 + 自动摘要 + `记住：xxx` 钉住记忆
- 状态驱动主动：idle / 续话 / 日问候；危机冷静窗与残留策略
- DeepSeek API Key 仅存服务端

### 技术栈

- 内核：`@yanisjiang/companion-core`
- 宿主后端：Node.js、TypeScript、Hono、better-sqlite3
- 前端：React、Vite
- 模型：DeepSeek（OpenAI 兼容 Chat Completions）

### 本地启动

要求：Node.js 20+

```bash
cp .env.example .env
# 编辑 .env：填写 APP_PASSWORD、SESSION_SECRET、DEEPSEEK_API_KEY
npm install
npm run dev
```

- 页面（Vite）：http://127.0.0.1:5173  
- API：http://127.0.0.1:8787  

### 生产构建

```bash
npm run build
NODE_ENV=production npm start
```

构建后由同一端口提供 API 与 `dist/web` 静态页。请在前面加 Nginx / Caddy 等做 HTTPS。

### 环境变量

复制 `.env.example` 为 `.env` 后填写。**不要提交 `.env`。**

| 变量 | 说明 |
| --- | --- |
| `APP_PASSWORD` | 网页登录口令 |
| `SESSION_SECRET` | Cookie 签名密钥（长随机串） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 默认 `deepseek-chat` |
| `COMPANION_NAME` | AI 默认显示名 |
| `USER_NICKNAME` | 默认怎么称呼你 |
| `PROACTIVE_ENABLED` | 是否启用主动问候 |
| `PROACTIVE_HOUR_START` / `PROACTIVE_HOUR_END` | 主动问候时段（上海时区小时） |
| `DATA_DIR` | SQLite 等数据目录，默认 `./data` |
| `PORT` | 服务端口，默认 `8787` |

### 部署提示

1. 安装 Node 20+，配置 `.env`
2. `npm ci && npm run build`
3. `pm2` / `systemd` 运行 `npm start`（需常开进程，主动消息才稳定）
4. 反代 HTTPS 到 `127.0.0.1:8787`
5. 手机「添加到主屏幕」可作 PWA；系统推送需 HTTPS + 推送密钥

### 安全与隐私

- 面向**单用户自托管**，请用强口令与强 `SESSION_SECRET`
- 对话与记忆在你自己的 SQLite；请备份 `DATA_DIR`
- 遵守模型服务商与当地法规

## 许可证

[MIT](./LICENSE)
