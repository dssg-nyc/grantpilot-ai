import { z } from "zod";

// Allow-list for organization fields a client may set when creating a profile
// (POST /api/profile). Mirrors the writable fields of `OrgProfile`
// (types/profile.ts) that the onboarding wizard actually submits.
// Deliberately excludes server/computed-only columns: `id`, `profile_embedding`,
// `profile_completeness`, `created_at`, `updated_at`, `created_by`.
export const profileSchema = z.object({
  legal_name: z.string().min(2),
  dba_name: z.string().nullable().optional(),
  ein: z.string().nullable().optional(),
  is_501c3: z.boolean().nullable().optional(),
  year_founded: z.number().int().nullable().optional(),
  website_url: z.string().nullable().optional(),
  org_type: z
    .enum(["ngo", "community_group", "educational", "individual", "impact_startup", "other"])
    .default("ngo"),
  mission_statement: z.string().min(10).max(500).optional(),
  primary_focus_areas: z.array(z.string()).default([]),
  secondary_focus_areas: z.array(z.string()).default([]),
  target_beneficiaries: z.array(z.string()).default([]),
  geographic_service_area: z
    .enum(["national", "multi_state", "state", "regional", "local"])
    .default("local"),
  service_states: z.array(z.string()).default([]),
  service_cities: z.array(z.string()).default([]),
  sdg_alignments: z.array(z.number()).default([]),
  annual_budget_range: z.enum(["<50k", "50k_250k", "250k_1m", "1m_5m", "5m_plus"]).optional(),
  years_in_operation: z.number().int().nonnegative().optional(),
  programs: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        budget: z.number().optional(),
      }),
    )
    .default([]),
  staff_full_time: z.number().int().nonnegative().optional(),
  staff_part_time: z.number().int().nonnegative().optional(),
  has_received_grants: z.boolean().optional(),
  avg_grant_size_range: z.string().nullable().optional(),
  previous_funder_types: z.array(z.string()).optional(),
  has_active_grants: z.boolean().optional(),
  min_grant_size: z.number().nonnegative().optional(),
  max_grant_size: z.number().nonnegative().optional(),
  preferred_grant_types: z.array(z.string()).optional(),
  notification_frequency: z.enum(["daily", "weekly", "never"]).optional(),
  match_score_threshold: z.number().min(0).max(100).optional(),
  logo_url: z.string().nullable().optional(),
});

// Partial allow-list for PATCH /api/profile. Same field set as `profileSchema`
// but every field optional (a PATCH may touch just one field, e.g. settings
// updating only `match_score_threshold` + `notification_frequency`).
// Excludes the same server/computed-only columns as `profileSchema`.
export const profileUpdateSchema = profileSchema.partial();

const pipelineStageEnum = z.enum([
  "saved",
  "researching",
  "drafting",
  "submitted",
  "awarded",
  "rejected",
  "withdrawn",
]);

// opportunity_id is intentionally optional: the "quick add" flow lets a user
// create a private, manually-tracked pipeline item with no linked opportunity
// (see app/api/pipeline/route.ts POST, hooks/usePipeline.ts AddToPipelineInput).
export const pipelineCreateSchema = z.object({
  opportunity_id: z.string().uuid().optional(),
  match_id: z.string().uuid().optional(),
  title: z.string().min(3),
  stage: pipelineStageEnum.default("saved"),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Allow-list for PATCH /api/pipeline/[id]. Only fields a user should be able
// to change on their own pipeline item. Deliberately excludes `org_id`,
// `opportunity_id`, `id`, `created_at`, `updated_at`, `match_id` — those must
// never be client-settable via this route.
export const pipelineUpdateSchema = z.object({
  stage: pipelineStageEnum.optional(),
  notes: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  amount_requested: z.number().nullable().optional(),
  amount_awarded: z.number().nullable().optional(),
  checklist: z.array(z.unknown()).optional(),
  documents: z.array(z.unknown()).optional(),
});

// POST /api/team — create + send an invite. `role` is the org-scoped role
// the invitee will have once they accept (see users.org_role,
// supabase/migrations/014_team_invites.sql). Owner is never invite-able —
// it's derived from organizations.created_by, not a role a client can set.
export const teamInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

// POST /api/team/accept — the only client-supplied input for accepting an
// invite is the opaque token; everything else (which org, which email it was
// addressed to) is resolved server-side by the accept_org_invite() SECURITY
// DEFINER function against the caller's own authenticated session.
export const teamAcceptSchema = z.object({
  token: z.string().uuid(),
});
