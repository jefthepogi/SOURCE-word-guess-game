const { app, BrowserWindow, protocol, net } = require("electron");
const fs = require("fs");
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
    width: 720,
    height: 1000,
    minWidth: 620,
    minHeight: 760,
    autoHideMenuBar: true,
    title: "DECODE: SOURCE",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Allow the renderer to start the MP3 after the first user gesture.
      // This also keeps Electron's autoplay policy consistent in development
      // and in the packaged app.
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false,
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
    if (filePath.toLowerCase().endsWith(".mp3")) {
      if (!fs.existsSync(filePath)) {
        console.error(`[audio] missing file: ${filePath}`);
        return new Response("Audio file not found", { status: 404 });
      }
      const file = fs.statSync(filePath);
      const range = request.headers.get("Range");
      const headers = new Headers({
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      console.log(`[audio] request ${request.url} -> ${filePath} (${file.size} bytes, range=${range || "none"})`);

      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (match) {
          const start = Number(match[1]);
          const end = match[2] ? Math.min(Number(match[2]), file.size - 1) : file.size - 1;
          if (start <= end && start < file.size) {
            const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
            headers.set("Content-Length", String(chunk.length));
            headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
            return new Response(chunk, { status: 206, headers });
          }
        }
      }

      const audio = fs.readFileSync(filePath);
      headers.set("Content-Length", String(audio.length));
      return new Response(audio, { status: 200, headers });
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
