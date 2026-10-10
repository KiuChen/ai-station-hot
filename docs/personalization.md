# AI Station 个性化记录

## 当前版本：2026-10-02

- 名称与图标：AI Station + 已确认的折页 S；米白折页、冰青折面、深色底。
- 关于页：仅展示 KiuChen、AI Station 的个人维护者、GitHub 链接。不展示邮箱、二维码、统计或流程图。其余页面保留当前布局。
- 站点身份：MCP 前缀 ai_station，采集标识 AIStationBot。框架许可与署名保留。
- 日报：北京时间 09:00；取稿窗口为前一天 09:00 至当天 09:00，补刊任务在 09:00 后才处理当天。文案、RSS、Agent 说明和漏刊告警共用 industry/reports.ts 中的时间配置。
- 关闭模型榜和 Codex 重置监控：导航、定时任务、公开页面、接口和站点地图按框架现有开关隐藏。
- 信源、分类、主题、AI 筛选与写作、入选门槛全部保留上游默认。未迁入旧 ai-station 的信源和 /jobs/。
- 域名目标：hot.kiuchen.cc。原 kiuchen.cc 保留旧站；DNS、服务器及 HTTPS 尚未配置。
- 隐私与使用规则：已撰写个人站版本，使用反馈页作为联系渠道；仍标为上线前草稿，部署供应商和日志期限待确定。

## MiniMax 默认配置

默认共用 https://api.minimax.cn/v1、MiniMax-M3。Token Plan 使用订阅 Key，不与按量付费 Key 混用。保守设置 LLM_JSON_MODE=false，仍要求输出可解析 JSON；关闭图片输入，M3 关闭 thinking，并用 reasoning_split 分离思考内容。

最初按官方文档预填默认配置。2026-10-02 用户提供 Key 后，已真实验证 MiniMax-M3 的 25 次请求与套餐剩余额度接口。采集和全局模型调用仍关闭；测试仅在有限进程中临时启用。具体套餐名称和生产使用方式尚待确认。

官方参考（2026-10-02 查询）：

- https://platform.minimaxi.com/docs/token-plan/other-tools
- https://platform.minimaxi.com/docs/api-reference/text-openai-api
- https://platform.minimaxi.com/docs/token-plan/faq
- https://platform.minimaxi.com/docs/api-reference/errorcode

官方说明 Token Plan 面向个人交互场景，生产环境建议按量付费。套餐额度受窗口限制；存在已购积分时可能在额度耗尽后自动继续扣积分。不能将 HTTP 429 或网站自己的调用次数预算等同于套餐已用满。

## 独立额度提醒

配置项为 FEISHU_QUOTA_ALERT_ENABLED、FEISHU_QUOTA_WEBHOOK_URL、FEISHU_QUOTA_WEBHOOK_SECRET、FEISHU_QUOTA_ALERT_REPEAT_MINUTES，以及 MINIMAX_TOKEN_PLAN_MONITOR_ENABLED。与内容推送、运营转发独立。

- 2026-10-02 用户提供 Webhook 后，地址已写入本地 .env（0600、Git 忽略），独立额度提醒与 Token Plan 检查开关设为 true；其他发送、采集、全局模型开关不变。
- 真实飞书接口接受了 1 条“联调测试，非额度告警”消息，未要求额外签名密钥。MiniMax 额度接口同时验证成功，当前周期剩余 99%、本周剩余 100%。
- worker 每 10 分钟查询 https://www.minimax.cn/v1/token_plan/remains，只读 general 的 current_interval_remaining_percent、current_weekly_remaining_percent 和对应有效窗口。
- 任一有效窗口显示剩余 0% 时发送提醒；同一耗尽窗口去重，新窗口可再次提醒。窗口百分比缺失、范围无效或过期，以及 video 的额度均不会触发文本套餐提醒；返回为 0 的 count 字段不用于推算额度。
- 还检查 MiniMax 模型回执的明确错误：2056 为资源限制，需要核对具体额度或资源限制；1008 为余额不足。普通 HTTP 429 不等同于套餐耗尽。即使额度查询失败，已有的明确拒绝仍可提醒。
- 飞书发送失败不记录已发送状态，下轮重试。接口检查失败会记录任务失败，不会假造耗尽提醒。消息不含凭据、原始账户响应或访客反馈。
- 提醒不自动暂停模型调用；轮询最多存在约 10 分钟延迟，不能保证在账户自动扣积分前通知。

**运行状态**：尚未部署，也没有启动持续 worker。当前完成配置、真实接口联调和本地模拟规则测试；生产环境运行 worker 后持续检查才生效。未人为耗尽真实套餐，0% 触发、去重、失败重试与窗口恢复使用本地模拟验证。

## 密钥与上线

.env 被 Git 忽略。本机管理员密码、数据库密码、会话与图片签名密钥已生成；MiniMax API Key 已保存在本地 .env（0600 权限、Git 忽略），飞书 Webhook 已私密配置并通过真实测试发送。现在 SITE_URL 已预填 https://hot.kiuchen.cc，SITE_DOMAIN 已预填 hot.kiuchen.cc，但域名没有因此完成部署。本地预览时用进程环境临时覆盖 SITE_URL=http://localhost:3000。

