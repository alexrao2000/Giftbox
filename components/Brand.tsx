import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Giftbox home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M5 14h22v14H5zm-2-5h26v6H3zm13 0v19M16 9c-9 0-10-7-5-7 4 0 5 7 5 7Zm0 0c9 0 10-7 5-7-4 0-5 7-5 7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      giftbox<span className="brand-dot">.</span>
    </Link>
  );
}
export function Present({ open = false }: { open?: boolean }) {
  return (
    <div className={`present ${open ? "unwrapped" : ""}`} aria-hidden="true">
      <div className="present-glow" />
      <div className="spark spark-one">✦</div>
      <div className="spark spark-two">✧</div>
      <div className="spark spark-three">✧</div>
      <div className="present-shadow" />
      <div className="box-body">
        <span className="ribbon-front" />
      </div>
      <div className="box-lid">
        <span className="ribbon-top" />
        <span className="bow bow-left" />
        <span className="bow bow-right" />
        <span className="bow-knot" />
      </div>
      <span className="gift-tag">for you ♡</span>
    </div>
  );
}
