const state = { city: "北京", strategy: "max", participants: [{ name: "我", location: "望京" }, { name: "小林", location: "霍营" }, { name: "阿哲", location: "朱辛庄" }], modes: new Set(["transit", "driving"]) };

const list = document.querySelector("#participant-list");
const isLocalPreview = location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);

function renderParticipants() {
  list.innerHTML = state.participants.map((person, index) => `<div class="participant-row"><span class="participant-index">${String(index + 1).padStart(2, "0")}</span><input data-field="name" data-index="${index}" value="${escapeHtml(person.name)}" aria-label="参与者${index + 1}姓名" /><input data-field="location" data-index="${index}" value="${escapeHtml(person.location)}" placeholder="地铁站 / 小区，例如：望京地铁站" aria-label="参与者${index + 1}出发地" /><button class="remove-button" data-remove="${index}" type="button" aria-label="删除参与者">×</button></div>`).join("");
  document.querySelector("#add-participant").disabled = state.participants.length >= 5;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch])); }
function showMessage(message) { const box = document.querySelector("#form-message"); box.textContent = message; box.classList.remove("hidden"); }
function clearMessage() { document.querySelector("#form-message").classList.add("hidden"); }

document.querySelector("#add-participant").addEventListener("click", () => { if (state.participants.length < 5) { state.participants.push({ name: `朋友${state.participants.length + 1}`, location: "" }); renderParticipants(); list.lastElementChild.querySelector("input[data-field=location]").focus(); } });
list.addEventListener("input", event => { const target = event.target; if (target.dataset.index !== undefined) state.participants[Number(target.dataset.index)][target.dataset.field] = target.value; });
list.addEventListener("click", event => { const index = event.target.dataset.remove; if (index !== undefined && state.participants.length > 2) { state.participants.splice(Number(index), 1); renderParticipants(); } });
document.querySelector("#mode-pills").addEventListener("click", event => { const button = event.target.closest("button[data-mode]"); if (!button) return; const mode = button.dataset.mode; if (state.modes.has(mode) && state.modes.size > 1) state.modes.delete(mode); else state.modes.add(mode); button.classList.toggle("active", state.modes.has(mode)); });
document.querySelector("#strategy-pills").addEventListener("click", event => { const button = event.target.closest("button[data-strategy]"); if (!button) return; state.strategy = button.dataset.strategy; document.querySelectorAll(".strategy-pill").forEach(pill => { const active = pill === button; pill.classList.toggle("active", active); pill.setAttribute("aria-checked", String(active)); }); });
document.querySelector("#city-pills").addEventListener("click", event => { const button = event.target.closest("button[data-city]"); if (!button) return; state.city = button.dataset.city; document.querySelectorAll(".city-pill").forEach(pill => { const active = pill === button; pill.classList.toggle("active", active); pill.setAttribute("aria-checked", String(active)); }); });

document.querySelector("#recommend-form").addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage();
  const ownKey = document.querySelector("#amap-key").value.trim();
  if (!ownKey) { showMessage("请先填写高德 Web 服务 Key，再生成聚餐方案。"); document.querySelector("#amap-key").focus(); return; }
  const button = event.currentTarget.querySelector(".primary-button"); button.disabled = true; button.querySelector("span:first-child").textContent = "正在比较路线…";
  const payload = { city: state.city, food: document.querySelector("#food").value.trim() || "餐厅", meetingTime: document.querySelector("#meeting-time").value, participants: state.participants, modes: [...state.modes], strategy: state.strategy, amapKey: ownKey || undefined };
  let result;
  try {
    const response = await fetch("/api/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      if (isLocalPreview && [404, 501].includes(response.status)) { result = sampleRecommendation(payload); }
      else { const error = await response.json().catch(() => ({})); throw new Error(error.message || "暂时无法获取实时推荐，请稍后再试。"); }
    }
    if (result) {
      // Local static preview intentionally uses deterministic sample data.
    } else {
    result = await response.json();
    }
  } catch (error) {
    showMessage(error.message);
    button.disabled = false;
    button.querySelector("span:first-child").textContent = "生成聚餐方案";
    return;
  }
  renderProductResult(result, payload);
  button.disabled = false;
  button.querySelector("span:first-child").textContent = "生成聚餐方案";
});

function sampleRecommendation(payload) { const people = payload.participants; const restaurants = [{ name: "山本日式料理", detail: "日料 · 人均 ¥168 · 步行 4 分钟", score: "4.7" }, { name: "鸟久居酒屋", detail: "日料 · 人均 ¥126 · 步行 7 分钟", score: "4.6" }, { name: "本格烧肉专门店", detail: "烤肉 · 人均 ¥182 · 步行 9 分钟", score: "4.5" }]; const plans = [{ mode: "公共交通", avg: 38, variance: 18, max: 47, width: 73 }, { mode: "驾车", avg: 29, variance: 64, max: 42, width: 55 }, { mode: "自行车", avg: 34, variance: 42, max: 45, width: 64 }].filter(plan => payload.modes.includes(plan.mode === "公共交通" ? "transit" : plan.mode === "驾车" ? "driving" : "bicycle")); return { sample: true, meetingPoint: restaurants[0].name, subtitle: `${people.length} 人 · ${payload.food} · ${payload.meetingTime || "现在"} 到达`, recommendedMode: plans[0]?.mode || "公共交通", strategy: payload.strategy || "max", plans, candidates: [{ name: restaurants[0].name, detail: restaurants[0].detail, recommendedMode: plans[0]?.mode || "公共交通", max: 47, avg: 38, spread: 8, variance: 18, selected: true }, { name: restaurants[1].name, detail: restaurants[1].detail, recommendedMode: "公共交通", max: 52, avg: 40, spread: 12, variance: 24 }, { name: restaurants[2].name, detail: restaurants[2].detail, recommendedMode: "驾车", max: 55, avg: 37, spread: 18, variance: 33 }], restaurants }; }

