# Companion（陪伴）

私人 DeepSeek 陪伴聊天应用：Web / PWA、口令进门、SQLite 记忆，面向「想有一个能陪着自己的 AI」的个人自托管场景。

> 英文简介：*A private DeepSeek-powered companion chat app (Web/PWA) with password login, memory, and gentle daily check-ins.*

## 功能

- 口令登录，HttpOnly 会话 Cookie
- 固定陪伴向人设（朋友语气）
- 多轮上下文 + 自动摘要 + 聊天发送 `记住：xxx` 钉住记忆
- 「正在输入」反馈；模型失败时短回执
- 每日最多一次主动问候（可开关，默认 21:00–22:00，`Asia/Shanghai`）
- DeepSeek API Key 仅存服务端，不进前端

## 技术栈

- 后端：Node.js、TypeScript、Hono、better-sqlite3
- 前端：React、Vite
- 模型：DeepSeek（OpenAI 兼容 Chat Completions）

## 本地启动

要求：Node.js 20+

```bash
cp .env.example .env
# 编辑 .env：填写 APP_PASSWORD、SESSION_SECRET、DEEPSEEK_API_KEY
npm install
npm run dev
```

- 页面（Vite）：http://127.0.0.1:5173  
- API：http://127.0.0.1:8787  

## 生产构建

```bash
npm run build
NODE_ENV=production npm start
```

构建后由同一端口提供 API 与 `dist/web` 静态页。请在前面加 Nginx / Caddy 等做 HTTPS。

## 环境变量

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
| `PROACTIVE_HOUR_START` / `PROACTIVE_HOUR_END` | 主动问候时段（本地上海时区小时） |
| `DATA_DIR` | SQLite 等数据目录，默认 `./data` |
| `PORT` | 服务端口，默认 `8787` |

## 使用提示

- 发送 `记住：喜欢喝美式` 可写入钉住记忆
- 设置里可改显示名、称呼、主动开关，以及清空记忆 / 对话
- 主动消息写入对话记录；无系统推送时，打开网页即可看到

## 部署（例如阿里云）

1. 安装 Node 20+，上传本仓库，配置 `.env`
2. `npm ci && npm run build`
3. 用 `pm2` 或 `systemd` 运行 `npm start`
4. 反代到 `127.0.0.1:8787`，开启 HTTPS
5. 手机浏览器打开站点后「添加到主屏幕」，即可近似 PWA

## 安全与隐私

- 本项目面向**单用户自托管**，请使用强口令与强 `SESSION_SECRET`
- 对话与记忆落在你自己的服务器 SQLite 中，请自行备份 `DATA_DIR`
- 请遵守 DeepSeek 与所在地相关服务条款与法律法规

## 许可证

[MIT](./LICENSE)
