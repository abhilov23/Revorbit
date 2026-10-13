import OpenAI from "openai";

import type { ReviewModelOptions } from "@revorbit/shared";

export interface CreateAiClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** Abort a completion that has not settled after this many milliseconds. */
  timeoutMs?: number;
  /** How many times to retry a transient provider failure. */
  maxRetries?: number;
}

export interface CompleteOptions extends ReviewModelOptions {
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 2;

export function createAiClient(options: CreateAiClientOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  const client = new OpenAI({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    maxRetries,
    timeout: timeoutMs,
  });

  const defaultModel = options.model ?? "gpt-4o-mini";

  async function complete(
    systemPrompt: string,
    userPrompt: string,
    completeOptions: CompleteOptions = {},
  ) {
    const model = completeOptions.model ?? defaultModel;
    const maxTokens = completeOptions.maxTokens;

    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
      },
      { signal: completeOptions.signal },
    );

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned an empty response");
    }

    return content;
  }

  return {
    complete,
  };
}

export type AiClient = ReturnType<typeof createAiClient>;
