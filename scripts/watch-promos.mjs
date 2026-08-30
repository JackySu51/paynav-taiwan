#!/usr/bin/env node
/**
 * 優惠活動「變動偵測」，不是內容爬蟲。
 *
 *   node scripts/watch-promos.mjs            # 檢查有沒有變動
 *   node scripts/watch-promos.mjs --report   # 只印目前狀態，不連外
 *
 * 為什麼是變動偵測而不是把優惠抓下來直接用：
 *
 *   1. 法律面：銀行的活動頁是他人的著作，整頁抓下來重新發佈會有風險。
 *      這支腳本只留「內容的指紋（雜湊）」與抓取時間，不保存也不發佈原文。
 *   2. 準確度面：回饋規則充滿條件（登錄、門檻、排除項目、分期不計）。
 *      機器誤讀一個「需登錄」，使用者就會少拿一筆錢，比沒功能更糟。
 *   3. 維護面：銀行頁面改版頻繁，寫死選擇器的爬蟲每季都會壞。
 *      指紋比對只依賴「頁面有沒有變」，改版也不會誤報成資料錯誤。
 *
 * 所以流程是：機器負責「盯著看，有動就叫人」，人負責「判斷數字」。
 * 這在資料正確性比覆蓋率重要的場景（金錢）是划算的取捨。
 *
 * 它會做的事：
 *   - 讀 public/data/promo-sources.json 的官方頁清單
 *   - 檢查 robots.txt 是否允許抓取，不允許就跳過並記錄原因
 *   - 抓首頁 HTML，取出可見文字，算出雜湊
 *   - 和上次的雜湊比對，有變動就寫進 data/promo-state.json 並輸出報告
 *   - 在 GitHub Actions 裡會設定 outputs，讓 workflow 開 issue 提醒你核對
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = join(ROOT, 'public/data/promo-sources.json');
const STATE_DIR = join(ROOT, 'data');
const STATE = join(STATE_DIR, 'promo-state.json');

const REPORT_ONLY = process.argv.includes('--report');
// HTTP header 只接受 ASCII（ByteString），這裡不能寫中文，否則 fetch 會直接丟錯
const USER_AGENT =
  'PayNavTaiwanBot/1.0 (personal project; change-detection only; content not stored)';
const TIMEOUT_MS = 15_000;
/** 對同一個網站之間的間隔，避免造成對方負擔 */
const POLITE_DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * robots.txt 檢查。不是法律義務的全部，但這是最基本的網路禮貌，
 * 對方明確說不要抓就不要抓。
 */
async function robotsAllows(url) {
  try {
    const origin = new URL(url).origin;
    const txt = await fetchText(`${origin}/robots.txt`);
    const path = new URL(url).pathname || '/';

    // 只解析 User-agent: * 這一段的 Disallow
    let inStar = false;
    const disallowed = [];
    for (const rawLine of txt.split('\n')) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const [rawKey, ...rest] = line.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();
      if (key === 'user-agent') inStar = value === '*';
      else if (inStar && key === 'disallow' && value) disallowed.push(value);
    }
    const blocked = disallowed.some((rule) => rule === '/' || path.startsWith(rule));
    return { allowed: !blocked, reason: blocked ? `robots.txt 禁止 ${path}` : '' };
  } catch {
    // 沒有 robots.txt 或讀不到，視為允許（這是慣例）
    return { allowed: true, reason: '' };
  }
}

/** 取出可見文字，去掉 script/style 與空白，避免每次都因為隨機 token 而誤判變動 */
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 把明顯會每次變的東西正規化掉，降低誤報 */
function normalize(text) {
  return text
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[^\d]?\d{0,2}:?\d{0,2}/g, '<日期>')
    .replace(/\b\d{10,}\b/g, '<序號>')
    .toLowerCase();
}

const fingerprint = (text) => createHash('sha256').update(normalize(text)).digest('hex').slice(0, 16);

async function main() {
  const config = await readJson(SOURCES);
  if (!config?.sources?.length) {
    console.error('✗ 找不到 public/data/promo-sources.json 或裡面沒有 sources');
    process.exit(1);
  }

  const previous = (await readJson(STATE, { sources: {} })) ?? { sources: {} };

  if (REPORT_ONLY) {
    console.log(`監控清單共 ${config.sources.length} 個來源：`);
    for (const src of config.sources) {
      const prev = previous.sources?.[src.id];
      console.log(
        ` - ${src.label}：${prev?.checkedAt ? `上次檢查 ${prev.checkedAt.slice(0, 10)}` : '尚未檢查'}` +
          `${prev?.error ? `（上次失敗：${prev.error}）` : ''}`,
      );
    }
    return;
  }

  const changed = [];
  const failed = [];
  const nextSources = {};

  for (const src of config.sources) {
    const prev = previous.sources?.[src.id];
    const gate = await robotsAllows(src.url);

    if (!gate.allowed) {
      console.log(`⏭  ${src.label}：${gate.reason}，跳過`);
      nextSources[src.id] = { ...prev, skipped: gate.reason, checkedAt: new Date().toISOString() };
      await sleep(POLITE_DELAY_MS);
      continue;
    }

    try {
      const html = await fetchText(src.url);
      const text = extractText(html);
      const hash = fingerprint(text);
      const isChanged = Boolean(prev?.hash) && prev.hash !== hash;

      nextSources[src.id] = {
        hash,
        length: text.length,
        checkedAt: new Date().toISOString(),
        lastChangedAt: isChanged ? new Date().toISOString() : (prev?.lastChangedAt ?? null),
      };

      if (!prev?.hash) {
        console.log(`＋ ${src.label}：first seen，記下指紋`);
      } else if (isChanged) {
        console.log(`⚠ ${src.label}：頁面有變動`);
        changed.push(src);
      } else {
        console.log(`＝ ${src.label}：沒有變動`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${src.label}：抓取失敗（${message}）`);
      failed.push({ ...src, message });
      nextSources[src.id] = { ...prev, error: message, checkedAt: new Date().toISOString() };
    }

    await sleep(POLITE_DELAY_MS);
  }

  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(
    STATE,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), sources: nextSources }, null, 2)}\n`,
  );

  const lines = [];
  if (changed.length > 0) {
    lines.push('以下官方頁面有變動，請人工核對回饋數字後更新 `public/data/rules.json`：');
    lines.push('');
    for (const src of changed) {
      lines.push(`- [${src.label}](${src.url})`);
      lines.push(`  - 要看的地方：${src.watch}`);
      if (src.cards?.length) lines.push(`  - 相關卡片：${src.cards.join('、')}`);
    }
  }
  if (failed.length > 0) {
    lines.push('');
    lines.push('抓取失敗（可能是對方擋了機器人或網址改了，需要更新監控清單）：');
    for (const src of failed) lines.push(`- ${src.label}：${src.message}`);
  }

  const report = lines.join('\n');
  if (report) {
    console.log('\n----- 報告 -----');
    console.log(report);
  } else {
    console.log('\n全部沒有變動，這次不用做事。');
  }

  if (process.env.GITHUB_OUTPUT) {
    const needsAttention = changed.length > 0 || failed.length > 0;
    await writeFile(
      process.env.GITHUB_OUTPUT,
      `needs_attention=${needsAttention}\nchanged_count=${changed.length}\n` +
        `report<<REPORT_EOF\n${report || '沒有變動'}\nREPORT_EOF\n`,
      { flag: 'a' },
    );
  }
}

main().catch((error) => {
  console.error(`✗ 腳本失敗：${error.message}`);
  process.exit(1);
});
