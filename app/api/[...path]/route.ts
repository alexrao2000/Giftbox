import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "node:crypto";
import { put, get, del } from "@vercel/blob";
import { z } from "zod";
import { db, findGift, publicGift, type TicketFile } from "@/lib/db";
import { api, HttpError, owner, privateHeaders, sameOrigin } from "@/lib/http";
import {
  encrypt,
  equals,
  fileType,
  hash,
  sessionToken,
  validSession,
} from "@/lib/security";
import { giftSchema, promiseFor } from "@/lib/validation";
import { deliverNotifications, transport } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ path: string[] }> };
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: privateHeaders });
const idSchema = z.uuid();

export async function GET(request: Request, context: Context) {
  return api(async () => {
    const { path } = await context.params;
    if (path[0] === "session")
      return json({
        authenticated: validSession(
          (await cookies()).get("giftbox_owner")?.value,
        ),
      });
    if (path[0] === "gift" && path.length === 2) {
      const gift = await findGift(path[1]);
      if (!gift)
        throw new HttpError(
          404,
          "This gift link is unavailable. Please contact the sender.",
        );
      return json(publicGift(gift));
    }
    if (path[0] === "download" && path.length === 3) {
      const gift = await findGift(path[1]);
      const index = Number(path[2]);
      if (
        !gift?.delivery_id ||
        !/^\d+$/.test(path[2]) ||
        !Number.isSafeInteger(index) ||
        !gift.files[index]
      )
        throw new HttpError(404, "Ticket file unavailable.");
      const file = gift.files[index];
      const result = await get(file.pathname, {
        access: "private",
        useCache: false,
      });
      if (!result || result.statusCode !== 200)
        throw new HttpError(404, "Ticket file unavailable.");
      return new Response(result.stream, {
        headers: {
          ...privateHeaders,
          "Content-Type": file.type,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        },
      });
    }
    if (path[0] === "cron" && path.length === 1) {
      if (
        !process.env.CRON_SECRET ||
        !equals(
          request.headers.get("authorization") || "",
          `Bearer ${process.env.CRON_SECRET}`,
        )
      )
        throw new HttpError(401, "Unauthorized.");
      await db()`DELETE FROM login_attempts WHERE expires_at < now()`;
      return json(await deliverNotifications());
    }
    await owner();
    if (path[0] === "gifts" && path.length === 1) {
      const gifts =
        await db()`SELECT g.*, (SELECT count(*)::integer FROM notifications n WHERE n.gift_id = g.id AND n.sent_at IS NULL) AS pending_emails,
        (SELECT last_error FROM notifications n WHERE n.gift_id = g.id ORDER BY n.created_at DESC LIMIT 1) AS email_error FROM gifts g ORDER BY g.created_at DESC LIMIT 500`;
      return json(gifts);
    }
    if (path[0] === "settings" && path.length === 1) {
      const rows = await db()`SELECT email FROM mail_settings WHERE id = 1`;
      return json({
        configured: !!rows[0],
        email: rows[0]?.email || process.env.OWNER_EMAIL || "",
      });
    }
    throw new HttpError(404, "Page unavailable.");
  });
}

