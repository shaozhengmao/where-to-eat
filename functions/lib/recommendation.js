const MAX_PARTICIPANTS = 5;
const MAX_CANDIDATES = 3;
const RESTAURANTS_PER_SEED = 5;
const MAX_RESTAURANT_DETAILS = 9;
const SUPPORTED_CITIES = new Set(["北京", "上海", "广州", "深圳"]);
const SUPPORTED_MODES = new Set(["driving", "transit", "bicycle"]);
const CITY_ADCODE_PREFIX = { "北京": "11", "上海": "31", "广州": "4401", "深圳": "4403" };
const STRATEGIES = new Set(["spread", "max", "average"]);

export async function handleRecommendation(request) {
  let payload;
  try {
    if (Number(request.headers.get("content-length") || 0) > 20_000) throw new Error("payload too large");
    payload = await request.json();
    validatePayload(payload);
  } catch (error) {
    return json({ error: "INVALID_REQUEST", message: error.message }, 400);
  }

  const amapKey = typeof payload.amapKey === "string" && payload.amapKey.trim();
  if (!amapKey) return json({ error: "AMAP_KEY_REQUIRED", message: "请在页面中填写高德 Web 服务 Key 后再生成方案。" }, 400);

  try {
    const geocoded = await geocodeParticipants(payload, amapKey);
    const result = await buildRecommendation(payload, amapKey, geocoded);
    return json(result);
  } catch (error) {
    const status = error.code === "INVALID_LOCATION" || error.code === "ROUTE_UNAVAILABLE" ? 400 : error.code === "AMAP_QUOTA_EXCEEDED" ? 429 : 502;
    return json({ error: error.code || "AMAP_REQUEST_FAILED", message: error.message }, status);
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("payload must be an object");
  if (!SUPPORTED_CITIES.has(payload.city)) throw new Error("city must be one of: 北京, 上海, 广州, 深圳");
  if (!Array.isArray(payload.participants) || payload.participants.length < 2 || payload.participants.length > MAX_PARTICIPANTS) throw new Error("participants must contain 2-5 people");
  if (!payload.participants.every(person => person && typeof person.location === "string" && person.location.trim())) throw new Error("each participant needs a location");
  if (!Array.isArray(payload.modes) || !payload.modes.length || !payload.modes.every(mode => SUPPORTED_MODES.has(mode))) throw new Error("select one or more supported transport modes");
  if (payload.strategy !== undefined && !STRATEGIES.has(payload.strategy)) throw new Error("strategy must be spread, max, or average");
}

async function geocodeParticipants(payload, key) {
  return Promise.all(payload.participants.map(async person => ({ ...person, point: await amapGeo(key, person.location, payload.city) })));
}

async function buildRecommendation(payload, key, geocoded) {
  const points = geocoded.map(person => person.point);
  const seeds = makeCandidateSeeds(points, centroid(points)).slice(0, MAX_CANDIDATES);
  const restaurantCandidates = await findCandidateRestaurants(key, payload.food || "餐厅", seeds);
  const candidates = await mapWithConcurrency(restaurantCandidates, 1, async candidate => {
    const routeResults = await mapWithConcurrency(geocoded, 2, person => getRoutes(key, person.point, candidate.point, payload.city, payload.modes));
    const routes = routeResults.map(result => result.routes);
    const score = scoreCandidate(routes, payload.modes, geocoded.length, payload.strategy || "max");
    return { ...candidate, routes, score, routeErrors: routeResults.flatMap(result => result.errors || []) };
  });
  const viable = candidates.filter(candidate => candidate.score);
  if (!viable.length) {
    const upstreamError = candidates.flatMap(candidate => candidate.routeErrors || []).find(Boolean);
    if (upstreamError) throw upstreamError;
    throw codedError("ROUTE_UNAVAILABLE", "所选出行方式无法为所有参与者规划完整路线。请切换出行方式，或确认每个出发地的识别结果。");
  }
  viable.sort((a, b) => compareScore(a.score, b.score));
  const finalists = viable.slice(0, MAX_CANDIDATES);
  const selected = finalists[0];
  return {
    source: "amap",
    meetingPoint: selected.restaurant.name || "推荐餐厅",
    subtitle: `${payload.participants.length} 人 · ${payload.food || "餐厅"} · ${payload.meetingTime || "未指定到达时间"}到达`,
    coordinates: selected.point,
    resolvedParticipants: geocoded.map(person => ({ name: person.name || "参与者", input: person.location, resolved: person.point.label })),
    recommendedMode: modeLabel(selected.score.mode),
    strategy: payload.strategy || "max",
    plans: summarizeRoutes(selected.routes, payload.modes),
    candidates: finalists.map((candidate, index) => ({
      name: candidate.restaurant.name || `候选餐厅 ${index + 1}`,
      detail: candidate.restaurant.detail,
      recommendedMode: modeLabel(candidate.score.mode),
      spread: candidate.score.spread,
      max: candidate.score.max,
      avg: candidate.score.avg,
      variance: candidate.score.variance,
      selected: candidate === selected,
      amapUrl: amapPoiUrl(candidate.restaurant),
      routes: candidate.routes.map((route, personIndex) => ({
        name: geocoded[personIndex].name || `参与者 ${personIndex + 1}`,
        modes: Object.fromEntries(Object.entries(route).map(([mode, value]) => [mode, value && { minutes: value.minutes, detail: value.detail, departure: suggestedDeparture(payload.meetingTime, value.minutes) }]))
      }))
    })),
    restaurants: finalists.map(candidate => candidate.restaurant)
  };
}

async function amapGeo(key, address, city) {
  const explicitPlaceType = /地铁|公交|站|小区|社区|大厦|园区|商场|广场|街道|路|号/.test(address);
  const stationQueries = explicitPlaceType ? [] : [`${address}地铁站`, `${address}公交站`];
  let geocode;
  for (const query of stationQueries) {
    const data = await amap("https://restapi.amap.com/v3/geocode/geo", key, { address: query, city });
    const candidate = data.geocodes?.[0];
    if (isTransitStop(candidate)) { geocode = candidate; break; }
  }
  if (!geocode) {
    const data = await amap("https://restapi.amap.com/v3/geocode/geo", key, { address, city });
    geocode = data.geocodes?.[0];
  }
  const location = geocode?.location;
  if (!location) throw codedError("INVALID_LOCATION", `无法定位“${address}”，请填写${city}内的地铁站、小区或商圈。`);
  if (!String(geocode.adcode || "").startsWith(CITY_ADCODE_PREFIX[city])) throw codedError("INVALID_LOCATION", `“${address}”不在${city}，请切换城市或修改出发地。`);
  const [lng, lat] = location.split(",").map(Number);
  return { lng, lat, label: geocode.formatted_address || geocode.address || address };
}

function isTransitStop(geocode) {
  return Boolean(geocode?.location) && String(geocode.level || "").includes("公交地铁站点");
}

async function amapReverseGeo(key, point) {
  const data = await amap("https://restapi.amap.com/v3/geocode/regeo", key, { location: `${point.lng},${point.lat}`, extensions: "base" });
  return { name: data.regeocode?.formatted_address || "候选区域" };
}

async function getRoutes(key, origin, destination, city, modes) {
  const results = {};
  const errors = [];
  if (modes.includes("driving")) { const result = await routeDuration("https://restapi.amap.com/v5/direction/driving", key, { origin: `${origin.lng},${origin.lat}`, destination: `${destination.lng},${destination.lat}` }, data => ({ duration: data.route?.paths?.[0]?.duration, detail: drivingSummary(data) })); results.driving = result.value; if (result.error) errors.push(result.error); }
  if (modes.includes("transit")) { const result = await routeDuration("https://restapi.amap.com/v3/direction/transit/integrated", key, { origin: `${origin.lng},${origin.lat}`, destination: `${destination.lng},${destination.lat}`, city, cityd: city, strategy: 0 }, data => ({ duration: data.route?.transits?.[0]?.duration, detail: transitLines(data) })); results.transit = result.value; if (result.error) errors.push(result.error); }
  if (modes.includes("bicycle")) { const result = await routeDuration("https://restapi.amap.com/v5/direction/bicycling", key, { origin: `${origin.lng},${origin.lat}`, destination: `${destination.lng},${destination.lat}` }, data => ({ duration: data.route?.paths?.[0]?.duration, detail: bicycleSummary(data) })); results.bicycle = result.value; if (result.error) errors.push(result.error); }
  return { routes: results, errors };
}

async function routeDuration(endpoint, key, params, readDuration) {
  try {
    const data = await amap(endpoint, key, params);
    const route = readDuration(data);
    const minutes = Number(route?.duration || 0) / 60;
    return { value: Number.isFinite(minutes) && minutes > 0 ? { minutes, detail: route.detail } : null };
  } catch (error) {
    return { value: null, error };
  }
}

async function findCandidateRestaurants(key, food, seeds) {
  const raw = await Promise.all(seeds.map(async seed => {
    const data = await amap("https://restapi.amap.com/v5/place/around", key, { keywords: food, location: `${seed.lng},${seed.lat}`, radius: 3000, page_size: 10, show_fields: "business" });
    return (data.pois || []).filter(poi => poi?.id && poi.location).sort((a, b) => restaurantRank(b, seed) - restaurantRank(a, seed)).slice(0, RESTAURANTS_PER_SEED);
  }));
  const uniquePois = [...new Map(raw.flat().map(poi => [poi.id, poi])).values()].slice(0, MAX_RESTAURANT_DETAILS);
  return mapWithConcurrency(uniquePois, 2, async poi => {
    const point = parsePoint(poi.location);
    const detail = await amap("https://restapi.amap.com/v5/place/detail", key, { id: poi.id, show_fields: "business" }).then(result => result.pois?.[0] || poi).catch(() => poi);
    return { point, restaurant: normalizeRestaurant(detail, food, point) };
  });
}

async function amap(endpoint, key, params) {
  const query = new URLSearchParams({ key, ...params });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${endpoint}?${query}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Amap HTTP ${response.status}`);
    const data = await response.json();
    if (data.status === "1") return data;
    if (data.infocode === "10021" && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
      continue;
    }
    const code = data.infocode === "10021" ? "AMAP_QUOTA_EXCEEDED" : "AMAP_REQUEST_FAILED";
    throw codedError(code, data.infocode === "10021" ? "这个高德 Key 的瞬时调用频率仍然过高，请稍后几秒再试。" : `${data.info || "高德请求被拒绝"}（错误码 ${data.infocode || "未知"}）`);
  }
  throw codedError("AMAP_REQUEST_FAILED", "高德请求重试失败。");
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function centroid(points) {
  return { lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length, lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length };
}

function makeCandidateSeeds(points, center) {
  const midpoint = (a, b) => ({ lng: (a.lng + b.lng) / 2, lat: (a.lat + b.lat) / 2 });
  return [center, midpoint(points[0], points[1]), midpoint(points.at(-1), points[0])];
}

function scoreCandidate(routes, modes, participantCount, strategy) {
  const scores = modes.map(mode => {
    const values = routes.map(route => route[mode]?.minutes);
    if (values.length !== participantCount || values.some(value => !Number.isFinite(value))) return null;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
    const max = Math.max(...values);
    const spread = max - Math.min(...values);
    const metrics = { mode, max, avg, variance, spread };
    if (strategy === "max") return { ...metrics, primary: max, secondary: spread, tertiary: avg };
    if (strategy === "average") return { ...metrics, primary: avg, secondary: spread, tertiary: max };
    return { ...metrics, primary: spread, secondary: max, tertiary: avg };
  }).filter(Boolean);
  return scores.sort(compareScore)[0] || null;
}

function compareScore(a, b) {
  return a.primary - b.primary || a.secondary - b.secondary || a.tertiary - b.tertiary;
}

function summarizeRoutes(routes, modes) {
  return modes.map(mode => {
    const values = routes.map(route => route[mode]?.minutes);
    if (values.some(value => !Number.isFinite(value))) return null;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
    return { mode: modeLabel(mode), modeKey: mode, avg, variance, max: Math.max(...values), spread: Math.max(...values) - Math.min(...values), width: Math.max(15, Math.min(100, 80 - variance / 3)) };
  }).filter(Boolean);
}

function distanceKm(origin, location) {
  if (typeof location !== "string") return Infinity;
  const [lng, lat] = location.split(",").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Infinity;
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat - origin.lat);
  const dLng = radians(lng - origin.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(origin.lat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function numericRating(value) { return Number(value) || 0; }
function modeLabel(mode) { return mode === "transit" ? "公共交通" : mode === "driving" ? "驾车" : "自行车"; }
function parsePoint(location) { const [lng, lat] = String(location).split(",").map(Number); return { lng, lat }; }
function transitLines(data) {
  const segments = data.route?.transits?.[0]?.segments || [];
  const rides = segments.flatMap((segment, segmentIndex) => (segment.bus?.buslines || []).map(line => ({ line, segmentIndex }))).filter(({ line }) => line.departure_stop?.name && line.arrival_stop?.name);
  if (!rides.length) return "公共交通 · 请在高德地图查看完整路线";
  const parts = rides.map(({ line }, index) => `${index ? `在${stopName(line.departure_stop.name)}换乘` : `${stopName(line.departure_stop.name)}乘`}${shortLineName(line.name)}至${stopName(line.arrival_stop.name)}`);
  const lastRideSegment = rides.at(-1).segmentIndex;
  const finalWalk = segments.slice(lastRideSegment + 1).map(segment => Number(segment.walking?.distance || 0)).reduce((total, distance) => total + distance, 0);
  const walkingSuffix = finalWalk >= 100 ? `，步行${formatDistance(finalWalk)}到餐厅` : "";
  return `公共交通 · ${parts.join("，")}${walkingSuffix}`;
}
function shortLineName(name) { return String(name || "公共交通").replace(/\([^)]*\)/g, ""); }
function stopName(name) { return String(name || "").replace(/\(地铁站\)|\(公交站\)/g, "") + "站"; }
function formatDistance(meters) { return meters >= 1000 ? `${Math.round(meters / 100) / 10} 公里` : `${Math.round(meters)} 米`; }
function drivingSummary(data) { const path = data.route?.paths?.[0]; const roads = (path?.steps || []).map(step => step.road).filter(Boolean); return roads.length ? `驾车 · ${[...new Set(roads)].slice(0, 3).join(" → ")}` : `驾车 · ${Math.round(Number(path?.distance || 0) / 100) / 10} km`; }
function bicycleSummary(data) { const path = data.route?.paths?.[0]; return `自行车 · ${Math.round(Number(path?.distance || 0) / 100) / 10} km`; }
function restaurantRank(poi, seed) { const point = parsePoint(poi.location); const rating = numericRating(poi.biz_ext?.rating || poi.rating); const distance = distanceKm(seed, poi.location); return rating * 10 - distance; }
function normalizeRestaurant(poi, food, point) { const score = poi.biz_ext?.rating || poi.rating || "-"; const distance = distanceKm(point, poi.location); return { name: poi.name, detail: `${poi.type || food} · ${poi.address || "附近"}`, score, address: poi.address, location: poi.location, distance, relevance: food }; }
function amapPoiUrl(restaurant) { return `https://uri.amap.com/marker?position=${encodeURIComponent(restaurant.location)}&name=${encodeURIComponent(restaurant.name || "推荐餐厅")}&callnative=1`; }
function suggestedDeparture(meetingTime, duration) { if (!/^\d{2}:\d{2}$/.test(meetingTime || "")) return null; const [hours, minutes] = meetingTime.split(":").map(Number); const total = (hours * 60 + minutes - Math.ceil(duration) - 5 + 24 * 60) % (24 * 60); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
function json(body, status = 200, extraHeaders = {}) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders } }); }
