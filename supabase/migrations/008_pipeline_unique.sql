-- A grant may appear in a given org's active pipeline only once.
-- 1. Collapse any existing active duplicates, keeping the earliest row.
DELETE FROM public.pipeline_items a
USING public.pipeline_items b
WHERE a.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND a.org_id = b.org_id
  AND a.opportunity_id = b.opportunity_id
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

-- 2. Enforce uniqueness for active items only (soft-deleted rows are excluded,
--    so a removed grant can be re-added later).
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_items_org_opp_active_key
  ON public.pipeline_items (org_id, opportunity_id)
  WHERE deleted_at IS NULL;
