<h1 align="center">Where to Eat</h1>

<p align="center">Group dining location & restaurant recommender — finds the fairest meeting point based on everyone's location and recommends nearby restaurants.</p>

<p align="center">Last updated: 2026-05 | <a href="./README.md">中文</a></p>

## Table of Contents

- [⚙️ Prerequisites](#prerequisites)
- [💡 Overview](#overview)
- [🕐 When to Use](#when-to-use)
- [🚀 Core Capabilities](#core-capabilities)
- [🎯 Design Principles](#design-principles)
- [📁 Repository Structure](#repository-structure)
- [🔖 Changelog](#changelog)
- [⚡ Quick Example](#quick-example)
- [📖 Related Docs](#related-docs)
- [📄 License](#license)

---

## Prerequisites

- **Amap (高德) API Key**: The skill uses Amap Web Service APIs for geocoding, route planning, and POI search. [Register on Amap Open Platform](https://lbs.amap.com/), create an app, and enable: Web Service, Geocoding/Reverse Geocoding, Route Planning, POI Search.
- **MCP Environment**: Configure the **Amap MCP service** (e.g. `amap-maps`) in Cursor / Claude or similar environments so the skill can call `mcp_amap-maps_*` tools. Store the API key in your MCP or environment config — **never commit it to this repo**.

---

## Overview

When a group wants to eat out together, this skill takes each person's starting location (e.g. metro station, neighborhood), calculates the **most time-fair** meeting point, and recommends **TOP 5 nearby restaurants** based on food preferences. Supports comparison across driving, subway, and bus, with optional Markdown export for easy sharing.

---

## When to Use

Trigger this skill when users say things like:

- "Let's grab food together", "find a middle point", "where should we meet to eat", "group dinner location"
- Or discuss: "multi-person dining", "most convenient spot", "restaurant recommendation"

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Geographic Center** | Calculates the centroid of all starting locations as the ideal meeting point baseline |
| **Multi-mode Travel Time** | Uses Amap API to fetch real-time driving/subway/bus times; distinguishes pure transit time from total travel time (including walking and transfers) |
| **Time Fairness** | Measures variance across participants' travel times — lower variance means fairer for everyone |
| **Multi-plan Comparison** | Presents driving, subway, and bus options side by side with pros/cons for the user to choose |
| **Restaurant Recommendation** | Ranks by rating and distance, recommends TOP 5, capped at ≤25 API detail calls |
| **Markdown Export** | Optionally generates and saves `dining-plan_[date]_[time].md` for sharing with the group |

---

## Design Principles

- **API First**: Travel times are based on Amap API results; estimates are only used when the API is unavailable and are clearly labeled as "estimated".
- **Leverage User Knowledge**: Proactively ask if users know a better route; if provided and verifiable, prioritize it.
- **Time Context**: Always clarify the dining time (e.g. "7pm"), distinguish between "leave now" and "arrive by a specific time", and account for peak hours and buffer time.
- **Respect Preferences**: If the user explicitly excludes a transport mode (e.g. "no e-bikes"), remove it entirely — it should not appear in any recommendation.

---

## Repository Structure

```
where-to-eat/
├── README.md                    # This document (Chinese)
├── README_EN.md                 # This document (English)
├── SKILL.md                     # Main skill doc (workflow, steps, rules)
├── SKILL_OPTIMIZATION_GUIDE.md  # Optimization notes and design trade-offs
├── CHANGELOG.md                 # Version history
├── references/
│   ├── algorithm.md             # Geographic and travel time algorithm details
│   ├── api-guide.md             # Amap API usage guide
│   └── examples.md              # Examples and sample dialogues
└── scripts/
    └── centroid_calculator.py   # Centroid calculation and travel time parsing (Python)
```

- **SKILL.md**: Full execution steps, parameter collection, data validation, and Markdown output — the primary reference when running the skill.
- **references/**: Algorithm details, API usage, and examples for implementation and debugging.
- **scripts/**: Reusable logic for centroid coordinates, API response parsing (e.g. splitting subway/bus segment times).

---

## Changelog

- **Current version**: v1.1.3
- **Key iterations** (see `CHANGELOG.md` for details):
  - v1.1.0: Refined API parsing, user route knowledge, time context, multi-plan comparison, and data validation.
  - v1.1.1: Fallback estimation when API is unavailable, with clear labeling.
  - v1.1.2: Formalized "API first, estimation only as fallback" principle.
  - v1.1.3: Added Step 10 — generate and save Markdown dining plan document.

---

## Quick Example

**User input**:
"Three of us are at Laiguangying, Huoying, and Zhuxinzhuang. We want BBQ — find us a meeting spot and restaurants."

**The skill will**:
1. Geocode all three locations to get coordinates.
2. Calculate the centroid; optionally ask the user if they know a better route.
3. Call Amap API to get driving/subway/bus travel times to the centroid, parsing walking, transfer, and pure transit segments.
4. Validate time reasonableness and compare similarity across transport plans.
5. Recommend a meeting area with pros/cons for each transport option.
6. Calculate departure times based on the dining time (including peak hours and buffer).
7. Search nearby restaurants for "BBQ" and recommend TOP 5.
8. Optionally generate and save `dining-plan_[date]_[time].md`.

---

## Related Docs

- Execution details and steps: **SKILL.md**
- Algorithms and API: **references/algorithm.md**, **references/api-guide.md**

---

## License

[MIT License](LICENSE)
