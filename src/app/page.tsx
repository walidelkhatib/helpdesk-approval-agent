"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useEffect, useRef, useState } from "react";
import type { HelpdeskUIMessage } from "@/lib/agent";
import { TicketCard } from "@/components/ticket-card";

const examples = [
  "My VPN won't connect since this morning. Open a high-priority ticket.",
  "I need access to the finance shared drive.",
  "What tickets do I have open?",
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * useChat holds the conversation and streams responses from /api/chat.
   *
   * sendAutomaticallyWhen: after the user clicks Approve or Reject, the
   * approval response is added to the last message. Once every pending
   * approval has a response, useChat sends the conversation back to the
   * server automatically, so the agent can run (or skip) the tool.
   */
  const { messages, sendMessage, addToolApprovalResponse, status, error } =
    useChat<HelpdeskUIMessage>({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4">
      <header className="border-b border-zinc-200 py-4">
        <h1 className="text-lg font-semibold">IT Help Desk</h1>
        <p className="text-sm text-zinc-500">
          Describe the problem. The agent proposes a ticket, and nothing is
          created until you approve it.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-500">Try one of these:</p>
            {examples.map((example) => (
              <button
                key={example}
                onClick={() => send(example)}
                className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : ""}
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white"
                  : "w-full space-y-3 text-sm"
              }
            >
              {message.parts.map((part, i) => {
                const key = `${message.id}-${i}`;
                switch (part.type) {
                  case "text":
                    return (
                      <p key={key} className="whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    );

                  // Tool parts are typed as "tool-<toolName>".
                  case "tool-create_ticket":
                    return (
                      <TicketCard
                        key={key}
                        part={part}
                        onRespond={(approved) =>
                          addToolApprovalResponse({
                            id: part.approval!.id,
                            approved,
                            reason: approved
                              ? undefined
                              : "The user rejected this ticket.",
                          })
                        }
                      />
                    );

                  case "tool-list_tickets":
                    return (
                      <p key={key} className="text-xs text-zinc-400">
                        {part.state === "output-available"
                          ? `Checked the ticket store (${part.output.tickets.length} found)`
                          : "Checking the ticket store…"}
                      </p>
                    );

                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <p className="text-sm text-zinc-400">Thinking…</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-zinc-200 py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. My laptop won't charge"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          autoFocus
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
