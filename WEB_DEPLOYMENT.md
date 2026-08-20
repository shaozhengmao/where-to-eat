# Web 服务部署

`web/` 是无构建静态前端，`worker.js` 是同源 API 与高德 REST API 的服务端代理。部署目标为 Cloudflare Workers，前端与 `/api/recommend` 由同一个 Worker 域名提供。

## 前置条件

- Node.js 与 Wrangler 4.x。
- 已登录 Cloudflare：`wrangler login`。
- 已在高德开放平台创建 Web 服务 Key，并开通地理编码、POI 搜索和路径规划。

## 部署

```bash
# 在项目根目录运行
wrangler deploy
```

高德 Key 不需要配置为 Cloudflare Secret。首次部署会创建：

- `where-to-eat` Worker；
- `web/` 对应的静态资源。

部署后使用 Wrangler 输出的 `*.workers.dev` URL 访问服务。绑定自定义域名可在 Cloudflare Dashboard 的 Worker 设置中完成，或在 `wrangler.jsonc` 中添加已验证域名对应的路由。

## 本地运行

运行 Worker：

```bash
wrangler dev --local --port 8787
```

打开 `http://localhost:8787`，然后在页面中填写自己的高德 Key。

只检查页面布局时，也可以运行：

```bash
python3 -m http.server 8788 -d web
```

静态服务器没有 Worker API，因此页面会明确显示本地样例结果，而不是伪装成高德实时数据。

## Key 使用方式

- 每次请求必须在页面填写高德 Web 服务 Key。
- Worker 不读取默认服务端 Key，也不保存用户 Key。
- Key 只随当前请求传给 Worker，不写入 URL、浏览器存储、Worker 存储或日志。
- 不要把 Key 提交到仓库、放入 `wrangler.jsonc`，或写入前端 JavaScript。

## 当前请求预算

- 2–5 位参与者；
- 最多评估 9 家交通平衡的候选餐厅，输出最佳 3 家；
- 每位参与者、每家候选餐厅、每种选中出行方式各查询一次路线，最多 135 条路线请求；
- 3 次周边餐厅搜索，最多 9 次餐厅详情查询。

候选餐厅按当前公平策略排序：最慢的人更快、时间差最小或平均耗时最低。餐厅口味会参与 POI 搜索与筛选，评分仅作为可用性和同分时的辅助信息。

## 运维建议

- 在 Cloudflare Dashboard 查看 Worker Observability，排查高德上游失败与 Worker 异常。
- 生产环境不要记录完整请求体，特别是 `amapKey` 字段。
- 高德返回限流时，Worker 会有限重试并向用户返回可读错误；不要在前端无限重试。
- 使用者应根据自己的高德账户额度控制查询频率和候选数量。
