"use client";

import { useRouter } from "next/navigation";

/** A drop-down that navigates: picking an option goes to the URL it carries. */
export function SectionSelect({ options, value, label }: { options: { value: string; href: string; text: string }[]; value: string; label: string }) {
  const router = useRouter();
  return (
    <select
      className="input w-auto max-w-xs"
      value={value}
      aria-label={label}
      onChange={(e) => {
        const next = options.find((o) => o.value === e.target.value);
        if (next) router.push(next.href);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.text}
        </option>
      ))}
    </select>
  );
}
