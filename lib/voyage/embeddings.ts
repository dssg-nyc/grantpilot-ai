const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function embedText(input: string, retries = 3): Promise<number[]> {
  if (!input?.trim()) return [];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "voyage-3",
        input: [input],
      }),
    });

    if (response.status === 429) {
      const waitMs = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(`Voyage AI rate limited — waiting ${waitMs}ms (attempt ${attempt + 1})`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      console.error(`Voyage AI error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as { data?: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? [];
  }

  console.error("Voyage AI: max retries exceeded");
  return [];
}
