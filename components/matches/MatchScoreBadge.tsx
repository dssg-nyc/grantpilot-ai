export default function MatchScoreBadge({ score }: { score: number }) {
  return <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">Match {score}%</span>;
}
