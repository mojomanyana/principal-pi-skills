const ENDPOINT = process.env.ROUTING_API_URL ?? "https://api.fireworks.ai/inference/v1/chat/completions";
const MODEL = process.env.ROUTING_MODEL ?? "accounts/fireworks/models/glm-5p3-flash";

export function routingModel() {
  return MODEL;
}

export function indexBooleanResults(expectedIds, results, field) {
  if (!Array.isArray(results)) throw new Error("model response is missing results[]");
  const expected = new Set(expectedIds);
  const indexed = new Map();
  for (const item of results) {
    if (!expected.has(item?.id)) throw new Error(`model response contains unknown id ${item?.id}`);
    if (indexed.has(item.id)) throw new Error(`model response contains duplicate id ${item.id}`);
    if (typeof item[field] !== "boolean") throw new Error(`model response has invalid ${field} verdict for ${item.id}`);
    indexed.set(item.id, item);
  }
  const missing = expectedIds.find((id) => !indexed.has(id));
  if (missing) throw new Error(`model response is missing id ${missing}`);
  return indexed;
}

export async function modelJson(messages) {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) throw new Error("FIREWORKS_API_KEY is required");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.2,
          reasoning_effort: "low",
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`model request failed (${response.status}): ${body}`);
      const content = JSON.parse(body).choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("model response had no message content");
      return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.cause?.code === "UND_ERR_HEADERS_TIMEOUT";
      if (!timedOut || attempt === 1) throw error;
    }
  }
}
