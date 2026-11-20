/**
 * Mock ticket store, held in server memory.
 *
 * This is deliberately simple: a real version would talk to ServiceNow, Jira,
 * or a database. Data resets whenever the server restarts or Vercel redeploys,
 * and separate serverless instances do not share it.
 */

export type Category = "network" | "hardware" | "software" | "access" | "other";
export type Priority = "low" | "medium" | "high";

export type Ticket = {
  id: string; // e.g. "IT-1042"
  status: "Open";
  category: Category;
  priority: Priority;
  summary: string;
  details: string;
  createdAt: string; // ISO timestamp
};

// Keep the store on globalThis so Next.js hot reloads in dev don't wipe it.
const globalStore = globalThis as unknown as {
  __tickets?: Ticket[];
  __nextTicketNumber?: number;
};
globalStore.__tickets ??= [];
globalStore.__nextTicketNumber ??= 1042;

export function createTicket(
  input: Omit<Ticket, "id" | "status" | "createdAt">,
): Ticket {
  const ticket: Ticket = {
    ...input,
    id: `IT-${globalStore.__nextTicketNumber!++}`,
    status: "Open",
    createdAt: new Date().toISOString(),
  };
  globalStore.__tickets!.push(ticket);
  return ticket;
}

export function listTickets(): Ticket[] {
  return [...globalStore.__tickets!];
}
