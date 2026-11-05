import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const giftSchema = z
  .object({
    sender: text(120).min(1, "Your name is required."),
    recipient: text(120).min(1, "Recipient name is required."),
    email: z.email("Enter a valid recipient email.").max(254),
    event: text(200).min(1, "Event name is required."),
    venue: text(200),
    event_at: z.iso.datetime({ offset: true }),
    deadline: z.iso.datetime({ offset: true }),
    timezone: text(80).refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone."),
    quantity: z.coerce.number().int().min(1).max(100),
    seats: text(300),
    message: text(3000),
  })
  .refine((value) => Date.parse(value.deadline) <= Date.parse(value.event_at), {
    message: "The delivery deadline must be before the event starts.",
    path: ["deadline"],
  })
  .refine((value) => Date.parse(value.event_at) > Date.now(), {
    message: "Choose an upcoming event.",
    path: ["event_at"],
  });

export function date(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
export function promiseFor(gift: z.infer<typeof giftSchema>) {
  return `I, ${gift.sender}, promise to deliver ${gift.quantity} ticket${gift.quantity === 1 ? "" : "s"} for ${gift.event} to ${gift.recipient} by ${date(gift.deadline, gift.timezone)} (${gift.timezone}). Ticket delivery is currently pending. I will provide the ticket files or the original provider’s transfer link here when available and notify the recipient by email. This promise records my delivery commitment; it does not confirm that tickets have already been transferred or change any marketplace deadline or ticket-provider requirements.`;
}
