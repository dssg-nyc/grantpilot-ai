import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { runAgent, type AgentEvent } from "@/lib/anthropic/agent/run-agent";
import { buildAgentSystemPrompt } from "@/lib/anthropic/agent/system-prompt";
import type { ToolContext } from "@/lib/anthropic/agent/tool-handlers";
import type { OrgProfile } from "@/types/profile";
import type Anthropic from "@anthropic-ai/sdk";

function sseLine(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const limited = await rateLimitGuard(request, "assistant-chat", strictRateLimiter);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { data: userRow } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = userRow?.org_id ?? null;
  if (!orgId) return new Response(JSON.stringify({ error: "Complete your organization profile first." }), { status: 400 });

  let body: { conversation_id?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const conversationId = body.conversation_id;
  const messageText = body.message?.trim();
  if (!conversationId || !messageText) {
    return new Response(JSON.stringify({ error: "conversation_id and message are required" }), { status: 400 });
  }
  if (messageText.length > 4000) {
    return new Response(JSON.stringify({ error: "Message is too long (max 4000 characters)." }), { status: 400 });
  }

  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (convError) return new Response(JSON.stringify({ error: convError.message }), { status: 500 });
  if (!conversation) return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*, plan")
    .eq("id", orgId)
    .single();
  if (orgError || !org) return new Response(JSON.stringify({ error: "Organization not found" }), { status: 404 });

  const { data: priorMessages, error: historyError } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (historyError) return new Response(JSON.stringify({ error: historyError.message }), { status: 500 });

  const { error: insertUserMsgError } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    org_id: orgId,
    role: "user",
    content: messageText,
  });
  if (insertUserMsgError) return new Response(JSON.stringify({ error: insertUserMsgError.message }), { status: 500 });

  // Auto-title a fresh conversation from its first message.
  if (conversation.title === "New conversation") {
    const title = messageText.length > 60 ? messageText.slice(0, 57) + "…" : messageText;
    await supabase.from("chat_conversations").update({ title }).eq("id", conversationId);
  }

  const history: Anthropic.MessageParam[] = (priorMessages ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: messageText });

  const systemPrompt = buildAgentSystemPrompt(org as OrgProfile);
  const ctx: ToolContext = { supabase, orgId, orgPlan: (org as { plan?: string | null }).plan ?? null };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const toolCallLog: Array<{ name: string; input: unknown; result: unknown }> = [];
      let finalText = "";
      const pendingCalls = new Map<string, unknown>();

      try {
        for await (const event of runAgent(systemPrompt, history, ctx)) {
          controller.enqueue(encoder.encode(sseLine(event)));

          if (event.type === "tool_call_start") {
            pendingCalls.set(event.name, event.input);
          } else if (event.type === "tool_call_end") {
            toolCallLog.push({ name: event.name, input: pendingCalls.get(event.name) ?? null, result: event.result });
          } else if (event.type === "done") {
            finalText = event.finalText;
          }
        }
      } catch {
        controller.enqueue(encoder.encode(sseLine({ type: "error", message: "The assistant stream was interrupted." })));
      }

      if (finalText.trim()) {
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          org_id: orgId,
          role: "assistant",
          content: finalText,
          tool_calls: toolCallLog.length ? toolCallLog : null,
        });
        await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
