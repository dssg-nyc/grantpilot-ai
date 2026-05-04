export default function MatchReasons({ reasons }: { reasons: string[] }) {
  return (
    <ul className="list-disc pl-5 text-sm text-slate-600">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}
