"use client";

import { Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import type { OrgProfile } from "@/types/profile";

export default function EditProfilePage() {
  const { data, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  // Pre-fill the wizard with the existing org so edits don't wipe unchanged
  // fields. Drop server-managed/heavy columns (embedding is recomputed on save).
  const org = data?.organization as Record<string, unknown> | null | undefined;
  let initialData: Partial<OrgProfile> | undefined;
  if (org) {
    const { profile_embedding: _e, created_at: _c, updated_at: _u, id: _id, ...rest } = org;
    initialData = rest as Partial<OrgProfile>;
  }

  return <OnboardingWizard initialData={initialData} />;
}
