import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OrgRole = "admin" | "member";
export type TeamMemberRole = "owner" | OrgRole;

export interface TeamMember {
  id: string;
  email: string;
  org_role: OrgRole;
  role: TeamMemberRole;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: OrgRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
}

export interface TeamData {
  members: TeamMember[];
  invites: TeamInvite[];
  isOwner: boolean;
  isAdmin: boolean;
}

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const response = await fetch("/api/team");
      return response.json() as Promise<TeamData>;
    },
  });
}

export interface InviteTeammateInput {
  email: string;
  role?: OrgRole;
}

export function useInviteTeammate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteTeammateInput) => {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send invite");
      }
      return response.json() as Promise<TeamInvite>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

/** Removes a member, or revokes a pending invite — both hit the same
 * DELETE /api/team/[id] route, which disambiguates by id. */
export function useRemoveTeamEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/team/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

export function useAcceptTeamInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to accept invite");
      }
      return response.json() as Promise<{ org_id: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
