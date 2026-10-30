// Local embeddings via Ollama (default model: bge-m3, 1024-dim — matches the
// vector(1024) columns on opportunities.embedding and
// organizations.profile_embedding). Vectors from a different model live in a
// different space, so changing EMBEDDING_MODEL requires a full re-embed
// (scripts/reembed-all.ts).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const EMBEDDING_DIMENSIONS = 1024;

// bge-m3 cosine similarities sit ~0.17 higher and in a narrower band than the
// voyage-3 scores the thresholds and score weights were tuned on (measured on
// 447 real org×opportunity pairs: voyage p5/p50/p95 = .20/.28/.38, bge-m3 =
// .37/.45/.52). A linear map fit on those percentiles puts bge-m3 back on the
// voyage scale (within ±0.02 at every percentile), so match_score's semantic
// component and every match_threshold keep their meaning. Re-measure if
// EMBEDDING_MODEL changes.
const SIM_SCALE = 1.232;
const SIM_OFFSET = -0.258;

/** Map a raw bge-m3 cosine similarity onto the 0–1 scale the app was tuned on. */
export function calibrateSimilarity(raw: number): number {
  return Math.min(1, Math.max(0, raw * SIM_SCALE + SIM_OFFSET));
}

/** Inverse of calibrateSimilarity: a calibrated threshold → raw cosine for match_opportunities. */
export function rawSimilarityThreshold(calibrated: number): number {
  return (calibrated - SIM_OFFSET) / SIM_SCALE;
}

const ollamaUrl = () => (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const embeddingModel = () => process.env.EMBEDDING_MODEL || "bge-m3";

// Embedding cost on CPU grows with input length: at ~16K chars a 2-vCPU VPS
// managed ~0.4 grants/s. The title, funder and opening of the description
// carry nearly all the matching signal, so inputs are cut to 2K chars
// (~500 tokens). Ollama also truncates server-side (truncate: true) to
// NUM_CTX as a backstop.
const MAX_INPUTS_PER_REQUEST = 32;
const MAX_CHARS_PER_INPUT = 2000;
const NUM_CTX = 2048;
const REQUEST_TIMEOUT_MS = 120_000;

/** Embed one chunk (<= MAX_INPUTS_PER_REQUEST) in a single request, with backoff on network errors/5xx. */
async function embedChunk(payload: string[], retries: number): Promise<number[][]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const backoff = () => sleep(Math.min(1000 * 2 ** attempt, 16000));
    let response: Response;
    try {
      response = await fetch(`${ollamaUrl()}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: embeddingModel(),
          input: payload,
          truncate: true,
          options: { num_ctx: NUM_CTX },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      // Connection refused / timeout (e.g. Ollama restarting or loading the model).
      console.warn(`Ollama embed request failed (attempt ${attempt + 1}): ${e instanceof Error ? e.message : e}`);
      if (attempt < retries) await backoff();
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      console.warn(`Ollama embed error ${response.status} — retrying (attempt ${attempt + 1})`);
      if (attempt < retries) await backoff();
      continue;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Ollama embed error: ${response.status} ${response.statusText} ${detail.slice(0, 200)}`);
      return payload.map(() => []);
    }

    const data = (await response.json()) as { embeddings?: number[][] };
    const embeddings = data.embeddings ?? [];
    return payload.map((_, i) => {
      const emb = embeddings[i];
      if (!emb?.length) return [];
      if (emb.length !== EMBEDDING_DIMENSIONS) {
        console.error(
          `Embedding model "${embeddingModel()}" returned ${emb.length} dims; expected ${EMBEDDING_DIMENSIONS}. Discarding.`,
        );
        return [];
      }
      return emb;
    });
  }
  console.error("Ollama embed: max retries exceeded");
  return payload.map(() => []);
}

/**
 * Embed a batch of texts, chunking internally into requests of
 * MAX_INPUTS_PER_REQUEST. Returns one vector per input (empty array for any
 * input that is blank or failed).
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

// ---------------------------------------------------------------------------
// Shared text builders — the canonical text each table is embedded from.
// ---------------------------------------------------------------------------

export interface OpportunityEmbeddingFields {
  title?: string | null;
  description?: string | null;
  funder_name?: string | null;
  eligibility_types?: string[] | null;
}

/**
 * Text for opportunities.embedding. Mirrors the ingest paths
 * (title / description / "Funder: ..."), plus the "Eligibility: ..." line the
 * grants.gov sync adds when eligibility is known.
 */
export function buildOpportunityEmbeddingText(opp: OpportunityEmbeddingFields): string {
  const title = opp.title ?? "";
  const lines = [title, opp.description || title, `Funder: ${opp.funder_name ?? ""}`];
  if (opp.eligibility_types?.length) lines.push(`Eligibility: ${opp.eligibility_types.join(", ")}`);
  return lines.join("\n");
}

/** Text for organizations.profile_embedding. Mirrors app/api/profile/route.ts buildEmbeddingText. */
export function buildOrgEmbeddingText(data: Record<string, unknown>): string {
  return [
    data.mission_statement,
    `Focus areas: ${((data.primary_focus_areas as string[] | null) ?? []).join(", ")}`,
    `Beneficiaries: ${((data.target_beneficiaries as string[] | null) ?? []).join(", ")}`,
    `Programs: ${((data.programs as Array<{ name: string; description: string }> | null) ?? []).map((p) => `${p.name}: ${p.description}`).join(". ")}`,
    `Budget: ${data.annual_budget_range ?? ""}`,
    `Service area: ${data.geographic_service_area ?? "national"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
