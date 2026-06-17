/**
 * USAspending.gov exposes HISTORICAL federal award data (who already received
 * money), not open solicitations an org can apply to. Ingesting it as
 * "opportunities" would pollute the feed and matches with closed awards, so it
 * is intentionally not wired into the ingestion pipeline.
 *
 * It is still valuable as funder intelligence — e.g. "this agency awarded
 * $X to orgs like yours last year" on the opportunity detail page. That is a
 * post-MVP enhancement; until then this returns an empty list by design.
 *
 * Open federal opportunities come from grants.gov (grants) and SAM.gov
 * (contracts/solicitations) instead.
 */
export async function fetchUsaSpendingData(): Promise<never[]> {
  return [];
}
