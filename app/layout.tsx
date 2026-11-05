import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giftbox — Good things are on their way",
  description: "A thoughtful home for tickets that are on their way.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
