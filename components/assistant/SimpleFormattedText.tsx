"use client";

// Lightweight formatter for assistant chat replies — no markdown library
// dependency. Handles the shapes Claude actually produces in conversational
// (not draft-section) replies: paragraphs, bullet lists, and **bold**.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

export default function SimpleFormattedText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, bIdx) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^[-*]\s/.test(l.trim()));

        if (isList) {
          return (
            <ul key={bIdx} className="list-disc space-y-1 pl-5">
              {lines.map((line, lIdx) => (
                <li key={lIdx} className="leading-relaxed">
                  {renderInline(line.trim().replace(/^[-*]\s/, ""), `${bIdx}-${lIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bIdx} className="leading-relaxed whitespace-pre-wrap">
            {renderInline(block, `${bIdx}`)}
          </p>
        );
      })}
    </div>
  );
}
