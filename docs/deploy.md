# 部署

本个人版本已于 2026-10-03 部署到腾讯云新加坡服务器，访问地址为 `https://hot.kiuchen.cc`；现有 `kiuchen.cc` 保留旧站。个性化代码使用 `personalize/ai-station` 分支。部署使用该分支提交导出的源码包，服务器上的 `.env`、数据卷及证书独立保留；源码包不含密钥或本地测试结果。生产目录为 `/home/ubuntu/ai-station-deploy/ai-station-hot`。

## 用 Docker（推荐）

需要一台装了 Docker（带 Compose）的机器。云服务器建议至少 2 核、4 GB 内存，构建镜像时要用到。

```bash
git clone --branch personalize/ai-station https://github.com/KiuChen/ai-station-hot.git ai-station-hot
cd ai-station-hot
node scripts/init-env.ts
docker compose up -d --build
```

`init-env.ts` 会生成 `.env`，填好随机密钥和管理员密码，并把密码打印一次。机器上没有 Node 的话，把 `.env.example` 复制成 `.env`，自己填 `ADMIN_PASSWORD`（至少 12 位）、`SESSION_SECRET`、`IMG_PROXY_SIGN_SECRET`、`POSTGRES_PASSWORD`（各用 `openssl rand -hex 32` 生成）和 `LLM_API_KEY`。

启动后后台在 `/admin`，用管理员密码登录。首次启动会导入 18 个默认 RSS 信源与默认主题。

本个人版本的 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED` 和全部消息发送开关默认关闭，因此启动不会自动采集或调用模型。先在 `.env` 配置 MiniMax Key，验证接口和模型权限，在后台设置调用次数预算，再显式启用：

```dotenv
COLLECT_ENABLED=true
MODEL_CALLS_ENABLED=true
```

重新启动 worker 后才开始处理新内容。首次导入会产生较多模型调用，耗时取决于套餐额度、限流和内容量。日报按北京时间 09:00 生成，取稿截止和补刊也使用这个时间。

模型默认配置为 `https://api.minimax.cn/v1`、`MiniMax-M3`。Token Plan 使用订阅 Key，与按量付费 Key 不互通；默认值需用实际账户验证。Key 填在 `.env`，不必放入命令行参数。

额度通知与内容推送独立：配置飞书群自定义机器人 Webhook（启用签名校验时再填 Secret），设置 `FEISHU_QUOTA_ALERT_ENABLED=true`；MiniMax Token Plan 同时设置 `MINIMAX_TOKEN_PLAN_MONITOR_ENABLED=true`，重启 worker。每 30 分钟查询套餐接口的 general 当前周期/本周剩余百分比，任一显示 0% 时提醒；同一额度窗口只提醒一次，发送失败后下一轮重试。count 字段、视频额度、未识别或过期窗口均不作为文本套餐耗尽的证据。还会检查模型回执中明确的资源限制/余额不足；普通 HTTP 429 不判为额度耗尽。检查失败会记录任务失败，不会伪造耗尽提醒。提醒不会自动暂停模型，也不能保证在自动扣积分之前通知。没有 Key 或 Webhook 时保持关闭。

本机已于 2026-10-02 私密配置 Key 与 Webhook，并通过一次真实飞书测试发送。2026-10-03 已单独迁入服务器生产配置并运行持续 worker；生产采集与模型处理已启用，模型调用次数上限为 10/分钟、60/小时、500/天。新加坡服务器上的 MiniMax 结构化调用和 Token Plan 额度查询已通过。机器人地址与签名密钥均不得写进部署文档或提交到仓库。

`docker compose` 会起五个容器：`db`（PostgreSQL 17）、`setup`（每次启动先跑数据库迁移和种子数据，然后退出）、`api`、`worker`（抓取、模型处理、定时任务）、`web`（网页）。

### 在中国大陆的服务器上

- 构建时 npm 走国内镜像：`docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com`，然后 `docker compose up -d`。
- 拉取 Docker 镜像慢，先给 Docker 配置镜像加速。
- 海外信源抓不到时，在 `.env` 里设置 `EGRESS_PROXY_URL`：抓信源、图片和模型榜数据时走这个代理，调用模型接口不走。
- 对外提供网站服务需要先完成 ICP 备案，备案号填在 `industry/site.ts` 的 `icp`。

