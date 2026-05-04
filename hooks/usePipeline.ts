import { useQuery } from "@tanstack/react-query";

export function usePipeline() {
  return useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const response = await fetch("/api/pipeline");
      return response.json();
    },
  });
}
