import fs from "node:fs";
const envText = fs.readFileSync("../../.env", "utf8");
const key = envText.match(/^AI_API_KEY=(.+)$/m)?.[1].trim();
const base = envText.match(/^AI_BASE_URL=(.+)$/m)?.[1].trim();
const models = ["deepseek-ai/deepseek-coder-6.7b-instruct", "nvidia/llama-3.1-nemotron-nano-8b-v1", "deepseek-ai/deepseek-v4-flash", "meta/llama-3.1-8b-instruct"];
for (const m of models) {
  try {
    const t0 = Date.now();
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: m, messages: [{ role: "user", content: "say OK" }], max_tokens: 10 }),
    });
    console.log(m, "->", r.status, "in", Date.now() - t0, "ms");
  } catch (e) {
    console.log(m, "-> ERR", e.message.slice(0, 100));
  }
}
