"use client";

import { Sparkles, TrendingUp, Clock, Plus, LayoutGrid } from "lucide-react";

export type FeedTab = "matches" | "trending" | "closing_soon" | "new" | "browse";

interface FeedTabsProps {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}

const TABS: { value: FeedTab; label: string; icon: React.ReactNode }[] = [
  { value: "matches", label: "My Matches", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { value: "trending", label: "Trending", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: "closing_soon", label: "Closing Soon", icon: <Clock className="h-3.5 w-3.5" /> },
  { value: "new", label: "New", icon: <Plus className="h-3.5 w-3.5" /> },
  { value: "browse", label: "Browse All", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
];

export default function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tab.value
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
