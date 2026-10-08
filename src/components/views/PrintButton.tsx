"use client";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className ?? "btn-primary"} onClick={() => window.print()}>
      Print
    </button>
  );
}
