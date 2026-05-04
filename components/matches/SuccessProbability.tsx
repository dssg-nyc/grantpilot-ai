export default function SuccessProbability({ probability }: { probability: number }) {
  const color = probability >= 70 ? "text-green-600" : probability >= 40 ? "text-amber-600" : "text-red-600";
  return <p className={`text-sm font-medium ${color}`}>Success probability: {probability}%</p>;
}
