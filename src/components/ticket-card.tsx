import type { HelpdeskUIMessage } from "@/lib/agent";

type CreateTicketPart = Extract<
  HelpdeskUIMessage["parts"][number],
  { type: "tool-create_ticket" }
>;

const priorityStyles = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
} as const;

/**
 * Renders one create_ticket call through its lifecycle:
 * proposed (Approve / Reject) → created (ticket ID) or rejected.
 */
export function TicketCard({
  part,
  onRespond,
}: {
  part: CreateTicketPart;
  onRespond: (approved: boolean) => void;
}) {
  // While the model is still streaming the arguments, they may be incomplete.
  if (part.state === "input-streaming") {
    return <Shell tone="neutral" title="Drafting ticket…" />;
  }

  // The arguments failed the Zod schema (or the tool threw): nothing was created.
  if (part.state === "output-error") {
    return (
      <Shell tone="error" title="Invalid ticket proposal">
        <p className="text-red-700">{part.errorText}</p>
      </Shell>
    );
  }

  const input = part.input;

  return (
    <Shell
      tone={
        part.state === "output-available"
          ? "success"
          : part.state === "output-denied"
            ? "muted"
            : "pending"
      }
      title={
        part.state === "output-available"
          ? `Ticket created: ${part.output.ticketId}`
          : part.state === "output-denied"
            ? "Ticket rejected: nothing was created"
            : "Proposed ticket"
      }
    >
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-zinc-500">Summary</dt>
        <dd className="font-medium">{input.summary}</dd>
        <dt className="text-zinc-500">Category</dt>
        <dd className="capitalize">{input.category}</dd>
        <dt className="text-zinc-500">Priority</dt>
        <dd>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${priorityStyles[input.priority]}`}
          >
            {input.priority}
          </span>
        </dd>
        <dt className="text-zinc-500">Details</dt>
        <dd className="whitespace-pre-wrap text-zinc-700">{input.details}</dd>
        {part.state === "output-available" && (
          <>
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium text-emerald-700">{part.output.status}</dd>
          </>
        )}
      </dl>

      {/* Waiting on the human: the server has paused and the tool has NOT run. */}
      {part.state === "approval-requested" && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onRespond(true)}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Approve
          </button>
          <button
            onClick={() => onRespond(false)}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-50"
          >
            Reject
          </button>
        </div>
      )}

      {part.state === "approval-responded" && (
        <p className="mt-3 text-xs text-zinc-500">
          {part.approval.approved ? "Approved. Creating ticket…" : "Rejected."}
        </p>
      )}
    </Shell>
  );
}

const tones = {
  neutral: "border-zinc-200 bg-zinc-50",
  pending: "border-amber-300 bg-amber-50/60",
  success: "border-emerald-300 bg-emerald-50/60",
  muted: "border-zinc-200 bg-zinc-50 opacity-70",
  error: "border-red-300 bg-red-50",
} as const;

function Shell({
  tone,
  title,
  children,
}: {
  tone: keyof typeof tones;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {title}
      </p>
      {children}
    </div>
  );
}
