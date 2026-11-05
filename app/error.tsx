"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="empty-state">
      <h1>A little hold-up.</h1>
      <p>We couldn’t open this page. Please try again.</p>
      <br />
      <button className="button primary" onClick={reset}>
        Try again ↗
      </button>
    </section>
  );
}
