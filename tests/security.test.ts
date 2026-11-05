import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decrypt,
  encrypt,
  equals,
  fileType,
  sessionToken,
  validSession,
} from "../lib/security";
import { giftSchema, promiseFor } from "../lib/validation";
import { publicGift, type Gift } from "../lib/db";

process.env.SESSION_SECRET = "test-only-session-secret-never-use-in-production";

test("owner sessions expire and reject tampered signatures and timestamps", () => {
  const now = 1793836800000;
  const token = sessionToken(now);
  assert.ok(validSession(token, now));
  assert.equal(validSession(token, now + 43200000), false);
  assert.equal(
    validSession(
      token.replace(/.$/, (c) => (c === "f" ? "a" : "f")),
      now,
    ),
    false,
  );
  assert.equal(
    validSession(`9999999999999.${token.split(".")[1]}`, now),
    false,
  );
  assert.equal(validSession(`${token}.extra`, now), false);
  assert.equal(validSession(undefined, now), false);
});

test("Gmail app passwords are authenticated encrypted with randomized nonces", () => {
  const clear = "test-only-mail-credential";
  const first = encrypt(clear),
    second = encrypt(clear);
  assert.notEqual(first, second);
  assert.ok(!first.includes(clear));
  assert.equal(decrypt(first), clear);
  const bytes = Buffer.from(first, "base64");
  bytes[15] ^= 1;
  assert.throws(() => decrypt(bytes.toString("base64")));
  const old = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET =
    "a-different-test-session-secret-for-key-rotation";
  assert.throws(() => decrypt(first));
  process.env.SESSION_SECRET = old;
});

test("secret comparisons handle arbitrary lengths", () => {
  assert.equal(equals("a", "a"), true);
  assert.equal(equals("a", "longer input"), false);
  assert.equal(equals("", "a"), false);
});

test("upload signatures allow ticket formats and reject HTML disguised as a ticket", () => {
  assert.equal(fileType(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(
    fileType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(fileType(Buffer.from([255, 216, 255, 224])), "image/jpeg");
  assert.equal(fileType(Buffer.from("<html>ticket.pdf</html>")), undefined);
  assert.equal(fileType(Buffer.alloc(0)), undefined);
});

const future = new Date(Date.now() + 864000000).toISOString();
const before = new Date(Date.now() + 432000000).toISOString();
const gift = {
  sender: "Taylor",
  recipient: "Sam",
  email: "recipient@example.com",
  event: "An evening out",
  venue: "The venue",
  event_at: future,
  deadline: before,
  timezone: "America/Los_Angeles",
  quantity: 2,
  seats: "",
  message: "See you there!",
};

test("gift validation rejects impossible delivery dates, bad emails and invalid time zones", () => {
  assert.ok(giftSchema.safeParse(gift).success);
  assert.equal(
    giftSchema.safeParse({
      ...gift,
      deadline: new Date(Date.parse(future) + 1).toISOString(),
    }).success,
    false,
  );
  assert.equal(
    giftSchema.safeParse({ ...gift, email: "not an email" }).success,
    false,
  );
  assert.equal(giftSchema.safeParse({ ...gift, quantity: 0 }).success, false);
  assert.equal(
    giftSchema.safeParse({ ...gift, timezone: "not/a-zone" }).success,
    false,
  );
});

test("promise states the named sender, recipient, deadline and pending transfer accurately", () => {
  const promise = promiseFor(gift);
  assert.ok(promise.includes("I, Taylor, promise to deliver 2 tickets"));
  assert.ok(promise.includes("to Sam by"));
  assert.ok(promise.includes("Ticket delivery is currently pending."));
  assert.ok(
    promise.includes(
      "does not confirm that tickets have already been transferred",
    ),
  );
});

test("recipient responses omit email, database identifiers and Blob paths", () => {
  const view = publicGift({
    ...gift,
    id: "private-id",
    token: "private-link-token",
    created_at: future,
    acknowledged_at: null,
    revoked: false,
    delivery_id: null,
    transfer_url: null,
    promise: "promise",
    files: [
      {
        pathname: "private-storage-path",
        name: "ticket.pdf",
        type: "application/pdf",
        size: 100,
      },
    ],
  } as Gift);
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes("recipient@example.com"));
  assert.ok(!serialized.includes("private-storage-path"));
  assert.ok(!serialized.includes("private-id"));
  assert.equal(view.files[0].index, 0);
});
