import { neon } from "@neondatabase/serverless";

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return neon(process.env.DATABASE_URL);
}

export type TicketFile = {
  pathname: string;
  name: string;
  type: string;
  size: number;
};
export type Gift = {
  id: string;
  token: string;
  sender: string;
  recipient: string;
  email: string;
  event: string;
  venue: string;
  event_at: string;
  deadline: string;
  timezone: string;
  quantity: number;
  seats: string;
  message: string;
  promise: string;
  created_at: string;
  acknowledged_at: string | null;
  revoked: boolean;
  delivery_id: string | null;
  files: TicketFile[];
  transfer_url: string | null;
};

export async function findGift(token: string): Promise<Gift | undefined> {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const rows =
    await db()`SELECT * FROM gifts WHERE token = ${token} AND revoked = false`;
  return rows[0] as Gift | undefined;
}

export function publicGift(gift: Gift) {
  const { email, id, files, ...rest } = gift;
  void email;
  void id;
  return {
    ...rest,
    files: files.map(({ name, type, size }, index) => ({
      name,
      type,
      size,
      index,
    })),
  };
}
