const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const http = require("http");

const PORT = 3000;
const NEXT_URL = `http://localhost:${PORT}`;
let mainWindow;
let nextProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(NEXT_URL);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, () => resolve())
        .on("error", () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Impossible de joindre ${url} après ${timeout} ms`));
          } else {
            setTimeout(check, 500);
          }
        });
    };

    check();
  });
}

function isServerAlreadyRunning(url) {
  return new Promise((resolve) => {
    http.get(url, () => resolve(true)).on("error", () => resolve(false));
  });
}

async function startNext() {
  if (await isServerAlreadyRunning(NEXT_URL)) {
    console.log(`Serveur Next.js déjà actif sur ${NEXT_URL}, réutilisation.`);
    return;
  }

  const nextCommand = app.isPackaged ? "npm run start" : "npm run dev";
  nextProcess = spawn(nextCommand, {
    cwd: process.cwd(),
    shell: true,
    env: process.env,
    stdio: "inherit",
  });

  nextProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Processus Next.js terminé avec le code ${code}`);
    }
  });
}

app.whenReady().then(async () => {
  if (!app.isPackaged) {
    await startNext();
    try {
      await waitForServer(NEXT_URL, 120000);
    } catch (error) {
      console.error(error);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (nextProcess) {
    nextProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
