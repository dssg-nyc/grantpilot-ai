import { useQuery } from "@tanstack/react-query";

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const response = await fetch("/api/matches");
      return response.json();
    },
  });
}