### 配域名和 HTTPS

先把域名解析到服务器，然后在 `.env` 里设置：

```bash
SITE_URL=https://hot.kiuchen.cc
SITE_DOMAIN=hot.kiuchen.cc
PORT=127.0.0.1:3000        # 3000 端口只给本机的 Caddy 用，不直接对外
TRUST_PROXY=true           # 访客地址从 Caddy 转来的请求头里读
```

再用带 HTTPS 的方式启动，Caddy 会自动申请和续期证书：

```bash
docker compose --profile https up -d --build
```

已经有 Nginx 的话，不用 Caddy，把站点反向代理到 `http://127.0.0.1:3000`，带上 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`，并在 `.env` 里设 `TRUST_PROXY=true`。`SITE_URL` 一定要写成读者实际访问的地址：生成的链接、RSS、分享图和 MCP 都用它。

### 更新

```bash
git pull
docker compose up -d --build
```

数据库迁移只做向后兼容的增量，更新时自动执行。

### 备份

在 `.env` 里配置 `DB_BACKUP_STORE_*`，每天 04:10 自动备份到那里。代码默认使用腾讯云 COS 地址，采用 S3 Signature V4；接入其他兼容存储时应填写对应域名和区域并验证上传及恢复。当前未配置备份存储。也可以手动导出：

```bash
docker compose exec -T db pg_dump -U aihot aihot | gzip > myhot-$(date +%F).sql.gz
```

数据都在三个 Docker 卷里：`db`（数据库）、`data`（上传的图片、图片缓存、本地备份）、`caddy`（证书）。`docker compose down` 不会删除它们；`docker compose down -v` 会。

### 看日志

```bash
docker compose logs -f --tail 100 api worker web
```

后台的“运行”页能看到每个定时任务最近的结果，“信源”页能看到每个信源的抓取状况。

## 花多少钱

- **模型**：每条新资料至少预筛一次；可能入选的再评分两次，入选的还要写标题摘要、打标签、归组，另外还有日报和事件综述。我们用示范信源在本地试跑，第一次导入的 152 条资料一共用了大约 930 次模型调用。之后每天用多少，取决于你的信源每天更新多少条。后台“模型与评测”页能看到每一步的调用次数和输入输出 token 数。
- **付费采集**（X、公众号、Jina）：按请求计费，默认不启用，填了 key 才会用。
- 后台“设置 → 预算”设置的是每分钟、每小时、每天的调用次数上限。它不是人民币消费上限，也不等于 Token Plan 的套餐额度；还需在模型平台核对消费与积分设置。填 0 表示停用对应服务。

## 不用 Docker

需要 Node.js 24.11 以上和 PostgreSQL 16 或 17。

```bash
npm ci
node scripts/init-env.ts
createdb myhot
```

在 `.env` 里加上：

```bash
DATABASE_URL=postgres://你的用户名@127.0.0.1:5432/myhot
API_BASE_URL=http://127.0.0.1:3001
```

然后：

```bash
node --env-file=.env scripts/migrate.ts
node --env-file=.env scripts/seed.ts
npm run build -w @aihot/web

node --env-file=.env apps/api/src/main.ts          # 接口，3001 端口
node --env-file=.env apps/worker/src/main.ts       # 后台任务
cd apps/web && NODE_ENV=production node --env-file=../../.env server.ts   # 网页，3000 端口
```

三个进程要一直运行，生产环境用 systemd 或 pm2 守护。

开发时用带热更新的方式：`npm run dev:api`、`npm run dev:worker`、`npm run dev:web`。开发时想免登录进后台，在 `.env` 里设 `DEV_AUTH_ROLE=admin`（生产环境会拒绝启动）。

### 本个人版本采集频率

18 个默认 RSS 信源的采集间隔设为 30 分钟；`SOURCE_INTERVAL_ADAPT_ENABLED=false` 关闭按产出量自动调整频率。调度器每分钟检查到期信源，成功采集后至少间隔 30 分钟再采集；失败时沿用原有退避策略。MiniMax 额度检查在北京时间每小时的 00、30 分钟运行。
