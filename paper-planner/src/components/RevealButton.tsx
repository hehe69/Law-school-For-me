"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const inDesktopApp = () => typeof window !== "undefined" && typeof window.paperPlanner?.revealInFinder === "function";

// "Reveal in Finder" for a file the app just wrote. Only renders inside the desktop app;
// the plain web version has no bridge, so nothing is shown.
export function RevealButton({ path }: { path: string }) {
  const available = useSyncExternalStore(subscribe, inDesktopApp, () => false);
  if (!available) return null;
  return (
    <button type="button" className="ml-2 text-xs" onClick={() => window.paperPlanner?.revealInFinder(path)}>
      Reveal in Finder
    </button>
  );
}
