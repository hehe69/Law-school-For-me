import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Law Study",
  description: "Unit-based study notes and practice tests",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-gray-200">
          <div className="mx-auto flex max-w-4xl items-center gap-5 px-4 py-3">
            <Link href="/" className="font-semibold">Law Study</Link>
            <nav className="flex gap-4 text-sm text-gray-700">
              <Link href="/" className="hover:underline">Courses</Link>
              <Link href="/review" className="hover:underline">Review</Link>
              <Link href="/gaps" className="hover:underline">Gaps</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
