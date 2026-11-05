"use client";
import Link from "next/link";
import { useState } from "react";
import { Brand, Present } from "@/components/Brand";

export default function Home() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <header className="site-header">
        <Brand />
        <Link className="nav-link" href="/admin">
          Your gift boxes <span>↗</span>
        </Link>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> THE ANTICIPATION IS PART OF THE GIFT
          </span>
          <h1>
            Good things
            <br />
            are <em>on their way.</em>
          </h1>
          <p className="lead">
            The tickets aren’t here yet. The excitement can be.
            <br className="desktop" /> Give them a little something to look
            forward to.
          </p>
          <Link href="/admin" className="button primary">
            Make a gift box <span>↗</span>
          </Link>
          <div className="hero-note">
            <span>♡</span> A personal promise. A moment worth waiting for.
          </div>
        </div>
        <div className="hero-stage">
          <div className="stage-ring" />
          <Present open={open} />
          <button className="preview-invitation" onClick={() => setOpen(!open)}>
            {open
              ? "A night to remember. Coming soon. ♡"
              : "A little preview. Tap to unwrap."}
            <span>{open ? "↺" : "↗"}</span>
          </button>
          <span className="stage-caption">A SMALL BOX. A BIG SOMETHING.</span>
        </div>
      </section>
      <section className="how">
        <div className="section-intro">
          <span className="eyebrow">FROM “I GOT YOU SOMETHING”</span>
          <h2>To “I can’t wait.”</h2>
        </div>
        <div className="steps">
          <article>
            <span className="step-number">01 /</span>
            <h3>Wrap the anticipation.</h3>
            <p>
              Add the event, a personal note, and your promise to deliver the
              tickets.
            </p>
          </article>
          <article>
            <span className="step-number">02 /</span>
            <h3>Share their little surprise.</h3>
            <p>
              Send a private gift link. They can open it now and see what’s on
              its way.
            </p>
          </article>
          <article>
            <span className="step-number">03 /</span>
            <h3>Deliver the good stuff.</h3>
            <p>
              Upload the tickets when they arrive. We’ll email your recipient
              when they’re ready.
            </p>
          </article>
        </div>
      </section>
      <footer>
        <Brand />
        <p>For the things worth looking forward to.</p>
        <span>MADE TO MEAN SOMETHING ♡</span>
      </footer>
    </main>
  );
}
