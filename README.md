<h1 align="center">Where to Eat</h1>

<p align="center">
  <strong>多人聚餐，按真实到店路线找到更公平的餐厅。</strong><br />
  <em>Find restaurants that are fairer for the whole group, using real travel times.</em>
</p>

<p align="center">
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" />
  <img alt="Amap" src="https://img.shields.io/badge/Map-Amap-00A6A6" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="Version" src="https://img.shields.io/badge/version-2.1.0-245B4A" />
</p>

---

多数“找中间地点”的工具止步于一个抽象坐标。但聚餐的终点是餐厅：每个人能不能到、谁走得最久、路线是否讲得清楚，才决定这个建议能否真正被采纳。

Where to Eat 从参与者出发地和口味出发，搜索多个候选餐厅，逐一计算所有人的实际路线，再给出 1 家推荐和最多 2 家备选。默认优先让最慢的人更快；也可以按“时间差最小”或“平均耗时最低”重新排序。

> 当前支持北京、上海、广州、深圳；每次 2–5 位参与者。

## ✨ 功能特性

- **以餐厅为终点**：重心和交通平衡区域只用于搜索，最终由每个人到餐厅的真实路线决定。
- **三种公平策略**：默认“最慢的人更快”；可切换“时间差最小”与“平均耗时最低”。
- **可核验的地点识别**：模糊地名依次尝试地铁站、公交站、原始地点，并展示“原始输入 → 实际使用地点”。
- **完整路线说明**：公共交通结果包含上车站、线路、换乘站、下车站和最后步行。
- **口味优先的候选搜索**：按日料、火锅、烤肉等偏好搜索，不把评分当作唯一排序条件。
- **公共额度与自带 Key**：服务端 Key 受每日公共使用次数保护；用户也可以临时使用自己的高德 Key，仅用于这一次请求，不保存。
- **两个使用入口**：对话式 Skill 使用高德 MCP；Web 服务部署在 Cloudflare Workers 上。

## 🚀 部署到 Cloudflare

前提：已安装并登录 Wrangler，且已在 [高德开放平台](https://lbs.amap.com/) 创建 **Web 服务 Key**，开通地理编码、路径规划和 POI 搜索能力。

```bash
git clone https://github.com/shaozhengmao/where-to-eat.git
cd where-to-eat

# 将服务端高德 Key 写入 Cloudflare Secret，不会提交到 Git
wrangler secret put AMAP_WEB_KEY

# 首次部署会创建 Worker、静态资源绑定和 Durable Object
wrangler deploy
```

部署成功后，Cloudflare 会输出 `*.workers.dev` 地址。需要绑定自己的域名时，在 Cloudflare Dashboard 的 Worker 设置中添加 Custom Domain，或在 `wrangler.jsonc` 中配置路由后再次部署。

运行架构：

```text
浏览器
  -> Cloudflare Worker
       -> web/ 静态页面
       -> /api/recommend
            -> 高德 Web 服务 REST API
            -> Durable Object（每日公共使用次数）
```

浏览器不会直接请求高德，服务端 `AMAP_WEB_KEY` 不会返回给浏览器。页面中“使用自己的高德 Key”就是“用户自带 Key”：该 Key 只随当前 HTTPS 请求发送给 Worker，不写入 URL、不存入浏览器、不计入公共使用次数。

完整部署与本地运行说明见 [WEB_DEPLOYMENT.md](WEB_DEPLOYMENT.md)。

## 🧭 使用方式

### Web 服务

填写 2–5 位参与者的出发地，选择城市、口味和出行方式。系统会先显示地点解析结果，再推荐餐厅与每个人的路线。

示例：

```text
城市：北京
参与者：望京、霍营、朱辛庄
口味：日料
到达时间：19:00
```

“望京”这类未注明类型的地名会按 `望京地铁站 → 望京公交站 → 望京` 解析。若解析结果不符合实际，修改为具体站名、小区、商场或地址后重新查询。

### 对话式 Skill

[`SKILL.md`](SKILL.md) 面向已配置高德 MCP 的 Codex、Cursor、Claude 等环境。Key 应在 MCP 或运行环境中配置，**不会要求用户把 Key 粘贴到对话中**。若 MCP 或 Key 未配置，应先完成环境配置，而不是在聊天中发送密钥。

## 🔧 推荐与排序逻辑

1. 解析每个出发地，并验证是否属于所选城市。
2. 用重心及两个交通平衡区域搜索口味匹配的餐厅，去重后保留有限候选。
3. 为每个候选餐厅计算每位参与者的完整路线。
4. 对每种允许的出行方式计算：最慢耗时、时间差、平均耗时。
5. 按所选策略选出 1 家推荐和最多 2 家备选。

默认策略的比较顺序为：

```text
最慢的人更快：最慢耗时 -> 时间差 -> 平均耗时
时间差最小：  时间差   -> 最慢耗时 -> 平均耗时
平均耗时最低：平均耗时 -> 最慢耗时 -> 时间差
```

指定到达时间时，会按“路线耗时 + 5 分钟缓冲”给出建议出发时间。路线数据反映的是查询时高德 API 的结果，不承诺预测未来时段的拥堵或候车情况。

## 📁 目录结构

```text
where-to-eat/
├── web/                    # 无构建前端页面
├── worker.js               # Cloudflare Worker：API 代理、候选排序、公共额度
├── wrangler.jsonc          # Worker、静态资源、Durable Object 配置
├── SKILL.md                # 对话式 MCP 工作流
├── WEB_DEPLOYMENT.md       # 本地运行与 Cloudflare 部署说明
├── references/
│   ├── algorithm.md        # 地理与公平指标背景
│   └── api-guide.md        # 高德 MCP API 参考
└── scripts/
    └── centroid_calculator.py
```

## ⚠️ 使用边界

- 路线和餐厅数据来自高德，结果用于辅助聚餐决策，不保证餐厅营业、订位或实时道路状况。
- 公共使用次数按匿名浏览器身份与中国自然日计数；成功完成的共享 Key 查询才会消耗次数。使用自己的 Key 不消耗公共次数。
- 服务不保存用户的高德 Key。出发地只在当前请求中用于计算；部署方如需处理日志，应避免记录请求体和 Key。
- 高德服务的可用范围、配额与计费以高德开放平台规则为准。

## 📄 许可证

[MIT](LICENSE) © 2026 shaozhengmao
