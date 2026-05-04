import StatsCards from "@/components/dashboard/StatsCards";
import RecentMatches from "@/components/dashboard/RecentMatches";

export default function DashboardHomePage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Good morning</h2>
        <p className="mt-0.5 text-sm text-slate-500">Here&apos;s your funding intelligence overview.</p>
      </div>
      <StatsCards />
      <RecentMatches />
    </div>
  );
}
