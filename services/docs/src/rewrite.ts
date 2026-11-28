export interface RewriteInput {
  question: string;
  draft: string;
  passages: string[];
  toolNotes: string[];
}

export async function rewriteWithOpenAI(input: RewriteInput): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You phrase answers for the Harbor House front desk. Use only the supplied draft, policy passages, and tool notes. Do not invent a rule. If a tool failed, say that plainly.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
