#!/usr/bin/env node
/**
 * 檢查回饋規則庫有沒有過期。
 *
 *   node scripts/check-rules.mjs            # 只印報告
 *   node scripts/check-rules.mjs --strict   # 有過期規則就結束碼 1（給 CI 用）
 *
 * 判斷標準：
 *   - 已過期：valid_until 早於今天
 *   - 快到期：valid_until 在 30 天內
 *   - 順便驗 JSON 結構，避免手改壞掉才發現
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WARN_DAYS = 30;

// 合法支付方式一律以 rules.json 的 paymentMethods 為準，新增支付工具不用再改這支腳本。

const readJson = async (relPath) => JSON.parse(await readFile(join(ROOT, relPath), 'utf8'));

const daysBetween = (a, b) => Math.round((a - b) / 86_400_000);

async function main() {
  const strict = process.argv.includes('--strict');
  const rules = await readJson('public/data/rules.json');
  const stores = await readJson('public/data/stores.json');

  const channelIds = new Set([...stores.channels.map((c) => c.id), 'all']);
  const methodIds = new Set(rules.paymentMethods.map((m) => m.id));

  const errors = [];
  const expired = [];
  const expiringSoon = [];
  const today = new Date(new Date().toISOString().slice(0, 10));

  for (const card of rules.cards) {
    if (!card.id || !card.bank || !card.name) {
      errors.push(`卡片缺少 id / bank / name：${JSON.stringify(card).slice(0, 80)}`);
    }
    for (const rule of card.rules ?? []) {
      const label = `${card.bank} ${card.name} × ${rule.payment_method}`;

      if (!methodIds.has(rule.payment_method)) {
        errors.push(`${label}：rules.json 的 paymentMethods 裡沒有這個支付方式`);
      }
      for (const channel of rule.channels ?? []) {
        if (!channelIds.has(channel)) {
          errors.push(`${label}：通路代號「${channel}」在 stores.json 的 channels 找不到`);
        }
      }
      if (typeof rule.base_reward_pct !== 'number' || typeof rule.extra_reward_pct !== 'number') {
        errors.push(`${label}：回饋率必須是數字`);
      }
      if (rule.cap_amount_monthly !== null && typeof rule.cap_amount_monthly !== 'number') {
        errors.push(`${label}：cap_amount_monthly 必須是數字或 null`);
      }

      if (rule.valid_until) {
        const due = new Date(rule.valid_until);
        if (Number.isNaN(due.getTime())) {
          errors.push(`${label}：valid_until 格式要是 YYYY-MM-DD`);
          continue;
        }
        const diff = daysBetween(due, today);
        if (diff < 0) expired.push({ label, date: rule.valid_until, diff });
        else if (diff <= WARN_DAYS) expiringSoon.push({ label, date: rule.valid_until, diff });
      }
    }
  }

  const lines = [];
  lines.push(`規則庫版本：${rules.version}（更新於 ${rules.updated_at}）`);
  lines.push(`共 ${rules.cards.length} 張卡、${rules.cards.reduce((n, c) => n + c.rules.length, 0)} 條規則`);
  lines.push('');

  if (errors.length) {
    lines.push(`❌ 結構問題 ${errors.length} 筆`);
    errors.forEach((e) => lines.push(`   - ${e}`));
    lines.push('');
  }
  if (expired.length) {
    lines.push(`⏰ 已過期 ${expired.length} 條，請去銀行官網核對後更新 valid_until`);
    expired.forEach((e) => lines.push(`   - ${e.label}（${e.date}，過期 ${-e.diff} 天）`));
    lines.push('');
  }
  if (expiringSoon.length) {
    lines.push(`🔔 ${WARN_DAYS} 天內到期 ${expiringSoon.length} 條`);
    expiringSoon.forEach((e) => lines.push(`   - ${e.label}（${e.date}，剩 ${e.diff} 天）`));
    lines.push('');
  }
  if (!errors.length && !expired.length && !expiringSoon.length) {
    lines.push('✅ 全部正常，沒有過期或即將到期的規則。');
  }

  const report = lines.join('\n');
  console.log(report);

  // 給 GitHub Actions 用：把報告寫進 step output
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import('node:fs/promises');
    const needsAttention = errors.length + expired.length + expiringSoon.length > 0;
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `needs_attention=${needsAttention}\nreport<<REPORT_EOF\n${report}\nREPORT_EOF\n`,
    );
  }

  if (strict && (errors.length || expired.length)) process.exit(1);
}

main().catch((error) => {
  console.error('檢查腳本自己壞了：', error);
  process.exit(1);
});
