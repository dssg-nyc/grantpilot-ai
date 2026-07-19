"use client";

import { useEffect, useRef, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import PipelineColumn from "@/components/pipeline/PipelineColumn";
import AddGrantModal from "@/components/pipeline/AddGrantModal";
import PipelineItemDetailModal from "@/components/pipeline/PipelineItemDetailModal";
import { usePipeline, useUpdatePipelineStage, useDeletePipelineItem } from "@/hooks/usePipeline";
import type { PipelineItem } from "@/types/pipeline";

const ERROR_DISMISS_MS = 4000;

const STAGES = ["saved", "researching", "drafting", "submitted", "awarded", "rejected"] as const;

export default function PipelineBoard() {
  const { data: items, isLoading } = usePipeline();
  const updateStage = useUpdatePipelineStage();
  const deleteItem = useDeletePipelineItem();
  const allItems: PipelineItem[] = Array.isArray(items) ? items : [];
  const [addGrantOpen, setAddGrantOpen] = useState(false);
  const [openItem, setOpenItem] = useState<PipelineItem | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  function showBoardError(message: string) {
    setBoardError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setBoardError(null);
    }, ERROR_DISMISS_MS);
  }

  function dismissBoardError() {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setBoardError(null);
  }

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    updateStage.mutate(
      { id: draggableId, stage: destination.droppableId },
      {
        onError: () => {
          showBoardError("Couldn't move that grant — try again");
        },
      },
    );
  }

  function onDelete(id: string) {
    deleteItem.mutate(id, {
      onError: () => {
        showBoardError("Couldn't remove that grant — try again");
      },
    });
  }

  function isItemUpdating(id: string) {
    const updating = updateStage.isPending && updateStage.variables?.id === id;
    const deleting = deleteItem.isPending && deleteItem.variables === id;
    return Boolean(updating || deleting);
  }

  const total = allItems.length;

  return (
    <div className="space-y-4">
      {boardError && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <span>{boardError}</span>
          <button
            type="button"
            onClick={dismissBoardError}
            aria-label="Dismiss error"
            className="shrink-0 text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setAddGrantOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add Grant
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((s) => (
            <div key={s} className="h-52 animate-pulse rounded-xl bg-slate-100 border border-slate-200" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{total}</span>
            {total === 1 ? "grant" : "grants"} in pipeline
            {STAGES.filter((s) => allItems.some((i) => i.stage === s)).map((s) => {
              const count = allItems.filter((i) => i.stage === s).length;
              return (
                <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 capitalize">
                  {count} {s}
                </span>
              );
            })}
          </div>

          {/* Board */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {STAGES.map((stage) => (
                <PipelineColumn
                  key={stage}
                  stage={stage}
                  items={allItems.filter((i) => i.stage === stage)}
                  onDelete={onDelete}
                  isItemUpdating={isItemUpdating}
                  onOpenDetail={setOpenItem}
                />
              ))}
            </div>
          </DragDropContext>
        </>
      )}

      {addGrantOpen && <AddGrantModal onClose={() => setAddGrantOpen(false)} />}
      <PipelineItemDetailModal item={openItem} onClose={() => setOpenItem(null)} />
    </div>
  );
}
