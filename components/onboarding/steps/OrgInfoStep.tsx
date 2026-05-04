"use client";

import { OrgProfile, OrgType } from "@/types/profile";

interface StepProps {
  data: Partial<OrgProfile>;
  onChange: (updates: Partial<OrgProfile>) => void;
}

const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: "ngo", label: "NGO / Nonprofit" },
  { value: "community_group", label: "Community Group" },
  { value: "educational", label: "Educational Institution" },
  { value: "individual", label: "Individual" },
  { value: "impact_startup", label: "Impact Startup" },
  { value: "other", label: "Other" },
];

export default function OrgInfoStep({ data, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Organization Information</h2>
        <p className="mt-1 text-sm text-slate-500">Tell us about your organization's basic details.</p>
      </div>

      {/* Legal Name */}
      <div className="space-y-1">
        <label htmlFor="legal_name" className="block text-sm font-medium text-slate-700">
          Legal Name <span className="text-red-500">*</span>
        </label>
        <input
          id="legal_name"
          type="text"
          value={data.legal_name ?? ""}
          onChange={(e) => onChange({ legal_name: e.target.value })}
          placeholder="Full legal name of your organization"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* DBA Name */}
      <div className="space-y-1">
        <label htmlFor="dba_name" className="block text-sm font-medium text-slate-700">
          DBA / Doing Business As <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="dba_name"
          type="text"
          value={data.dba_name ?? ""}
          onChange={(e) => onChange({ dba_name: e.target.value || null })}
          placeholder="Operating name if different from legal name"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* EIN + 501c3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="ein" className="block text-sm font-medium text-slate-700">
            EIN <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="ein"
            type="text"
            value={data.ein ?? ""}
            onChange={(e) => onChange({ ein: e.target.value || null })}
            placeholder="XX-XXXXXXX"
            maxLength={10}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">501(c)(3) Status</span>
          <div className="flex gap-6 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="is_501c3"
                checked={data.is_501c3 === true}
                onChange={() => onChange({ is_501c3: true })}
                className="h-4 w-4 accent-blue-600"
              />
              Yes
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="is_501c3"
                checked={data.is_501c3 === false}
                onChange={() => onChange({ is_501c3: false })}
                className="h-4 w-4 accent-blue-600"
              />
              No
            </label>
          </div>
        </div>
      </div>

      {/* Org Type */}
      <div className="space-y-1">
        <label htmlFor="org_type" className="block text-sm font-medium text-slate-700">
          Organization Type <span className="text-red-500">*</span>
        </label>
        <select
          id="org_type"
          value={data.org_type ?? ""}
          onChange={(e) => onChange({ org_type: e.target.value as OrgType })}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>Select organization type…</option>
          {ORG_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Year Founded + Website */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="year_founded" className="block text-sm font-medium text-slate-700">
            Year Founded <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="year_founded"
            type="number"
            min={1800}
            max={new Date().getFullYear()}
            value={data.year_founded ?? ""}
            onChange={(e) => onChange({ year_founded: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder="e.g. 2010"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="website_url" className="block text-sm font-medium text-slate-700">
            Website URL <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="website_url"
            type="url"
            value={data.website_url ?? ""}
            onChange={(e) => onChange({ website_url: e.target.value || null })}
            placeholder="https://yourorg.org"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
