# Talk to Adam — gated voice-interface architecture

Status: next-scope design only. No client or owner UI, microphone control, audio session, or voice action is exposed in the Adam Phase 1 release.

## Product boundary

Talk to Adam is a private owner interaction mode for **Adam — WOVO Media AI Operations Assistant**. It may explain operating signals, capture an owner request, draft an internal task, or prepare an approval packet. Speech never expands Adam's authority: sending, publishing, deploying, purchasing, billing changes, credential changes, or production-data mutations remain separately confirmed, server-authorized actions.

The assistant must identify itself as AI. It must not imitate Payton or any other person, and custom voices require documented rights and consent. Recording or transcript retention is opt-in, visible, and governed by the same owner-only retention controls as Adam memory.

## Proposed architecture

1. The authenticated owner requests a short-lived voice session from a server-only route.
2. The server re-runs the trusted owner-role check, feature flag, budget cap, rate limit, provider-health, and moderation gates. The long-lived OpenAI key never reaches the browser.
3. After those gates pass, the server creates an ephemeral Realtime session. The browser connects over WebRTC and shows microphone, listening, speaking, interruption, elapsed time, and cost/allowance state.
4. Conversation events are normalized into tenant-scoped Adam turns. Audio is not retained by default. Any retained transcript is visibly marked, editable, archivable, and linked to a correlation ID.
5. Voice-originated tool requests produce a preview card with inputs, cost, risk, and required confirmation. High-impact tools cannot execute from the audio stream; they enter the existing Adam approval queue.
6. A server-authoritative usage ledger reserves and settles audio/text units idempotently. Hard caps end the session before overrun.

OpenAI's current Realtime models support low-latency text/audio over WebRTC, WebSocket, or SIP and support function calling. WOVO should prefer WebRTC for the browser experience; SIP/telephony remains outside scope until separate identity, consent, recording, jurisdiction, routing, and emergency safeguards exist. Official references: https://developers.openai.com/api/docs/models/gpt-realtime and https://developers.openai.com/api/docs/models/gpt-realtime-mini.

## Required data and controls

- `wovo_adam_voice_sessions`: owner/workspace, correlation ID, provider session reference hash, state, timestamps, allowance reservation, settled usage, consent choice, and terminal error code.
- `wovo_adam_voice_turns`: ordered text transcript only when retention is enabled; speaker, source, moderation state, created time, and archive state.
- `wovo_adam_voice_action_proposals`: normalized tool name, redacted input summary, risk, estimated cost, confirmation state, related Adam approval ID, and execution evidence if a separate approved workflow later completes it.
- All tables use owner-only RLS/direct-browser denial. Provider secrets and raw ephemeral credentials never enter memory, audit summaries, transcripts, or client-visible logs.
- Append-only audit events cover session start/end, consent changes, proposal creation, confirmation, denial, quota stop, and provider failure without storing raw audio.

## Release gates

Talk to Adam remains hidden unless all of the following pass:

- server-side feature flag and trusted owner entitlement;
- verified Realtime provider connectivity using a short-lived browser credential;
- explicit microphone permission and clear recording/transcript disclosure;
- moderation and prompt-injection defenses for transcript and retrieved business context;
- tenant-bound tool registry with read-only tools first;
- confirmation tests proving speech cannot bypass approval, billing, publishing, or deployment rules;
- idempotent metering, hard daily/monthly spend caps, concurrency cap, and disconnect cleanup;
- desktop and phone tests for permission denial, mute/interruption, reconnect, network loss, accessibility, and transcript deletion/archive;
- documented retention period and an owner-visible kill switch.

## Prioritized delivery sequence

1. Read-only voice briefing using KPI/task/report data, no tools.
2. Dictated internal task and memory draft, always previewed before save.
3. Approval-packet preparation, never approval execution by voice alone.
4. Additional low-risk tools only after individual policy and end-to-end tests.

No telephony, external calling, autonomous outreach, voice cloning, or hands-free consequential action belongs in these phases.
