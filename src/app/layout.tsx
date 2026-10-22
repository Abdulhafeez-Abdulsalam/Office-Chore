import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Office Chores",
  description: "Who's doing which office chore, and when.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