export async function POST(request: Request, context: Context) {
  return api(async () => {
    sameOrigin(request);
    const { path } = await context.params;
    const sql = db();
    if (path[0] === "session" && path.length === 1) {
      const { password } = z
        .object({ password: z.string().max(256) })
        .parse(await request.json());
      const key = hash(
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      );
      const rows =
        await sql`INSERT INTO login_attempts (key, count, expires_at) VALUES (${key}, 1, now() + interval '15 minutes')
        ON CONFLICT (key) DO UPDATE SET count = CASE WHEN login_attempts.expires_at < now() THEN 1 ELSE login_attempts.count + 1 END,
        expires_at = CASE WHEN login_attempts.expires_at < now() THEN now() + interval '15 minutes' ELSE login_attempts.expires_at END RETURNING count`;
      if (rows[0].count > 10)
        throw new HttpError(
          429,
          "Too many sign-in attempts. Please wait 15 minutes.",
        );
      if (
        !process.env.OWNER_PASSWORD ||
        !equals(password, process.env.OWNER_PASSWORD)
      )
        throw new HttpError(401, "That owner password is incorrect.");
      (await cookies()).set("giftbox_owner", sessionToken(), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 43200,
      });
      return json({ ok: true });
    }
    if (path[0] === "logout" && path.length === 1) {
      (await cookies()).delete("giftbox_owner");
      return json({ ok: true });
    }
    if (path[0] === "gift" && path.length === 3 && path[2] === "acknowledge") {
      const gift = await findGift(path[1]);
      if (!gift) throw new HttpError(404, "This gift link is unavailable.");
      await sql`UPDATE gifts SET acknowledged_at = COALESCE(acknowledged_at, now()) WHERE id = ${gift.id}`;
      return json({ ok: true });
    }
    await owner();
    if (path[0] === "gifts" && path.length === 1) {
      const gift = giftSchema.parse(await request.json());
      const id = randomUUID(),
        token = randomBytes(32).toString("hex");
      await sql`INSERT INTO gifts (id,token,sender,recipient,email,event,venue,event_at,deadline,timezone,quantity,seats,message,promise)
        VALUES (${id},${token},${gift.sender},${gift.recipient},${gift.email},${gift.event},${gift.venue},${gift.event_at},${gift.deadline},${gift.timezone},${gift.quantity},${gift.seats},${gift.message},${promiseFor(gift)})`;
      return json({ id, token }, 201);
    }
    if (path[0] === "settings" && path.length === 1) {
      const value = z
        .object({
          email: z.email().regex(/@gmail\.com$/i, "Use your Gmail address."),
          password: z
            .string()
            .transform((v) => v.replace(/\s/g, ""))
            .pipe(
              z
                .string()
                .regex(
                  /^[a-zA-Z]{16}$/,
                  "Enter the 16-letter Gmail app password.",
                ),
            ),
        })
        .parse(await request.json());
      try {
        await transport(value.email, value.password).verify();
      } catch {
        throw new HttpError(
          400,
          "Gmail could not sign in. Check the address and app password, then try again.",
        );
      }
      await sql`INSERT INTO mail_settings (id,email,password_encrypted) VALUES (1,${value.email},${encrypt(value.password)})
        ON CONFLICT(id) DO UPDATE SET email = EXCLUDED.email, password_encrypted = EXCLUDED.password_encrypted`;
      return json({ ok: true, ...(await deliverNotifications()) });
    }
    if (path[0] === "gifts" && path.length === 3 && path[2] === "retry")
      return json(await deliverNotifications(idSchema.parse(path[1])));
    if (path[0] === "gifts" && path.length === 3 && path[2] === "publish") {
      const id = idSchema.parse(path[1]);
      const rows =
        await sql`SELECT * FROM gifts WHERE id = ${id} AND revoked = false`;
      const gift = rows[0];
      if (!gift)
        throw new HttpError(
          404,
          "Gift unavailable. Restore its link before publishing tickets.",
        );
      const form = await request.formData();
      const files = form
        .getAll("files")
        .filter((f): f is File => f instanceof File && f.size > 0);
      const transferUrl = String(form.get("transfer_url") || "").trim();
      if (transferUrl) {
        const url = z.url().parse(transferUrl);
        if (
          new URL(url).protocol !== "https:" ||
          new URL(url).username ||
          new URL(url).password
        )
          throw new HttpError(
            400,
            "Use an HTTPS transfer link without a username or password.",
          );
      }
      if (!files.length && !transferUrl)
        throw new HttpError(
          400,
          "Choose ticket files or add the official transfer link.",
        );
      if (
        files.length > 10 ||
        files.reduce((sum, f) => sum + f.size, 0) > 3 * 1024 * 1024
      )
        throw new HttpError(400, "Upload up to 10 files totaling 3 MB.");
      const validated = await Promise.all(
        files.map(async (file) => {
          const bytes = Buffer.from(await file.arrayBuffer());
          const type = fileType(bytes);
          if (!type)
            throw new HttpError(400, "Ticket files must be PDF, PNG, or JPG.");
          return {
            bytes,
            type,
            name:
              file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180) ||
              "ticket",
          };
        }),
      );
      const uploaded: TicketFile[] = [];
      const deliveryId = randomUUID(),
        notificationId = randomUUID();
      try {
        for (const file of validated) {
          const result = await put(
            `tickets/${id}/${deliveryId}/${randomUUID()}`,
            file.bytes,
            { access: "private", contentType: file.type },
          );
          uploaded.push({
            pathname: result.pathname,
            name: file.name,
            type: file.type,
            size: file.bytes.length,
          });
        }
        const base = process.env.APP_URL;
        if (!base) throw new Error("APP_URL is required.");
        const body = `Hi ${gift.recipient},\n\n${gift.sender} has made your tickets for ${gift.event} available.\n\nOpen your private gift box to download the files or use the official transfer link:\n${base}/g/${gift.token}\n\nKeep this link private. If your ticket provider requires accepting a transfer, follow its instructions.\n\nGiftbox`;
        const results = await sql.transaction([
          sql`UPDATE gifts SET delivery_id = ${deliveryId}, files = ${JSON.stringify(uploaded)}::jsonb, transfer_url = ${transferUrl || null} WHERE id = ${id} AND revoked = false RETURNING id`,
          sql`INSERT INTO notifications (id,gift_id,delivery_id,recipient,subject,body)
            SELECT ${notificationId},id,${deliveryId},email,${`Your tickets for ${gift.event} are ready`},${body} FROM gifts WHERE id = ${id} AND revoked = false`,
        ]);
        if (!results[0].length)
          throw new HttpError(
            409,
            "The gift was revoked while uploading. Restore it before trying again.",
          );
      } catch (error) {
        await Promise.allSettled(uploaded.map((file) => del(file.pathname)));
        throw error;
      }
      let mail;
      try {
        mail = await deliverNotifications(id);
      } catch {
        mail = { sent: 0, pending: true };
      }
      return json({ ok: true, ...mail });
    }
    throw new HttpError(404, "Action unavailable.");
  });
}

export async function PATCH(request: Request, context: Context) {
  return api(async () => {
    sameOrigin(request);
    await owner();
    const { path } = await context.params;
    if (path[0] !== "gifts" || path.length !== 2)
      throw new HttpError(404, "Action unavailable.");
    const id = idSchema.parse(path[1]);
    const { revoked } = z
      .object({ revoked: z.boolean() })
      .parse(await request.json());
    await db()`UPDATE gifts SET revoked = ${revoked} WHERE id = ${id}`;
    return json({ ok: true });
  });
}
