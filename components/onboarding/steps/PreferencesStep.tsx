"use client";

import { OrgProfile } from "@/types/profile";

interface StepProps {
  data: Partial<OrgProfile>;
  onChange: (updates: Partial<OrgProfile>) => void;
}

const GRANT_TYPES = [
  "General Operating",
  "Project/Program",
  "Capacity Building",
  "Capital",
  "Research",
];

const NOTIFICATION_OPTIONS: {
  value: NonNullable<OrgProfile["notification_frequency"]>;
  label: string;
  description: string;
}[] = [
  { value: "daily", label: "Daily", description: "Get new matches every day" },
  { value: "weekly", label: "Weekly", description: "A weekly digest of top matches" },
  { value: "never", label: "Never", description: "I'll check in manually" },
];

export default function PreferencesStep({ data, onChange }: StepProps) {
  const grantTypes = data.preferred_grant_types ?? [];
  const threshold = data.match_score_threshold ?? 50;

  function toggleGrantType(type: string) {
    if (grantTypes.includes(type)) {
      onChange({ preferred_grant_types: grantTypes.filter((t) => t !== type) });
    } else {
      onChange({ preferred_grant_types: [...grantTypes, type] });
    }
  }

  function formatCurrency(val: number | undefined): string {
    if (!val) return "";
    return val.toLocaleString("en-US");
  }

  function parseCurrency(raw: string): number | undefined {
    const cleaned = raw.replace(/[^0-9]/g, "");
    return cleaned ? parseInt(cleaned, 10) : undefined;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Grant Preferences</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set your ideal grant parameters so we can surface the best matches.
        </p>
      </div>

      {/* Grant Size Range */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-700">Preferred Grant Size Range</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="min_grant_size" className="block text-xs font-medium text-slate-600">
              Minimum ($)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                $
              </span>
              <input
                id="min_grant_size"
                type="text"
                inputMode="numeric"
                value={formatCurrency(data.min_grant_size)}
                onChange={(e) => onChange({ min_grant_size: parseCurrency(e.target.value) })}
                placeholder="5,000"
                className="w-full rounded-lg border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="max_grant_size" className="block text-xs font-medium text-slate-600">
              Maximum ($)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                $
              </span>
              <input
                id="max_grant_size"
                type="text"
                inputMode="numeric"
                value={formatCurrency(data.max_grant_size)}
                onChange={(e) => onChange({ max_grant_size: parseCurrency(e.target.value) })}
                placeholder="500,000"
                className="w-full rounded-lg border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preferred Grant Types */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-700">Preferred Grant Types</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GRANT_TYPES.map((type) => {
            const checked = grantTypes.includes(type);
            return (
              <label
                key={type}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                  checked
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGrantType(type)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                {type}
              </label>
            );
          })}
        </div>
      </div>

      {/* Match Score Threshold */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-slate-700">
            Minimum Match Score
          </span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-semibold text-blue-700">
            {threshold}%
          </span>
        </div>
        <div className="space-y-1.5">
          <input
            type="range"
            min={25}
            max={90}
            step={5}
            value={threshold}
            onChange={(e) => onChange({ match_score_threshold: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>25% (broader)</span>
            <span>90% (precise)</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Show grant matches above{" "}
          <span className="font-semibold text-slate-700">{threshold}%</span> fit score.
        </p>
      </div>

      {/* Notification Frequency */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-slate-700">Notification Frequency</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {NOTIFICATION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                data.notification_frequency === opt.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-blue-300"
              }`}
            >
              <input
                type="radio"
                name="notification_frequency"
                checked={data.notification_frequency === opt.value}
                onChange={() => onChange({ notification_frequency: opt.value })}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
