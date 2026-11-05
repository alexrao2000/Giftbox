import nextEnv from "@next/env";
import { db } from "../lib/db";

nextEnv.loadEnvConfig(process.cwd(), true);
const sql = db();
await sql`CREATE TABLE IF NOT EXISTS gifts (
  id uuid PRIMARY KEY, token text UNIQUE NOT NULL, sender text NOT NULL, recipient text NOT NULL,
  email text NOT NULL, event text NOT NULL, venue text NOT NULL DEFAULT '', event_at timestamptz NOT NULL,
  deadline timestamptz NOT NULL, timezone text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0),
  seats text NOT NULL DEFAULT '', message text NOT NULL DEFAULT '', promise text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz, revoked boolean NOT NULL DEFAULT false,
  delivery_id uuid, files jsonb NOT NULL DEFAULT '[]', transfer_url text
)`;
await sql`CREATE TABLE IF NOT EXISTS mail_settings (id integer PRIMARY KEY CHECK (id = 1), email text NOT NULL, password_encrypted text NOT NULL)`;
await sql`CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY, gift_id uuid NOT NULL REFERENCES gifts(id), delivery_id uuid NOT NULL,
  recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0, last_error text, UNIQUE(gift_id, delivery_id)
)`;
await sql`CREATE TABLE IF NOT EXISTS login_attempts (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
console.log("Database schema ready.");
