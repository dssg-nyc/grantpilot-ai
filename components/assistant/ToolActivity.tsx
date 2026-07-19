"use client";

import { Search, FileSearch, Sparkles, Kanban, PlusCircle, ArrowRightLeft, FileText, PenLine, Loader2, Check, Globe, Import } from "lucide-react";
import { GRANT_SECTIONS, type GrantSectionKey } from "@/lib/utils/grant-sections";
import type { ToolCallLogEntry } from "@/hooks/useAssistant";

const TOOL_META: Record<string, { label: (input: unknown) => string; icon: React.ElementType }> = {
  search_opportunities: { label: () => "Searching opportunities database", icon: Search },
  web_search: { label: () => "Searching the web", icon: Globe },
  get_opportunity_detail: { label: () => "Looking up grant details", icon: FileSearch },
  get_matches: { label: () => "Checking your matches", icon: Sparkles },
  get_pipeline: { label: () => "Checking your pipeline", icon: Kanban },
  add_to_pipeline: { label: () => "Adding to pipeline", icon: PlusCircle },
  update_pipeline_stage: { label: () => "Updating pipeline stage", icon: ArrowRightLeft },
  get_draft: { label: () => "Reviewing current draft", icon: FileText },
  write_draft_section: {
    label: (input) => {
      const key = (input as { section_key?: GrantSectionKey } | undefined)?.section_key;
      const label = key ? GRANT_SECTIONS[key]?.label : undefined;
      return label ? `Writing "${label}"` : "Writing draft section";
    },
    icon: PenLine,
  },
  import_web_opportunity: {
    label: (input) => {
      const funder = (input as { funder_name?: string } | undefined)?.funder_name;
      return funder ? `Importing grant from ${funder}` : "Importing grant into your pipeline";
    },
    icon: Import,
  },
};

export default function ToolActivity({ call }: { call: ToolCallLogEntry }) {
  const meta = TOOL_META[call.name] ?? { label: () => call.name, icon: Loader2 };
  const Icon = meta.icon;
  const done = call.result !== undefined;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
      {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Icon className="h-3 w-3 animate-pulse text-blue-500" />}
      {meta.label(call.input)}
    </div>
  );
}
