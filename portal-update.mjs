// もちぽよ マーケットポータル データ更新スクリプト（1ファイル版・自動生成）
// 使い方: node portal-update.mjs [--brief daily|weekly]
// 必要な環境変数: FRED_API_KEY（米国データ）、ANTHROPIC_API_KEY（AIまとめ）
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/entry.mjs
import { join as join9 } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// src/scripts/update-data.mjs
import { fileURLToPath } from "node:url";
import { dirname as dirname2, join as join7 } from "node:path";

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
  for (let i2 = 0; i2 < text.length; i2++) {
    const c = text[i2];
    if (inQ) {
      if (c === '"') {
        if (text[i2 + 1] === '"') {
          field += '"';
          i2++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i2 + 1] === "\n") i2++;
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
  for (let i2 = 1; i2 < obs.length; i2++) {
    if (addMonths(obs[i2 - 1][0], 1) !== obs[i2][0]) continue;
    out.push([obs[i2][0], round((obs[i2][1] / obs[i2 - 1][1] - 1) * 100, 2)]);
  }
  return out;
}
function diff(obs) {
  const out = [];
  for (let i2 = 1; i2 < obs.length; i2++) {
    if (addMonths(obs[i2 - 1][0], 1) !== obs[i2][0]) continue;
    out.push([obs[i2][0], round(obs[i2][1] - obs[i2 - 1][1], 1)]);
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
  for (let i2 = h + 1; i2 < rows.length; i2++) {
    const r = rows[i2];
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

// src/scripts/update-data.mjs
var ROOT = join7(dirname2(fileURLToPath(import.meta.url)), "..");
var TASKS = { fred: fetch_fred_exports, jgb: fetch_jgb_exports, cot: fetch_cot_exports, policy: fetch_policy_exports, holidays: fetch_holidays_exports, jwks: fetch_jwks_exports };
async function updateAll({ outDir = join7(ROOT, "site", "data"), only = null, fetch: fetchImpl = fetch, now = /* @__PURE__ */ new Date(), env = process.env, log = console.log } = {}) {
  const metaPath = join7(outDir, "meta.json");
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

// src/scripts/generate-brief.mjs
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { dirname as dirname3, join as join8 } from "node:path";
import { readdir, unlink } from "node:fs/promises";

// src/scripts/lib/time.mjs
var DOW = ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
var fmtCache = /* @__PURE__ */ new Map();
function partsIn(utcMs, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  const p = {};
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
function tzOffsetMinutes(utcMs, tz) {
  const p = partsIn(utcMs, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(utcMs / 1e3) * 1e3) / 6e4);
}
function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(guess, tz);
  let t = guess - off1 * 6e4;
  const off2 = tzOffsetMinutes(t, tz);
  if (off2 !== off1) t = guess - off2 * 6e4;
  return t;
}
function jst(utcMs) {
  const t = new Date(utcMs + 9 * 36e5);
  const iso = t.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), dow: DOW[t.getUTCDay()] };
}
function jaDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const w = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}\u6708${d}\u65E5\uFF08${w}\uFF09`;
}

// src/scripts/generate-brief.mjs
var ROOT2 = join8(dirname3(fileURLToPath2(import.meta.url)), "..");
var API_URL = "https://api.anthropic.com/v1/messages";
var SECTION_TITLES = {
  policy: "\u91D1\u878D\u653F\u7B56\u30FB\u4E2D\u592E\u9280\u884C",
  rates: "\u91D1\u5229\u30FB\u50B5\u5238",
  macro: "\u7D4C\u6E08\u6307\u6A19",
  fx: "\u70BA\u66FF",
  risk: "\u682A\u5F0F\u30FB\u5546\u54C1\u30FB\u5730\u653F\u5B66"
};
var ARCHIVE_KEEP = 40;
async function buildContext(dataDir2, now = /* @__PURE__ */ new Date()) {
  const L = [];
  const t = jst(now.getTime());
  L.push(`\u73FE\u5728\u6642\u523B\uFF1A${jaDate(t.date)} ${t.time}\uFF08\u65E5\u672C\u6642\u9593\uFF09`);
  const last = (arr) => arr && arr.length ? arr[arr.length - 1] : null;
  const back = (arr, days) => {
    const l = last(arr);
    if (!l) return null;
    const target = addDays(l[0], -days);
    for (let i2 = arr.length - 1; i2 >= 0; i2--) if (arr[i2][0] <= target) return arr[i2];
    return null;
  };
  const sgn = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "\u2212" : "\xB1") + Math.abs(v).toFixed(d);
  const r = await readJson(join8(dataDir2, "us_rates.json"));
  if (r && r.series && r.series.DGS10) {
    const y10 = last(r.series.DGS10), y2 = last(r.series.DGS2), w10 = back(r.series.DGS10, 7);
    L.push(`\u7C73\u56FD\u50B5\u5229\u56DE\u308A\uFF08${y10[0]}\u6642\u70B9\u3001FRB H.15\uFF09\uFF1A2\u5E74 ${y2[1].toFixed(2)}%\u300110\u5E74 ${y10[1].toFixed(2)}%` + (w10 ? `\uFF0810\u5E74\u306F1\u9031\u9593\u524D\u6BD4 ${sgn(y10[1] - w10[1])}%pt\uFF09` : ""));
    L.push(`FF\u91D1\u5229\u306E\u8A98\u5C0E\u76EE\u6A19\uFF1A${r.fed.lower.toFixed(2)}\u301C${r.fed.upper.toFixed(2)}%\uFF08${r.fed.date}\u6642\u70B9\uFF09`);
  }
  const j = await readJson(join8(dataDir2, "jgb.json"));
  if (j && j.rows && j.rows.length) {
    const lr = last(j.rows), i2 = j.tenors.indexOf("2Y"), i10 = j.tenors.indexOf("10Y");
    L.push(`\u65E5\u672C\u56FD\u50B5\u5229\u56DE\u308A\uFF08${lr[0]}\u6642\u70B9\u3001\u8CA1\u52D9\u7701\uFF09\uFF1A2\u5E74 ${lr[1][i2]}%\u300110\u5E74 ${lr[1][i10]}%`);
    if (r && r.series && r.series.DGS10) {
      const m = new Map(r.series.DGS10);
      const us2 = m.get(lr[0]);
      if (us2 !== void 0) L.push(`\u65E5\u7C7310\u5E74\u91D1\u5229\u5DEE\uFF08${lr[0]}\uFF09\uFF1A${(us2 - lr[1][i10]).toFixed(2)}%pt`);
    }
  }
  const cb = await readJson(join8(dataDir2, "manual", "central_banks.json"));
  if (cb) {
    L.push("\u4E3B\u8981\u4E2D\u592E\u9280\u884C\u306E\u653F\u7B56\u91D1\u5229\uFF08\u516C\u5F0F\u767A\u8868\u3067\u78BA\u8A8D\u3057\u305F\u5024\uFF09\uFF1A" + cb.banks.map((b) => `${b.short} ${b.current.display}\uFF08${b.current.decided} ${b.current.lastAction}\uFF09`).join("\u3001"));
    const until = now.getTime() + 8 * 864e5;
    const ev = [];
    for (const b of cb.banks) for (const m of b.meetings) {
      const at = zonedToUtc(m.date, b.time || "12:00", b.tz);
      if (at >= now.getTime() - 864e5 && at <= until) {
        const x = jst(at);
        ev.push([at, `${jaDate(x.date)}${b.time ? " " + x.time : "\uFF08\u6642\u523B\u672A\u5B9A\uFF09"} ${b.short}\u30FB${b.meeting}${m.tag ? "\uFF08" + m.tag + "\uFF09" : ""}`]);
      }
    }
    ev.sort((a, b) => a[0] - b[0]);
    if (ev.length) L.push("\u4ECA\u5F8C8\u65E5\u9593\u306E\u4E2D\u592E\u9280\u884C\u306E\u4E88\u5B9A\uFF08\u65E5\u672C\u6642\u9593\uFF09\uFF1A" + ev.map((e) => e[1]).join("\u3001"));
  }
  const today = t.date, end = addDays(today, 8);
  const hol = [];
  const jp = await readJson(join8(dataDir2, "holidays_jp.json"));
  for (const [d, n] of jp && jp.days || []) if (d >= today && d <= end) hol.push(`${jaDate(d)} \u65E5\u672C ${n}`);
  const uk = await readJson(join8(dataDir2, "holidays_uk.json"));
  for (const [d, n] of uk && uk.days || []) if (d >= today && d <= end) hol.push(`${jaDate(d)} \u82F1\u56FD ${n}`);
  const us = await readJson(join8(dataDir2, "manual", "holidays_us.json"));
  for (const [d, , n, note] of us && us.days || []) if (d >= today && d <= end) hol.push(`${jaDate(d)} \u7C73\u56FD ${n}\uFF08${note}\uFF09`);
  if (hol.length) L.push("\u4ECA\u5F8C8\u65E5\u9593\u306E\u4F11\u5834\u30FB\u795D\u65E5\uFF1A" + hol.join("\u3001"));
  const c = await readJson(join8(dataDir2, "cot.json"));
  if (c && c.currencies) {
    const pick2 = c.currencies.filter((x) => ["JPY", "GBP"].includes(x.ccy) && x.rows.length > 1).map((x) => {
      const a = x.rows[x.rows.length - 1], b = x.rows[x.rows.length - 2];
      const net = a[2] - a[3], prev = b[2] - b[3];
      return `${x.name} ${net >= 0 ? "\u8CB7\u3044\u8D8A\u3057" : "\u58F2\u308A\u8D8A\u3057"} ${Math.abs(net).toLocaleString("en-US")}\u679A\uFF08\u524D\u9031\u6BD4 ${net - prev >= 0 ? "+" : "\u2212"}${Math.abs(net - prev).toLocaleString("en-US")}\uFF09`;
    });
    if (pick2.length) L.push(`CFTC \u6295\u6A5F\u7B4B\uFF08\u975E\u5546\u696D\u90E8\u9580\uFF09\u306E\u901A\u8CA8\u5148\u7269\u30DD\u30B8\u30B7\u30E7\u30F3\uFF08${c.latest}\u6642\u70B9\uFF09\uFF1A${pick2.join("\u3001")}`);
  }
  return L.join("\n");
}
var SYSTEM = `\u3042\u306A\u305F\u306F\u3001FX\uFF08\u5916\u56FD\u70BA\u66FF\uFF09\u30C8\u30EC\u30FC\u30C0\u30FC\u5411\u3051\u4F1A\u54E1\u5236\u30DD\u30FC\u30BF\u30EB\u30B5\u30A4\u30C8\u306E\u300C\u30DE\u30FC\u30B1\u30C3\u30C8\u307E\u3068\u3081\u300D\u3092\u4F5C\u308B\u7DE8\u96C6\u8005\u3067\u3059\u3002
\u8AAD\u8005\u306F\u65E5\u672C\u306E\u500B\u4EBA\u30C8\u30EC\u30FC\u30C0\u30FC\uFF08\u521D\u5FC3\u8005\u301C\u4E0A\u7D1A\u8005\uFF09\u3067\u3001\u30DD\u30F3\u30C9\u5186\uFF08GBP/JPY\uFF09\u3092\u4E2D\u5FC3\u306B\u53D6\u5F15\u3057\u3066\u3044\u307E\u3059\u3002

# \u5FC5\u305A\u5B88\u308B\u3053\u3068
- web_search \u3067\u78BA\u8A8D\u3067\u304D\u305F\u4E8B\u5B9F\u3060\u3051\u3092\u66F8\u304F\u3002\u6570\u5024\u30FB\u65E5\u4ED8\u30FB\u6642\u523B\u30FB\u767A\u8A00\u8005\u306F\u3001\u691C\u7D22\u7D50\u679C\u306E\u51FA\u5178\u3067\u78BA\u8A8D\u3067\u304D\u305F\u3082\u306E\u306B\u9650\u308B\u3002\u78BA\u8A8D\u3067\u304D\u306A\u3044\u3053\u3068\u306F\u66F8\u304B\u306A\u3044\u3002
- \u58F2\u8CB7\u306E\u63A8\u5968\u3001\u4FA1\u683C\u306E\u4E88\u60F3\u30FB\u76EE\u6A19\u5024\u3001\u300C\u8CB7\u3044\u300D\u300C\u58F2\u308A\u300D\u300C\u30C1\u30E3\u30F3\u30B9\u300D\u306A\u3069\u53D6\u5F15\u3092\u52E7\u3081\u308B\u8868\u73FE\u306F\u66F8\u304B\u306A\u3044\u3002\u5E02\u5834\u306E\u898B\u65B9\u3092\u7D39\u4ECB\u3059\u308B\u5834\u5408\u306F\u300C\u301C\u3068\u306E\u898B\u65B9\u304C\u51FA\u3066\u3044\u308B\u300D\u306E\u3088\u3046\u306B\u3001\u51FA\u5178\u306E\u3042\u308B\u7B2C\u4E09\u8005\u306E\u898B\u65B9\u3068\u3057\u3066\u66F8\u304F\u3002
- \u8A18\u4E8B\u306E\u6587\u7AE0\u3092\u5199\u3055\u305A\u3001\u77ED\u3044\u81EA\u5206\u306E\u8A00\u8449\u3067\u8981\u7D04\u3059\u308B\u3002\u9577\u3044\u5F15\u7528\u306F\u3057\u306A\u3044\u3002
- \u6642\u523B\u306F\u65E5\u672C\u6642\u9593\uFF08JST\uFF09\u3067\u300C21:30\u300D\u306E\u3088\u3046\u306B\u3001\u65E5\u4ED8\u306F\u300C10\u67085\u65E5\uFF08\u6708\uFF09\u300D\u306E\u3088\u3046\u306B\u66F8\u304F\u3002
- \u5C02\u9580\u7528\u8A9E\u306B\u306F\u521D\u5FC3\u8005\u5411\u3051\u306E\u77ED\u3044\u88DC\u8DB3\u3092\u4ED8\u3051\u308B\uFF08\u4F8B\uFF1A\u300CCPI\uFF08\u6D88\u8CBB\u8005\u7269\u4FA1\u6307\u6570\uFF09\u300D\uFF09\u3002
- \u51FA\u5178URL\u306F\u3001\u691C\u7D22\u7D50\u679C\u306B\u5B9F\u969B\u306B\u51FA\u3066\u304D\u305FURL\u3060\u3051\u3092\u4F7F\u3044\u3001\u5404\u9805\u76EE\u306B1\u301C3\u4EF6\u4ED8\u3051\u308B\u3002
- \u300C\u53C2\u8003\u30C7\u30FC\u30BF\u300D\u3068\u3057\u3066\u6E21\u3059\u6570\u5024\uFF08\u516C\u7684\u6A5F\u95A2\u304B\u3089\u53D6\u5F97\u6E08\u307F\uFF09\u3068\u77DB\u76FE\u3059\u308B\u3053\u3068\u306F\u66F8\u304B\u306A\u3044\u3002
- \u51FA\u529B\u306F\u6307\u5B9A\u3055\u308C\u305FJSON\u3060\u3051\u3002\u524D\u5F8C\u306B\u8AAC\u660E\u6587\u3084\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u8A18\u53F7\u3092\u4ED8\u3051\u306A\u3044\u3002`;
var SRC = '"sources": [{"title": "\u8A18\u4E8B\u30FB\u767A\u8868\u306E\u540D\u524D", "url": "https://..."}]';
var SCHEMA_DAILY = `{
  "headline": "\u304D\u3087\u3046\u306E\u76F8\u5834\u3092\u4E00\u8A00\u3067\uFF0840\u5B57\u4EE5\u5185\uFF09",
  "summary": ["\u8981\u70B91\uFF0870\u5B57\u4EE5\u5185\uFF09", "\u8981\u70B92", "\u8981\u70B93"],
  "gbpjpy": {"text": "\u30DD\u30F3\u30C9\u5186\u306B\u95A2\u4FC2\u3059\u308B\u6750\u6599\uFF08\u82F1\u56FD\u30FB\u65E5\u672C\u306E\u6750\u6599\u3092\u4E2D\u5FC3\u306B\u3001200\u5B57\u4EE5\u5185\uFF09", ${SRC}},
  "sections": [
    {"id": "policy", "items": [{"title": "\u898B\u51FA\u3057\uFF0830\u5B57\u4EE5\u5185\uFF09", "body": "\u672C\u6587\uFF08150\u5B57\u4EE5\u5185\uFF09", ${SRC}}]},
    {"id": "rates", "items": []},
    {"id": "macro", "items": []},
    {"id": "fx", "items": []},
    {"id": "risk", "items": []}
  ],
  "watch": [{"when": "21:30", "label": "\u304D\u3087\u3046\u306E\u6CE8\u76EE\u4E88\u5B9A\uFF0830\u5B57\u4EE5\u5185\uFF09", "note": "\u88DC\u8DB3\uFF0850\u5B57\u4EE5\u5185\u3001\u306A\u3051\u308C\u3070\u7A7A\uFF09", ${SRC}}],
  "caution": "\u8AAD\u3080\u4EBA\u3078\u306E\u6CE8\u610F\u70B9\uFF08100\u5B57\u4EE5\u5185\u3002\u306A\u3051\u308C\u3070\u7A7A\u6587\u5B57\uFF09"
}`;
var SCHEMA_WEEKLY = `{
  "headline": "\u5148\u9031\u306E\u76F8\u5834\u3092\u4E00\u8A00\u3067\uFF0840\u5B57\u4EE5\u5185\uFF09",
  "summary": ["\u8981\u70B91\uFF0870\u5B57\u4EE5\u5185\uFF09", "\u8981\u70B92", "\u8981\u70B93"],
  "review": [{"title": "\u5148\u9031\u306E\u51FA\u6765\u4E8B\uFF0830\u5B57\u4EE5\u5185\uFF09", "body": "\u672C\u6587\uFF08150\u5B57\u4EE5\u5185\uFF09", ${SRC}}],
  "gbpjpy": {"text": "\u30DD\u30F3\u30C9\u5186\u306E1\u9031\u9593\uFF08\u6750\u6599\u4E2D\u5FC3\u3001200\u5B57\u4EE5\u5185\uFF09", ${SRC}},
  "next_week": [{"when": "10\u67087\u65E5\uFF08\u6C34\uFF0921:30", "label": "\u6765\u9031\u306E\u6CE8\u76EE\u4E88\u5B9A\uFF0830\u5B57\u4EE5\u5185\uFF09", "note": "\u88DC\u8DB3\uFF0850\u5B57\u4EE5\u5185\u3001\u306A\u3051\u308C\u3070\u7A7A\uFF09", ${SRC}}],
  "caution": "\u8AAD\u3080\u4EBA\u3078\u306E\u6CE8\u610F\u70B9\uFF08100\u5B57\u4EE5\u5185\u3002\u306A\u3051\u308C\u3070\u7A7A\u6587\u5B57\uFF09"
}`;
function buildUserPrompt(mode2, context, now, maxSearches) {
  const t = jst(now.getTime());
  if (mode2 === "weekly") {
    const from = addDays(t.date, -6);
    return `# \u4F5C\u696D
\u5148\u9031\uFF08${jaDate(from)}\u301C${jaDate(t.date)}\uFF09\u306E\u5916\u56FD\u70BA\u66FF\u5E02\u5834\u3092\u632F\u308A\u8FD4\u308A\u3001\u6765\u9031\u306E\u6CE8\u76EE\u4E88\u5B9A\u3092\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044\u3002
\u691C\u7D22\u306F${maxSearches}\u56DE\u4EE5\u5185\u3002\u4E3B\u8981\u901A\u4FE1\u793E\u30FB\u7D4C\u6E08\u30E1\u30C7\u30A3\u30A2\u3001\u5404\u56FD\u4E2D\u592E\u9280\u884C\u30FB\u7D71\u8A08\u6A5F\u95A2\u306E\u516C\u5F0F\u767A\u8868\u3092\u512A\u5148\u3057\u3066\u304F\u3060\u3055\u3044\u3002
- review \u306F3\u301C6\u4EF6\u3002\u30DD\u30F3\u30C9\u30FB\u5186\u30FB\u30C9\u30EB\u306B\u95A2\u4FC2\u304C\u6DF1\u3044\u3082\u306E\u3092\u512A\u5148\u3002
- next_week \u306F\u691C\u7D22\u3067\u65E5\u6642\u3092\u78BA\u8A8D\u3067\u304D\u305F\u4E88\u5B9A\u3060\u3051\uFF08\u6700\u59278\u4EF6\uFF09\u3002\u65E5\u672C\u6642\u9593\u306B\u76F4\u3057\u3066\u66F8\u304F\u3002\u78BA\u8A8D\u3067\u304D\u306A\u3051\u308C\u3070\u5165\u308C\u306A\u3044\u3002

# \u53C2\u8003\u30C7\u30FC\u30BF\uFF08\u3053\u306E\u30B5\u30A4\u30C8\u304C\u516C\u7684\u6A5F\u95A2\u304B\u3089\u53D6\u5F97\u6E08\u307F\uFF09
${context}

# \u51FA\u529B\u3059\u308BJSON\u306E\u5F62
${SCHEMA_WEEKLY}`;
  }
  return `# \u4F5C\u696D
\u304D\u3087\u3046\uFF08${jaDate(t.date)}\uFF09\u306E\u671D\u306B\u8AAD\u3080\u3001\u5916\u56FD\u70BA\u66FF\u5E02\u5834\u306E\u307E\u3068\u3081\u3092\u4F5C\u3063\u3066\u304F\u3060\u3055\u3044\u3002
\u5BFE\u8C61\u306F\u3001\u524D\u55B6\u696D\u65E5\u306E\u6771\u4EAC\u6642\u9593\u304B\u3089\u3001\u3051\u3055\u65E5\u672C\u6642\u95936\u6642\u3054\u308D\u307E\u3067\u306E\u51FA\u6765\u4E8B\u3068\u3001\u304D\u3087\u3046\u306E\u4E88\u5B9A\u3067\u3059\u3002
\u691C\u7D22\u306F${maxSearches}\u56DE\u4EE5\u5185\u3002\u4E3B\u8981\u901A\u4FE1\u793E\u30FB\u7D4C\u6E08\u30E1\u30C7\u30A3\u30A2\u3001\u5404\u56FD\u4E2D\u592E\u9280\u884C\u30FB\u7D71\u8A08\u6A5F\u95A2\u306E\u516C\u5F0F\u767A\u8868\u3092\u512A\u5148\u3057\u3066\u304F\u3060\u3055\u3044\u3002
- sections \u306E\u5404 items \u306F0\u301C3\u4EF6\u3002\u305D\u306E\u5206\u91CE\u3067\u78BA\u8A8D\u3067\u304D\u305F\u91CD\u8981\u306A\u51FA\u6765\u4E8B\u304C\u306A\u3051\u308C\u3070\u7A7A\u914D\u5217\u306B\u3059\u308B\u3002
- gbpjpy \u306F\u82F1\u56FD\u3068\u65E5\u672C\u306E\u6750\u6599\uFF08\u4E2D\u9280\u30FB\u6307\u6A19\u30FB\u8981\u4EBA\u767A\u8A00\u30FB\u653F\u6CBB\uFF09\u3092\u4E2D\u5FC3\u306B\u3002
- watch \u306F\u3001\u304D\u3087\u3046\u301C\u3042\u3059\u306E\u671D\u307E\u3067\u306E\u4E88\u5B9A\u306E\u3046\u3061\u3001\u691C\u7D22\u3067\u65E5\u6642\u3092\u78BA\u8A8D\u3067\u304D\u305F\u3082\u306E\u3060\u3051\uFF08\u6700\u59276\u4EF6\uFF09\u3002\u65E5\u672C\u6642\u9593\u306B\u76F4\u3057\u3066\u66F8\u304F\u3002

# \u53C2\u8003\u30C7\u30FC\u30BF\uFF08\u3053\u306E\u30B5\u30A4\u30C8\u304C\u516C\u7684\u6A5F\u95A2\u304B\u3089\u53D6\u5F97\u6E08\u307F\uFF09
${context}

# \u51FA\u529B\u3059\u308BJSON\u306E\u5F62
${SCHEMA_DAILY}`;
}
async function post(fetchImpl, apiKey, body, { retries = 3 } = {}) {
  let lastErr;
  for (let i2 = 0; i2 <= retries; i2++) {
    try {
      const res = await fetchImpl(API_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      const err = new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
      if (![429, 500, 502, 503, 504, 529].includes(res.status)) throw Object.assign(err, { fatal: true });
      lastErr = err;
      const ra = Number(res.headers && res.headers.get && res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1e3 : 5e3 * (i2 + 1));
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      await sleep(3e3 * (i2 + 1));
    }
  }
  throw lastErr;
}
async function askWithSearch({ fetch: fetchImpl, apiKey, model, tool, maxSearches, system, user, maxTokens = 8e3 }) {
  const messages = [{ role: "user", content: user }];
  const texts = [];
  const results = [];
  let searches = 0;
  const usage = { input_tokens: 0, output_tokens: 0 };
  for (let turn = 0; turn < 6; turn++) {
    const res = await post(fetchImpl, apiKey, {
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [{ type: tool, name: "web_search", max_uses: maxSearches, user_location: { type: "approximate", city: "Tokyo", region: "Tokyo", country: "JP", timezone: "Asia/Tokyo" } }]
    });
    for (const b of res.content || []) {
      if (b.type === "text") {
        texts.push(b.text || "");
        for (const c of b.citations || []) if (c.url) results.push({ url: c.url, title: c.title || "" });
      } else if (b.type === "server_tool_use") searches++;
      else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r.type === "web_search_result" && r.url) results.push({ url: r.url, title: r.title || "" });
      }
    }
    if (res.usage) {
      usage.input_tokens += res.usage.input_tokens || 0;
      usage.output_tokens += res.usage.output_tokens || 0;
    }
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "max_tokens") throw new Error("\u51FA\u529B\u304C\u9577\u3059\u304E\u3066\u9014\u4E2D\u3067\u5207\u308C\u307E\u3057\u305F\uFF08max_tokens\uFF09");
    return { text: texts.join(""), results, searches, usage };
  }
  throw new Error("\u691C\u7D22\u306E\u7D99\u7D9A\u56DE\u6570\u304C\u4E0A\u9650\u306B\u9054\u3057\u307E\u3057\u305F");
}
function extractJson(text) {
  const s = String(text || "").replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("JSON\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  return JSON.parse(s.slice(a, b + 1));
}
function normUrl(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return null;
    x.hash = "";
    return x.host.toLowerCase().replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search;
  } catch {
    return null;
  }
}
var clip = (s, n) => {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
};
function cleanBrief(raw, mode2, results) {
  const allowed = /* @__PURE__ */ new Map();
  for (const r of results) {
    const k = normUrl(r.url);
    if (k && !allowed.has(k)) allowed.set(k, r);
  }
  let dropped = 0;
  const srcs = (list) => {
    const out2 = [];
    for (const s of Array.isArray(list) ? list : []) {
      const k = s && normUrl(s.url);
      if (!k || !allowed.has(k) || out2.some((o) => normUrl(o.url) === k)) continue;
      out2.push({ title: clip(s.title || allowed.get(k).title || allowed.get(k).url, 80), url: s.url });
      if (out2.length >= 3) break;
    }
    return out2;
  };
  const items = (list, max, withWhen) => {
    const out2 = [];
    for (const it of Array.isArray(list) ? list : []) {
      const sources = srcs(it && it.sources);
      if (!sources.length) {
        dropped++;
        continue;
      }
      const o = withWhen ? { when: clip(it.when, 24), label: clip(it.label, 40), note: clip(it.note, 70), sources } : { title: clip(it.title, 40), body: clip(it.body, 200), sources };
      if (withWhen ? !o.label : !o.title || !o.body) {
        dropped++;
        continue;
      }
      out2.push(o);
      if (out2.length >= max) break;
    }
    return out2;
  };
  const summary = (Array.isArray(raw.summary) ? raw.summary : []).map((s) => clip(s, 90)).filter(Boolean).slice(0, 3);
  const g = raw.gbpjpy || {};
  const gSources = srcs(g.sources);
  const out = {
    headline: clip(raw.headline, 60),
    summary,
    gbpjpy: gSources.length && g.text ? { text: clip(g.text, 260), sources: gSources } : null,
    caution: clip(raw.caution, 140)
  };
  if (mode2 === "weekly") {
    out.review = items(raw.review, 6, false);
    out.next_week = items(raw.next_week, 8, true);
  } else {
    const secs = Array.isArray(raw.sections) ? raw.sections : [];
    out.sections = Object.keys(SECTION_TITLES).map((id) => {
      const s = secs.find((x) => x && x.id === id) || {};
      return { id, title: SECTION_TITLES[id], items: items(s.items, 3, false) };
    });
    out.watch = items(raw.watch, 6, true);
  }
  const count = mode2 === "weekly" ? out.review.length : out.sections.reduce((n, s) => n + s.items.length, 0);
  if (!out.headline || out.summary.length < 2 || count < 2) {
    throw new Error(`\u5185\u5BB9\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\uFF08\u898B\u51FA\u3057:${!!out.headline} \u8981\u70B9:${out.summary.length} \u9805\u76EE:${count} \u51FA\u5178\u306A\u3057\u3067\u9664\u5916:${dropped}\uFF09`);
  }
  out.dropped = dropped;
  return out;
}
async function saveArchive(dataDir2, brief) {
  const dir = join8(dataDir2, "briefs");
  const file = `${brief.date}-${brief.mode}.json`;
  await writeJson(join8(dir, file), brief);
  const idx = await readJson(join8(dir, "index.json"), null) || { items: [] };
  const items = [
    { date: brief.date, mode: brief.mode, file, headline: brief.headline, generated_at: brief.generated_at },
    ...idx.items.filter((x) => x.file !== file)
  ].slice(0, ARCHIVE_KEEP);
  await writeJson(join8(dir, "index.json"), { items });
  const keep = new Set(items.map((x) => x.file).concat("index.json"));
  for (const f of await readdir(dir)) if (f.endsWith(".json") && !keep.has(f)) await unlink(join8(dir, f));
}
async function setMeta(dataDir2, key, entry) {
  const p = join8(dataDir2, "meta.json");
  const meta2 = await readJson(p, null) || { sources: {} };
  meta2.sources ||= {};
  const prev = meta2.sources[key] || {};
  meta2.sources[key] = entry.status === "ok" ? entry : { ...prev, ...entry };
  meta2.updated = (/* @__PURE__ */ new Date()).toISOString();
  await writeJson(p, meta2);
}
async function run7({ mode: mode2 = "daily", fetch: fetchImpl = fetch, dataDir: dataDir2 = join8(ROOT2, "site", "data"), env = process.env, now = /* @__PURE__ */ new Date(), log = console.log } = {}) {
  const key = `brief_${mode2}`;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await setMeta(dataDir2, key, { status: "skipped", message: "ANTHROPIC_API_KEY \u304C\u672A\u8A2D\u5B9A", checkedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return { ok: false, skipped: true };
  }
  const model = env.CLAUDE_MODEL || "claude-sonnet-5-5";
  const tool = env.WEB_SEARCH_TOOL || "web_search_20250305";
  const maxSearches = Math.max(1, Math.min(20, Number(env.BRIEF_MAX_SEARCHES || 8)));
  try {
    const context = await buildContext(dataDir2, now);
    const user = buildUserPrompt(mode2, context, now, maxSearches);
    const res = await askWithSearch({ fetch: fetchImpl, apiKey, model, tool, maxSearches, system: SYSTEM, user });
    let raw;
    try {
      raw = extractJson(res.text);
    } catch (e) {
      log(`JSON\u306E\u8AAD\u307F\u53D6\u308A\u306B\u5931\u6557\u3057\u305F\u305F\u3081\u3001\u6574\u5F62\u3060\u3051\u3092\u518D\u4F9D\u983C\u3057\u307E\u3059: ${e.message}`);
      const fix = await post(fetchImpl, apiKey, {
        model,
        max_tokens: 8e3,
        system: "\u5165\u529B\u3055\u308C\u305F\u30C6\u30AD\u30B9\u30C8\u3092\u3001\u5185\u5BB9\u3092\u5909\u3048\u305A\u306B\u6B63\u3057\u3044JSON\u3060\u3051\u306B\u76F4\u3057\u3066\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u8AAC\u660E\u6587\u306F\u66F8\u304B\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002",
        messages: [{ role: "user", content: res.text }]
      });
      raw = extractJson((fix.content || []).filter((b) => b.type === "text").map((b) => b.text).join(""));
    }
    const clean = cleanBrief(raw, mode2, res.results);
    const t = jst(now.getTime());
    const brief = {
      mode: mode2,
      date: t.date,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      model,
      searches: res.searches,
      ...clean,
      notice: "AI\uFF08Claude\uFF09\u304CWeb\u4E0A\u306E\u516C\u958B\u60C5\u5831\u3092\u691C\u7D22\u3057\u3066\u81EA\u52D5\u3067\u8981\u7D04\u3057\u305F\u3082\u306E\u3067\u3059\u3002\u8AA4\u308A\u3092\u542B\u3080\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002\u91CD\u8981\u306A\u6570\u5024\u3084\u65E5\u6642\u306F\u51FA\u5178\u3067\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002\u6295\u8CC7\u5224\u65AD\u306F\u3054\u81EA\u8EAB\u306E\u8CAC\u4EFB\u3067\u304A\u9858\u3044\u3057\u307E\u3059\u3002"
    };
    await writeJson(join8(dataDir2, mode2 === "weekly" ? "brief_weekly.json" : "brief.json"), brief);
    await saveArchive(dataDir2, brief);
    await setMeta(dataDir2, key, { status: "ok", message: `\u691C\u7D22${res.searches}\u56DE\u30FB\u51FA\u5178\u306A\u3057\u9664\u5916${clean.dropped}\u4EF6\u30FB\u5165\u529B${res.usage.input_tokens}/\u51FA\u529B${res.usage.output_tokens}\u30C8\u30FC\u30AF\u30F3`, asOf: brief.date, checkedAt: brief.generated_at, lastSuccess: brief.generated_at });
    log(`\u307E\u3068\u3081\uFF08${mode2}\uFF09: ${brief.headline}`);
    return { ok: true, brief };
  } catch (e) {
    await setMeta(dataDir2, key, { status: "error", message: String(e.message || e).slice(0, 300), checkedAt: (/* @__PURE__ */ new Date()).toISOString() });
    log(`\u307E\u3068\u3081\uFF08${mode2}\uFF09\u306E\u4F5C\u6210\u306B\u5931\u6557: ${e.message}`);
    return { ok: false, error: e };
  }
}

// src/manual.mjs
var MANUAL = { "notices.json": { "items": [] }, "holidays_us.json": { "checked": "2026-10-03", "sources": ["NYSE: ICE\uFF08NYSE\u306E\u89AA\u4F1A\u793E\uFF092025\u5E7412\u670823\u65E5\u767A\u8868 2026\u301C2028\u5E74\u306E\u4F11\u5834\u30FB\u77ED\u7E2E\u53D6\u5F15\u65E5 https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx", "\u9023\u90A6\u795D\u65E5: \u7C73\u4EBA\u4E8B\u7BA1\u7406\u5C40\uFF08OPM\uFF09https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/"], "note": "type \u2026 both: NYSE\u4F11\u5834\u304B\u3064\u9023\u90A6\u795D\u65E5 / nyse: NYSE\u306E\u307F\u4F11\u5834 / fed: \u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09/ early: NYSE\u77ED\u7E2E\u53D6\u5F15\u30022028\u5E74\u5206\u306FNYSE\u30FBOPM\u306E\u516C\u8868\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u8FFD\u8A18\u3057\u3066\u304F\u3060\u3055\u3044\u3002", "days": [["2026-10-12", "fed", "\u30B3\u30ED\u30F3\u30D6\u30B9\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2026-11-11", "fed", "\u30D9\u30C6\u30E9\u30F3\u30BA\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2026-11-26", "both", "\u30B5\u30F3\u30AF\u30B9\u30AE\u30D3\u30F3\u30B0\uFF08\u611F\u8B1D\u796D\uFF09", "NYSE\u4F11\u5834"], ["2026-11-27", "early", "\u611F\u8B1D\u796D\u306E\u7FCC\u65E5", "NYSE\u306F\u7C73\u6771\u90E813:00\u3067\u53D6\u5F15\u7D42\u4E86"], ["2026-12-24", "early", "\u30AF\u30EA\u30B9\u30DE\u30B9\u30FB\u30A4\u30D6", "NYSE\u306F\u7C73\u6771\u90E813:00\u3067\u53D6\u5F15\u7D42\u4E86"], ["2026-12-25", "both", "\u30AF\u30EA\u30B9\u30DE\u30B9", "NYSE\u4F11\u5834"], ["2027-01-01", "both", "\u5143\u65E5", "NYSE\u4F11\u5834"], ["2027-01-18", "both", "\u30AD\u30F3\u30B0\u7267\u5E2B\u8A18\u5FF5\u65E5", "NYSE\u4F11\u5834"], ["2027-02-15", "both", "\u30EF\u30B7\u30F3\u30C8\u30F3\u8A95\u751F\u65E5", "NYSE\u4F11\u5834"], ["2027-03-26", "nyse", "\u8056\u91D1\u66DC\u65E5\uFF08\u30B0\u30C3\u30C9\u30D5\u30E9\u30A4\u30C7\u30FC\uFF09", "NYSE\u4F11\u5834\uFF08\u9023\u90A6\u795D\u65E5\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09"], ["2027-05-31", "both", "\u30E1\u30E2\u30EA\u30A2\u30EB\u30FB\u30C7\u30FC", "NYSE\u4F11\u5834"], ["2027-06-18", "both", "\u30B8\u30E5\u30FC\u30F3\u30C6\u30A3\u30FC\u30F3\u30B9\uFF08\u632F\u66FF\uFF09", "NYSE\u4F11\u5834"], ["2027-07-05", "both", "\u72EC\u7ACB\u8A18\u5FF5\u65E5\uFF08\u632F\u66FF\uFF09", "NYSE\u4F11\u5834"], ["2027-09-06", "both", "\u30EC\u30A4\u30D0\u30FC\u30FB\u30C7\u30FC", "NYSE\u4F11\u5834"], ["2027-10-11", "fed", "\u30B3\u30ED\u30F3\u30D6\u30B9\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2027-11-11", "fed", "\u30D9\u30C6\u30E9\u30F3\u30BA\u30FB\u30C7\u30FC", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"], ["2027-11-25", "both", "\u30B5\u30F3\u30AF\u30B9\u30AE\u30D3\u30F3\u30B0\uFF08\u611F\u8B1D\u796D\uFF09", "NYSE\u4F11\u5834"], ["2027-11-26", "early", "\u611F\u8B1D\u796D\u306E\u7FCC\u65E5", "NYSE\u306F\u7C73\u6771\u90E813:00\u3067\u53D6\u5F15\u7D42\u4E86"], ["2027-12-24", "both", "\u30AF\u30EA\u30B9\u30DE\u30B9\uFF08\u632F\u66FF\uFF09", "NYSE\u4F11\u5834"], ["2027-12-31", "fed", "\u5143\u65E5\uFF082028\u5E74\uFF09\u306E\u632F\u66FF", "\u9023\u90A6\u795D\u65E5\uFF08NYSE\u306F\u901A\u5E38\u53D6\u5F15\uFF09"]] }, "central_banks.json": { "checked": "2026-10-03", "note": "\u5404\u4E2D\u592E\u9280\u884C\u306E\u516C\u5F0F\u30B5\u30A4\u30C8\u3067\u78BA\u8A8D\u3057\u305F\u4F1A\u5408\u65E5\u7A0B\u3068\u653F\u7B56\u91D1\u5229\u3067\u3059\u3002\u4F1A\u5408\u306E\u305F\u3073\u306B current \u3092\u66F4\u65B0\u3057\u3066\u304F\u3060\u3055\u3044\uFF08BIS\u30FBFRED\u306E\u30C7\u30FC\u30BF\u306E\u65B9\u304C\u65B0\u3057\u3044\u5834\u5408\u306F\u3001\u305D\u3061\u3089\u304C\u81EA\u52D5\u3067\u8868\u793A\u3055\u308C\u307E\u3059\uFF09\u3002", "banks": [{ "id": "fed", "short": "FRB", "name": "\u7C73\u9023\u90A6\u6E96\u5099\u5236\u5EA6\uFF08FRB\uFF09", "ccy": "USD", "flag": "\u7C73", "bis": "US", "meeting": "FOMC", "rateName": "FF\u91D1\u5229\u306E\u8A98\u5C0E\u76EE\u6A19", "tz": "America/New_York", "time": "14:00", "timeLabel": "\u58F0\u660E\u767A\u8868", "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "scheduleNote": "\u65E5\u7A0B\u306F\u76F4\u524D\u306E\u4F1A\u5408\u3067\u78BA\u5B9A\u3057\u307E\u3059\uFF08\u516C\u5F0F\u767A\u8868\u306E\u6CE8\u8A18\u306B\u3088\u308B\uFF09", "current": { "display": "3.75\u301C4.00%", "value": 3.875, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-16", "effective": "2026-09-17", "source": "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm" }, "meetings": [{ "date": "2026-10-28", "start": "2026-10-27" }, { "date": "2026-12-09", "start": "2026-12-08", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-01-27", "start": "2027-01-26" }, { "date": "2027-03-17", "start": "2027-03-16", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-04-28", "start": "2027-04-27" }, { "date": "2027-06-09", "start": "2027-06-08", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-07-28", "start": "2027-07-27" }, { "date": "2027-09-15", "start": "2027-09-14", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }, { "date": "2027-10-27", "start": "2027-10-26" }, { "date": "2027-12-08", "start": "2027-12-07", "tag": "\u7D4C\u6E08\u898B\u901A\u3057\u3042\u308A" }] }, { "id": "boj", "short": "\u65E5\u9280", "name": "\u65E5\u672C\u9280\u884C", "ccy": "JPY", "flag": "\u65E5", "bis": "JP", "meeting": "\u91D1\u878D\u653F\u7B56\u6C7A\u5B9A\u4F1A\u5408", "rateName": "\u7121\u62C5\u4FDD\u30B3\u30FC\u30EB\u30EC\u30FC\u30C8\uFF08\u30AA\u30FC\u30D0\u30FC\u30CA\u30A4\u30C8\u7269\uFF09\u306E\u8A98\u5C0E\u76EE\u6A19", "tz": "Asia/Tokyo", "time": null, "timeLabel": "\u516C\u8868\uFF08\u6642\u523B\u306F\u4E8B\u524D\u306B\u6C7A\u307E\u3063\u3066\u3044\u307E\u305B\u3093\uFF09", "url": "https://www.boj.or.jp/mopo/mpmsche_minu/index.htm", "current": { "display": "1.25%\u7A0B\u5EA6", "value": 1.25, "lastAction": "\u5229\u4E0A\u3052", "decided": "2026-09-18", "effective": "2026-09-24", "source": "https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/k260918a.pdf" }, "meetings": [{ "date": "2026-10-30", "start": "2026-10-29", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2026-12-18", "start": "2026-12-17" }, { "date": "2027-01-22", "start": "2027-01-21", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-03-18", "start": "2027-03-17" }, { "date": "2027-04-28", "start": "2027-04-27", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-06-11", "start": "2027-06-10" }, { "date": "2027-07-22", "start": "2027-07-21", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-09-22", "start": "2027-09-21" }, { "date": "2027-10-29", "start": "2027-10-28", "tag": "\u5C55\u671B\u30EC\u30DD\u30FC\u30C8" }, { "date": "2027-12-17", "start": "2027-12-16" }] }, { "id": "ecb", "short": "ECB", "name": "\u6B27\u5DDE\u4E2D\u592E\u9280\u884C\uFF08ECB\uFF09", "ccy": "EUR", "flag": "\u6B27", "bis": "XM", "meeting": "\u7406\u4E8B\u4F1A\uFF08\u91D1\u878D\u653F\u7B56\uFF09", "rateName": "\u9810\u91D1\u30D5\u30A1\u30B7\u30EA\u30C6\u30A3\u91D1\u5229", "tz": "Europe/Berlin", "time": "14:15", "timeLabel": "\u653F\u7B56\u6C7A\u5B9A\uFF0814:45\u304B\u3089\u8A18\u8005\u4F1A\u898B\uFF09", "url": "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html", "current": { "display": "2.50%", "value": 2.5, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-10", "effective": "2026-09-16", "source": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" }, "meetings": [{ "date": "2026-10-29", "start": "2026-10-28" }, { "date": "2026-12-17", "start": "2026-12-16" }, { "date": "2027-02-04", "start": "2027-02-03" }, { "date": "2027-03-18", "start": "2027-03-17" }, { "date": "2027-04-29", "start": "2027-04-28" }, { "date": "2027-06-10", "start": "2027-06-09" }, { "date": "2027-07-22", "start": "2027-07-21" }, { "date": "2027-09-09", "start": "2027-09-08" }, { "date": "2027-10-28", "start": "2027-10-27" }, { "date": "2027-12-16", "start": "2027-12-15" }] }, { "id": "boe", "short": "BOE", "name": "\u30A4\u30F3\u30B0\u30E9\u30F3\u30C9\u9280\u884C\uFF08BOE\uFF09", "ccy": "GBP", "flag": "\u82F1", "bis": "GB", "meeting": "\u91D1\u878D\u653F\u7B56\u59D4\u54E1\u4F1A\uFF08MPC\uFF09", "rateName": "\u30D0\u30F3\u30AF\u30EC\u30FC\u30C8", "tz": "Europe/London", "time": "12:00", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates", "current": { "display": "3.75%", "value": 3.75, "lastAction": "\u636E\u3048\u7F6E\u304D", "decided": "2026-09-17", "lastChange": "2025-12-18", "source": "https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/september-2026" }, "meetings": [{ "date": "2026-11-05", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2026-12-17" }, { "date": "2027-02-04", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-03-18" }, { "date": "2027-04-29", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-06-17" }, { "date": "2027-07-29", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-09-16" }, { "date": "2027-11-04", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-12-16" }] }, { "id": "rba", "short": "RBA", "name": "\u8C6A\u5DDE\u6E96\u5099\u9280\u884C\uFF08RBA\uFF09", "ccy": "AUD", "flag": "\u8C6A", "bis": "AU", "meeting": "\u91D1\u878D\u653F\u7B56\u7406\u4E8B\u4F1A", "rateName": "\u30AD\u30E3\u30C3\u30B7\u30E5\u30EC\u30FC\u30C8\u8A98\u5C0E\u76EE\u6A19", "tz": "Australia/Sydney", "time": "14:30", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.rba.gov.au/schedules-events/board-meeting-schedules.html", "current": { "display": "4.60%", "value": 4.6, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-29", "effective": "2026-09-30", "source": "https://www.rba.gov.au/cash-rate-target-overview.html" }, "meetings": [{ "date": "2026-11-03", "start": "2026-11-02", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2026-12-08", "start": "2026-12-07" }, { "date": "2027-02-09", "start": "2027-02-08", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-03-23", "start": "2027-03-22" }, { "date": "2027-05-04", "start": "2027-05-03", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-06-22", "start": "2027-06-21" }, { "date": "2027-08-10", "start": "2027-08-09", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-09-28", "start": "2027-09-27" }, { "date": "2027-11-02", "start": "2027-11-01", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-12-14", "start": "2027-12-13" }] }, { "id": "rbnz", "short": "RBNZ", "name": "NZ\u6E96\u5099\u9280\u884C\uFF08RBNZ\uFF09", "ccy": "NZD", "flag": "NZ", "bis": "NZ", "meeting": "\u653F\u7B56\u91D1\u5229\uFF08OCR\uFF09\u767A\u8868", "rateName": "\u30AA\u30D5\u30A3\u30B7\u30E3\u30EB\u30FB\u30AD\u30E3\u30C3\u30B7\u30E5\u30EC\u30FC\u30C8\uFF08OCR\uFF09", "tz": "Pacific/Auckland", "time": "14:00", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.rbnz.govt.nz/news-and-events/how-we-release-information/ocr-decision-dates-and-financial-stability-report-dates-to-feb-2028", "current": { "display": "2.75%", "value": 2.75, "lastAction": "\u5229\u4E0A\u3052", "delta": 0.25, "decided": "2026-09-02", "source": "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate" }, "meetings": [{ "date": "2026-10-28", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2026-12-09", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-02-10", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-03-17", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-05-05", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-06-16", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-08-04", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-09-15", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }, { "date": "2027-10-27", "tag": "\u91D1\u878D\u653F\u7B56\u30EC\u30D3\u30E5\u30FC" }, { "date": "2027-12-08", "tag": "\u91D1\u878D\u653F\u7B56\u58F0\u660E" }] }, { "id": "boc", "short": "BOC", "name": "\u30AB\u30CA\u30C0\u9280\u884C\uFF08BOC\uFF09", "ccy": "CAD", "flag": "\u52A0", "bis": "CA", "meeting": "\u653F\u7B56\u91D1\u5229\u767A\u8868", "rateName": "\u7FCC\u65E5\u7269\u91D1\u5229\u306E\u8A98\u5C0E\u76EE\u6A19", "tz": "America/Toronto", "time": "09:45", "timeLabel": "\u653F\u7B56\u767A\u8868", "url": "https://www.bankofcanada.ca/2026/07/bank-canada-publishes-2027-schedule-policy-interest-rate-announcements-other-major-publications/", "current": { "display": "2.25%", "value": 2.25, "lastAction": "\u636E\u3048\u7F6E\u304D", "decided": "2026-09-02", "lastChange": "2025-10-29", "source": "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/" }, "meetings": [{ "date": "2026-10-28" }, { "date": "2026-12-09" }, { "date": "2027-01-27", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-03-03" }, { "date": "2027-04-28", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-06-02" }, { "date": "2027-07-21", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-09-08" }, { "date": "2027-10-27", "tag": "\u91D1\u878D\u653F\u7B56\u5831\u544A" }, { "date": "2027-12-08" }] }, { "id": "snb", "short": "SNB", "name": "\u30B9\u30A4\u30B9\u56FD\u7ACB\u9280\u884C\uFF08SNB\uFF09", "ccy": "CHF", "flag": "\u745E", "bis": "CH", "meeting": "\u91D1\u878D\u653F\u7B56\u8A55\u4FA1", "rateName": "SNB\u653F\u7B56\u91D1\u5229", "tz": "Europe/Zurich", "time": "09:30", "timeLabel": "\u653F\u7B56\u767A\u8868\uFF0810:00\u304B\u3089\u8A18\u8005\u4F1A\u898B\uFF09", "url": "https://www.snb.ch/en/services-events/digital-services/event-schedule", "current": { "display": "0.00%", "value": 0, "lastAction": "\u636E\u3048\u7F6E\u304D", "decided": "2026-09-24", "source": "https://www.snb.ch/en/publications/communication/press-releases-restricted/pre_20260924" }, "meetings": [{ "date": "2026-12-10" }, { "date": "2027-03-18" }, { "date": "2027-06-24" }, { "date": "2027-09-23" }, { "date": "2027-12-16" }] }] }, "cftc_schedule.json": { "checked": "2026-10-03", "source": "https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm", "note": "CFTC\u304C\u516C\u8868\u3059\u308B\u5EFA\u7389\u660E\u7D30\u306E\u516C\u8868\u65E5\uFF08\u7C73\u6771\u90E815:30\uFF09\u3002\u795D\u65E5\u306E\u9031\u306F\u6708\u66DC\u306A\u3069\u306B\u305A\u308C\u307E\u3059\u3002\u7FCC\u5E74\u5206\u304C\u516C\u8868\u3055\u308C\u305F\u3089\u8FFD\u8A18\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u4E00\u89A7\u306E\u6700\u5F8C\u306E\u65E5\u4ED8\u3088\u308A\u5F8C\u306F\u3001\u6BCE\u9031\u91D1\u66DC\u3068\u3057\u3066\u6271\u3044\u307E\u3059\u3002", "dates": ["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06", "2026-11-16", "2026-11-20", "2026-11-30", "2026-12-04", "2026-12-11", "2026-12-18", "2026-12-28"] }, "holidays_jp_extra.json": { "checked": "2026-10-03", "source": "\u65E5\u672C\u53D6\u5F15\u6240\u30B0\u30EB\u30FC\u30D7 \u4F11\u696D\u65E5\u4E00\u89A7 https://www.jpx.co.jp/corporate/about-jpx/calendar/index.html", "note": "\u56FD\u6C11\u306E\u795D\u65E5\u4EE5\u5916\u3067\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\u304C\u4F11\u696D\u3059\u308B\u65E5\uFF08\u5E74\u672B\u5E74\u59CB\uFF09\u3002", "days": [["2026-12-31", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"], ["2027-01-02", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"], ["2027-01-03", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"], ["2027-12-31", "\u5E74\u672B\u5E74\u59CB\u306E\u4F11\u696D\u65E5\uFF08\u6771\u4EAC\u8A3C\u5238\u53D6\u5F15\u6240\uFF09"]] } };

// src/entry.mjs
var dataDir = join9(process.cwd(), "data");
mkdirSync(join9(dataDir, "manual"), { recursive: true });
for (const [name, obj] of Object.entries(MANUAL)) {
  const p = join9(dataDir, "manual", name);
  if (!existsSync(p)) writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}
var i = process.argv.indexOf("--brief");
var mode = i > 0 ? process.argv[i + 1] : "none";
var meta = await updateAll({ outDir: dataDir });
var bad = Object.entries(meta.sources).filter(([, v]) => v.status === "error").map(([k]) => k);
console.log(bad.length ? `\u30C7\u30FC\u30BF\u53D6\u5F97 \u5B8C\u4E86\uFF08\u5931\u6557: ${bad.join(", ")}\uFF09` : "\u30C7\u30FC\u30BF\u53D6\u5F97 \u5B8C\u4E86");
if (mode === "daily" || mode === "weekly") {
  const r = await run7({ mode, dataDir });
  if (!r.ok && !r.skipped) process.exitCode = 1;
}
