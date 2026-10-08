import Link from "next/link";

/** The top bar on every page. The capture box joins it in phase 2. */
export function Header() {
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 print:hidden">
      <Link href="/" className="text-sm font-semibold tracking-tight text-gray-900">
        Law Outlines
      </Link>
      <nav className="flex items-center gap-3 text-sm text-gray-600">
        <Link href="/" className="hover:text-gray-900">
          Courses
        </Link>
      </nav>
      <div className="ml-auto" id="header-right" />
    </header>
  );
}
