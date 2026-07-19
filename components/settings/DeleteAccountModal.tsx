"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useDeleteAccount } from "@/hooks/useProfile";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
}

const CONFIRM_WORD = "DELETE";

export default function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Rendered as a separate component that only mounts while `open` is true:
  // the whole subtree unmounts on close and mounts fresh next time, so
  // `confirmText` and the mutation state start clean without needing an
  // effect to reset them.
  return <DeleteAccountDialog onClose={onClose} />;
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const deleteAccount = useDeleteAccount();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const canConfirm = confirmText === CONFIRM_WORD;

  async function handleConfirmDelete() {
    if (!canConfirm) return;
    try {
      await deleteAccount.mutateAsync();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      // Error state is surfaced via deleteAccount.isError / deleteAccount.error below;
      // keep the modal open so the user can see what went wrong.
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete account"
          className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Delete account</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          <div className="mb-4 flex items-start gap-3 rounded-md bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-700">
              This action is permanent and cannot be undone. It will delete your organization,
              pipeline, and match data. Any grants you&apos;ve submitted to the shared platform
              pool will remain — they&apos;ll just no longer be attributed to you.
            </p>
          </div>

          {deleteAccount.isError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {deleteAccount.error instanceof Error
                ? deleteAccount.error.message
                : "Failed to delete account"}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Type <span className="font-semibold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleteAccount.isPending}
              autoComplete="off"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={deleteAccount.isPending}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={!canConfirm || deleteAccount.isPending}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
