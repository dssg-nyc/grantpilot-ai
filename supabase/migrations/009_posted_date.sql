-- Capture when a funder actually opened/posted an opportunity (distinct from
-- created_at, which is when WE ingested it). Lets the UI show/sort by what is
-- genuinely new today rather than by ingest time.
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS posted_date date;
CREATE INDEX IF NOT EXISTS opportunities_posted_date_idx ON public.opportunities (posted_date DESC NULLS LAST);
