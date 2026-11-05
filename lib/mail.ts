import nodemailer from "nodemailer";
import { db } from "./db";
import { decrypt } from "./security";

export function transport(email: string, password: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: email, pass: password },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
}
export async function deliverNotifications(giftId?: string) {
  const sql = db();
  const settings = await sql`SELECT * FROM mail_settings WHERE id = 1`;
  if (!settings[0])
    return {
      sent: 0,
      pending: true,
      message: "Connect Gmail to send queued notifications.",
    };
  const claimed =
    await sql`UPDATE notifications SET lease_until = now() + interval '5 minutes', attempts = attempts + 1
    WHERE id IN (SELECT n.id FROM notifications n JOIN gifts g ON g.id = n.gift_id
      WHERE n.sent_at IS NULL AND g.revoked = false AND (n.lease_until IS NULL OR n.lease_until < now())
      AND (${giftId || null}::uuid IS NULL OR n.gift_id = ${giftId || null}::uuid)
      ORDER BY n.created_at LIMIT 10 FOR UPDATE OF n SKIP LOCKED) RETURNING *`;
  let sent = 0;
  const sender = settings[0].email as string;
  const mail = transport(sender, decrypt(settings[0].password_encrypted));
  for (const item of claimed) {
    try {
      await mail.sendMail({
        from: { name: "Giftbox", address: sender },
        to: item.recipient,
        subject: item.subject,
        text: item.body,
        messageId: `<giftbox-${item.id}@${sender.split("@")[1]}>`,
      });
      await sql`UPDATE notifications SET sent_at = now(), last_error = null, lease_until = null WHERE id = ${item.id}`;
      sent++;
    } catch {
      await sql`UPDATE notifications SET last_error = 'Gmail could not send the email. Check your connection and retry.', lease_until = now() + interval '5 minutes' WHERE id = ${item.id}`;
    }
  }
  const pending =
    await sql`SELECT count(*)::integer AS count FROM notifications n JOIN gifts g ON g.id = n.gift_id
    WHERE n.sent_at IS NULL AND g.revoked = false AND (${giftId || null}::uuid IS NULL OR n.gift_id = ${giftId || null}::uuid)`;
  return { sent, pending: pending[0].count > 0 };
}
