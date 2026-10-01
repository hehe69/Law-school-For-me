import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Planner",
  description: "Plan and organise research for long legal writing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-gray-300 bg-gray-50 px-4 py-2 text-sm flex items-center gap-4">
          <Link href="/" className="font-semibold text-gray-900 no-underline hover:underline">
            Paper Planner
          </Link>
        </header>
        <main className="px-4 py-4 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
