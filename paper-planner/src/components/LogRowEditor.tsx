"use client";

import { useTransition } from "react";
import { updateLogEntry } from "@/app/actions";
import { InlineText } from "./InlineText";

// Inline editing of pin cite, used_in, and note, plus the verified checkbox.
export function LogPin({ id, value }: { id: number; value: string | null }) {
  return <InlineText value={value ?? ""} placeholder="no pin cite" onSave={(v) => updateLogEntry(id, { pin_cite: v || null })} />;
}
export function LogUsedIn({ id, value }: { id: number; value: string }) {
  return <InlineText value={value} placeholder="e.g. fn 23" onSave={(v) => updateLogEntry(id, { used_in: v })} />;
}
export function LogNote({ id, value }: { id: number; value: string }) {
  return <InlineText value={value} placeholder="note" onSave={(v) => updateLogEntry(id, { note: v })} />;
}
export function LogVerified({ id, value }: { id: number; value: boolean }) {
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      checked={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          await updateLogEntry(id, { verified: next });
        });
      }}
    />
  );
}
