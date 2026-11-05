"use client";
import { useEffect, useState } from "react";
import { Brand, Present } from "./Brand";
import { date } from "@/lib/validation";
import type { Gift } from "@/lib/db";

type ViewGift = Omit<Gift, "email" | "id" | "files"> & {
  files: { name: string; type: string; size: number; index: number }[];
};
export function GiftView({ token }: { token: string }) {
  const [gift, setGift] = useState<ViewGift>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/gift/${token}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!cancelled) setGift(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  async function acknowledge() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/gift/${token}/acknowledge`, {
        method: "POST",
      });
      if (!response.ok)
        throw new Error("Could not record that. Please try again.");
      setGift((g) =>
        g ? { ...g, acknowledged_at: new Date().toISOString() } : g,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!gift)
    return (
      <main>
        <header className="site-header">
          <Brand />
          <span className="eyebrow">JUST FOR YOU</span>
        </header>
        <section className="empty-state">
          <h1>{error ? "A little hold-up." : "One lovely moment…"}</h1>
          <p role={error ? "alert" : "status"}>
            {error || "Opening your private gift box."}
          </p>
        </section>
      </main>
    );
  const ready = !!gift.delivery_id;
  return (
    <main className="gift-page">
      <header className="site-header">
        <Brand />
        <span className="eyebrow">A GIFT FROM {gift.sender.toUpperCase()}</span>
      </header>
      {!open ? (
        <section className="unwrap">
          <span className="eyebrow">
            TO {gift.recipient.toUpperCase()}, WITH LOVE
          </span>
          <h1>
            You have a little
            <br />
            <em>something waiting.</em>
          </h1>
          <Present />
          <button className="button primary" onClick={() => setOpen(true)}>
            Open your gift <span>↗</span>
          </button>
          <p>From {gift.sender} ♡</p>
        </section>
      ) : (
        <section className="opened-gift">
          <div className="gift-heading">
            <span className="eyebrow">SOMETHING TO LOOK FORWARD TO</span>
            <h1>{gift.event}</h1>
            <p>
              For {gift.recipient}, from {gift.sender}{" "}
              <span className="wine">♡</span>
            </p>
          </div>
          <div className="ticket-card">
            <div className="ticket-topline">
              <span className={`status ${ready ? "ready" : ""}`}>
                {ready ? "YOUR TICKETS ARE READY" : "TICKET DELIVERY PENDING"}
              </span>
              <span className="ticket-count">
                {gift.quantity} TICKET{gift.quantity === 1 ? "" : "S"}
              </span>
            </div>
            <div className="ticket-grid">
              <div>
                <span className="field-label">WHEN</span>
                <h3>{date(gift.event_at, gift.timezone)}</h3>
                <small>{gift.timezone}</small>
              </div>
              <div>
                <span className="field-label">WHERE</span>
                <h3>{gift.venue || "Details to come"}</h3>
                {gift.seats && <small>{gift.seats}</small>}
              </div>
            </div>
            <div className="ticket-tear" />
            <div className="ticket-bottom">
              <span>GOOD TIMES AHEAD</span>
              <span>✦ ✦ ✦</span>
            </div>
          </div>
          {gift.message && (
            <div className="personal-note">
              <span className="eyebrow">
                A NOTE FROM {gift.sender.toUpperCase()}
              </span>
              <p>“{gift.message}”</p>
              <span>— {gift.sender}</span>
            </div>
          )}
          {ready ? (
            <section className="delivery-panel">
              <span className="eyebrow">THE WAIT IS OVER</span>
              <h2>Let’s make it a memory.</h2>
              <p>
                Your sender has made these tickets available. Follow any
                acceptance steps required by the original ticket provider.
              </p>
              <div className="download-list">
                {gift.files.map((file) => (
                  <a
                    key={file.index}
                    className="download"
                    href={`/api/download/${token}/${file.index}`}
                  >
                    <span>↧</span>
                    <div>
                      <strong>{file.name}</strong>
                      <small>
                        {Math.max(1, Math.round(file.size / 1024))} KB
                      </small>
                    </div>
                    <span>Download ↗</span>
                  </a>
                ))}
              </div>
              {gift.transfer_url && (
                <a
                  className="button primary"
                  href={gift.transfer_url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open ticket transfer <span>↗</span>
                </a>
              )}
            </section>
          ) : (
            <section className="delivery-panel">
              <span className="eyebrow">WORTH THE WAIT</span>
              <h2>Your tickets are on their way.</h2>
              <p>
                {gift.sender} has promised to deliver them by{" "}
                <strong>
                  {date(gift.deadline, gift.timezone)} ({gift.timezone})
                </strong>
                . You’ll get an email when they’re available here.
              </p>
              {Date.parse(gift.deadline) < Date.now() && (
                <p className="notice">
                  The promised delivery time has passed. Please contact{" "}
                  {gift.sender} for an update.
                </p>
              )}
            </section>
          )}
          <details className="promise" open={!ready}>
            <summary>
              The delivery promise <span>↗</span>
            </summary>
            <p>{gift.promise}</p>
            <p className="muted">
              Created {date(gift.created_at, gift.timezone)}.
            </p>
            {gift.acknowledged_at ? (
              <p className="acknowledged">
                ✓ Read on {date(gift.acknowledged_at, gift.timezone)}
              </p>
            ) : (
              <button
                disabled={busy}
                className="button secondary"
                onClick={acknowledge}
              >
                {busy ? "Saving…" : "I’ve read the delivery promise"}
              </button>
            )}
            <small>Acknowledging records that you’ve read this promise.</small>
          </details>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <p className="private-note">
            Keep this link private. Anyone with it can open your gift box.
          </p>
        </section>
      )}
      <footer className="gift-footer">
        <Brand />
        <p>A little anticipation. A lot to look forward to.</p>
      </footer>
    </main>
  );
}
