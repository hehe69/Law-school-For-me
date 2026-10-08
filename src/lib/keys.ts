// Keyboard helpers shared by the editor, exam mode and the drills. "Mod" is Cmd on a Mac, Ctrl elsewhere.

export function isMac(): boolean {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent);
}

export function isMod(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/** "Mod+K" -> "⌘K" on a Mac, "Ctrl+K" elsewhere. */
export function shortcutLabel(combo: string): string {
  const mac = isMac();
  return combo
    .split("+")
    .map((part) => {
      switch (part) {
        case "Mod":
          return mac ? "⌘" : "Ctrl";
        case "Shift":
          return mac ? "⇧" : "Shift";
        case "Alt":
          return mac ? "⌥" : "Alt";
        case "Up":
          return "↑";
        case "Down":
          return "↓";
        case "Enter":
          return mac ? "↩" : "Enter";
        default:
          return part;
      }
    })
    .join(mac ? "" : "+");
}
