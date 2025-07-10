# Sitemap Diff - Cloudflare Workers 版本

这是一个基于 Cloudflare Workers 的站点监控机器人，用于监控网站的 sitemap 变化并通过 Telegram 发送通知。

## 功能特点

- 监控网站 sitemap 的变化
- 检测新增的 URL
- 通过 Telegram 发送通知
- 支持定时检查（每小时）
- 支持手动触发检查
- 支持关键词汇总

## 部署步骤

### 前提条件

- Cloudflare 账号
- Node.js 和 npm

### 安装步骤

1. 克隆仓库并安装依赖

```bash
git clone <仓库地址>
cd cloudflare-worker
npm install
```

2. 配置 Cloudflare Workers

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 KV 命名空间
npx wrangler kv:namespace create "SITEMAP_KV"
```

3. 更新 `wrangler.toml` 配置

将创建的 KV 命名空间 ID 更新到 `wrangler.toml` 文件中：

```toml
[[kv_namespaces]]
binding = "SITEMAP_KV"
id = "YOUR_KV_NAMESPACE_ID"  # 替换为实际的 KV 命名空间 ID
```

4. 配置环境变量

在 Cloudflare Dashboard 中设置以下环境变量：

- `TELEGRAM_BOT_TOKEN`: Telegram 机器人 token
- `TELEGRAM_TARGET_CHAT`: 消息发送目标（频道或用户 ID）

5. 部署 Worker

```bash
npx wrangler deploy
```

6. 配置 Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_URL>/telegram-webhook"
```

## 使用方法

### Telegram 命令

- `/help` - 显示帮助信息
- `/rss list` - 显示所有监控的 sitemap 列表
- `/rss add URL` - 添加新的 sitemap 监控
- `/rss del URL` - 删除指定的 sitemap 监控
- `/news` - 手动触发关键词汇总

## 开发说明

### 项目结构

```
cloudflare-worker/
├── src/
│   ├── index.ts           # 主入口文件
│   ├── types.ts           # 类型定义
│   ├── rss/
│   │   └── manager.ts     # RSS 管理器
│   ├── bots/
│   │   └── telegram.ts    # Telegram 机器人功能
│   └── storage/           # 存储相关功能
├── wrangler.toml          # Cloudflare Workers 配置
└── package.json           # 项目依赖
```

### 本地开发

```bash
# 本地开发
npm run dev

# 部署
npm run deploy
```

## 注意事项

1. Cloudflare Workers 有执行时间限制，确保代码高效运行
2. 确保 Telegram 机器人有足够权限发送消息
3. 大型 sitemap 可能需要分批处理以避免超出 Workers 限制 