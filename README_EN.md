<h1 align="center">Where to Eat</h1>

<p align="center">
  <strong>Find a restaurant that is fairer for the whole group, using real travel times.</strong><br />
  <em>多人聚餐，按真实到店路线找到更公平的餐厅。</em>
</p>

<p align="center">
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" />
  <img alt="Amap" src="https://img.shields.io/badge/Map-Amap-00A6A6" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

Most “find a middle point” tools stop at an abstract coordinate. Group dining ends at a restaurant: everyone needs a workable route, the slowest trip matters, and the suggestion must be explainable.

Where to Eat searches food-matched restaurants, calculates complete routes for every participant, and returns one primary recommendation with up to two alternatives. Its default strategy minimizes the slowest participant's travel time; smallest time spread and lowest average time are also available.

> Currently supports Beijing, Shanghai, Guangzhou, and Shenzhen, for groups of 2–5 participants.

## ✨ Features

- Restaurant-first recommendation based on complete participant routes.
- Three fairness strategies: smallest maximum travel time, smallest spread, or lowest average.
- Ambiguous locations resolve as metro station, bus stop, then original place, with the result shown to users.
- Transit instructions include boarding station, line, transfer station, alighting station, and final walk.
- Food preference is part of candidate search; rating is not the primary ranking signal.
- Public daily usage allowance, plus an optional user-provided Amap key for one request only.
- A conversational MCP Skill and a Cloudflare Workers web service.

## 🚀 Deploy to Cloudflare

Create an Amap Web Service key with geocoding, route planning, and POI search enabled, then run:

```bash
git clone https://github.com/shaozhengmao/where-to-eat.git
cd where-to-eat
wrangler secret put AMAP_WEB_KEY
wrangler deploy
```

The Worker serves the static site and `/api/recommend` from one origin. It keeps `AMAP_WEB_KEY` server-side and uses a Durable Object to atomically enforce the public daily allowance.

The optional “Use your own Amap key” field means that the submitted key is used for this request only. It is not stored in the browser, URL, Worker storage, or logs, and does not consume public usage.

See [WEB_DEPLOYMENT.md](WEB_DEPLOYMENT.md) for local development, deployment, request budgets, and operational guidance.

## 🧭 How It Works

```text
Participants + food preference
  -> resolve locations
  -> search candidate restaurants around transport-balanced areas
  -> calculate complete routes for every participant
  -> rank by the selected fairness strategy
  -> one primary restaurant + up to two alternatives
```

When an arrival time is supplied, the app suggests departure times using route duration plus a five-minute buffer. API route times are query-time values and do not promise future traffic conditions.

## 📁 Structure

```text
where-to-eat/
├── web/                    # Static frontend
├── worker.js               # Cloudflare Worker, Amap API proxy, ranking, allowance
├── wrangler.jsonc          # Worker, static assets, Durable Object config
├── SKILL.md                # Conversational MCP workflow
├── WEB_DEPLOYMENT.md       # Local development and Cloudflare deployment
├── references/             # Algorithm and Amap MCP references
└── scripts/
```

## 📄 License

[MIT](LICENSE) © 2026 shaozhengmao
