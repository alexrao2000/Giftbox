# Giftbox

A private gift link for tickets that will arrive later. The owner creates a gift, shares its link, and publishes ticket files or an official transfer link when they become available. The recipient sees the delivery promise and gets an email when tickets are ready.

## Run locally

Use Node.js 24 or newer. Install dependencies with `npm ci`, copy [.env.example](.env.example) to `.env.local`, and fill in the values. For a linked Vercel project, `vercel env pull .env.local --yes` retrieves development service configuration. Keep custom local secrets in `.env.development.local` so pulls do not overwrite them.

Run `npm run db:migrate`, then `npm run dev`. The owner dashboard is at `/admin`. `npm run owner-key` displays the locally configured owner password; keep it private. Set a long random `OWNER_PASSWORD`, independent `SESSION_SECRET` of at least 32 characters, and a random `CRON_SECRET`. Set `APP_URL` to the canonical production origin before publishing gifts.

## Services

- Neon Postgres stores gifts, encrypted mail settings, rate limits, and the notification queue.
- A **private** Vercel Blob store holds PDF, PNG, and JPG ticket files. Uploads support up to ten files totaling 3 MB per delivery.
- Gmail SMTP sends notifications from the account connected in the private owner dashboard. Connect it with a dedicated [Google app password](https://support.google.com/accounts/answer/185833), which requires 2-Step Verification. The app verifies the connection before storing the password encrypted with AES-256-GCM. No email is sent by merely creating a gift.

The owner uploads files or supplies an HTTPS transfer URL and selects **Make available & notify**. This replaces the previous delivery, saves a notification in the same database transaction, and attempts to send it immediately. If Gmail is unavailable or not connected, notifications stay queued. Connecting Gmail attempts queued delivery, the dashboard has a retry button, and a daily Vercel Cron retries up to ten notifications. Failed attempts have a five-minute delay. Email uses a persistent queue and lease; SMTP cannot guarantee exactly-once delivery after an ambiguous network failure. “Sent” means Gmail accepted the message, not that it reached the recipient’s inbox.

## Privacy and delivery commitments

Gift links contain 256-bit random tokens. Anyone possessing a link can read its gift and download its current ticket files. Gift pages use no analytics, are marked noindex, and send no referrer to other websites. The owner can pause and restore a link. Original files from replaced deliveries stay private in Blob storage; remove them through the storage dashboard when retention is no longer needed.

The delivery promise is recorded at creation and remains fixed. The recipient can acknowledge reading it. This is a record of the sender’s commitment, not a claim that tickets have already transferred, a marketplace-approved substitute for delivery, or a guarantee of legal enforceability. Mobile tickets may still require acceptance through the original provider.

Production and preview deployments should use separate databases, Blob stores, owner credentials, and session secrets. Apply the schema before deploying. Changing `SESSION_SECRET` signs the owner out and prevents decrypting existing Gmail settings; reconnect Gmail afterward. Email bodies retain the configured gift origin, so changing `APP_URL` requires reviewing queued messages. TLS is required in production.

## Checks

`npm run check` checks TypeScript. `npm test` checks security primitives, validation, and API behavior. `npm run test:integration` exercises the running local app against real database and private file storage with synthetic fixtures, without sending email. `npm run build` makes a production build.