COLLECT_ENABLED、MODEL_CALLS_ENABLED、FEISHU_CONTENT_PUSH_ENABLED、FEISHU_INTERNAL_ENABLED、INDEXNOW_SUBMIT_ENABLED 仍关闭；FEISHU_QUOTA_ALERT_ENABLED 与 MINIMAX_TOKEN_PLAN_MONITOR_ENABLED 为 true。

上线前还需：服务器、DNS 与 HTTPS、生产模型使用方式与账户权限、生产备份、部署供应商与日志期限、额度提醒的生产运行检查。代码当前仍在 personalize/ai-station 本地分支，未提交推送。

## 品牌与关于页设计

品牌定位为个人 AI 资讯站：使用折页 S 代表整理与阅读，保持现有整体布局与字体体系，不增加霓虹或装饰图案。文字标志仍为 AI Station。

关于页使用留白、站点眉题、大字 KiuChen、一句维护者身份及 GitHub 入口。只使用已确认的身份，不补写职业、经历、社交账号或邮箱。

## 验证记录

2026-09-30 品牌替换：类型、网页构建、16 项前端测试、151 项后端测试、冒烟和桌面/手机核对通过。使用临时数据库，服务已清理。

2026-10-02：类型检查、生产网页构建、16 项前端测试、153 项后端测试、主要页面与 RSS/API/MCP/品牌资源冒烟检查通过。补充核对身份页内容、导航隐藏、关闭模块的 404 状态及 09:00 日报 RSS。测试只用本机模拟模型/机器人，不调用真实付费服务。临时预览和测试数据库在本轮结束时清理。

部署文档已与本版本默认关闭采集的行为对齐；MiniMax Key 后续已补入本地配置，飞书 Webhook 已于后续步骤私密配置并联调；服务器、DNS、HTTPS、持续 worker 与生产备份仍待配置。


## 后续 X 与公众号信源需要提供什么

| 采集类型 | 必要信息 | 可选设置 |
|---|---|---|
| X | SocialData 账户的 API Key；要关注的公开账号名或主页链接 | 是否收回复、转帖，频率，进入精选或只作热度证据 |
| 微信公众号 | 极致了（Dajiala）账户的 API Key；公众号原始 ID（gh_…）和名称 | 抓取频率、分级、是否参与精选 |

公众号原始 ID 不清楚时可先提供公众号名称与一篇公开文章链接，后续再核实 ID。上述均使用框架现有的第三方采集服务，不需要把个人 X/微信登录密码或 Cookie 提供给本站。两个服务独立于 MiniMax 套餐计费；目前默认 RSS 信源不需要它们。公众号二维码属于展示入口，不是采集凭据。

## 2026-10-02 真实 MiniMax 验证与产品录像

用户提供 API Key 后，在独立本地演示数据库中通过项目回执与预算层完成 25 次 MiniMax-M3 真实调用，25 次均成功收到有效结果：结构化响应、3 篇预筛和结构抽取、6 次评分、3 次中文标题摘要、1 次归组与 1 次复核、1 次全文翻译、2 次事件综述、日报/周报/月报各 1 次，以及 1 次内容理解提示词和正式输出结构验证。模型回报 38,135 输入 tokens、2,694 输出 tokens；不把 tokens 换算为套餐请求额度。

3 篇自创样本默认评分分别为 4、8、34，均未达 T1 的 60 分门槛。只在演示数据库通过人工编辑覆盖选入，用于展示产品界面；默认评分门槛和提示词未改。全文翻译仅对自创的演示源授权，默认 18 个 RSS 的全文许可不变。内容理解因样本未触发入选分支，单独验证了正式提示词及同等输出结构，不能当成自然入选全流程质量评测。

主要页面、RSS、REST API、MCP 握手与品牌资源冒烟通过。产品演示录制真实本地浏览器操作，带中文章节、旁白与演示数据标注。录像录制时持续采集、模型全局调用、飞书、推送和 IndexNow 均关闭；只在有限测试进程开启模型调用。视觉、嵌入、X/公众号采集未真实联调，录像不代表已经上线。飞书额度提醒已在录制后的配置步骤启用并联调，见下文。

2026-10-02 后续飞书配置：新增 Token Plan 剩余额度轮询，并以本地模拟验证 0% 提醒、窗口去重、投递失败重试、普通限流不误报和额度查询失败的回执兜底；真实飞书仅发送一条明确标记的联调消息，未耗尽真实套餐。先前演示视频展示的是本次配置前的状态。

飞书配置验证：类型检查、156 项后端测试、16 项前端测试与生产构建、主要页面与 RSS/API/MCP 冒烟检查通过。新增阈值测试全部采用本地模拟接口，不访问真实 MiniMax/飞书；唯一真实飞书测试消息由独立联调进程发送。
