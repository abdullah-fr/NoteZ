---
name: AI Chat
description: Streaming chat with Tutor/Researcher/Summarizer modes, conversation history, optional source grounding from Sources library
type: feature
---
Tables: chat_conversations (title, mode, source_id), chat_messages (role, content). RLS scoped to auth.uid().
Edge function: supabase/functions/ai-chat — verifies JWT, persists user msg, streams from Lovable AI Gateway (google/gemini-2.5-flash) via SSE, persists assistant msg on completion. Handles 429/402 explicitly.
UI: src/components/dashboard/ChatView.tsx — left history sidebar (lg+), mode pills, source attach Select pulling ready sources, react-markdown + remark-gfm rendering, streaming cursor, Enter to send.
Mode prompts live in the edge function MODE_PROMPTS map.