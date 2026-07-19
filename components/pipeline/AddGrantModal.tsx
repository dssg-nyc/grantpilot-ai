"use client";

import { useEffect, useState } from "react";
import { useAddToPipeline } from "@/hooks/usePipeline";
import { useSubmitOpportunity } from "@/hooks/useOpportunities";
import type { Opportunity } from "@/types/opportunity";

interface AddGrantModalProps {
  onClose: () => void;
}

type Mode = "quick" | "url";

const FUNDER_TYPE_OPTIONS: { value: NonNullable<Opportunity["funder_type"]>; label: string }[] = [
  { value: "federal_government", label: "Federal Government" },
  { value: "state_government", label: "State Government" },
  { value: "local_government", label: "Local Government" },
  { value: "foundation", label: "Foundation" },
  { value: "corporate", label: "Corporate" },
  { value: "international", label: "International" },
  { value: "individual", label: "Individual" },
  { value: "other", label: "Other" },
];

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

// Rendered only while open (parent mounts it conditionally), so every open is
// a fresh mount with fresh state — no effect-based reset needed on close.
export default function AddGrantModal({ onClose }: AddGrantModalProps) {
  const [mode, setMode] = useState<Mode>("quick");

  // Quick add state
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");

  // Submit from URL state
  const [url, setUrl] = useState("");
  const [funderName, setFunderName] = useState("");
  const [funderType, setFunderType] = useState<string>("");
  const [states, setStates] = useState("");

  const addToPipeline = useAddToPipeline();
  const submitOpportunity = useSubmitOpportunity();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleQuickAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    addToPipeline.mutate(
      {
        title,
        notes: notes || undefined,
        deadline: deadline || undefined,
        stage: "saved",
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }

  function handleSubmitFromUrl(e: React.FormEvent) {
    e.preventDefault();
    const parsedStates = states
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    submitOpportunity.mutate(
      {
        url,
        funder_name: funderName,
        funder_type: funderType ? (funderType as Opportunity["funder_type"]) : undefined,
        geographic_states: parsedStates,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add a grant"
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Add a grant</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          {/* Tab toggle */}
          <div className="mb-4 flex rounded-md border border-gray-200 bg-gray-50 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={`flex-1 rounded px-3 py-1.5 font-medium transition ${
                mode === "quick" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Quick Add
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`flex-1 rounded px-3 py-1.5 font-medium transition ${
                mode === "url" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Submit from URL
            </button>
          </div>

          {mode === "quick" ? (
            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              {addToPipeline.isError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {addToPipeline.error instanceof Error
                    ? addToPipeline.error.message
                    : "Failed to add to pipeline"}
                </div>
              )}
              <div>
                <label className={labelClass}>Title</label>
                <input
                  className={inputClass}
                  type="text"
                  placeholder="e.g. Ford Foundation — Arts Innovation Grant"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="e.g. Ford Foundation — Arts Innovation Grant. https://..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Deadline</label>
                <input
                  className={inputClass}
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <button
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                type="submit"
                disabled={addToPipeline.isPending}
              >
                {addToPipeline.isPending ? "Adding…" : "Add to pipeline"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitFromUrl} className="space-y-4">
              {submitOpportunity.isError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {submitOpportunity.error instanceof Error
                    ? submitOpportunity.error.message
                    : "Failed to submit grant"}
                </div>
              )}
              <div>
                <label className={labelClass}>Grant URL</label>
                <input
                  className={inputClass}
                  type="url"
                  placeholder="https://example.org/grants/arts-innovation"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  disabled={submitOpportunity.isPending}
                />
                <p className="mt-1 text-xs text-gray-500">
                  We&apos;ll extract the details automatically and share this grant with other
                  nonprofits on GrantPilot too.
                </p>
              </div>
              <div>
                <label className={labelClass}>Funder Name</label>
                <input
                  className={inputClass}
                  type="text"
                  placeholder="Ford Foundation"
                  value={funderName}
                  onChange={(e) => setFunderName(e.target.value)}
                  required
                  disabled={submitOpportunity.isPending}
                />
              </div>
              <div>
                <label className={labelClass}>Funder Type</label>
                <select
                  className={inputClass}
                  value={funderType}
                  onChange={(e) => setFunderType(e.target.value)}
                  disabled={submitOpportunity.isPending}
                >
                  <option value="">Select a type (optional)</option>
                  {FUNDER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Service States</label>
                <input
                  className={inputClass}
                  type="text"
                  placeholder="e.g. NY, NJ"
                  value={states}
                  onChange={(e) => setStates(e.target.value)}
                  disabled={submitOpportunity.isPending}
                />
              </div>
              <button
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                type="submit"
                disabled={submitOpportunity.isPending}
              >
                {submitOpportunity.isPending ? "Reading the grant page…" : "Submit grant"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
