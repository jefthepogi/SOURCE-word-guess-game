const { app, BrowserWindow, protocol, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

// The game uses fetch("./data/...json"), and Chromium's fetch() refuses file://
// URLs. Serving the project through a custom app:// scheme makes fetch work
// exactly like it does under `python -m http.server`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 900,
    autoHideMenuBar: true,
    title: "FIND THE SOURCE",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL("app://game/index.html");
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.normalize(path.join(__dirname, decodeURIComponent(pathname)));

    // Never serve anything outside the project folder
    if (!filePath.startsWith(__dirname)) {
      return new Response("Forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
