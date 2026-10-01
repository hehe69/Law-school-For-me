import { contextBridge, ipcRenderer } from "electron";

// The only bridge between the page and the desktop shell: reveal a file the app wrote.
contextBridge.exposeInMainWorld("paperPlanner", {
  revealInFinder: (filePath: string): Promise<boolean> => ipcRenderer.invoke("paper-planner:reveal", filePath),
});
