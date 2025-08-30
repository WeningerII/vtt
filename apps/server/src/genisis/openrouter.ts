import type { ProviderResponse } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(opts: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<ProviderResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const body = {
    model: opts.model ?? "openrouter/auto",
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.7,
  } as const;

  const started = Date.now();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      // Optional but recommended by OpenRouter
      "HTTP-Referer": "https://github.com/weningerii/vtt",
      "X-Title": "VTT Genisis",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }

  const json: any = await res.json();
  const latency = Date.now() - started;
  const content = json?.choices?.[0]?.message?.content ?? "";
  const model = json?.model ?? body.model;
  const usage = json?.usage ?? undefined;

  return { content, model, usage, raw: { latency } } satisfies ProviderResponse;
}
