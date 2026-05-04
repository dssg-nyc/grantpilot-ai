"use client";

import { useProfile } from "@/hooks/useProfile";
import Link from "next/link";

const BUDGET_LABELS: Record<string, string> = {
  "<50k": "Under $50K",
  "50k_250k": "$50K – $250K",
  "250k_1m": "$250K – $1M",
  "1m_5m": "$1M – $5M",
  "5m_plus": "$5M+",
};

export default function ProfilePage() {
  const { data, isLoading } = useProfile();
  const org = data?.organization;
  const completeness = data?.profile_completeness ?? 0;

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading profile…</div>;
  }

  if (!org) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900">No profile yet</h2>
        <p className="mt-1 text-sm text-gray-500">Set up your organization profile to get matched with grants.</p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Create Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{org.legal_name}</h1>
          {org.dba_name && <p className="text-sm text-gray-500">DBA: {org.dba_name}</p>}
        </div>
        <Link
          href="/dashboard/profile/edit"
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit Profile
        </Link>
      </div>

      {/* Profile completeness */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Profile completeness</p>
          <p className="text-sm font-bold text-blue-600">{completeness}%</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${completeness}%` }}
          />
        </div>
        {completeness < 80 && (
          <p className="mt-1 text-xs text-gray-400">
            A more complete profile improves match quality.{" "}
            <Link href="/dashboard/profile/edit" className="text-blue-500 hover:underline">
              Complete it →
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Mission */}
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Mission</h3>
          <p className="text-sm text-gray-700">{org.mission_statement ?? "Not set"}</p>
        </div>

        {/* Focus Areas */}
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Focus Areas</h3>
          {org.primary_focus_areas?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {org.primary_focus_areas.map((area: string) => (
                <span key={area} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {area}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not set</p>
          )}
        </div>

        {/* Organization Details */}
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Organization Details
          </h3>
          <dl className="space-y-2 text-sm">
            {[
              ["Type", org.org_type],
              ["Year Founded", org.year_founded],
              ["Annual Budget", org.annual_budget_range ? BUDGET_LABELS[org.annual_budget_range] : null],
              ["Full-time Staff", org.staff_full_time],
              ["501(c)(3)", org.is_501c3 === true ? "Yes" : org.is_501c3 === false ? "No" : "Unknown"],
              ["EIN", org.ein],
              ["Website", org.website_url],
            ].map(([label, value]) =>
              value ? (
                <div key={String(label)} className="flex justify-between">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-800">{String(value)}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>

        {/* Service Area */}
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Geographic Reach
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Scope</dt>
              <dd className="font-medium text-gray-800 capitalize">{org.geographic_service_area?.replace("_", " ")}</dd>
            </div>
            {org.service_states?.length > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">States</dt>
                <dd className="font-medium text-gray-800">{org.service_states.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Programs */}
        {org.programs?.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-5 md:col-span-2">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Programs ({org.programs.length})
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {org.programs.map((p: { name: string; description: string; budget?: number }, i: number) => (
                <div key={i} className="rounded-lg bg-gray-50 p-3">
                  <p className="font-medium text-gray-800">{p.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{p.description}</p>
                  {p.budget && (
                    <p className="mt-1 text-xs text-blue-600">${p.budget.toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
