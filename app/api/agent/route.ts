// POST /api/agent — given a companyId + transactionId, return the
// agent's structured hypothesis. Single Claude call, forced tool use
// for guaranteed-valid JSON. Prompt-cached on the system block since
// the system prompt is static across all calls.

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { accountById, findTransaction, getCompany } from "@/lib/fixtures";
import { buildAgentContext } from "@/lib/agent/buildContext";
import { SYSTEM_PROMPT } from "@/lib/agent/systemPrompt";
import {
  PROPOSE_CATEGORIZATION_TOOL,
  type RawHypothesis,
} from "@/lib/agent/schema";

const MODEL = "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  // Construct the client per-request so .env.local edits are picked up
  // without a dev-server restart.
  const client = new Anthropic();

  let body: {
    companyId?: string;
    transactionId?: string;
    narrativeOverride?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { companyId, transactionId, narrativeOverride } = body;
  if (!companyId || !transactionId) {
    return Response.json(
      { error: "companyId and transactionId are required" },
      { status: 400 },
    );
  }

  const company = getCompany(companyId);
  const found = findTransaction(company.id, transactionId);
  if (!found) {
    return Response.json(
      { error: `Transaction ${transactionId} not found in ${company.id}` },
      { status: 404 },
    );
  }

  // Rules are persisted client-side in this prototype, so the route
  // doesn't see them on every call. The client could pass them in;
  // for v1 we treat the rule list as empty server-side. The Inspect
  // drawer will reflect this.
  //
  // Apply the CPA-edited business narrative override if provided —
  // overrides the seed narrative without touching fixtures.
  const effectiveCompany =
    narrativeOverride && narrativeOverride.trim().length > 0
      ? {
          ...company,
          profile: { ...company.profile, narrative: narrativeOverride },
        }
      : company;
  const context = buildAgentContext(effectiveCompany, found.transaction, []);
  const userMessage = JSON.stringify(context, null, 2);

  const startedAt = Date.now();

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      // Cache the system prompt — it's identical across every agent
      // call this app makes, so each subsequent call only pays for
      // the user message + a tiny cache-hit token charge.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [PROPOSE_CATEGORIZATION_TOOL],
      tool_choice: { type: "tool", name: "propose_categorization" },
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown LLM error";
    return Response.json(
      { error: `LLM call failed: ${message}` },
      { status: 502 },
    );
  }

  const latencyMs = Date.now() - startedAt;

  const toolUseBlock = response.content.find(
    (b) => b.type === "tool_use" && b.name === "propose_categorization",
  );

  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    return Response.json(
      {
        error: "Model did not call propose_categorization",
        rawContent: response.content,
      },
      { status: 502 },
    );
  }

  const raw = toolUseBlock.input as RawHypothesis;

  // Defensive validation: the schema enum should already prevent this,
  // but if we ever change the COA without updating the schema we want
  // to fail loud rather than save garbage to the audit log.
  if (!accountById(raw.accountId)) {
    return Response.json(
      { error: `Model returned unknown accountId: ${raw.accountId}` },
      { status: 502 },
    );
  }
  if (raw.proposedRule && !accountById(raw.proposedRule.accountId)) {
    return Response.json(
      { error: `Model proposed rule with unknown accountId` },
      { status: 502 },
    );
  }

  return Response.json({
    hypothesis: raw,
    inspect: {
      systemPrompt: SYSTEM_PROMPT,
      contextSentToAgent: context,
      rawModelOutput: raw,
      model: response.model,
      latencyMs,
      tokenUsage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheCreationInput: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadInput: response.usage.cache_read_input_tokens ?? 0,
      },
    },
  });
}
