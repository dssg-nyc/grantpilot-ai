import PipelineCard from "@/components/pipeline/PipelineCard";

interface PipelineItem {
  id: string;
  stage: string;
  title: string;
  notes?: string;
  deadline?: string;
  opportunity?: { title: string; funder_name: string } | null;
}

const STAGE_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  saved:       { label: "Saved",       color: "text-slate-600",   bg: "bg-slate-100",   dot: "bg-slate-400"   },
  researching: { label: "Researching", color: "text-blue-700",    bg: "bg-blue-50",     dot: "bg-blue-500"    },
  drafting:    { label: "Drafting",    color: "text-violet-700",  bg: "bg-violet-50",   dot: "bg-violet-500"  },
  submitted:   { label: "Submitted",   color: "text-amber-700",   bg: "bg-amber-50",    dot: "bg-amber-500"   },
  awarded:     { label: "Awarded",     color: "text-emerald-700", bg: "bg-emerald-50",  dot: "bg-emerald-500" },
  rejected:    { label: "Rejected",    color: "text-red-600",     bg: "bg-red-50",      dot: "bg-red-400"     },
};

export default function PipelineColumn({ stage, items = [] }: { stage: string; items?: PipelineItem[] }) {
  const meta = STAGE_META[stage] ?? { label: stage, color: "text-slate-600", bg: "bg-slate-100", dot: "bg-slate-400" };

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden min-h-[240px]">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b border-slate-200 ${meta.bg}`}>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          <h3 className={`text-xs font-semibold capitalize ${meta.color}`}>{meta.label}</h3>
        </div>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}>
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-[11px] text-slate-300 text-center">Drop grants here</p>
          </div>
        )}
        {items.map((item) => (
          <PipelineCard
            key={item.id}
            stage={stage}
            title={item.opportunity?.title ?? item.title}
            funder={item.opportunity?.funder_name}
            deadline={item.deadline}
          />
        ))}
      </div>
    </section>
  );
}
