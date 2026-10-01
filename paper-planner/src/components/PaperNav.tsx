"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["", "Dashboard"],
  ["/outline", "Outline"],
  ["/sources", "Sources"],
  ["/quotes", "Quote bank"],
  ["/citations", "Citation log"],
  ["/drafts", "Drafts"],
  ["/map", "Argument map"],
  ["/export", "Export"],
] as const;

export function PaperNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/papers/${slug}`;
  return (
    <nav className="flex gap-1 flex-wrap border-b border-gray-300 mt-2 text-sm">
      {items.map(([path, label]) => {
        const href = base + path;
        const active = path === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={path}
            href={href}
            className={`px-3 py-1.5 -mb-px border-b-2 no-underline ${active ? "border-gray-900 text-gray-900 font-medium" : "border-transparent text-gray-600 hover:text-gray-900"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
