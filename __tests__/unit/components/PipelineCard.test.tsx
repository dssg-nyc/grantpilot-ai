import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PipelineCard from "@/components/pipeline/PipelineCard";

describe("PipelineCard", () => {
  it("renders title", () => {
    render(<PipelineCard title="Sample Grant" stage="saved" />);
    expect(screen.getByText("Sample Grant")).toBeDefined();
  });

  it("requires a second click on the checkmark before calling onDelete", () => {
    const onDelete = vi.fn();
    render(<PipelineCard title="Sample Grant" stage="saved" onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText("Remove from pipeline"));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Confirm remove from pipeline"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending delete when the cancel control is clicked", () => {
    const onDelete = vi.fn();
    render(<PipelineCard title="Sample Grant" stage="saved" onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText("Remove from pipeline"));
    fireEvent.click(screen.getByLabelText("Cancel remove from pipeline"));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Remove from pipeline")).toBeDefined();
  });

  it("hides the delete control and shows an in-flight indicator while updating", () => {
    render(<PipelineCard title="Sample Grant" stage="saved" onDelete={vi.fn()} isUpdating />);

    expect(screen.queryByLabelText("Remove from pipeline")).toBeNull();
    expect(screen.getByLabelText("Updating")).toBeDefined();
  });
});
