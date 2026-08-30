/**
 * LLM 提供者的抽象層。
 *
 * 目前支援兩家，未來想加新的（Gemini、Groq、OpenRouter…）只要實作 LlmProvider 介面。
 *
 * 為什麼要抽象化：
 * · 免費起步用 GitHub Models（GPT-4o，一天 50 次）
 * · 有預算後切 Anthropic（Claude Sonnet 4.6）
 * · 切換只需要改一個環境變數，不用改所有呼叫端
 * · 未來如果 A 家漲價或 B 家出新模型，切換成本是零
 *
 * 環境變數：
 *   LLM_PROVIDER=github_models   # 或 anthropic
 *   GITHUB_TOKEN=xxx             # GitHub Models 需要 PAT
 *   ANTHROPIC_API_KEY=xxx        # Anthropic 需要 API key
 */

export interface LlmProvider {
  name: string;
  /** 送一則訊息給模型，回傳純文字回應。系統提示放前面。 */
  chat(params: {
    system: string;
    user: string;
    /** 期望回傳 JSON；提供者會盡量約束（例如 Anthropic 的 response_format） */
    expectJson?: boolean;
    maxTokens?: number;
  }): Promise<string>;
}

/**
 * GitHub Models 提供者。
 * 免費，但有配額：每天 50 次、每次輸入 8000 tokens、輸出 4000 tokens。
 * 適合起步與低頻使用；跑不動整批規則時會被 429 擋。
 */
export function githubModelsProvider(config: {
  token: string;
  model?: string;
}): LlmProvider {
  const model = config.model ?? 'gpt-4o';
  return {
    name: `github_models/${model}`,
    async chat({ system, user, expectJson, maxTokens = 1500 }) {
      const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: maxTokens,
          temperature: 0.2, // 資料判讀要穩定，不要創意
          ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (res.status === 429) {
        // 剩餘資訊在 header，把它撈出來給呼叫端做人性化處理
        const remaining = res.headers.get('x-ratelimit-remaining');
        const reset = res.headers.get('x-ratelimit-reset');
        throw new LlmRateLimitError(
          `GitHub Models 配額用完了（剩餘 ${remaining ?? '?'}，重置 ${reset ?? '?'}）`,
        );
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub Models 回應失敗 (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    },
  };
}

/**
 * Anthropic 提供者。
 * 付費，但配額寬鬆；判讀品質對中文更好一點，特別是牽涉數字結構化的任務。
 * 適合定期批次跑，成本每月大約 US$2-5（我方用量估算）。
 */
export function anthropicProvider(config: {
  apiKey: string;
  model?: string;
}): LlmProvider {
  const model = config.model ?? 'claude-sonnet-4-5';
  return {
    name: `anthropic/${model}`,
    async chat({ system, user, expectJson, maxTokens = 1500 }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          // Anthropic 沒有原生 JSON 模式，靠 prompt 約束
          system: expectJson
            ? `${system}\n\n嚴格只輸出合法的 JSON，不要有前後說明或 markdown 圍籬。`
            : system,
          messages: [{ role: 'user', content: user }],
          temperature: 0.2,
        }),
      });

      if (res.status === 429) {
        throw new LlmRateLimitError('Anthropic API 遇到速率限制');
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic 回應失敗 (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      const text = data.content?.filter((c) => c.type === 'text')[0]?.text ?? '';

      // 有時候還是會混入 ```json ... ``` 圍籬，統一剝掉
      if (expectJson) {
        return text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
      }
      return text;
    },
  };
}

export class LlmRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmRateLimitError';
  }
}

/**
 * 依環境變數自動挑一個提供者。
 * Node.js 側使用；App 本體不會呼叫 LLM（那是伺服器/排程的事）。
 */
export function getProviderFromEnv(): LlmProvider {
  const provider = process.env.LLM_PROVIDER ?? 'github_models';

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('缺少 ANTHROPIC_API_KEY');
    return anthropicProvider({ apiKey: key });
  }

  if (provider === 'github_models') {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('缺少 GITHUB_TOKEN（可用個人的 PAT，讀取權限就夠）');
    return githubModelsProvider({ token });
  }

  throw new Error(`未知的 LLM_PROVIDER: ${provider}`);
}
