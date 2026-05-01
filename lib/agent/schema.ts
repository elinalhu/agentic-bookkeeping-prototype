// JSON Schema for the agent's structured output, used as a Claude
// tool definition. We force tool use so the model is guaranteed to
// produce a valid Hypothesis object — no parsing free-form text.
//
// The accountId field is enumerated from the live chart of accounts
// so the model literally cannot pick an account that doesn't exist.

import type Anthropic from "@anthropic-ai/sdk";
import { chartOfAccounts } from "../fixtures";
import type { AgentHypothesis } from "../types";

const accountIds = chartOfAccounts.map((a) => a.id);

export const PROPOSE_CATEGORIZATION_TOOL: Anthropic.Messages.Tool = {
  name: "propose_categorization",
  description:
    "Propose how this bank transaction should be categorized. Always " +
    "call this tool to respond — do not respond with prose. Pick the " +
    "single best account, calibrate confidence honestly, cite specific " +
    "evidence in reasoning, and surface a focused question only when " +
    "the ambiguity is genuinely unresolvable from context.",
  input_schema: {
    type: "object",
    properties: {
      accountId: {
        type: "string",
        enum: accountIds,
        description: "The chart-of-accounts id you propose for this transaction.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "Calibrated confidence. HIGH: ≥2 prior similar categorizations agree AND merchant/amount unambiguous given business. MEDIUM: one supporting signal or a meaningful deviation from pattern. LOW: no relevant history or multiple accounts plausibly fit. In cold-start mode (context.isColdStart=true), cap at MEDIUM.",
      },
      confidenceScore: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Numerical 0..1 score consistent with the confidence level (high>0.8, medium 0.5-0.8, low<0.5).",
      },
      reasoning: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 5,
        description:
          "2-5 evidence bullets. Each must reference a SPECIFIC signal from the context object (e.g. a prior transaction, a business-profile field, a merchant heuristic). Plain language for the owner; precise enough that a CPA can audit the reasoning.",
      },
      alternatives: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            accountId: { type: "string", enum: accountIds },
            why: {
              type: "string",
              description:
                "1-2 sentences on why this alternative is plausible and why you didn't pick it.",
            },
          },
          required: ["accountId", "why"],
          additionalProperties: false,
        },
        description:
          "1-2 plausible alternatives the CPA reviewing this should see were considered. Required even at high confidence.",
      },
      clarifyingQuestion: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "A single focused question, plain language, that the owner can answer in seconds.",
          },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                label: {
                  type: "string",
                  description: "Short answer label shown as a button.",
                },
                suggestedAccountId: {
                  type: "string",
                  enum: accountIds,
                },
                nextAction: {
                  type: "string",
                  enum: ["confirm", "split", "ask_followup", "flag"],
                  description:
                    "What happens if the user picks this option. 'confirm' = book to that account. 'split' = open a split UI. 'ask_followup' = the agent will ask one more thing. 'flag' = owner is unsure, route to the bookkeeping team for review.",
                },
              },
              required: ["label", "suggestedAccountId", "nextAction"],
              additionalProperties: false,
            },
          },
        },
        required: ["text", "options"],
        additionalProperties: false,
        description:
          "OMIT this field unless the ambiguity is genuinely unresolvable from context. Do not ask vague questions just to seem cautious.",
      },
      proposedRule: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            enum: [
              "this_transaction",
              "this_merchant",
              "merchant_amount_band",
            ],
            description:
              "Default to the NARROWEST scope that's actually useful. Broader scopes risk overfitting on a single decision.",
          },
          criteria: {
            type: "string",
            description:
              "Human-readable description of when the rule fires (e.g. 'All ADP transactions ≥ $30,000').",
          },
          accountId: { type: "string", enum: accountIds },
        },
        required: ["scope", "criteria", "accountId"],
        additionalProperties: false,
        description:
          "OPTIONAL. Only propose a rule when (a) confidence is high or the user has just confirmed, AND (b) the pattern is likely to recur. For one-off transactions or low-confidence calls, omit.",
      },
    },
    required: [
      "accountId",
      "confidence",
      "confidenceScore",
      "reasoning",
      "alternatives",
    ],
    additionalProperties: false,
  },
};

// Type-narrow what we get back from Claude. Keep loose here and let
// the route do strict validation.
export type RawHypothesis = Pick<
  AgentHypothesis,
  "accountId" | "confidence" | "confidenceScore" | "reasoning"
> & {
  alternatives: AgentHypothesis["alternatives"];
  clarifyingQuestion?: AgentHypothesis["clarifyingQuestion"];
  proposedRule?: AgentHypothesis["proposedRule"];
};
