import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function NotFound() {
  return (
    <main>
      <header className="site-header">
        <Brand />
      </header>
      <section className="empty-state">
        <h1>This box is a little lost.</h1>
        <p>Check the gift link or ask the sender for a new one.</p>
        <br />
        <Link href="/" className="button secondary">
          Back to Giftbox ↗
        </Link>
      </section>
    </main>
  );
}
