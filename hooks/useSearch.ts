import { useQuery } from "@tanstack/react-query";

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    enabled: Boolean(query),
    queryFn: async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      return response.json();
    },
  });
}
