"use client";

import { Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import type { OrgProfile } from "@/types/profile";

export default function EditProfilePage() {
  const { data, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // Pre-fill the wizard with the existing org so edits don't wipe unchanged
  // fields. Drop server-managed/heavy columns (embedding is recomputed on save).
  const org = data?.organization as Record<string, unknown> | null | undefined;
  let initialData: Partial<OrgProfile> | undefined;
  if (org) {
    const OMIT_FIELDS = ["profile_embedding", "created_at", "updated_at", "id"];
    const rest = Object.fromEntries(
      Object.entries(org).filter(([key]) => !OMIT_FIELDS.includes(key)),
    );
    initialData = rest as Partial<OrgProfile>;
  }

  return <OnboardingWizard initialData={initialData} />;
}
