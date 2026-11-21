import {
  ToolLoopAgent,
  isStepCount,
  tool,
  type InferAgentUIMessage,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { createTicket, listTickets } from "./ticket-store";

/**
 * TOOLS ARE DEFINED HERE.
 *
 * Each tool has a Zod `inputSchema`. The AI SDK checks the model's proposed
 * arguments against it before anything runs. If the model proposes an
 * invalid category or an empty summary, the call fails validation, `execute`
 * never runs, and the error goes back to the model (and shows in the UI).
 */
export const createTicketInput = z.object({
  category: z.enum(["network", "hardware", "software", "access", "other"]),
  priority: z.enum(["low", "medium", "high"]),
  summary: z
    .string()
    .trim()
    .min(5, "Summary is too short")
    .max(120, "Summary must be 120 characters or fewer")
    .describe("One-line ticket title"),
  details: z
    .string()
    .trim()
    .min(1, "Details are required")
    .max(2000)
    .describe(
      "What the user reported, including when it started and what they tried",
    ),
});

const tools = {
  create_ticket: tool({
    description:
      "Create an IT help desk ticket. A human must approve the ticket before it is created.",
    inputSchema: createTicketInput,
    // This only runs after the user clicks Approve (see `toolApproval` below).
    execute: async (input) => {
      const ticket = createTicket(input);
      return { ticketId: ticket.id, status: ticket.status };
    },
  }),

  list_tickets: tool({
    description:
      "List all existing tickets with their IDs, status, priority and summary. Always use this to answer questions about existing tickets.",
    inputSchema: z.object({}),
    execute: async () => ({ tickets: listTickets() }),
  }),
};

const instructions = `You are a concise IT help desk agent.

- You can only do two things: create tickets (create_ticket) and list tickets (list_tickets). You cannot update, close, reopen or reassign tickets, so never offer to.
- If the user asks to update or close a ticket, say you can't do that here: the IT help desk will update or close it, and they can mention the ticket ID when IT follows up. Don't create a new ticket as a workaround.

- Turn the user's request into a ticket: choose a category (network, hardware, software, access, other), a priority (low, medium, high), a short summary, and details.
- If a key detail is missing, ask at most ONE clarifying question, then propose the ticket with your best judgement.
- To create a ticket, call create_ticket. The user will see an approval card, so don't ask "shall I create it?" in text first.
- Never claim a ticket was created unless create_ticket returned a ticketId. Quote that ID exactly.
- If the user rejects a proposed ticket, do not retry it. Ask briefly what they would like to change.
- For ANY question about existing tickets, call list_tickets. Never answer from conversation memory.
- One ticket per issue. Before proposing a ticket, check with list_tickets whether an open ticket already covers the same problem. If it does, don't propose another one: tell the user the existing ticket ID covers it and that IT will follow up there.
- Only call list_tickets when the user asks about tickets or you are checking for a duplicate. Don't mention existing tickets in replies where they aren't relevant.
- You may share general troubleshooting tips if the user asks. Say they are general suggestions that may not match their setup, and that the IT help desk will follow up on the ticket.
- Never suggest steps that weaken security or need admin rights: no disabling firewalls, antivirus or other security software, no sudo or administrator commands, no changing security settings. Leave those to IT.
- Keep replies short: one to three sentences.`;

/**
 * The agent. ToolLoopAgent runs the model, calls tools, feeds results back,
 * and repeats until the model gives a final answer (or the step limit is hit).
 *
 * The model is a parameter so tests can pass a mock model.
 */
export function createHelpdeskAgent(
  // AI Gateway model string ("provider/model"). Authenticated by
  // AI_GATEWAY_API_KEY locally, or automatically via OIDC on Vercel.
  // The default is on AI Gateway's free tier; set AI_MODEL to use another
  // model (e.g. "anthropic/claude-sonnet-5.5" with paid credits).
  model: LanguageModel = process.env.AI_MODEL ?? "openai/gpt-5-mini",
) {
  return new ToolLoopAgent({
    model,
    instructions,
    tools,
    stopWhen: isStepCount(5),

    /**
     * APPROVAL IS ENFORCED HERE, ON THE SERVER.
     *
     * 'user-approval' means: when the model calls create_ticket, do NOT run
     * `execute`. Instead, stream an approval request to the browser and stop.
     * The tool only runs on a later request that carries the user's approval.
     * list_tickets is read-only, so it runs without approval.
     */
    toolApproval: {
      create_ticket: "user-approval",
    },

    /**
     * The browser sends the whole chat history on each request, so a malicious
     * client could try to forge an "approved" response. With a secret set, the
     * server HMAC-signs every approval request it issues and rejects any
     * approval whose signature doesn't match, before the tool runs.
     */
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
  });
}

export const helpdeskAgent = createHelpdeskAgent();

/** Message type shared with the client, so tool parts are fully typed. */
export type HelpdeskUIMessage = InferAgentUIMessage<typeof helpdeskAgent>;
