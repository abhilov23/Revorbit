import OpenAI from "openai";

export interface CreateAiClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface CompleteOptions {
  model?: string;
}

export function createAiClient(options: CreateAiClientOptions) {
  const client = new OpenAI({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
  });

  const defaultModel = options.model ?? "gpt-4o-mini";

  async function complete(
    systemPrompt: string,
    userPrompt: string,
    completeOptions: CompleteOptions = {},
  ) {
    const model = completeOptions.model ?? defaultModel;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

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
