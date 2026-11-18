# minimal — 10 分钟自行启动

1. 在仓库根目录安装依赖（已含 `@yanisjiang/companion-core` workspace）。
2. 设置 API Key：

```bash
# PowerShell
$env:DEEPSEEK_API_KEY="sk-..."
npx tsx examples/minimal/index.ts
```

3. 另开终端：

```bash
curl http://127.0.0.1:8790/health
curl -X POST http://127.0.0.1:8790/messages -H "content-type: application/json" -d "{\"text\":\"早啊\"}"
curl "http://127.0.0.1:8790/messages?limit=20"
```

默认用 `packages/companion-core/examples/character` 配置；可用 `CONFIG_DIR` 指向自己的角色目录。存储默认内存（重启清空）。
