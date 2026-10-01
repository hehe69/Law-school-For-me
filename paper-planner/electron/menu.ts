import { app, Menu, type MenuItemConstructorOptions } from "electron";

export interface MenuActions {
  revealDataFolder: () => void;
  importData: () => void;
  backupNow: () => void;
  goBack: () => void;
  goForward: () => void;
}

// Standard Mac menu: app, Edit (so form shortcuts work), View, Data, Window.
export function buildMenu(actions: MenuActions) {
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push({
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  });

  template.push({
    label: "View",
    submenu: [
      { label: "Back", accelerator: "CmdOrCtrl+[", click: actions.goBack },
      { label: "Forward", accelerator: "CmdOrCtrl+]", click: actions.goForward },
      { type: "separator" },
      { role: "reload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  });

  template.push({
    label: "Data",
    submenu: [
      { label: "Reveal Data Folder in Finder", click: actions.revealDataFolder },
      { label: "Import Data from Folder…", click: actions.importData },
      { type: "separator" },
      { label: "Back Up Now", click: actions.backupNow },
    ],
  });

  template.push({
    label: "Window",
    role: "window",
    submenu: isMac
      ? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }]
      : [{ role: "minimize" }, { role: "close" }],
  });

  if (!isMac) template.push({ label: "App", submenu: [{ role: "quit" }] });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
