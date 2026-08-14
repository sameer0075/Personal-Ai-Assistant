import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { env } from "./config/env.js";
import { setMainWindow } from "./state/window-state.js";
import { registerFsIpc } from "./ipc/fs-ipc.js";
import { registerProjectIpc } from "./ipc/project-ipc.js";
import { registerAgentIpc } from "./ipc/agent-ipc.js";
import * as mcpClient from "./mcp/mcp-client.service.js";
import { registerApprovalIpc } from "./ipc/approval-ipc.js";
import { registerConfirmationIpc } from "./ipc/confirmation-ipc.js";

// import.meta.dirname (stable since Node 20.11) rather than __dirname - this
// package is ESM ("type": "module"), so the CJS-only __dirname global isn't
// available in the built output.
const dirname = import.meta.dirname;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0f14", // matches the app's dark theme - avoids a white flash on load
    webPreferences: {
      // electron-vite now builds this as CommonJS with an explicit .cjs
      // extension (see electron.vite.config.ts) - Electron's sandboxed
      // preload loader doesn't support ESM import syntax, so this can't be
      // .mjs or plain .js (which would be ESM under this package's "type":
      // "module" setting).
      preload: join(dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("ready-to-show", () => win.show());

  // Any link the app tries to open externally (e.g. a doc link the agent surfaces)
  // opens in the user's real browser, not a second Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(async () => {
  registerFsIpc();
  registerApprovalIpc();
  registerProjectIpc();
  registerAgentIpc();
  registerConfirmationIpc();

  const win = createWindow();
  setMainWindow(win);

  if (env) {
    try {
      await mcpClient.initStaticServers();
    } catch (err) {
      console.error("Failed to connect static MCP servers (web search will be unavailable):", err);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow();
      setMainWindow(newWin);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});