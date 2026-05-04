import { formatDistanceToNowStrict } from "date-fns";

export function daysUntil(date: string): string {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}
