import { z } from "zod";

export const profileSchema = z.object({
  legal_name: z.string().min(2),
  mission_statement: z.string().min(10).max(500).optional(),
  primary_focus_areas: z.array(z.string()).default([]),
  target_beneficiaries: z.array(z.string()).default([]),
});

export const pipelineCreateSchema = z.object({
  opportunity_id: z.string().uuid(),
  title: z.string().min(3),
  stage: z.enum(["saved", "researching", "drafting", "submitted", "awarded", "rejected", "withdrawn"]).default("saved"),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});
