import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import { AGENT_TOOLS } from "@/lib/anthropic/agent/tools";
import { TOOL_HANDLERS, type ToolContext } from "@/lib/anthropic/agent/tool-handlers";

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; name: string; input: Record<string, unknown> }
  | { type: "tool_call_end"; name: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "done"; finalText: string };

const MAX_TOOL_ROUNDS = 8;
const MODEL = "claude-sonnet-4-6";

export async function* runAgent(
  systemPrompt: string,
  history: Anthropic.MessageParam[],
  ctx: ToolContext,
): AsyncGenerator<AgentEvent> {
  const messages: Anthropic.MessageParam[] = [...history];
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let stream;
    try {
      stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages,
      });
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : "Failed to reach the assistant." };
      return;
    }

    let roundText = "";
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          roundText += event.delta.text;
          yield { type: "text_delta", text: event.delta.text };
        } else if (event.type === "content_block_start") {
          // Server-hosted tools (currently just web_search) execute inside
          // Anthropic's own infrastructure — no round-trip through our
          // TOOL_HANDLERS needed, but we still surface them as activity so
          // the UI shows "Searching the web" like any other tool call.
          const block = event.content_block;
          if (block.type === "server_tool_use" && block.name === "web_search") {
            yield { type: "tool_call_start", name: "web_search", input: {} };
          } else if (block.type === "web_search_tool_result") {
            const content = block.content;
            const result = Array.isArray(content)
              ? { result_count: content.length, titles: content.slice(0, 5).map((r) => r.title) }
              : { error: content.error_code };
            yield { type: "tool_call_end", name: "web_search", result };
          }
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        yield { type: "error", message: `Assistant error (${err.status}): ${err.message}` };
      } else {
        yield { type: "error", message: "Lost connection to the assistant mid-response." };
      }
      return;
    }

    finalText += roundText;

    let finalMessage: Anthropic.Message;
    try {
      finalMessage = await stream.finalMessage();
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : "Failed to complete the response." };
      return;
    }

    messages.push({ role: "assistant", content: finalMessage.content });

    if (finalMessage.stop_reason !== "tool_use") {
      yield { type: "done", finalText };
      return;
    }

    const toolUseBlocks = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const input = (block.input ?? {}) as Record<string, unknown>;
      yield { type: "tool_call_start", name: block.name, input };

      const handler = TOOL_HANDLERS[block.name];
      let result: unknown;
      if (!handler) {
        result = { error: `Unknown tool: ${block.name}` };
      } else {
        try {
          result = await handler(ctx, input);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Tool execution failed" };
        }
      }

      yield { type: "tool_call_end", name: block.name, result };
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
    // Loop continues — Claude gets the tool results and responds again.
  }

  yield {
    type: "error",
    message: "This is taking more steps than expected — try rephrasing or breaking your request into smaller parts.",
  };
}
