// もちぽよ マーケットポータル データ更新スクリプト（1ファイル版・自動生成）
// 使い方: node portal-update.mjs
// 必要な環境変数: FRED_API_KEY（米国データ）
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/entry.mjs
import { join as join10 } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// src/scripts/update-data.mjs
import { fileURLToPath } from "node:url";
import { dirname as dirname2, join as join9 } from "node:path";

// src/scripts/lib/util.mjs
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
var UA = "mochipoyo-market-portal/1.0 (+GitHub Actions; data refresh once or a few times a day)";
async function httpGet(fetchImpl, url, { headers = {}, timeoutMs = 3e4, retries = 2, as = "text", encoding = "utf-8" } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { headers: { "user-agent": UA, ...headers }, signal: ac.signal });
      if (!res.ok) {
        const body = await safeText(res);
        const err = new Error(`HTTP ${res.status} ${url} ${body.slice(0, 200)}`);
        err.status = res.status;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw Object.assign(err, { fatal: true });
        throw err;
      }
      if (as === "json") return await res.json();
      if (as === "bytes") return new Uint8Array(await res.arrayBuffer());
      if (encoding.toLowerCase() !== "utf-8") {
        return new TextDecoder(encoding).decode(new Uint8Array(await res.arrayBuffer()));
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (e.fatal || attempt === retries) break;
      await sleep(1500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const t = Date.parse(dateStr + "T00:00:00Z") + n * 864e5;
  return ymd(t);
}
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return ymd(t);
}
async function writeJson(file, obj) {
  await mkdir(dirname(file), { recursive: true });
  const prev = await readJson(file, null);
  if (prev && typeof prev === "object" && "updated" in obj) {
    const strip = (o) => JSON.stringify({ ...o, updated: null });
    if (strip(prev) === strip(obj)) return false;
  }
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(obj) + "\n", "utf8");
  await rename(tmp, file);
  return true;
}
async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
function num(v) {
  if (v === null || v === void 0) return null;
  const s = String(v).trim();
  if (s === "" || s === "." || s === "-" || s.toLowerCase() === "nan") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function round(v, digits = 4) {
  if (v === null || v === void 0 || !Number.isFinite(v)) return null;
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

// src/scripts/fetch-fred.mjs
var fetch_fred_exports = {};
__export(fetch_fred_exports, {
  RATE_SERIES: () => RATE_SERIES,
  buildMacro: () => buildMacro,
  changePoints: () => changePoints,
  crossMultiply: () => crossMultiply,
  diff: () => diff,
  mom: () => mom,
  run: () => run,
  yoy: () => yoy
});
import { join } from "node:path";
var API = "https://api.stlouisfed.org/fred/series/observations";
var RATE_SERIES = [
  ["DGS3MO", "3\u30AB\u6708"],
  ["DGS2", "2\u5E74"],
  ["DGS5", "5\u5E74"],
  ["DGS10", "10\u5E74"],
  ["DGS30", "30\u5E74"]
];
var FED_SERIES = ["DFEDTARL", "DFEDTARU"];
var FX_SERIES = ["DEXJPUS", "DEXUSUK", "DEXUSEU"];
var MACRO_SERIES = ["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE", "UNRATE", "PAYEMS", "CES0500000003", "ICSA", "SAHMREALTIME"];
async function getSeries(fetchImpl, key, id, start) {
  const url = `${API}?series_id=${id}&api_key=${encodeURIComponent(key)}&file_type=json&observation_start=${start}`;
  const json = await httpGet(fetchImpl, url, { as: "json" });
  if (!json || !Array.isArray(json.observations)) throw new Error(`${id}: \u60F3\u5B9A\u5916\u306E\u5FDC\u7B54`);
  const out = [];
  for (const o of json.observations) {
    const v = num(o.value);
    if (v !== null && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) out.push([o.date, v]);
  }
  return out;
}
function yoy(obs, lag = 12) {
  const map = new Map(obs.map(([d, v]) => [d, v]));
  const out = [];
  for (const [d, v] of obs) {
    const prev = map.get(addMonths(d, -lag));
    if (prev) out.push([d, round((v / prev - 1) * 100, 2)]);
  }
  return out;
}
function mom(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    if (addMonths(obs[i - 1][0], 1) !== obs[i][0]) continue;
    out.push([obs[i][0], round((obs[i][1] / obs[i - 1][1] - 1) * 100, 2)]);
  }
  return out;
}
function diff(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    if (addMonths(obs[i - 1][0], 1) !== obs[i][0]) continue;
    out.push([obs[i][0], round(obs[i][1] - obs[i - 1][1], 1)]);
  }
  return out;
}
function crossMultiply(a, b, digits = 3) {
  const m = new Map(b);
  const out = [];
  for (const [d, v] of a) {
    const w = m.get(d);
    if (w !== void 0) out.push([d, round(v * w, digits)]);
  }
  return out;
}
function changePoints(obs) {
  const out = [];
  for (const [d, v] of obs) {
    if (!out.length || out[out.length - 1][1] !== v) out.push([d, v]);
  }
  return out;
}
var tail = (arr, n) => arr.slice(Math.max(0, arr.length - n));
var pick = (series) => ({
  latest: series.length ? { date: series[series.length - 1][0], value: series[series.length - 1][1] } : null,
  prev: series.length > 1 ? { date: series[series.length - 2][0], value: series[series.length - 2][1] } : null
});
function buildMacro(raw) {
  const ind = [];
  const add = (o, series) => ind.push({ ...o, ...pick(series), series });
  add({ id: "cpi", name: "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", measure: "\u524D\u5E74\u6BD4", unit: "%", freq: "M", src: "BLS", fred: ["CPIAUCSL"], hint: "\u7269\u4FA1\u306E\u52E2\u3044\u3002\u9AD8\u3044\u307B\u3069\u5229\u4E0B\u3052\u3057\u306B\u304F\u3044" }, tail(yoy(raw.CPIAUCSL), 36));
  add({ id: "core_cpi", name: "\u30B3\u30A2CPI\uFF08\u98DF\u54C1\u30FB\u30A8\u30CD\u30EB\u30AE\u30FC\u9664\u304F\uFF09", measure: "\u524D\u5E74\u6BD4", unit: "%", freq: "M", src: "BLS", fred: ["CPILFESL"], hint: "FRB\u304C\u91CD\u8996\u3059\u308B\u57FA\u8ABF\u7684\u306A\u7269\u4FA1" }, tail(yoy(raw.CPILFESL), 36));
  add({ id: "cpi_mom", name: "CPI", measure: "\u524D\u6708\u6BD4", unit: "%", freq: "M", src: "BLS", fred: ["CPIAUCSL"], hint: "\u76F4\u8FD11\u30AB\u6708\u306E\u7269\u4FA1\u306E\u4F38\u3073" }, tail(mom(raw.CPIAUCSL), 36));
  add({ id: "core_pce", name: "\u30B3\u30A2PCE\u30C7\u30D5\u30EC\u30FC\u30BF\u30FC", measure: "\u524D\u5E74\u6BD4", unit: "%", freq: "M", src: "BEA", fred: ["PCEPILFE"], hint: "FRB\u306E\u7269\u4FA1\u76EE\u6A19\uFF082%\uFF09\u306B\u4F7F\u308F\u308C\u308B\u6307\u6A19" }, tail(yoy(raw.PCEPILFE), 36));
  add({ id: "pce", name: "PCE\u30C7\u30D5\u30EC\u30FC\u30BF\u30FC", measure: "\u524D\u5E74\u6BD4", unit: "%", freq: "M", src: "BEA", fred: ["PCEPI"], hint: "\u500B\u4EBA\u6D88\u8CBB\u5168\u4F53\u306E\u7269\u4FA1" }, tail(yoy(raw.PCEPI), 36));
  add({ id: "unrate", name: "\u5931\u696D\u7387", measure: "\u6C34\u6E96", unit: "%", freq: "M", src: "BLS", fred: ["UNRATE"], hint: "\u4E0A\u304C\u308B\u3068\u666F\u6C17\u6E1B\u901F\u306E\u30B5\u30A4\u30F3" }, tail(raw.UNRATE, 36));
  add({ id: "nfp", name: "\u975E\u8FB2\u696D\u90E8\u9580\u96C7\u7528\u8005\u6570", measure: "\u524D\u6708\u5DEE", unit: "\u5343\u4EBA", freq: "M", src: "BLS", fred: ["PAYEMS"], hint: "\u96C7\u7528\u306E\u5897\u3048\u65B9\u3002\u767A\u8868\u5F8C\u306B\u6539\u5B9A\u3055\u308C\u308B\u3053\u3068\u304C\u591A\u3044" }, tail(diff(raw.PAYEMS), 36));
  add({ id: "ahe", name: "\u5E73\u5747\u6642\u7D66", measure: "\u524D\u5E74\u6BD4", unit: "%", freq: "M", src: "BLS", fred: ["CES0500000003"], hint: "\u8CC3\u91D1\u306E\u4F38\u3073\u3002\u7269\u4FA1\u306E\u5148\u884C\u304D\u306B\u5F71\u97FF" }, tail(yoy(raw.CES0500000003), 36));
  add({ id: "claims", name: "\u65B0\u898F\u5931\u696D\u4FDD\u967A\u7533\u8ACB\u4EF6\u6570", measure: "\u9031\u6B21", unit: "\u4EF6", freq: "W", src: "\u7C73\u52B4\u50CD\u7701", fred: ["ICSA"], hint: "\u6BCE\u9031\u306E\u96C7\u7528\u306E\u4F53\u6E29\u8A08" }, tail(raw.ICSA, 104));
  add({ id: "sahm", name: "\u30B5\u30FC\u30E0\u30FB\u30EB\u30FC\u30EB\u6307\u6A19", measure: "\u6C34\u6E96", unit: "pt", freq: "M", src: "Claudia Sahm", fred: ["SAHMREALTIME"], hint: "0.50\u4EE5\u4E0A\u3067\u666F\u6C17\u5F8C\u9000\u5165\u308A\u306E\u30B5\u30A4\u30F3\u3068\u3055\u308C\u308B", threshold: 0.5 }, tail(raw.SAHMREALTIME, 36));
  return ind;
}
async function run({ fetch: fetchImpl = fetch, outDir, env = process.env, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  const key = env.FRED_API_KEY;
  if (!key) return { ok: false, skipped: true, message: "FRED_API_KEY \u304C\u672A\u8A2D\u5B9A\u306E\u305F\u3081\u30B9\u30AD\u30C3\u30D7" };
  const today = ymd(now);
  const raw = {};
  const plan = [
    ...RATE_SERIES.map(([id]) => [id, addDays(today, -365 * 3)]),
    ...FED_SERIES.map((id) => [id, addDays(today, -365 * 6)]),
    ...FX_SERIES.map((id) => [id, addDays(today, -365 * 3)]),
    ...MACRO_SERIES.map((id) => [id, addDays(today, -365 * 5)])
  ];
  for (const [id, start] of plan) {
    raw[id] = await getSeries(fetchImpl, key, id, start);
    if (!raw[id].length) throw new Error(`${id}: \u30C7\u30FC\u30BF\u304C\u7A7A\u3067\u3059`);
    await sleep(env.NODE_ENV === "test" ? 0 : 250);
  }
  const updated = now.toISOString();
  const fredNote = "This product uses the FRED\xAE API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.";
  const lower = changePoints(raw.DFEDTARL);
  const upper = changePoints(raw.DFEDTARU);
  const lastL = raw.DFEDTARL[raw.DFEDTARL.length - 1];
  const lastU = raw.DFEDTARU[raw.DFEDTARU.length - 1];
  const rates = {
    updated,
    source: "\u7C73\u9023\u90A6\u6E96\u5099\u5236\u5EA6\u7406\u4E8B\u4F1A\uFF08FRB\uFF09H.15\u30FBFOMC\u516C\u8868\u5024\uFF0FFRED\u7D4C\u7531",
    note: fredNote,
    tenors: RATE_SERIES.map(([id, label]) => ({ id, label })),
    series: Object.fromEntries(RATE_SERIES.map(([id]) => [id, raw[id]])),
    fed: { lower: lastL[1], upper: lastU[1], date: lastU[0], lowerHistory: lower, upperHistory: upper }
  };
  await writeJson(join(outDir, "us_rates.json"), rates);
  await writeJson(join(outDir, "us_macro.json"), { updated, source: "FRED\u7D4C\u7531\uFF08\u5404\u7D71\u8A08\u306E\u4F5C\u6210\u6A5F\u95A2\u306F\u9805\u76EE\u3054\u3068\u306B\u8A18\u8F09\uFF09", note: fredNote, indicators: buildMacro(raw) });
  const fx = {
    updated,
    source: "FRB H.10\uFF08NY\u6B63\u5348\u306E\u53C2\u8003\u30EC\u30FC\u30C8\uFF09\uFF0FFRED\u7D4C\u7531\u3002\u30DD\u30F3\u30C9\u5186\u30FB\u30E6\u30FC\u30ED\u5186\u306F\u5F53\u30B5\u30A4\u30C8\u3067\u639B\u3051\u7B97\u3057\u3066\u7B97\u51FA",
    note: fredNote,
    usdjpy: raw.DEXJPUS,
    gbpusd: raw.DEXUSUK,
    eurusd: raw.DEXUSEU,
    gbpjpy: crossMultiply(raw.DEXJPUS, raw.DEXUSUK),
    eurjpy: crossMultiply(raw.DEXJPUS, raw.DEXUSEU)
  };
  await writeJson(join(outDir, "fx_ref.json"), fx);
  log(`FRED: ${plan.length}\u7CFB\u5217\u3092\u53D6\u5F97\uFF08\u7C7310\u5E74 ${rates.series.DGS10.at(-1).join(" ")}\uFF09`);
  return { ok: true, message: `${plan.length}\u7CFB\u5217`, asOf: rates.series.DGS10.at(-1)[0] };
}

// src/scripts/fetch-jgb.mjs
var fetch_jgb_exports = {};
__export(fetch_jgb_exports, {
  URL_ALL: () => URL_ALL,
  URL_CURRENT: () => URL_CURRENT,
  mergeRows: () => mergeRows,
  parseJgbCsv: () => parseJgbCsv,
  parseJgbDate: () => parseJgbDate,
  run: () => run2
});
import { join as join2 } from "node:path";
var URL_CURRENT = "https://www.mof.go.jp/jgbs/reference/interest_rate/jgbcm.csv";
var URL_ALL = "https://www.mof.go.jp/jgbs/reference/interest_rate/data/jgbcm_all.csv";
var ERA = { M: 1867, T: 1911, S: 1925, H: 1988, R: 2018 };
function parseJgbDate(s) {
  s = String(s || "").trim();
  let m = s.match(/^([MTSHR])(\d+|元)\.(\d{1,2})\.(\d{1,2})$/);
  if (m) {
    const y = ERA[m[1]] + (m[2] === "\u5143" ? 1 : Number(m[2]));
    return `${y}-${String(m[3]).padStart(2, "0")}-${String(m[4]).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}
function parseJgbCsv(text) {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => ["\u57FA\u6E96\u65E5", "Date"].includes(String(r[0] || "").trim()));
  if (h < 0) throw new Error("\u898B\u51FA\u3057\u884C\uFF08\u57FA\u6E96\u65E5\uFF09\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  const tenors = rows[h].slice(1).map((c) => String(c).trim()).filter(Boolean).map((c) => c.replace(/年$/, "Y"));
  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const date = parseJgbDate(r[0]);
    if (!date) continue;
    out.push([date, tenors.map((_, j) => num(r[j + 1]))]);
  }
  return { tenors, rows: out };
}
function mergeRows(a, b) {
  const m = /* @__PURE__ */ new Map();
  for (const [d, v] of a) m.set(d, v);
  for (const [d, v] of b) m.set(d, v);
  return [...m.entries()].sort((x, y) => x[0] < y[0] ? -1 : 1);
}
async function run2({ fetch: fetchImpl = fetch, outDir, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  const curText = await httpGet(fetchImpl, URL_CURRENT, { encoding: "shift_jis" });
  const cur = parseJgbCsv(curText);
  let all = { tenors: cur.tenors, rows: [] };
  try {
    all = parseJgbCsv(await httpGet(fetchImpl, URL_ALL, { encoding: "shift_jis", timeoutMs: 6e4 }));
  } catch (e) {
    log(`JGB: \u904E\u53BB\u5206\u306E\u53D6\u5F97\u306B\u5931\u6557\uFF08\u5F53\u6708\u5206\u306E\u307F\u3067\u7D9A\u884C\uFF09: ${e.message}`);
  }
  if (all.tenors.join() !== cur.tenors.join()) {
    throw new Error(`\u5E74\u9650\u306E\u4E26\u3073\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093: ${all.tenors.join()} / ${cur.tenors.join()}`);
  }
  const since = addDays(ymd(now), -365 * 3 - 10);
  const rows = mergeRows(all.rows, cur.rows).filter(([d]) => d >= since);
  if (!rows.length) throw new Error("\u56FD\u50B5\u91D1\u5229\u306E\u30C7\u30FC\u30BF\u884C\u304C\u3042\u308A\u307E\u305B\u3093");
  await writeJson(join2(outDir, "jgb.json"), {
    updated: now.toISOString(),
    source: "\u8CA1\u52D9\u7701\u300C\u56FD\u50B5\u91D1\u5229\u60C5\u5831\u300D\uFF08https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm\uFF09\u3092\u52A0\u5DE5\u3057\u3066\u4F5C\u6210",
    license: "\u516C\u5171\u30C7\u30FC\u30BF\u5229\u7528\u898F\u7D04\uFF08\u7B2C1.0\u7248\uFF09",
    tenors: cur.tenors,
    rows
  });
  const last = rows[rows.length - 1];
  log(`JGB: ${rows.length}\u65E5\u5206\uFF08\u6700\u65B0 ${last[0]}\u300110\u5E74 ${last[1][cur.tenors.indexOf("10Y")]}%\uFF09`);
  return { ok: true, message: `${rows.length}\u65E5\u5206`, asOf: last[0] };
}

// src/scripts/fetch-cot.mjs
var fetch_cot_exports = {};
__export(fetch_cot_exports, {
  CURRENCIES: () => CURRENCIES,
  buildUrl: () => buildUrl,
  run: () => run3,
  shape: () => shape
});
import { join as join3 } from "node:path";
var ENDPOINT = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
var CURRENCIES = [
  { ccy: "JPY", code: "097741", name: "\u65E5\u672C\u5186" },
  { ccy: "GBP", code: "096742", name: "\u82F1\u30DD\u30F3\u30C9" },
  { ccy: "EUR", code: "099741", name: "\u30E6\u30FC\u30ED" },
  { ccy: "AUD", code: "232741", name: "\u8C6A\u30C9\u30EB" },
  { ccy: "NZD", code: "112741", name: "NZ\u30C9\u30EB" },
  { ccy: "CAD", code: "090741", name: "\u30AB\u30CA\u30C0\u30C9\u30EB" },
  { ccy: "CHF", code: "092741", name: "\u30B9\u30A4\u30B9\u30D5\u30E9\u30F3" },
  { ccy: "MXN", code: "095741", name: "\u30E1\u30AD\u30B7\u30B3\u30DA\u30BD" }
];
var FIELDS = [
  "report_date_as_yyyy_mm_dd",
  "cftc_contract_market_code",
  "open_interest_all",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
  "comm_positions_long_all",
  "comm_positions_short_all",
  "nonrept_positions_long_all",
  "nonrept_positions_short_all"
];
function buildUrl(since) {
  const codes = CURRENCIES.map((c) => `'${c.code}'`).join(",");
  const params = new URLSearchParams({
    $select: FIELDS.join(","),
    $where: `cftc_contract_market_code in(${codes}) AND report_date_as_yyyy_mm_dd >= '${since}T00:00:00.000'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: "5000"
  });
  return `${ENDPOINT}?${params.toString()}`;
}
function shape(records) {
  const by = new Map(CURRENCIES.map((c) => [c.code, /* @__PURE__ */ new Map()]));
  for (const r of records) {
    const m = by.get(String(r.cftc_contract_market_code || "").trim());
    if (!m) continue;
    const d = String(r.report_date_as_yyyy_mm_dd || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const row = [
      d,
      num(r.open_interest_all),
      num(r.noncomm_positions_long_all),
      num(r.noncomm_positions_short_all),
      num(r.comm_positions_long_all),
      num(r.comm_positions_short_all),
      num(r.nonrept_positions_long_all),
      num(r.nonrept_positions_short_all)
    ];
    if (row.slice(1, 4).some((v) => v === null)) continue;
    m.set(d, row);
  }
  return CURRENCIES.map((c) => ({
    ...c,
    rows: [...by.get(c.code).values()].sort((a, b) => a[0] < b[0] ? -1 : 1)
  }));
}
async function run3({ fetch: fetchImpl = fetch, outDir, now = /* @__PURE__ */ new Date(), env = process.env, log = console.log } = {}) {
  const since = addDays(ymd(now), -7 * 110);
  const headers = env.SOCRATA_APP_TOKEN ? { "X-App-Token": env.SOCRATA_APP_TOKEN } : {};
  const records = await httpGet(fetchImpl, buildUrl(since), { as: "json", headers, timeoutMs: 6e4 });
  if (!Array.isArray(records)) throw new Error("CFTC: \u60F3\u5B9A\u5916\u306E\u5FDC\u7B54");
  const currencies = shape(records);
  const missing = currencies.filter((c) => !c.rows.length).map((c) => c.ccy);
  if (missing.length === currencies.length) throw new Error("CFTC: \u5BFE\u8C61\u901A\u8CA8\u306E\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093");
  const latest = currencies.map((c) => c.rows.at(-1)?.[0]).filter(Boolean).sort().at(-1);
  await writeJson(join3(outDir, "cot.json"), {
    updated: now.toISOString(),
    source: "\u7C73\u5546\u54C1\u5148\u7269\u53D6\u5F15\u59D4\u54E1\u4F1A\uFF08CFTC\uFF09Commitments of Traders\uFF08Legacy\u30FBFutures Only\uFF09",
    columns: ["date", "open_interest", "noncomm_long", "noncomm_short", "comm_long", "comm_short", "nonrept_long", "nonrept_short"],
    latest,
    currencies
  });
  log(`CFTC: ${currencies.length}\u901A\u8CA8\uFF08\u6700\u65B0 ${latest}${missing.length ? `\u3001\u6B20\u3051: ${missing.join(",")}` : ""}\uFF09`);
  return { ok: true, message: missing.length ? `\u4E00\u90E8\u6B20\u3051 ${missing.join(",")}` : `${currencies.length}\u901A\u8CA8`, asOf: latest };
}

// src/scripts/fetch-policy.mjs
var fetch_policy_exports = {};
__export(fetch_policy_exports, {
  AREAS: () => AREAS,
  buildUrl: () => buildUrl2,
  parseBisCsv: () => parseBisCsv,
  run: () => run4
});
import { join as join4 } from "node:path";
var AREAS = ["US", "JP", "GB", "XM", "AU", "NZ", "CA", "CH"];
function buildUrl2(since) {
  return `https://stats.bis.org/api/v1/data/WS_CBPOL/D.${AREAS.join("+")}/all?startPeriod=${since}&format=csv`;
}
function parseBisCsv(text) {
  const rows = parseCsv(text).filter((r) => r.length > 1);
  if (!rows.length) throw new Error("BIS: \u7A7A\u306ECSV");
  const head = rows[0].map((h) => h.trim());
  const iA = head.indexOf("REF_AREA"), iT = head.indexOf("TIME_PERIOD"), iV = head.indexOf("OBS_VALUE");
  if (iA < 0 || iT < 0 || iV < 0) throw new Error("BIS: \u5217\u540D\u304C\u60F3\u5B9A\u3068\u9055\u3044\u307E\u3059 " + head.join(","));
  const by = {};
  for (const r of rows.slice(1)) {
    const area = String(r[iA] || "").split(":")[0].trim();
    const date = String(r[iT] || "").trim();
    const v = num(r[iV]);
    if (!AREAS.includes(area) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || v === null) continue;
    (by[area] ||= []).push([date, v]);
  }
  const areas = {};
  for (const [area, obs] of Object.entries(by)) {
    obs.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const changes = [];
    for (const [d, v] of obs) if (!changes.length || changes.at(-1)[1] !== v) changes.push([d, v]);
    areas[area] = { last: obs.at(-1), changes };
  }
  return areas;
}
async function run4({ fetch: fetchImpl = fetch, outDir, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  const since = addDays(ymd(now), -365 * 3);
  const text = await httpGet(fetchImpl, buildUrl2(since), { timeoutMs: 6e4 });
  const areas = parseBisCsv(text);
  const got = Object.keys(areas);
  if (!got.length) throw new Error("BIS: \u5BFE\u8C61\u56FD\u306E\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093");
  await writeJson(join4(outDir, "policy_bis.json"), {
    updated: now.toISOString(),
    source: "BIS\uFF08\u56FD\u969B\u6C7A\u6E08\u9280\u884C\uFF09Central bank policy rates\u3002BIS\u306B\u3088\u308B\u516C\u5F0F\u7FFB\u8A33\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
    areas
  });
  const lag = got.map((a) => `${a} ${areas[a].last[0].slice(5)}`).join(" / ");
  log(`BIS: ${got.length}\u5730\u57DF\uFF08\u6700\u7D42\u89B3\u6E2C\u65E5 ${lag}\uFF09`);
  return { ok: true, message: `${got.length}\u5730\u57DF`, asOf: got.map((a) => areas[a].last[0]).sort()[0] };
}

// src/scripts/fetch-holidays.mjs
var fetch_holidays_exports = {};
__export(fetch_holidays_exports, {
  URL_JP: () => URL_JP,
  URL_UK: () => URL_UK,
  parseJpCsv: () => parseJpCsv,
  run: () => run5,
  shapeUk: () => shapeUk
});
import { join as join5 } from "node:path";
var URL_JP = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
var URL_UK = "https://www.gov.uk/bank-holidays.json";
var UK_JA = {
  "New Year's Day": "\u5143\u65E5",
  "Good Friday": "\u8056\u91D1\u66DC\u65E5\uFF08\u30B0\u30C3\u30C9\u30D5\u30E9\u30A4\u30C7\u30FC\uFF09",
  "Easter Monday": "\u30A4\u30FC\u30B9\u30BF\u30FC\u30DE\u30F3\u30C7\u30FC",
  "Early May bank holiday": "\u30A2\u30FC\u30EA\u30FC\u30FB\u30E1\u30A4\u30FB\u30D0\u30F3\u30AF\u30DB\u30EA\u30C7\u30FC",
  "Spring bank holiday": "\u30B9\u30D7\u30EA\u30F3\u30B0\u30FB\u30D0\u30F3\u30AF\u30DB\u30EA\u30C7\u30FC",
  "Summer bank holiday": "\u30B5\u30DE\u30FC\u30FB\u30D0\u30F3\u30AF\u30DB\u30EA\u30C7\u30FC",
  "Christmas Day": "\u30AF\u30EA\u30B9\u30DE\u30B9",
  "Boxing Day": "\u30DC\u30AF\u30B7\u30F3\u30B0\u30C7\u30FC"
};
function parseJpCsv(text) {
  const out = [];
  for (const r of parseCsv(text)) {
    const m = String(r[0] || "").trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) continue;
    out.push([`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`, String(r[1] || "").trim()]);
  }
  return out;
}
function shapeUk(json) {
  const ev = json && json["england-and-wales"] && json["england-and-wales"].events;
  if (!Array.isArray(ev)) throw new Error("GOV.UK: england-and-wales \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  return ev.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map((e) => {
    const ja = UK_JA[e.title] || e.title;
    const sub = /substitute/i.test(e.notes || "") ? "\uFF08\u632F\u66FF\uFF09" : "";
    return [e.date, ja + sub, e.title];
  }).sort((a, b) => a[0] < b[0] ? -1 : 1);
}
async function run5({ fetch: fetchImpl = fetch, outDir, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  const from = `${new Date(now).getUTCFullYear() - 1}-01-01`;
  const results = [];
  const errors = [];
  try {
    const jp = parseJpCsv(await httpGet(fetchImpl, URL_JP, { encoding: "shift_jis" })).filter(([d]) => d >= from);
    if (!jp.length) throw new Error("\u65E5\u672C\u306E\u795D\u65E5\u304C0\u4EF6");
    await writeJson(join5(outDir, "holidays_jp.json"), {
      updated: now.toISOString(),
      source: "\u5185\u95A3\u5E9C\u300C\u56FD\u6C11\u306E\u795D\u65E5\u306B\u3064\u3044\u3066\u300D\uFF08https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html\uFF09\u3092\u52A0\u5DE5\u3057\u3066\u4F5C\u6210",
      license: "\u516C\u5171\u30C7\u30FC\u30BF\u5229\u7528\u898F\u7D04\uFF08\u7B2C1.0\u7248\uFF09",
      days: jp
    });
    results.push(`\u65E5\u672C${jp.length}\u4EF6\uFF08\u301C${jp.at(-1)[0]}\uFF09`);
  } catch (e) {
    errors.push("\u65E5\u672C: " + e.message);
  }
  try {
    const uk = shapeUk(await httpGet(fetchImpl, URL_UK, { as: "json" })).filter(([d]) => d >= from);
    if (!uk.length) throw new Error("\u82F1\u56FD\u306E\u795D\u65E5\u304C0\u4EF6");
    await writeJson(join5(outDir, "holidays_uk.json"), {
      updated: now.toISOString(),
      source: "GOV.UK Bank holidays\uFF08England and Wales\uFF09",
      license: "Contains public sector information licensed under the Open Government Licence v3.0.",
      days: uk
    });
    results.push(`\u82F1\u56FD${uk.length}\u4EF6\uFF08\u301C${uk.at(-1)[0]}\uFF09`);
  } catch (e) {
    errors.push("\u82F1\u56FD: " + e.message);
  }
  log(`\u795D\u65E5: ${results.join("\u3001")}${errors.length ? "\uFF0F\u5931\u6557: " + errors.join("\u3001") : ""}`);
  if (!results.length) throw new Error(errors.join(" / "));
  return { ok: errors.length === 0, message: [...results, ...errors].join("\u3001"), asOf: ymd(now) };
}

// src/scripts/fetch-jwks.mjs
var fetch_jwks_exports = {};
__export(fetch_jwks_exports, {
  JWKS_URL: () => JWKS_URL,
  run: () => run6,
  sanitize: () => sanitize
});
import { join as join6 } from "node:path";
var JWKS_URL = "https://api.fincs.jp/token_access_link/jwks";
function sanitize(json) {
  if (!json || !Array.isArray(json.keys)) throw new Error("JWKS\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
  const keys = json.keys.filter((k) => k && k.kty === "RSA" && typeof k.n === "string" && typeof k.e === "string").map((k) => ({ kty: "RSA", kid: k.kid, use: k.use, alg: k.alg, n: k.n, e: k.e }));
  if (!keys.length) throw new Error("RSA\u516C\u958B\u9375\u304C\u3042\u308A\u307E\u305B\u3093");
  return { keys };
}
async function run6({ fetch: fetchImpl = fetch, outDir, log = console.log } = {}) {
  const jwks = sanitize(await httpGet(fetchImpl, JWKS_URL, { as: "json" }));
  await writeJson(join6(outDir, "fincs_jwks.json"), jwks);
  log(`Fincs JWKS: ${jwks.keys.map((k) => k.kid).join(", ")}`);
  return { ok: true, message: jwks.keys.map((k) => k.kid).join(", ") };
}

// src/scripts/fetch-ecb.mjs
var fetch_ecb_exports = {};
__export(fetch_ecb_exports, {
  CCYS: () => CCYS,
  URL_ECB: () => URL_ECB,
  apiUrl: () => apiUrl,
  mergeRows: () => mergeRows2,
  parseEcbCsv: () => parseEcbCsv,
  parseEcbXml: () => parseEcbXml,
  run: () => run7,
  toPairs: () => toPairs
});
import { join as join7 } from "node:path";
var URL_ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
var CCYS = ["USD", "JPY", "GBP", "AUD", "NZD", "CAD", "CHF"];
function apiUrl(since) {
  return `https://data-api.ecb.europa.eu/service/data/EXR/D.${CCYS.join("+")}.EUR.SP00.A?startPeriod=${since}&format=csvdata`;
}
function parseEcbCsv(text) {
  const rows = parseCsv(text).filter((r) => r.length > 3);
  const head = rows[0].map((h) => h.trim());
  const iC = head.indexOf("CURRENCY"), iT = head.indexOf("TIME_PERIOD"), iV = head.indexOf("OBS_VALUE");
  if (iC < 0 || iT < 0 || iV < 0) throw new Error("ECB API: \u5217\u540D\u304C\u60F3\u5B9A\u3068\u9055\u3044\u307E\u3059");
  const by = /* @__PURE__ */ new Map();
  for (const r of rows.slice(1)) {
    const d = String(r[iT]).trim(), c = String(r[iC]).trim(), v = Number(r[iV]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !CCYS.includes(c) || !(v > 0)) continue;
    if (!by.has(d)) by.set(d, { date: d });
    by.get(d)[c] = v;
  }
  return [...by.values()].filter((r) => r.USD > 0 && r.JPY > 0 && r.GBP > 0).sort((a, b) => a.date < b.date ? -1 : 1);
}
function mergeRows2(oldRows, newRows) {
  const m = new Map(oldRows.map((r) => [r.date, r]));
  for (const r of newRows) m.set(r.date, r);
  return [...m.values()].sort((a, b) => a.date < b.date ? -1 : 1);
}
function parseEcbXml(xml) {
  const out = [];
  const dayRe = /<Cube\s+time=["'](\d{4}-\d{2}-\d{2})["']\s*>([\s\S]*?)<\/Cube>/g;
  let m;
  while (m = dayRe.exec(xml)) {
    const row = { date: m[1] };
    const rateRe = /<Cube\s+currency=["']([A-Z]{3})["']\s+rate=["']([\d.]+)["']\s*\/>/g;
    let r;
    while (r = rateRe.exec(m[2])) if (CCYS.includes(r[1])) row[r[1]] = Number(r[2]);
    if (row.USD > 0 && row.JPY > 0 && row.GBP > 0) out.push(row);
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function toPairs(rows) {
  const pick2 = (f, d) => rows.map((r) => [r.date, round(f(r), d)]);
  return {
    usdjpy: pick2((r) => r.JPY / r.USD, 3),
    gbpusd: pick2((r) => r.USD / r.GBP, 5),
    gbpjpy: pick2((r) => r.JPY / r.GBP, 3)
  };
}
async function run7({ fetch: fetchImpl = fetch, outDir, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  let fresh = [];
  let via = "API";
  try {
    fresh = parseEcbCsv(await httpGet(fetchImpl, apiUrl(addDays(ymd(now), -560)), { timeoutMs: 6e4, headers: { accept: "text/csv" } }));
    if (fresh.length < 100) throw new Error("\u4EF6\u6570\u4E0D\u8DB3");
  } catch (e) {
    via = "XML(90\u65E5)";
    log(`ECB: API\u3067\u53D6\u5F97\u3067\u304D\u306A\u304B\u3063\u305F\u305F\u3081\u76F4\u8FD190\u65E5\u306EXML\u3092\u4F7F\u3044\u307E\u3059\uFF08${e.message}\uFF09`);
    fresh = parseEcbXml(await httpGet(fetchImpl, URL_ECB, { timeoutMs: 3e4 }));
  }
  const prev = await readJson(join7(outDir, "fx_ecb.json"), null);
  const old = prev && Array.isArray(prev.rates) && Array.isArray(prev.columns) ? prev.rates.map((r) => Object.fromEntries([["date", r[0]], ...prev.columns.map((c, i) => [c, r[i + 1]])])) : [];
  const cutoff = addDays(ymd(now), -560);
  const rows = mergeRows2(old, fresh).filter((r) => r.date >= cutoff);
  if (rows.length < 25) throw new Error(`ECB: \u30C7\u30FC\u30BF\u304C\u5C11\u306A\u3059\u304E\u307E\u3059\uFF08${rows.length}\u65E5\u5206\uFF09`);
  const pairs = toPairs(rows.slice(-130));
  const last = rows[rows.length - 1].date;
  await writeJson(join7(outDir, "fx_ecb.json"), {
    updated: now.toISOString(),
    source: "\u6B27\u5DDE\u4E2D\u592E\u9280\u884C\uFF08ECB\uFF09\u30E6\u30FC\u30ED\u53C2\u8003\u30EC\u30FC\u30C8\uFF08ECB\u306E\u30A6\u30A7\u30D6\u30B5\u30A4\u30C8\u3067\u7121\u6599\u516C\u958B\uFF09\u3092\u3082\u3068\u306B\u3001\u5F53\u30B5\u30A4\u30C8\u3067\u30C9\u30EB\u5186\u30FB\u30DD\u30F3\u30C9\u30C9\u30EB\u30FB\u30DD\u30F3\u30C9\u5186\u3092\u8A08\u7B97",
    latest: last,
    pairs,
    // 1ユーロあたりの各通貨（通貨の強弱・値幅の計算に使う）。rates の列は [日付, ...columns]
    columns: CCYS,
    rates: rows.map((r) => [r.date, ...CCYS.map((c) => r[c] > 0 ? r[c] : null)])
  });
  log(`ECB: ${rows.length}\u65E5\u5206\u30FB${via}\uFF08\u6700\u65B0 ${last}\u3001\u30DD\u30F3\u30C9\u5186 ${pairs.gbpjpy.at(-1)[1]}\uFF09`);
  return { ok: true, message: `${rows.length}\u65E5\u5206`, asOf: last };
}

// src/scripts/fetch-mof.mjs
var fetch_mof_exports = {};
__export(fetch_mof_exports, {
  URL_MOF: () => URL_MOF,
  parseRss: () => parseRss,
  run: () => run8
});
import { join as join8 } from "node:path";
var URL_MOF = "https://www.mof.go.jp/news.rss";
var unesc = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
var tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? unesc(m[1]) : "";
};
function parseRss(xml) {
  const out = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while (m = re.exec(xml)) {
    const b = m[1];
    const title = tag(b, "title");
    let link = tag(b, "link");
    if (!link) {
      const a = m[0].match(/rdf:about=["']([^"']+)["']/);
      if (a) link = a[1];
    }
    const raw = tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "date");
    const t = Date.parse(raw);
    if (!title || !/^https?:\/\//.test(link)) continue;
    out.push({ title: title.slice(0, 200), link, date: Number.isFinite(t) ? new Date(t).toISOString() : null });
  }
  return out;
}
async function run8({ fetch: fetchImpl = fetch, outDir, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  const bytes = await httpGet(fetchImpl, URL_MOF, { as: "bytes" });
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 200));
  const enc = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1] || "utf-8";
  const items = parseRss(new TextDecoder(/shift|sjis/i.test(enc) ? "shift_jis" : enc).decode(bytes)).slice(0, 40);
  if (!items.length) throw new Error("\u8CA1\u52D9\u7701RSS: \u8A18\u4E8B\u304C\u3042\u308A\u307E\u305B\u3093");
  await writeJson(join8(outDir, "news_mof.json"), {
    updated: now.toISOString(),
    source: "\u8CA1\u52D9\u7701\u30A6\u30A7\u30D6\u30B5\u30A4\u30C8 \u65B0\u7740\u60C5\u5831\uFF08https://www.mof.go.jp/\uFF09\uFF0F\u516C\u5171\u30C7\u30FC\u30BF\u5229\u7528\u898F\u7D04\uFF08\u7B2C1.0\u7248\uFF09",
    items
  });
  log(`\u8CA1\u52D9\u7701RSS: ${items.length}\u4EF6`);
  return { ok: true, message: `${items.length}\u4EF6`, asOf: items[0].date ? items[0].date.slice(0, 10) : null };
}

// src/scripts/update-data.mjs
var ROOT = join9(dirname2(fileURLToPath(import.meta.url)), "..");
var TASKS = { ecb: fetch_ecb_exports, mof: fetch_mof_exports, fred: fetch_fred_exports, jgb: fetch_jgb_exports, cot: fetch_cot_exports, policy: fetch_policy_exports, holidays: fetch_holidays_exports, jwks: fetch_jwks_exports };
async function updateAll({ outDir = join9(ROOT, "site", "data"), only = null, fetch: fetchImpl = fetch, now = /* @__PURE__ */ new Date(), env = process.env, log = console.log } = {}) {
  const metaPath = join9(outDir, "meta.json");
  const meta2 = await readJson(metaPath, null) || { sources: {} };
  meta2.sources ||= {};
  for (const [name, mod] of Object.entries(TASKS)) {
    if (only && !only.includes(name)) continue;
    const prev = meta2.sources[name] || {};
    const at = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const r = await mod.run({ fetch: fetchImpl, outDir, now, env, log });
      if (r.skipped) {
        meta2.sources[name] = { ...prev, status: "skipped", message: r.message, checkedAt: at };
        log(`- ${name}: \u30B9\u30AD\u30C3\u30D7\uFF08${r.message}\uFF09`);
      } else {
        meta2.sources[name] = { status: r.ok ? "ok" : "partial", message: r.message, asOf: r.asOf || null, checkedAt: at, lastSuccess: at };
      }
    } catch (e) {
      meta2.sources[name] = { ...prev, status: "error", message: String(e.message || e).slice(0, 300), checkedAt: at };
      log(`! ${name}: \u5931\u6557 ${e.message}`);
    }
  }
  meta2.updated = (/* @__PURE__ */ new Date()).toISOString();
  await writeJson(metaPath, meta2);
  return meta2;
}

// src/manual.mjs
var MANUAL = { "central_banks.json": { "checked": "2026-10-03", "note": "\u5404\u4E2D\u592E\u9280\u884C\u306E\u516C\u5F0F\u30B5\u30A4\u30C8\u3067\u78BA\u8A8D\u3057\u305F\u4F1A\u5408\u65E5\u7A0B\u3068\u653F\u7B56\u91D1\u5229\u3067\u3059\u3002\u4F1A\u5408\u306E\u305F\u3073\u306B current \u3092\u66F4\u65B0\u3057\u3066\u304F\u3060\u3055\u3044\uFF08BIS\u30FBFRED\u306E\u30C7\u30FC\u30BF\u306E\u65B9\u304C\u65B0\u3057\u3044\u5834\u5408\u306F\u3001\u305D\u3061\u3089\u304C\u81EA\u52D5\u3067\u8868\u793A\u3055\u308C\u307E\u3059\uFF09\u3002", "banks": [{ "id": "fed", "short": "FRB", "name": "\u7C73\u9023\u90A6\u6E96\u5099\u5236\u5EA6\uFF08FRB\uFF09", "ccy": "USD", "flag": "\u7C73", "bis": "US", "meeting": "FOMC", "rateName": "FF\u91D1\u5229\u306E\u8A98\u5C0E\u76EE\u6A19", "tz": "America/New_York", "time": "14:00", "timeLabel": "\u58F0\u660E\u767A\u8868", "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "scheduleNote": "\u65E5\u7A0B\u306F\u76F4\u524D\u306E\u4F1A\u5408\u3067\u78BA\u5B9A\u3057\u307E\u3059\uFF08\u516C\u5F0F\u767A\u8868\u306E\u6CE8\u8A18\u306B\u3088\u308B\uFF09", "current": { "display": "3.75\u301C4.00%", "value": 3.875, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-16", "effective": "2026-09-17", "source": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm" }, "meetings": [{ "date": "2026-10-28", "start": "2026-10-27" }, { "date": "2026-12-09", "start": "2026-12-08", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-01-27", "start": "2027-01-26" }, { "date": "2027-03-17", "start": "2027-03-16", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-04-28", "start": "2027-04-27" }, { "date": "2027-06-09", "start": "2027-06-08", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-07-28", "start": "2027-07-27" }, { "date": "2027-09-15", "start": "2027-09-14", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-10-27", "start": "2027-10-26" }, { "date": "2027-12-08", "start": "2027-12-07", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }] }, { "id": "boj", "short": "\u65E5\u9280", "name": "\u65E5\u672C\u9280\u884C", "ccy": "JPY", "flag": "\u65E5", "bis": "JP", "meeting": "\u91D1\u878D\u653F\u7B56\u6C7A\u5B9A\u4F1A\u5408", "rateName": "\u7121\u62C5\u4FDD\u30B3\u30FC\u30EB\u30EC\u30FC\u30C8\uFF08\u30AA\u30FC\u30D0\u30FC\u30CA\u30A4\u30C8\u7269\uFF09\u306E\u8A98\u5C0E\u76EE\u6A19", "tz": "Asia/Tokyo", "time": null, "timeLabel": "\u516C\u8868\uFF08\u6642\u523B\u306F\u4E8B\u524D\u306B\u6C7A\u307E\u3063\u3066\u3044\u307E\u305B\u3093\uFF09", "url": "https://www.boj.or.jp/mopo/mpmsche_minu/index.htm", "current": { "display": "1.25%\u7A0B\u5EA6", "value": 1.25, "lastAction": "\u5229\u4E0A\u3052", "decided": "2026-09-18", "effective": "2026-09-24", "source": "https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/k260918a.pdf" }, "meetings": [{ "date": "2026-10-30", "start": "2026-10-29", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2026-12-18", "start": "2026-12-17" }, { "date": "2027-01-22", "start": "2027-01-21", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-03-18", "start": "2027-03-17" }, { "date": "2027-04-28", "start": "2027-04-27", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-06-11", "start": "2027-06-10" }, { "date": "2027-07-22", "start": "2027-07-21", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-09-22", "start": "2027-09-21" }, { "date": "2027-10-29", "start": "2027-10-28", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-12-17", "start": "2027-12-16" }] }, { "id": "ecb", "short": "ECB", "name": "\u6B27\u5DDE\u4E2D\u592E\u9280\u884C\uFF08ECB\uFF09", "ccy": "EUR", "flag": "\u6B27", "bis": "XM", "meeting": "\u7406\u4E8B\u4F1A\uFF08\u91D1\u878D\u653F\u7B56\uFF09", "rateName": "\u9810\u91D1\u30D5\u30A1\u30B7\u30EA\u30C6\u30A3\u91D1\u5229", "tz": "Europe/Berlin", "time": "14:15", "timeLabel": "\u653F\u7B56\u6C7A\u5B9A\uFF0814:45\u304B\u3089\u8A18\u8005\u4F1A\u898B\uFF09", "url": "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html", "current": { "display": "2.50%", "value": 2.5, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-10", "effective": "2026-09-16", "source": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" }, "meetings": [{ "date": "2026-10-29", "start": "2026-10-28" }, { "date": "2026-12-17", "start": "2026-12-16" }, { "date": "2027-02-04", "start": "2027-02-03" }, { "date": "2027-03-18", "start": "2027-03-17" }, { "date": "2027-04-29", "start": "2027-04-28" }, { "date": "2027-06-10", "start": "2027-06-09" }, { "date": "2027-07-22", "start": "2027-07-21" }, { "date": "2027-09-09", "start": "2027-09-08" }, { "date": "2027-10-28", "start": "2027-10-27" }, { "date": "2027-12-16", "start": "2027-12-15" }] }, { "id": "boe", "short": "BOE", "name": "\u30A4\u30F3\u30B0\u30E9\u30F3\u30C9\u9280\u884C\uFF08BOE\uFF09", "ccy": "GBP", "flag": "\u82F1", "bis": "GB", "meeting": "\u91D1\u878D\u653F\u7B56\u59D4\u54E1\u4F1A\uFF08MPC\uFF09", "rateName": "\u30D0\u30F3\u30AF\u30EC\u30FC\u30C8", "tz": "Europe/London", "time": "12:00", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates", "current": { "display": "3.75%", "value": 3.75, "lastAction": "\u636E\u3048\u7F6E\u304D", "decided": "2026-09-17", "lastChange": "2025-12-18", "source": "https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/september-2026" }, "meetings": [{ "date": "2026-11-05", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2026-12-17" }, { "date": "2027-02-04", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-03-18" }, { "date": "2027-04-29", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-06-17" }, { "date": "2027-07-29", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-09-16" }, { "date": "2027-11-04", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-12-16" }] }, { "id": "rba", "short": "RBA", "name": "\u8C6A\u5DDE\u6E96\u5099\u9280\u884C\uFF08RBA\uFF09", "ccy": "AUD", "flag": "\u8C6A", "bis": "AU", "meeting": "\u91D1\u878D\u653F\u7B56\u7406\u4E8B\u4F1A", "rateName": "\u30AD\u30E3\u30C3\u30B7\u30E5\u30EC\u30FC\u30C8\u8A98\u5C0E\u76EE\u6A19", "tz": "Australia/Sydney", "time": "14:30", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.rba.gov.au/schedules-events/board-meeting-schedules.html", "current": { "display": "4.60%", "value": 4.6, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-29", "effective": "2026-09-30", "source": "https://www.rba.gov.au/cash-rate-target-overview.html" }, "meetings": [{ "date": "2026-11-03", "start": "2026-11-02", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2026-12-08", "start": "2026-12-07" }, { "date": "2027-02-09", "start": "2027-02-08", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-03-23", "start": "2027-03-22" }, { "date": "2027-05-04", "start": "2027-05-03", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-06-22", "start": "2027-06-21" }, { "date": "2027-08-10", "start": "2027-08-09", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-09-28", "start": "2027-09-27" }, { "date": "2027-11-02", "start": "2027-11-01", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-12-14", "start": "2027-12-13" }] }, { "id": "rbnz", "short": "RBNZ", "name": "NZ\u6E96\u5099\u9280\u884C\uFF08RBNZ\uFF09", "ccy": "NZD", "flag": "NZ", "bis": "NZ", "meeting": "\u653F\u7B56\u91D1\u5229\uFF08OCR\uFF09\u767A\u8868", "rateName": "\u30AA\u30D5\u30A3\u30B7\u30E3\u30EB\u30FB\u30AD\u30E3\u30C3\u30B7\u30E5\u30EC\u30FC\u30C8\uFF08OCR\uFF09", "tz": "Pacific/Auckland", "time": "14:00", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.rbnz.govt.nz/news-and-events/how-we-release-information/ocr-decision-dates-and-financial-stability-report-dates-to-feb-2028", "current": { "display": "2.75%", "value": 2.75, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-02", "source": "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate" }, "meetings": [{ "date": "2026-10-28", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2026-12-09", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-02-10", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-03-17", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-05-05", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-06-16", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-08-04", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-09-15", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-10-27", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-12-08", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }] }, { "id": "boc", "short": "BOC", "name": "\u30AB\u30CA\u30C0\u9280\u884C\uFF08BOC\uFF09", "ccy": "CAD", "flag": "\u52A0", "bis": "CA", "meeting": "\u653F\u7B56\u91D1\u5229\u767A\u8868", "rateName": "\u7FCC\u65E5\u7269\u91D1\u5229\u306E\u8A98\u5C0E\u76EE\u6A19", "tz": "America/Toronto", "time": "09:45", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.bankofcanada.ca/2026/07/bank-canada-publishes-2027-schedule-policy-interest-rate-announcements-other-major-publications/", "current": { "display": "2.25%", "value": 2.25, "lastAction": "\u636E\u3048\u7F6E\u304D", "decided": "2026-09-02", "lastChange": "2025-10-29", "source": "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/" }, "meetings": [{ "date": "2026-10-28" }, { "date": "2026-12-09" }, { "date": "2027-01-27", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-03-03" }, { "date": "2027-04-28", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-06-02" }, { "date": "2027-07-21", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-09-08" }, { "date": "2027-10-27", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-12-08" }] }, { "id": "snb", "short": "SNB", "name": "\u30B9\u30A4\u30B9\u56FD\u7ACB\u9280\u884C\uFF08SNB\uFF09", "ccy": "CHF", "flag": "\u745E", "bis": "CH", "meeting": "\u91D1\u878D\u653F\u7B56\u8A55\u4FA1", "rateName": "SNB\u653F\u7B56\u91D1\u5229", "tz": "Europe/Zurich", "time": "09:30", "timeLabel": "\u653F\u7B56\u767A\u8868\uFF0810:00\u304B\u3089\u8A18\u8005\u4F1A\u898B\uFF09", "url": "https://www.snb.ch/en/services-events/digital-services/event-schedule", "current": { "display": "0.00%", "value": 0, "lastAction": "\u636E\u3048\u7F6E\u304D", "decided": "2026-09-24", "source": "https://www.snb.ch/en/publications/communication/press-releases-restricted/pre_20260924" }, "meetings": [{ "date": "2026-12-10" }, { "date": "2027-03-18" }, { "date": "2027-06-24" }, { "date": "2027-09-23" }, { "date": "2027-12-16" }] }] }, "cftc_schedule.json": { "checked": "2026-10-03", "source": "https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm", "note": "CFTC\u304C\u516C\u8868\u3059\u308B\u5EFA\u7389\u660E\u7D30\u306E\u516C\u8868\u65E5\uFF08\u7C73\u6771\u90E815:30\uFF09\u3002\u795D\u65E5\u306E\u9031\u306F\u6708\u66DC\u306A\u3069\u306B\u305A\u308C\u307E\u3059\u3002\u7FCC\u5E74\u5206\u304C\u516C\u8868\u3055\u308C\u305F\u3089\u8FFD\u8A18\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u4E00\u89A7\u306E\u6700\u5F8C\u306E\u65E5\u4ED8\u3088\u308A\u5F8C\u306F\u3001\u6BCE\u9031\u91D1\u66DC\u3068\u3057\u3066\u6271\u3044\u307E\u3059\u3002", "dates": ["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06", "2026-11-16", "2026-11-20", "2026-11-30", "2026-12-04", "2026-12-11", "2026-12-18", "2026-12-28"] }, "holidays_jp_extra.json": { "checked": "2026-10-03", "source": "\u65E5\u672C\u53D6\u5F15\u6240\u30B0\u30EB\u30FC\u30D7 \u4F11\u696D\u65E5\u4E00\u89A7 https://www.jpx.co.jp/corporate/about-jpx/calendar/index.html", "note": "\u56FD\u6C11\u306E\u795D\u65E5\u4EE5\u5916\u3067\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\u304C\u4F11\u696D\u3059\u308B\u65E5\uFF08\u5E74\u672B\u5E74\u59CB\uFF09\u3002", "days": [["2026-12-31", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"], ["2027-01-02", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"], ["2027-01-03", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"], ["2027-12-31", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"]] }, "holidays_us.json": { "checked": "2026-10-03", "sources": ["NYSE: ICE\uFF08NYSE\u306E\u89AA\u4F1A\u793E\uFF092025\u5E7412\u670823\u65E5\u767A\u8868 2026\u301C2028\u5E74\u306E\u4F11\u5834\u30FB\u77ED\u7E2E\u53D6\u5F15\u65E5 https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx", "\u9023\u90A6\u795D\u65E5: \u7C73\u4EBA\u4E8B\u7BA1\u7406\u5C40\uFF08OPM\uFF09https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"], "note": "type \u2026 both: NYSE\u4F11\u5834\u304B\u3064\u9023\u90A6\u795D\u65E5 / nyse: NYSE\u306E\u307F\u4F11\u5834 / fed: \u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09/ early: NYSE\u77ED\u7E2E\u53D6\u5F15\u30022028\u5E74\u5206\u306FNYSE\u30FBOPM\u306E\u516C\u8868\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u8FFD\u8A18\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "days": [["2026-10-12", "fed", "\u30B3\u30ED\u30F3\u30D6\u30B9\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2026-11-11", "fed", "\u30D9\u30C6\u30E9\u30F3\u30BA\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2026-11-26", "both", "\u30B5\u30F3\u30AF\u30B9\u30AE\u30D3\u30F3\u30B0\uFF08\u611F\u8B1D\u796D\uFF09", "NYSE\u4F11\u5834"], ["2026-11-27", "early", "\u611F\u8B1D\u796D\u306E\u7FCC\u65E5", "NYSE\u306F\u7C73\u6771\u90E813:00\u3067\u53D6\u5F15\u7D42\u4E86"], ["2026-12-24", "early", "\u30AF\u30EA\u30B9\u30DE\u30B9\u30FB\u30A4\u30D6", "NYSE\u306F\u7C73\u6771\u90E813:00\u3067\u53D6\u5F15\u7D42\u4E86"], ["2026-12-25", "both", "\u30AF\u30EA\u30B9\u30DE\u30B9", "NYSE\u4F11\u5834"], ["2027-01-01", "both", "\u5143\u65E5", "NYSE\u4F11\u5834"], ["2027-01-18", "both", "\u30AD\u30F3\u30B0\u7267\u5E2B\u8A18\u5FF5\u65E5", "NYSE\u4F11\u5834"], ["2027-02-15", "both", "\u30EF\u30B7\u30F3\u30C8\u30F3\u8A95\u751F\u65E5", "NYSE\u4F11\u5834"], ["2027-03-26", "nyse", "\u8056\u91D1\u66DC\u65E5\uFF08\u30B0\u30C3\u30C9\u30D5\u30E9\u30A4\u30C7\u30FC\uFF09", "NYSE\u4F11\u5834\uFF08\u9023\u90A6\u795D\u65E5\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09"], ["2027-05-31", "both", "\u30E1\u30E2\u30EA\u30A2\u30EB\u30FB\u30C7\u30FC", "NYSE\u4F11\u5834"], ["2027-06-18", "both", "\u30B8\u30E5\u30FC\u30F3\u30C6\u30A3\u30FC\u30F3\u30B9\uFF08\u632F\u66FF\uFF09", "NYSE\u4F11\u5834"], ["2027-07-05", "both", "\u72EC\u7ACB\u8A18\u5FF5\u65E5\uFF08\u632F\u66FF\uFF09", "NYSE\u4F11\u5834"], ["2027-09-06", "both", "\u30EC\u30A4\u30D0\u30FC\u30FB\u30C7\u30FC", "NYSE\u4F11\u5834"], ["2027-10-11", "fed", "\u30B3\u30ED\u30F3\u30D6\u30B9\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2027-11-11", "fed", "\u30D9\u30C6\u30E9\u30F3\u30BA\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2027-11-25", "both", "\u30B5\u30F3\u30AF\u30B9\u30AE\u30D3\u30F3\u30B0\uFF08\u611F\u8B1D\u796D\uFF09", "NYSE\u4F11\u5834"], ["2027-11-26", "early", "\u611F\u8B1D\u796D\u306E\u7FCC\u65E5", "NYSE\u306F\u7C73\u6771\u90E813:00\u3067\u53D6\u5F15\u7D42\u4E86"], ["2027-12-24", "both", "\u30AF\u30EA\u30B9\u30DE\u30B9\uFF08\u632F\u66FF\uFF09", "NYSE\u4F11\u5834"], ["2027-12-31", "fed", "\u5143\u65E5\uFF082028\u5E74\uFF09\u306E\u632F\u66FF", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"]] }, "indicators.json": { "checked": "2026-10-13", "note": "\u5404\u56FD\u306E\u7D71\u8A08\u4F5C\u6210\u6A5F\u95A2\u304C\u516C\u8868\u3057\u3066\u3044\u308B\u767A\u8868\u4E88\u5B9A\u3067\u3059\u3002\u4E88\u5B9A\u306F\u5909\u66F4\u3055\u308C\u308B\u3053\u3068\u304C\u3042\u308A\u307E\u3059\u3002ISM\u666F\u6CC1\u6307\u6570\u30FB\u65E5\u9280\u77ED\u89B3\u306A\u3069\u306F\u516C\u5F0F\u306E\u4E88\u5B9A\u8868\u3092\u78BA\u8A8D\u3067\u304D\u306A\u304B\u3063\u305F\u305F\u3081\u8F09\u305B\u3066\u3044\u307E\u305B\u3093\u3002importance\uFF1A3=\u7279\u306B\u6CE8\u76EE\u30012=\u6CE8\u76EE\u3002\u65B0\u3057\u3044\u4E88\u5B9A\u304C\u516C\u8868\u3055\u308C\u305F\u3089\u8FFD\u8A18\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "items": [{ "country": "\u82F1", "name": "GDP\uFF08\u6708\u6B21\uFF09", "period": "2026\u5E748\u6708\u5206", "date": "2026-10-15", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E749\u6708\u5206", "date": "2026-10-15", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.census.gov/economic-indicators/calendar-listview-2026.html" }, { "country": "\u82F1", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2026\u5E7410\u6708\u516C\u8868\u5206", "date": "2026-10-20", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u82F1", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E749\u6708\u5206", "date": "2026-10-21", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u82F1", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E749\u6708\u5206", "date": "2026-10-23", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u65E5", "name": "\u5168\u56FD\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E749\u6708\u5206", "date": "2026-10-23", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "GDP\u901F\u5831\u5024", "period": "2026\u5E747-9\u6708\u671F", "date": "2026-10-29", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bea.gov/news/schedule", "note": "\u767A\u8868\u6642\u523B\u306F\u516C\u8868\u5143\u306E\u8868\u8A18\uFF088:30\uFF09\u3092\u7C73\u6771\u90E8\u6642\u9593\u3068\u3057\u3066\u63DB\u7B97" }, { "country": "\u7C73", "name": "\u500B\u4EBA\u6240\u5F97\u30FB\u500B\u4EBA\u6D88\u8CBB\u652F\u51FA\uFF08PCE\uFF09", "period": "2026\u5E749\u6708\u5206", "date": "2026-10-29", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bea.gov/news/schedule", "note": "\u767A\u8868\u6642\u523B\u306F\u516C\u8868\u5143\u306E\u8868\u8A18\uFF088:30\uFF09\u3092\u7C73\u6771\u90E8\u6642\u9593\u3068\u3057\u3066\u63DB\u7B97" }, { "country": "\u65E5", "name": "\u6771\u4EAC\u90FD\u533A\u90E8\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08\u4E2D\u65EC\u901F\u5831\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-10-30", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "JOLTS\u6C42\u4EBA\u4EF6\u6570", "period": "2026\u5E749\u6708\u5206", "date": "2026-11-03", "time": "10:00", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/jolts.htm" }, { "country": "\u7C73", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-06", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/empsit.htm" }, { "country": "\u7C73", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-10", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/cpi.htm" }, { "country": "\u82F1", "name": "GDP\uFF08\u6708\u6B21\uFF09", "period": "2026\u5E749\u6708\u5206", "date": "2026-11-12", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u751F\u7523\u8005\u7269\u4FA1\u6307\u6570\uFF08PPI\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-13", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/ppi.htm" }, { "country": "\u65E5", "name": "GDP\u901F\u5831\uFF081\u6B21\uFF09", "period": "2026\u5E747-9\u6708\u671F", "date": "2026-11-16", "time": "08:50", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html" }, { "country": "\u82F1", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2026\u5E7411\u6708\u516C\u8868\u5206", "date": "2026-11-17", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-17", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.census.gov/economic-indicators/calendar-listview-2026.html" }, { "country": "\u82F1", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-18", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u82F1", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-20", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u65E5", "name": "\u5168\u56FD\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-20", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "GDP\u6539\u5B9A\u5024", "period": "2026\u5E747-9\u6708\u671F", "date": "2026-11-25", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bea.gov/news/schedule", "note": "\u767A\u8868\u6642\u523B\u306F\u516C\u8868\u5143\u306E\u8868\u8A18\uFF088:30\uFF09\u3092\u7C73\u6771\u90E8\u6642\u9593\u3068\u3057\u3066\u63DB\u7B97" }, { "country": "\u7C73", "name": "\u500B\u4EBA\u6240\u5F97\u30FB\u500B\u4EBA\u6D88\u8CBB\u652F\u51FA\uFF08PCE\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-11-25", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bea.gov/news/schedule", "note": "\u767A\u8868\u6642\u523B\u306F\u516C\u8868\u5143\u306E\u8868\u8A18\uFF088:30\uFF09\u3092\u7C73\u6771\u90E8\u6642\u9593\u3068\u3057\u3066\u63DB\u7B97" }, { "country": "\u65E5", "name": "\u6771\u4EAC\u90FD\u533A\u90E8\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08\u4E2D\u65EC\u901F\u5831\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2026-11-27", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "JOLTS\u6C42\u4EBA\u4EF6\u6570", "period": "2026\u5E7410\u6708\u5206", "date": "2026-12-01", "time": "10:00", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/jolts.htm" }, { "country": "\u7C73", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-04", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/empsit.htm" }, { "country": "\u65E5", "name": "GDP\u901F\u5831\uFF082\u6B21\uFF09", "period": "2026\u5E747-9\u6708\u671F", "date": "2026-12-08", "time": "08:50", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html" }, { "country": "\u7C73", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-10", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/cpi.htm" }, { "country": "\u82F1", "name": "GDP\uFF08\u6708\u6B21\uFF09", "period": "2026\u5E7410\u6708\u5206", "date": "2026-12-11", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u82F1", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2026\u5E7412\u6708\u516C\u8868\u5206", "date": "2026-12-15", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u751F\u7523\u8005\u7269\u4FA1\u6307\u6570\uFF08PPI\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-15", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/ppi.htm" }, { "country": "\u82F1", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-16", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-16", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.census.gov/economic-indicators/calendar-listview-2026.html" }, { "country": "\u82F1", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-18", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u65E5", "name": "\u5168\u56FD\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-18", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "GDP\u78BA\u5B9A\u5024", "period": "2026\u5E747-9\u6708\u671F", "date": "2026-12-23", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bea.gov/news/schedule", "note": "\u767A\u8868\u6642\u523B\u306F\u516C\u8868\u5143\u306E\u8868\u8A18\uFF088:30\uFF09\u3092\u7C73\u6771\u90E8\u6642\u9593\u3068\u3057\u3066\u63DB\u7B97" }, { "country": "\u7C73", "name": "\u500B\u4EBA\u6240\u5F97\u30FB\u500B\u4EBA\u6D88\u8CBB\u652F\u51FA\uFF08PCE\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2026-12-23", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bea.gov/news/schedule", "note": "\u767A\u8868\u6642\u523B\u306F\u516C\u8868\u5143\u306E\u8868\u8A18\uFF088:30\uFF09\u3092\u7C73\u6771\u90E8\u6642\u9593\u3068\u3057\u3066\u63DB\u7B97" }, { "country": "\u65E5", "name": "\u6771\u4EAC\u90FD\u533A\u90E8\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08\u4E2D\u65EC\u901F\u5831\uFF09", "period": "2026\u5E7412\u6708\u5206", "date": "2026-12-25", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-08", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/empsit.htm" }, { "country": "\u7C73", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-13", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/cpi.htm" }, { "country": "\u7C73", "name": "\u751F\u7523\u8005\u7269\u4FA1\u6307\u6570\uFF08PPI\uFF09", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-14", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/ppi.htm" }, { "country": "\u82F1", "name": "GDP\uFF08\u6708\u6B21\uFF09", "period": "2026\u5E7411\u6708\u5206", "date": "2027-01-15", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-15", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.census.gov/economic-indicators/calendar-listview.html" }, { "country": "\u82F1", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2027\u5E741\u6708\u516C\u8868\u5206", "date": "2027-01-19", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u82F1", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-20", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u82F1", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-22", "time": "07:00", "tz": "Europe/London", "importance": 2, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u65E5", "name": "\u5168\u56FD\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2026\u5E7412\u6708\u5206", "date": "2027-01-22", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u65E5", "name": "\u6771\u4EAC\u90FD\u533A\u90E8\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08\u4E2D\u65EC\u901F\u5831\uFF09", "period": "2027\u5E741\u6708\u5206", "date": "2027-01-29", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2027\u5E741\u6708\u5206", "date": "2027-02-05", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/empsit.htm" }, { "country": "\u7C73", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2027\u5E741\u6708\u5206", "date": "2027-02-11", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/cpi.htm" }, { "country": "\u7C73", "name": "\u751F\u7523\u8005\u7269\u4FA1\u6307\u6570\uFF08PPI\uFF09", "period": "2027\u5E741\u6708\u5206", "date": "2027-02-12", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/ppi.htm" }, { "country": "\u65E5", "name": "GDP\u901F\u5831\uFF081\u6B21\uFF09", "period": "2026\u5E7410-12\u6708\u671F", "date": "2027-02-15", "time": "08:50", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html" }, { "country": "\u82F1", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2027\u5E741\u6708\u5206", "date": "2027-02-17", "time": "07:00", "tz": "Europe/London", "importance": 3, "source": "https://www.ons.gov.uk/releasecalendar" }, { "country": "\u7C73", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2027\u5E741\u6708\u5206", "date": "2027-02-17", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.census.gov/economic-indicators/calendar-listview.html" }, { "country": "\u65E5", "name": "\u5168\u56FD\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2027\u5E741\u6708\u5206", "date": "2027-02-19", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u65E5", "name": "\u6771\u4EAC\u90FD\u533A\u90E8\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08\u4E2D\u65EC\u901F\u5831\uFF09", "period": "2027\u5E742\u6708\u5206", "date": "2027-02-26", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u7C73", "name": "\u96C7\u7528\u7D71\u8A08", "period": "2027\u5E742\u6708\u5206", "date": "2027-03-05", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/empsit.htm" }, { "country": "\u65E5", "name": "GDP\u901F\u5831\uFF082\u6B21\uFF09", "period": "2026\u5E7410-12\u6708\u671F", "date": "2027-03-09", "time": "08:50", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html" }, { "country": "\u7C73", "name": "\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2027\u5E742\u6708\u5206", "date": "2027-03-10", "time": "08:30", "tz": "America/New_York", "importance": 3, "source": "https://www.bls.gov/schedule/news_release/cpi.htm" }, { "country": "\u7C73", "name": "\u751F\u7523\u8005\u7269\u4FA1\u6307\u6570\uFF08PPI\uFF09", "period": "2027\u5E742\u6708\u5206", "date": "2027-03-12", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.bls.gov/schedule/news_release/ppi.htm" }, { "country": "\u7C73", "name": "\u5C0F\u58F2\u58F2\u4E0A\u9AD8", "period": "2027\u5E742\u6708\u5206", "date": "2027-03-16", "time": "08:30", "tz": "America/New_York", "importance": 2, "source": "https://www.census.gov/economic-indicators/calendar-listview.html" }, { "country": "\u65E5", "name": "\u5168\u56FD\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08CPI\uFF09", "period": "2027\u5E742\u6708\u5206", "date": "2027-03-19", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }, { "country": "\u65E5", "name": "\u6771\u4EAC\u90FD\u533A\u90E8\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF08\u4E2D\u65EC\u901F\u5831\uFF09", "period": "2027\u5E743\u6708\u5206", "date": "2027-03-26", "time": "08:30", "tz": "Asia/Tokyo", "importance": 2, "source": "https://www.stat.go.jp/data/kouhyou/e-stat_cpi.xml" }] }, "notices.json": { "items": [] } };

// src/entry.mjs
var dataDir = join10(process.cwd(), "data");
mkdirSync(join10(dataDir, "manual"), { recursive: true });
for (const [name, obj] of Object.entries(MANUAL)) {
  const p = join10(dataDir, "manual", name);
  if (!existsSync(p)) writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}
var meta = await updateAll({ outDir: dataDir });
var bad = Object.entries(meta.sources).filter(([, v]) => v.status === "error").map(([k]) => k);
console.log(bad.length ? `\u30C7\u30FC\u30BF\u53D6\u5F97 \u5B8C\u4E86\uFF08\u5931\u6557: ${bad.join(", ")}\uFF09` : "\u30C7\u30FC\u30BF\u53D6\u5F97 \u5B8C\u4E86");
