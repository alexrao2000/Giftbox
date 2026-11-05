import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { db } from "../lib/db";
import { del } from "@vercel/blob";

nextEnv.loadEnvConfig(process.cwd(), true);
const base = process.env.TEST_BASE_URL || "http://localhost:3080";
let cookie = "";
let giftId: string | undefined;
let token: string | undefined;
const paths: string[] = [];
let checks = 0;
const sql = db();
async function call(
  path: string,
  options: RequestInit = {},
  authorized = true,
) {
  const response = await fetch(`${base}/api/${path}`, {
    ...options,
    headers: {
      Origin: base,
      ...(authorized && cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
  return response;
}
function json(value: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
function check(value: unknown, message: string) {
  assert.ok(value, message);
  checks++;
  console.log(`✓ ${message}`);
}

try {
  check(
    (await call("gifts", {}, false)).status === 401,
    "Owner data rejects unauthenticated requests",
  );
  check(
    (await call("cron", {}, false)).status === 401,
    "Scheduled email retries require cron authorization",
  );
  const forged = await call("session", {
    ...json({ password: process.env.OWNER_PASSWORD }),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
  });
  check(forged.status === 403, "Cross-origin owner actions are rejected");
  const login = await call(
    "session",
    json({ password: process.env.OWNER_PASSWORD }),
  );
  check(login.ok, "Owner can sign in");
  cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  check(
    cookie.startsWith("giftbox_owner="),
    "Owner authentication sets a session cookie",
  );
  const settings = await (await call("settings")).json();
  assert.equal(
    settings.configured,
    false,
    "Integration fixtures must never send email: disconnect Gmail or use a dedicated test database.",
  );
  check(
    (await call("gift/" + "0".repeat(64))).status === 404,
    "Guessed gift tokens reveal no records",
  );
  const created = await call(
    "gifts",
    json({
      sender: "Integration Test",
      recipient: "Synthetic Recipient",
      email: "never-send@example.com",
      event: "Synthetic ticket delivery fixture",
      venue: "Test venue",
      event_at: new Date(Date.now() + 864000000).toISOString(),
      deadline: new Date(Date.now() + 432000000).toISOString(),
      timezone: "America/Los_Angeles",
      quantity: 1,
      seats: "Test seat",
      message: "<script>must stay text</script>",
    }),
  );
  check(created.status === 201, "Owner creates a real gift record");
  const createdData = await created.json();
  giftId = createdData.id;
  token = createdData.token;
  const giftResponse = await call(`gift/${token}`, {}, false);
  const view = await giftResponse.json();
  check(
    giftResponse.ok && !("email" in view) && !("id" in view),
    "Recipient sees the pending gift without private contact details",
  );
  check(
    giftResponse.headers.get("cache-control")?.includes("no-store"),
    "Recipient responses cannot be cached",
  );
  check(
    (await call(`download/${token}/0`, {}, false)).status === 404,
    "Pending gift has no downloadable ticket",
  );
  check(
    (await call(`gift/${token}/acknowledge`, { method: "POST" }, false)).ok,
    "Recipient can acknowledge the fixed delivery promise",
  );
  const malicious = new FormData();
  malicious.append(
    "files",
    new Blob(["<html>not a PDF</html>"], { type: "application/pdf" }),
    "ticket.pdf",
  );
  check(
    (await call(`gifts/${giftId}/publish`, { method: "POST", body: malicious }))
      .status === 400,
    "Upload rejects disguised active content",
  );
  const invalidLink = new FormData();
  invalidLink.append("transfer_url", "javascript:alert(1)");
  check(
    (
      await call(`gifts/${giftId}/publish`, {
        method: "POST",
        body: invalidLink,
      })
    ).status === 400,
    "Transfer links require HTTPS",
  );
  const pdf = Buffer.from("%PDF-1.4\nSynthetic integration fixture\n%%EOF");
  const upload = new FormData();
  upload.append(
    "files",
    new Blob([pdf], { type: "application/pdf" }),
    "synthetic-ticket.pdf",
  );
  check(
    (
      await call(
        `gifts/${giftId}/publish`,
        { method: "POST", body: upload },
        false,
      )
    ).status === 401,
    "Ticket uploads require owner authentication",
  );
  const published = await call(`gifts/${giftId}/publish`, {
    method: "POST",
    body: upload,
  });
  const result = await published.json();
  check(
    published.ok && result.pending && result.sent === 0,
    "Publishing stores a real ticket and leaves its email queued without Gmail",
  );
  const rows = await sql`SELECT files FROM gifts WHERE id = ${giftId}`;
  paths.push(...rows[0].files.map((f: { pathname: string }) => f.pathname));
  const file = await call(`download/${token}/0`, {}, false);
  check(
    file.ok && Buffer.from(await file.arrayBuffer()).equals(pdf),
    "Recipient downloads exact bytes from private Blob storage",
  );
  check(
    file.headers.get("content-disposition")?.includes("attachment"),
    "Files download as attachments",
  );
  const privateView = await (await call(`gift/${token}`, {}, false)).json();
  check(
    privateView.delivery_id &&
      privateView.files.length === 1 &&
      !JSON.stringify(privateView).includes("pathname"),
    "Published gift shows ready status without exposing Blob paths",
  );
  check(
    (
      await sql`SELECT * FROM notifications WHERE gift_id = ${giftId} AND sent_at IS NULL`
    ).length === 1,
    "Notification remains durable and unsent in the database",
  );
  const paused = await call(`gifts/${giftId}`, {
    ...json({ revoked: true }),
    method: "PATCH",
  });
  check(paused.ok, "Owner can pause the gift link");
  check(
    (await call(`gift/${token}`, {}, false)).status === 404 &&
      (await call(`download/${token}/0`, {}, false)).status === 404,
    "Pausing revokes both gift viewing and ticket downloads",
  );
  await call(`gifts/${giftId}`, {
    ...json({ revoked: false }),
    method: "PATCH",
  });
  check(
    (await call(`gift/${token}`, {}, false)).ok,
    "Restoring a link re-enables recipient access",
  );
  await call("logout", json({}));
  cookie = "";
  check(
    (await call("gifts")).status === 401,
    "Signing out removes owner access",
  );
  console.log(`${checks} integration checks passed. No email was sent.`);
} finally {
  if (giftId) {
    const rows = await sql`SELECT files FROM gifts WHERE id = ${giftId}`;
    for (const file of rows[0]?.files || [])
      if (!paths.includes(file.pathname)) paths.push(file.pathname);
    await sql`DELETE FROM notifications WHERE gift_id = ${giftId}`;
    await sql`DELETE FROM gifts WHERE id = ${giftId}`;
  }
  await Promise.all(paths.map((path) => del(path)));
  console.log("Removed synthetic gift records and ticket files.");
}
