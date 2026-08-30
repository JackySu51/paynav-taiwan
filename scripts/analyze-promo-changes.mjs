#!/usr/bin/env node
/**
 * AI 輔助判讀：把 watch-promos 偵測到「有變動」的頁面丟給 LLM，
 * 讓它結構化回答「數字有沒有變、新舊是多少」。
 *
 *   node scripts/analyze-promo-changes.mjs                # 判讀所有變動
 *   node scripts/analyze-promo-changes.mjs --source cathay_cube_promo   # 指定
 *
 * 使用前設定環境變數：
 *   export LLM_PROVIDER=github_models    # 或 anthropic
 *   export GITHUB_TOKEN=ghp_xxx          # GitHub Models 用（免費）
 *   export ANTHROPIC_API_KEY=sk-ant-xxx  # Anthropic 用（付費）
 *
 * 為什麼分兩步：
 * · watch-promos 只做「頁面有沒有變」的雜湊比對，沒動 LLM
 * · 這一支才實際讀內容做判讀，比較耗費 API 配額
 * · 好處是你可以先看變動清單，決定要不要花 tokens 判讀
 *
 * 輸出：data/promo-analysis.json，供 GitHub Actions 貼進 issue
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getProviderFromEnv, LlmRateLimitError } from './lib/llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES_PATH = join(ROOT, 'public/data/promo-sources.json');
const STATE_PATH = join(ROOT, 'data/promo-state.json');
const OUT_PATH = join(ROOT, 'data/promo-analysis.json');
const RULES_PATH = join(ROOT, 'public/data/rules.json');

const USER_AGENT = 'PayNavTaiwan-analyzer/1.0';
const FETCH_TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = `你是台灣信用卡回饋規則的分析助理。使用者會給你一個銀行活動頁的內容，
以及我方資料庫裡現有的規則。請你判讀這個頁面上的回饋數字，
並比對我方資料是否需要更新。

嚴格要求：
- 只根據頁面內容判讀，不要依賴訓練資料裡的歷史數字
- 如果頁面沒明說某個數字，回傳 null 不要猜
- 上限的計算範圍要看清楚（是「加碼上限」還是「總回饋上限」）
- 活動期限一定要抓出來，格式 YYYY-MM-DD
- 如果頁面是活動列表而不是單一活動，只判讀最主要的那個

輸出必須是合法 JSON，格式：
{
  "confidence": "high" | "medium" | "low",
  "summary": "一句話說這頁在講什麼",
  "detected_rules": [
    {
      "payment_method": "jkopay | linepay | pxpayplus | ...",
      "channels": ["seven_eleven", ...] 或 ["all"],
      "base_reward_pct": 1,
      "extra_reward_pct": 2,
      "cap_amount_monthly": 500 或 null,
      "valid_until": "2026-12-31",
      "requires": ["需每月登錄", "當月一般消費滿 3000"],
      "note": "簡短描述條件"
    }
  ],
  "changes_from_existing": [
    {
      "field": "extra_reward_pct",
      "old": 2,
      "new": 3,
      "action_suggested": "update"  // 或 "verify" 表示需要人工再看
    }
  ],
  "flags_for_human": ["活動內文提到 12/31 前，但沒說是哪一年", ...]
}`;

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-TW,zh;q=0.9' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 從 HTML 抓出可見文字，避免把 tokens 花在標籤與 script 上 */
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000); // 保守裁切避免超過 tokens 限制
}

function findRelevantRules(rulesData, source) {
  // source.id 例如 "esun_unicard_promo" → 抓 esun_unicard 的所有規則
  const cardId = source.id.replace(/_promo$/, '');
  const card = rulesData.cards.find((c) => c.id === cardId);
  if (!card) return null;
  return {
    card: `${card.bank} ${card.name}`,
    rules: card.rules,
  };
}

