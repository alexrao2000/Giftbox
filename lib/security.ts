import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("A session secret of at least 32 characters is required.");
  return value;
}
export function equals(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function sessionToken(now = Date.now()) {
  const expires = String(now + 12 * 60 * 60 * 1000);
  return `${expires}.${createHmac("sha256", secret()).update(expires).digest("hex")}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (!token) return false;
  const [expires, signature, extra] = token.split(".");
  if (
    extra ||
    !/^\d{13}$/.test(expires) ||
    Number(expires) <= now ||
    Number(expires) > now + 12 * 60 * 60 * 1000
  )
    return false;
  return equals(
    signature || "",
    createHmac("sha256", secret()).update(expires).digest("hex"),
  );
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret()).digest(),
    iv,
  );
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret()).digest(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function fileType(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
}