function renderProductResult(result, payload) {
  document.querySelector("#empty-state").classList.add("hidden");
  const content = document.querySelector("#result-content");
  content.classList.remove("hidden");
  const selectedPlan = (result.plans || []).find(plan => plan.mode === result.recommendedMode) || result.plans?.[0];
  const resolvedLocations = (result.resolvedParticipants || []).map(person => `<li><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.input)} → ${escapeHtml(person.resolved)}</span></li>`).join("");
  const candidates = (result.candidates || []).map((candidate, index) => {
    const routeData = candidate.routes || payload.participants.map((person, index) => ({ name: person.name, modes: { sample: { minutes: Math.max(1, Math.round(candidate.avg + (index - 1) * 4)), detail: "示例路线" } } }));
    const people = routeData.map(person => {
      const routes = Object.values(person.modes || {}).filter(Boolean);
      const action = routes.map(route => `<strong>${Math.round(route.minutes)} 分钟${route.departure ? ` · ${escapeHtml(route.departure)} 出发` : ""}</strong><small>${escapeHtml(route.detail || "路线")}</small>`).join("<span class=\"route-separator\">/</span>");
      return `<div class="route-person"><span>${escapeHtml(person.name)}</span><span class="route-summary">${action || "暂无完整路线"}</span></div>`;
    }).join("");
    const amapLink = candidate.amapUrl ? `<a class="amap-link" href="${escapeHtml(candidate.amapUrl)}" target="_blank" rel="noreferrer">在高德地图打开 <span aria-hidden="true">↗</span></a>` : "";
    const summary = `<p>${escapeHtml(candidate.detail || "高德地图餐厅")} · ${escapeHtml(candidate.recommendedMode)} · 平均 ${Math.round(candidate.avg)} 分钟 · 最慢 ${Math.round(candidate.max)} 分钟 · 时间差 ${Math.round(candidate.spread)} 分钟</p>`;
    const details = `<div class="candidate-routes">${people}</div>${amapLink}`;
    if (candidate.selected) return `<article class="candidate-option selected"><div><p class="recommend-reason">推荐方案 · ${escapeHtml(strategyLabel(result.strategy))}</p><strong>${escapeHtml(candidate.name)}</strong>${summary}${details}</div></article>`;
    return `<details class="candidate-option backup-option"><summary><div><p class="backup-label">备选方案 ${index + 1}</p><strong>${escapeHtml(candidate.name)}</strong>${summary}</div></summary>${details}</details>`;
  }).join("");
  const sampleNotice = result.sample ? `<p class="sample-notice">本地样例数据，不代表实时路线、餐厅或评分。</p>` : "";
  content.innerHTML = `${sampleNotice}<div class="result-head"><div><p class="section-kicker">RECOMMENDATION</p><h2>${escapeHtml(result.meetingPoint || "候选餐厅")}</h2><p class="result-meta">${escapeHtml(result.subtitle || `${payload.participants.length} 人 · ${payload.food}`)}</p></div><span class="recommend-badge">${escapeHtml(result.recommendedMode || "最公平")}</span></div><div class="stat-grid"><div class="mini-stat"><small>推荐方式平均耗时</small><strong>${Math.round(selectedPlan?.avg || 0)} 分钟</strong></div><div class="mini-stat"><small>推荐方式最慢耗时</small><strong>${Math.round(selectedPlan?.max || 0)} 分钟</strong></div><div class="mini-stat"><small>公平候选</small><strong>${Math.min(3, result.candidates?.length || 0)} 家</strong></div></div><section class="result-section resolved-section"><h3>按以下地点计算</h3><p class="result-meta">请确认系统识别的出发地点。</p><ul class="resolved-locations">${resolvedLocations || "<li><span>本地样例不包含地点识别结果。</span></li>"}</ul></section><section class="result-section"><h3>推荐与备选</h3><p class="result-meta">${strategyLabel(result.strategy)}；推荐方案已展开，备选方案可查看路线。</p><div class="candidate-options">${candidates || "<p class=\"result-meta\">暂无候选数据</p>"}</div></section>`;
}

function strategyLabel(strategy) { return strategy === "max" ? "优先让最慢的人更快" : strategy === "average" ? "优先降低总体平均耗时" : "优先缩小所有人的时间差"; }

renderParticipants();
