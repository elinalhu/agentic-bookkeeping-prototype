// POST /api/chat — streaming conversational follow-up to the agent's
// initial hypothesis. The owner (or CPA) can ask things like "how
// should I split this?", "what about gross margin?", "tell me more
// about the IRS rule for officer loans" — and the agent responds in
// plain prose, with full context of the transaction and its own
// prior reasoning.

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { findTransaction, getCompany } from "@/lib/fixtures";
import { buildAgentContext } from "@/lib/agent/buildContext";
import type { AgentHypothesis } from "@/lib/types";

const MODEL = "claude-sonnet-4-6";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  companyId: string;
  transactionId: string;
  hypothesis: AgentHypothesis;
  messages: ChatMessage[];
}

const CHAT_SYSTEM_PROMPT = `You are Pilot's bookkeeping agent, continuing a conversation with the small business owner (and possibly their CPA) about a specific transaction you previously analyzed.

GROUND RULES
- You already proposed a categorization with full reasoning. The user has that context. Don't re-explain unless asked.
- Be concise — 2-4 sentences typically. Prose, not bullet points, unless the user asks for a list.
- Plain language for the owner, but if the question touches on tax treatment or accounting nuance, name it precisely so the CPA reading later isn't confused.
- If the user provides new information that should change the categorization (e.g. "this AWS bill is mostly production"), explicitly say so and recommend the updated account by name. Don't be wishy-washy — if the answer changes, change it.
- When the right answer is "let's split this," propose the split with a sensible default ratio and explain how the user can override it.
- If you don't know, say you don't know. Don't invent IRS rules or invoice details.
- Never produce JSON or call any tool here — this is plain conversational prose.`;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyId, transactionId, hypothesis, messages } = body;
  if (!companyId || !transactionId || !hypothesis || !messages?.length) {
    return Response.json(
      {
        error:
          "companyId, transactionId, hypothesis, and messages are required",
      },
      { status: 400 },
    );
  }

  const company = getCompany(companyId);
  const found = findTransaction(company.id, transactionId);
  if (!found) {
    return Response.json({ error: "Transaction not found" }, { status: 404 });
  }

  const context = buildAgentContext(company, found.transaction, []);

  // Seed the conversation with the original analysis so the agent has
  // continuity. We use a synthetic assistant turn that summarizes the
  // hypothesis, then replay the user's messages.
  const seedAssistant = [
    `My initial take: ${hypothesis.accountId} at ${hypothesis.confidence} confidence (score ${hypothesis.confidenceScore.toFixed(2)}).`,
    "",
    "Reasoning:",
    ...hypothesis.reasoning.map((r) => `- ${r}`),
  ].join("\n");

  const seedUser = `Here is the full context for the transaction we're discussing — business profile, chart of accounts, the specific transaction, prior similar transactions, and any active rules:\n\n${JSON.stringify(context, null, 2)}\n\nWith that context, you proposed a categorization. I want to ask some follow-up questions.`;

  const apiMessages = [
    { role: "user" as const, content: seedUser },
    { role: "assistant" as const, content: seedAssistant },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const client = new Anthropic();

  let stream;
  try {
    stream = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: CHAT_SYSTEM_PROMPT,
      messages: apiMessages,
      stream: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown LLM error";
    return Response.json(
      { error: `LLM call failed: ${message}` },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
