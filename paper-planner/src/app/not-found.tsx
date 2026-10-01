import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-2">
      <h1>Not found</h1>
      <p>
        <Link href="/">Back to papers</Link>
      </p>
    </div>
  );
}
