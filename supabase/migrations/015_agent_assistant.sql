-- Agentic AI assistant: persisted conversations + tool-call history, and a
-- structured, section-by-section grant-application draft store distinct from
-- draft_generations (013's draft_generations is a single JSON blob of quick
-- "draft assistance" starter fields — talking points, not real narrative
-- sections; it's kept as-is for that existing quick-start feature).
-- grant_drafts is the new multi-section, individually-revisable draft a user
-- actually builds toward a submission with the assistant.

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Optional: a conversation can be scoped to one grant application, so the
  -- assistant page can list "conversations about this pipeline item" and a
  -- pipeline item can deep-link straight into a focused chat.
  pipeline_item_id UUID REFERENCES public.pipeline_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_org ON public.chat_conversations(org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_pipeline_item ON public.chat_conversations(pipeline_item_id);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_conversations_org_access ON public.chat_conversations FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  -- Plain text for simple messages. Tool activity that happened while
  -- producing an assistant message is recorded in tool_calls for UI replay
  -- (so reopening a conversation still shows "Searched opportunities" etc.)
  -- rather than being replayed against Claude again.
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_org_access ON public.chat_messages FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);

-- One row per section per pipeline item. Upserted on (pipeline_item_id,
-- section_key) so "revise the budget narrative" updates in place and keeps
-- a clean single current version per section (no version history in v1).
CREATE TABLE IF NOT EXISTS public.grant_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_item_id UUID NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL CHECK (section_key IN (
    'executive_summary',
    'statement_of_need',
    'project_description',
    'organizational_capacity',
    'budget_narrative',
    'evaluation_plan'
  )),
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_item_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_grant_drafts_pipeline_item ON public.grant_drafts(pipeline_item_id);

ALTER TABLE public.grant_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY grant_drafts_org_access ON public.grant_drafts FOR ALL USING (
  org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  OR org_id IN (SELECT id FROM public.organizations WHERE created_by = auth.uid())
);
