"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "./Brand";
import type { Gift } from "@/lib/db";
import { date } from "@/lib/validation";

type AdminGift = Gift & { pending_emails: number; email_error: string | null };
async function request(path: string, options?: RequestInit) {
  const response = await fetch(`/api/${path}`, {
    cache: "no-store",
    ...options,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
}
function post(path: string, value: unknown, method = "POST") {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
export function Dashboard() {
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [gifts, setGifts] = useState<AdminGift[]>([]);
  const [mail, setMail] = useState({ configured: false, email: "" });
  const [tab, setTab] = useState<"gifts" | "create" | "settings">("gifts");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  async function refresh() {
    const [rows, settings] = await Promise.all([
      request("gifts"),
      request("settings"),
    ]);
    setGifts(rows);
    setMail(settings);
  }
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    request("session")
      .then(async (result) => {
        setAuthenticated(result.authenticated);
        if (result.authenticated) await refresh();
      })
      .catch((e) => setError(e.message));
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      await post("session", { password: form.get("password") });
      setAuthenticated(true);
      await refresh();
    });
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = Object.fromEntries(form.entries());
    await run(async () => {
      await post("gifts", {
        ...value,
        timezone,
        event_at: new Date(String(value.event_at)).toISOString(),
        deadline: new Date(String(value.deadline)).toISOString(),
      });
      await refresh();
      setTab("gifts");
      setNotice(
        "Your gift box is ready to share. Creating it does not send an email.",
      );
    });
  }
  async function publish(e: FormEvent<HTMLFormElement>, gift: AdminGift) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      const result = await request(`gifts/${gift.id}/publish`, {
        method: "POST",
        body: form,
      });
      setNotice(
        result.pending
          ? "Tickets are available. The email is queued; connect Gmail or retry delivery."
          : "Tickets are available and the notification email was sent.",
      );
      formElement.reset();
      await refresh();
    });
  }
  async function saveMail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      await post("settings", Object.fromEntries(form.entries()));
      formElement.reset();
      await refresh();
      setNotice("Gmail is connected. Queued notifications are being sent.");
    });
  }
  return (
    <main className="admin-page">
      <header className="site-header">
        <Brand />
        <div className="header-actions">
          <span className="eyebrow">YOUR LITTLE GIFT STUDIO</span>
          {authenticated && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await post("logout", {});
                  setAuthenticated(false);
                  setGifts([]);
                })
              }
            >
              Sign out ↗
            </button>
          )}
        </div>
      </header>
      {authenticated === undefined ? (
        <div className="empty-state" role="status">
          {error || "Opening your studio…"}
        </div>
      ) : !authenticated ? (
        <section className="login">
          <span className="eyebrow">FOR THE GIFT GIVER</span>
          <h1>
            Welcome to
            <br />
            <em>your little studio.</em>
          </h1>
          <p>
            Sign in to wrap a promise, share a surprise, and deliver the
            tickets.
          </p>
          <form onSubmit={login}>
            <label>
              Owner password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? "Signing in…" : "Enter your studio ↗"}
            </button>
          </form>
          <small>The owner password is set when Giftbox is deployed.</small>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      ) : (
        <div className="studio">
          <div className="studio-heading">
            <div>
              <span className="eyebrow">A LITTLE CARE GOES A LONG WAY</span>
              <h1>
                Your gift boxes<span className="wine">.</span>
              </h1>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setTab("create");
                setError("");
                setNotice("");
              }}
            >
              + Make a gift box
            </button>
          </div>
          <nav className="tabs" aria-label="Studio sections">
            {(["gifts", "create", "settings"] as const).map((value) => (
              <button
                key={value}
                aria-current={tab === value ? "page" : undefined}
                onClick={() => {
                  setTab(value);
                  setError("");
                  setNotice("");
                }}
              >
                {value === "gifts"
                  ? `Gift boxes (${gifts.length})`
                  : value === "create"
                    ? "Create a gift"
                    : "Email setup"}
              </button>
            ))}
          </nav>
          {!mail.configured && (
            <div className="notice">
              Your gift boxes work now.{" "}
              <button
                className="text-button"
                onClick={() => setTab("settings")}
              >
                Connect Gmail
              </button>{" "}
              to send ticket-ready notifications.
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              {notice}
            </div>
          )}
          {tab === "gifts" &&
            (gifts.length ? (
              <div className="gift-list">
                {gifts.map((gift) => (
                  <article className="admin-gift" key={gift.id}>
                    <div className="admin-gift-top">
                      <div>
                        <span
                          className={`status ${gift.delivery_id ? "ready" : ""}`}
                        >
                          {gift.revoked
                            ? "LINK PAUSED"
                            : gift.delivery_id
                              ? "TICKETS AVAILABLE"
                              : "AWAITING TICKETS"}
                        </span>
                        <h2>{gift.event}</h2>
                        <p>
                          For <strong>{gift.recipient}</strong> ·{" "}
                          {gift.quantity} ticket{gift.quantity === 1 ? "" : "s"}{" "}
                          · {date(gift.event_at, gift.timezone)}
                        </p>
                        <small>
                          Deliver by {date(gift.deadline, gift.timezone)} (
                          {gift.timezone})
                        </small>
                      </div>
                      <div className="gift-mini" aria-hidden="true">
                        ♧
                      </div>
                    </div>
                    <div className="admin-gift-actions">
                      <a
                        className="button secondary"
                        href={`/g/${gift.token}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Preview gift ↗
                      </a>
                      <button
                        className="button secondary"
                        disabled={busy || gift.revoked}
                        onClick={() =>
                          run(async () => {
                            await navigator.clipboard.writeText(
                              `${location.origin}/g/${gift.token}`,
                            );
                            setNotice(
                              "Private gift link copied. Send it to the recipient.",
                            );
                          })
                        }
                      >
                        Copy gift link
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await post(
                              `gifts/${gift.id}`,
                              { revoked: !gift.revoked },
                              "PATCH",
                            );
                            await refresh();
                          })
                        }
                      >
                        {gift.revoked ? "Restore link" : "Pause link"}
                      </button>
                    </div>
                    <div className="gift-meta">
                      <span>
                        {gift.acknowledged_at
                          ? "✓ Recipient has read the promise"
                          : "Promise not yet acknowledged"}
                      </span>
                      <span>
                        {gift.pending_emails
                          ? `${gift.pending_emails} email queued`
                          : gift.delivery_id
                            ? "✓ Notification sent"
                            : "No notification sent yet"}
                      </span>
                    </div>
                    {gift.email_error && (
                      <p className="error">{gift.email_error}</p>
                    )}
                    {gift.pending_emails > 0 && (
                      <button
                        className="text-button"
                        disabled={busy || gift.revoked}
                        onClick={() =>
                          run(async () => {
                            const result = await post(
                              `gifts/${gift.id}/retry`,
                              {},
                            );
                            await refresh();
                            setNotice(
                              result.pending
                                ? "Still queued. Check Gmail setup; failed sends can be retried after five minutes."
                                : `${result.sent} notification(s) sent.`,
                            );
                          })
                        }
                      >
                        Retry queued email ↗
                      </button>
                    )}
                    <details className="upload-details">
                      <summary>
                        {gift.delivery_id
                          ? "Replace ticket delivery"
                          : "The tickets arrived? Add them here."}{" "}
                        <span>+</span>
                      </summary>
                      <form onSubmit={(e) => publish(e, gift)}>
                        <label>
                          Ticket files
                          <input
                            name="files"
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            multiple
                            disabled={busy || gift.revoked}
                          />
                          <small>
                            PDF, PNG, or JPG. Up to 10 files, 3 MB total.
                          </small>
                        </label>
                        <label>
                          Or an official ticket transfer link
                          <input
                            name="transfer_url"
                            type="url"
                            placeholder="https://…"
                            maxLength={4000}
                            disabled={busy || gift.revoked}
                          />
                        </label>
                        <p className="muted">
                          Publishing makes this delivery available and queues an
                          email to {gift.email}. A replacement replaces all
                          files and links in the previous delivery.
                        </p>
                        <button
                          className="button primary"
                          disabled={busy || gift.revoked}
                        >
                          {busy ? "Working…" : "Make available & notify ↗"}
                        </button>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <section className="empty-studio">
                <span className="empty-icon">✧</span>
                <h2>A good surprise starts here.</h2>
                <p>
                  Make your first gift box. Add the event now and the tickets
                  when they arrive.
                </p>
                <button
                  className="button primary"
                  onClick={() => setTab("create")}
                >
                  Wrap your first gift ↗
                </button>
              </section>
            ))}
          {tab === "create" && (
            <form className="studio-form" onSubmit={create}>
              <div className="form-intro">
                <span className="eyebrow">START WITH THE THOUGHT</span>
                <h2>What are they looking forward to?</h2>
                <p>
                  These details form the delivery promise. Check them before
                  creating the gift.
                </p>
              </div>
              <div className="form-grid">
                <label>
                  Your name
                  <input
                    name="sender"
                    required
                    maxLength={120}
                    placeholder="How they know you"
                  />
                </label>
                <label>
                  Their name
                  <input
                    name="recipient"
                    required
                    maxLength={120}
                    placeholder="The lucky one"
                  />
                </label>
                <label className="full">
                  Their email
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="Where to send ticket-ready notifications"
                  />
                </label>
                <label className="full">
                  Event name
                  <input
                    name="event"
                    required
                    maxLength={200}
                    placeholder="A night they’ll remember"
                  />
                </label>
                <label>
                  Venue
                  <input
                    name="venue"
                    maxLength={200}
                    placeholder="Where the good times happen"
                  />
                </label>
                <label>
                  Number of tickets
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue="1"
                    required
                  />
                </label>
                <label>
                  Event date & time
                  <input name="event_at" type="datetime-local" required />
                </label>
                <label>
                  Promised delivery date & time
                  <input name="deadline" type="datetime-local" required />
                </label>
                <p className="form-timezone full">
                  Both times use your current time zone:{" "}
                  <strong>{timezone}</strong>.
                </p>
                <label className="full">
                  Seat details <span className="optional">optional</span>
                  <input
                    name="seats"
                    maxLength={300}
                    placeholder="Section, row, seats…"
                  />
                </label>
                <label className="full">
                  A personal note <span className="optional">optional</span>
                  <textarea
                    name="message"
                    rows={4}
                    maxLength={3000}
                    placeholder="A little note makes it yours."
                  />
                </label>
              </div>
              <div className="form-promise">
                <span className="eyebrow">YOUR WORD, WRAPPED UP</span>
                <p>
                  Creating a gift records your promise to deliver these tickets
                  by the date above. The recipient sees that delivery is
                  pending. It doesn’t change the original provider’s transfer
                  requirements or a marketplace deadline.
                </p>
              </div>
              <button className="button primary" disabled={busy}>
                {busy ? "Wrapping…" : "Create their gift box ↗"}
              </button>
            </form>
          )}
          {tab === "settings" && (
            <section className="settings-panel">
              <span className="eyebrow">THE GOOD-NEWS DEPARTMENT</span>
              <h2>Send the “they’re here!” email.</h2>
              <p>
                Connect your Gmail account to send ticket-ready notifications
                from your own address.
              </p>
              <div
                className={`connection-status ${mail.configured ? "connected" : ""}`}
              >
                {mail.configured
                  ? `✓ Connected: ${mail.email}`
                  : "○ Gmail not connected yet"}
              </div>
              <form onSubmit={saveMail}>
                <label>
                  Gmail address
                  <input
                    name="email"
                    type="email"
                    defaultValue={mail.email}
                    required
                    autoComplete="email"
                  />
                </label>
                <label>
                  Gmail app password
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="16-letter app password"
                    maxLength={32}
                  />
                </label>
                <p className="muted">
                  Use an app password created for Giftbox, with 2-Step
                  Verification enabled. It is stored encrypted and is never
                  shown again. Connecting Gmail also sends any queued ticket
                  notifications.
                </p>
                <a
                  className="text-link"
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                >
                  Create a Gmail app password ↗
                </a>
                <button className="button primary" disabled={busy}>
                  {busy
                    ? "Connecting…"
                    : mail.configured
                      ? "Update Gmail connection ↗"
                      : "Connect Gmail ↗"}
                </button>
              </form>
              <p className="private-note">
                Failed notifications stay queued. Retry them in Gift boxes; an
                automatic retry also runs daily.
              </p>
            </section>
          )}
        </div>
      )}
      <footer>
        <Brand />
        <p>For the things worth looking forward to.</p>
      </footer>
    </main>
  );
}
