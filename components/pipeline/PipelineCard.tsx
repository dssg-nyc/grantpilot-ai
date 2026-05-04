interface PipelineCardProps {
  title: string;
  funder?: string;
  deadline?: string;
  stage: string;
}

const STAGE_ACCENT: Record<string, string> = {
  saved:       "border-l-slate-300",
  researching: "border-l-blue-400",
  drafting:    "border-l-violet-500",
  submitted:   "border-l-amber-500",
  awarded:     "border-l-emerald-500",
  rejected:    "border-l-red-400",
};

export default function PipelineCard({ title, funder, deadline, stage }: PipelineCardProps) {
  const daysLeft = deadline
    ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const urgent  = daysLeft !== null && daysLeft <= 7  && daysLeft >= 0;
  const warning = daysLeft !== null && daysLeft <= 21 && daysLeft > 7;
  const accentClass = STAGE_ACCENT[stage] ?? "border-l-slate-300";

  return (
    <article className={`group rounded-lg border border-slate-200 border-l-2 ${accentClass} bg-white p-3 shadow-sm transition hover:shadow-md hover:border-slate-300 cursor-pointer`}>
      <p className="text-xs font-semibold leading-snug text-slate-800 line-clamp-2 group-hover:text-blue-600 transition">
        {title}
      </p>

      {funder && (
        <p className="mt-1 text-[11px] text-slate-400 truncate">{funder}</p>
      )}

      {deadline && (
        <div className="mt-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            urgent  ? "bg-red-50 text-red-600" :
            warning ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"
          }`}>
            {daysLeft === 0
              ? "Due today"
              : daysLeft !== null && daysLeft > 0
              ? `${daysLeft}d left`
              : new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      )}
    </article>
  );
}
