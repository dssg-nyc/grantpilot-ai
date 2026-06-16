const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Voyage limits a single request to 128 inputs and ~120K total tokens. Keep
// chunks well under both: 32 inputs/request, each truncated to ~8K chars
// (~2K tokens), so a full chunk stays around 64K tokens.
const MAX_INPUTS_PER_REQUEST = 32;
const MAX_CHARS_PER_INPUT = 8000;

/** Embed one chunk (<= MAX_INPUTS_PER_REQUEST) in a single request, with 429 backoff. */
async function embedChunk(payload: string[], retries: number): Promise<number[][]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ model: "voyage-3", input: payload }),
    });

    if (response.status === 429) {
      const waitMs = Math.min(2000 * 2 ** attempt, 32000);
      console.warn(`Voyage AI rate limited — waiting ${waitMs}ms (attempt ${attempt + 1})`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      console.error(`Voyage AI error: ${response.status} ${response.statusText}`);
      return payload.map(() => []);
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[]; index: number }> };
    const out: number[][] = payload.map(() => []);
    for (const item of data.data ?? []) out[item.index] = item.embedding;
    return out;
  }
  console.error("Voyage AI: max retries exceeded");
  return payload.map(() => []);
}

/**
 * Embed a batch of texts, chunking internally to respect Voyage's per-request
 * input/token limits. Batching is essential: Voyage rate-limits by
 * requests-per-minute, so one request per document quickly trips 429s.
 * Returns one vector per input (empty array for any input blank or failed).
 */
export async function embedTexts(inputs: string[], retries = 5): Promise<number[][]> {
  const result: number[][] = inputs.map(() => []);
  // Keep original index alongside the (truncated) non-empty payloads.
  const items = inputs
    .map((t, i) => ({ i, t: t?.trim() ? t.slice(0, MAX_CHARS_PER_INPUT) : "" }))
    .filter((x) => x.t);
  if (items.length === 0) return result;

  for (let start = 0; start < items.length; start += MAX_INPUTS_PER_REQUEST) {
    const chunk = items.slice(start, start + MAX_INPUTS_PER_REQUEST);
    const embeddings = await embedChunk(chunk.map((c) => c.t), retries);
    embeddings.forEach((emb, j) => { result[chunk[j].i] = emb; });
  }
  return result;
}

export async function embedText(input: string, retries = 5): Promise<number[]> {
  if (!input?.trim()) return [];
  const [embedding] = await embedTexts([input], retries);
  return embedding ?? [];
}
