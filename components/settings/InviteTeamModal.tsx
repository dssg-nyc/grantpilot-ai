"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { useInviteTeammate } from "@/hooks/useTeam";
import type { OrgRole } from "@/hooks/useTeam";

interface InviteTeamModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InviteTeamModal({ open, onClose }: InviteTeamModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const inviteTeammate = useInviteTeammate();

  // Reset happens directly in the event handlers that close the modal
  // (handleClose below), not in an effect keyed off `open` — calling
  // setState synchronously from inside an effect trips the React Compiler
  // purity rule ("can trigger cascading renders"). Resetting at the close
  // call site instead means the state change is always tied to a real user
  // event.
  function handleClose() {
    setEmail("");
    setRole("member");
    inviteTeammate.reset();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canSubmit = /\S+@\S+\.\S+/.test(email) && !inviteTeammate.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await inviteTeammate.mutateAsync({ email: email.trim(), role });
      handleClose();
    } catch {
      // Error state is surfaced via inviteTeammate.isError / .error below;
      // keep the modal open so the user can see what went wrong.
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invite teammate"
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Invite teammate</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          <div className="mb-4 flex items-start gap-3 rounded-md bg-blue-50 p-3">
            <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
            <p className="text-sm text-blue-700">
              We&apos;ll email them a link to join your organization. The invite expires in 7
              days.
            </p>
          </div>

          {inviteTeammate.isError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {inviteTeammate.error instanceof Error
                ? inviteTeammate.error.message
                : "Failed to send invite"}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.org"
                disabled={inviteTeammate.isPending}
                autoComplete="off"
                autoFocus
              />
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
                disabled={inviteTeammate.isPending}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="member">Member — can view and work matches/pipeline</option>
                <option value="admin">Admin — can also invite and remove teammates</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={inviteTeammate.isPending}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {inviteTeammate.isPending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
