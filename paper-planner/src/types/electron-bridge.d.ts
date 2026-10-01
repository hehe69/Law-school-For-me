// Exposed by electron/preload.ts when the app runs inside the desktop shell.
interface Window {
  paperPlanner?: {
    revealInFinder: (path: string) => Promise<boolean>;
  };
}