async function analyzeOne(provider, source, existingRules) {
  console.log(`\n▶ ${source.name}`);
  console.log(`    ${source.url}`);

  const html = await fetchPage(source.url);
  const text = extractText(html);
  console.log(`    抓到 ${text.length} 字元的可見文字`);

  const userPrompt = [
    `# 銀行活動頁內容\n\n${text}`,
    existingRules
      ? `\n\n# 我方資料庫現有的規則（${existingRules.card}）\n\n${JSON.stringify(existingRules.rules, null, 2)}`
      : '',
    '\n\n請依系統提示的 JSON 格式輸出判讀結果。',
  ].join('');

  const raw = await provider.chat({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    expectJson: true,
    maxTokens: 2000,
  });

  try {
    const parsed = JSON.parse(raw);
    console.log(`    信心度：${parsed.confidence}`);
    console.log(`    偵測到 ${parsed.detected_rules?.length ?? 0} 條規則`);
    if (parsed.changes_from_existing?.length) {
      console.log(`    ⚠ 有 ${parsed.changes_from_existing.length} 處與現有資料不符`);
    }
    return { source: source.id, provider: provider.name, ok: true, result: parsed };
  } catch (error) {
    console.log(`    ✗ 判讀失敗（JSON 解析錯誤）：${error.message}`);
    return {
      source: source.id,
      provider: provider.name,
      ok: false,
      error: `JSON parse: ${error.message}`,
      raw: raw.slice(0, 500),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const onlySource = args[args.indexOf('--source') + 1];

  const [sources, state, rules] = await Promise.all([
    readFile(SOURCES_PATH, 'utf8').then(JSON.parse),
    existsSync(STATE_PATH) ? readFile(STATE_PATH, 'utf8').then(JSON.parse) : {},
    readFile(RULES_PATH, 'utf8').then(JSON.parse),
  ]);

  // 只判讀「有變動」或「從未判讀過」的頁面，除非指定 --source
  let targets = sources;
  if (onlySource) {
    targets = sources.filter((s) => s.id === onlySource);
    if (!targets.length) {
      console.error(`找不到來源：${onlySource}`);
      process.exit(1);
    }
  } else {
    targets = sources.filter((s) => state[s.id]?.changed === true);
    if (!targets.length) {
      console.log('沒有需要判讀的變動。先跑 npm run promo:watch。');
      return;
    }
  }

  console.log(`需要判讀 ${targets.length} 個來源`);

  let provider;
  try {
    provider = getProviderFromEnv();
    console.log(`使用提供者：${provider.name}`);
  } catch (error) {
    console.error(`\n✗ ${error.message}`);
    console.error('  設定 LLM_PROVIDER + 對應的 token 後重試。詳見 docs/09-AI-輔助維護.md');
    process.exit(1);
  }

  const analyses = [];
  for (const source of targets) {
    try {
      const existing = findRelevantRules(rules, source);
      const analysis = await analyzeOne(provider, source, existing);
      analyses.push(analysis);
    } catch (error) {
      if (error instanceof LlmRateLimitError) {
        console.log(`\n✗ 配額用完：${error.message}`);
        console.log('  已判讀的結果會先寫入，剩下的下次再跑。');
        break;
      }
      console.log(`    ✗ ${source.id} 失敗：${error.message}`);
      analyses.push({ source: source.id, ok: false, error: error.message });
    }
    // 對 API 客氣，兩秒一次
    await new Promise((r) => setTimeout(r, 2000));
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider: provider.name,
        analyses,
      },
      null,
      2,
    ) + '\n',
  );

  const withChanges = analyses.filter((a) => a.ok && a.result?.changes_from_existing?.length);
  console.log(`\n完成。有 ${withChanges.length} 個來源偵測到規則需要更新。`);
  console.log(`結果寫入：data/promo-analysis.json`);

  // GitHub Actions 用的 outputs
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('node:fs/promises');
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `has_changes=${withChanges.length > 0}\nchanges_count=${withChanges.length}\n`,
    );
  }
}

main().catch((error) => {
  console.error(`✗ 判讀腳本失敗：${error.message}`);
  process.exit(1);
});
