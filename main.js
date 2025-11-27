// ===============================================================
// R.A.C.E 2025 main.js  —  Fully Integrated, Clean, Updated
// ===============================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let loginWindow;
let homeWindow;
let raceWindow;

// --- CRITICAL PATHS ---
const appDataPath = app.getPath("userData");
const dbPath = path.join(appDataPath, "database.json");
const reqPath = path.join(appDataPath, "requirements.json");
const docsDir = path.join(appDataPath, "uploads");

// ---------------------------------------------------------------
// INITIALIZE APP DATA (database.json, requirements.json, uploads)
// ---------------------------------------------------------------
function initializeAppData() {
  if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true });
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const copyToAppData = (fileName, dest) => {
    const candidates = [
      path.join(process.resourcesPath, "app.asar.unpacked", fileName),
      path.join(__dirname, fileName)
    ];
    const source = candidates.find(p => fs.existsSync(p));

    if (source) {
      fs.copyFileSync(source, dest);
      console.log(`${fileName} copied → ${dest}`);
    } else {
      console.error(`Missing ${fileName}, created empty file.`);
      fs.writeFileSync(dest, "[]");
    }
  };

  if (!fs.existsSync(dbPath)) copyToAppData("database.json", dbPath);
  if (!fs.existsSync(reqPath)) copyToAppData("requirements.json", reqPath);
}

// ---------------------------------------------------------------
// LOGIN WINDOW (FIRST WINDOW)
// ---------------------------------------------------------------
function createLoginWindow() {
  initializeAppData();

  loginWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "RACE 2025 - Login",
    frame: false,
    resizable: true
  });

  loginWindow.loadFile("login.html");

  loginWindow.on("closed", () => {
    loginWindow = null;
    if (!homeWindow && !raceWindow) app.quit();
  });
}

// ---------------------------------------------------------------
// HOME WINDOW (AFTER LOGIN)
// ---------------------------------------------------------------
function createHomeWindow() {
  if (homeWindow) return homeWindow.focus();

  homeWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "RACE 2025 - Home",
    resizable: true
  });

  homeWindow.loadFile("home.html");

  homeWindow.on("closed", () => {
    homeWindow = null;
    if (!loginWindow && !raceWindow) app.quit();
  });
}

// ---------------------------------------------------------------
// RACE WINDOW (index.html) – OPENED AS NEW WINDOW
// ---------------------------------------------------------------
function createRaceWindow() {
  if (raceWindow) return raceWindow.focus();

  raceWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "RACE 2025 - Case Rate Search",
    resizable: true
  });

  const startUrl =
    `file://${path.join(__dirname, "index.html")}?db_path=${encodeURIComponent(dbPath)}`;

  raceWindow.loadURL(startUrl);

  raceWindow.on("closed", () => {
    raceWindow = null;
    if (!loginWindow && !homeWindow) app.quit();
  });
}

// ---------------------------------------------------------------
// APP LIFECYCLE
// ---------------------------------------------------------------
app.whenReady().then(createLoginWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
});

// ---------------------------------------------------------------
// IPC HANDLERS
// ---------------------------------------------------------------
ipcMain.on("open-home-window", () => {
  createHomeWindow();
  if (loginWindow) loginWindow.close();
});

ipcMain.on("open-race-window", () => {
  createRaceWindow();
  if (homeWindow) homeWindow.focus();
});

ipcMain.on("close-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// Read from database.json / requirements.json
ipcMain.handle("get-data", async (event, fileName) => {
  try {
    const p = fileName === "database.json" ? dbPath : reqPath;
    return fs.readFileSync(p, "utf8");
  } catch (err) {
    console.error(`Error reading ${fileName}:`, err);
    return "[]";
  }
});

// Upload documents
ipcMain.handle("upload-document", async () => {
  const active = raceWindow || homeWindow || loginWindow;
  const file = await dialog.showOpenDialog(active, {
    properties: ["openFile"],
    filters: [{ name: "Documents", extensions: ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"] }]
  });

  if (file.canceled) return null;
  const src = file.filePaths[0];
  const dest = path.join(docsDir, path.basename(src));
  fs.copyFileSync(src, dest);

  return { name: path.basename(src), time: fs.statSync(dest).mtime.getTime() };
});

// List uploaded files
ipcMain.handle("list-files", () => {
  if (!fs.existsSync(docsDir)) return [];
  return fs.readdirSync(docsDir).map(name => ({
    name,
    time: fs.statSync(path.join(docsDir, name)).mtime.getTime()
  }));
});

// Rename
ipcMain.handle("rename-file", (event, oldName, newName) => {
  const oldP = path.join(docsDir, oldName);
  const newP = path.join(docsDir, newName);
  if (!fs.existsSync(oldP)) return false;
  fs.renameSync(oldP, newP);
  return true;
});

// Delete
ipcMain.handle("delete-file", (event, name) => {
  const p = path.join(docsDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return true;
});

// Open file
ipcMain.on("open-file", (event, name) => {
  const p = path.join(docsDir, name);
  if (fs.existsSync(p)) shell.openPath(p);
});

// Export
ipcMain.handle("export-data", async (event, fileName, content) => {
  const active = raceWindow || homeWindow || loginWindow;
  const { filePath } = await dialog.showSaveDialog(active, {
    defaultPath: path.join(app.getPath("downloads"), fileName)
  });
  if (filePath) fs.writeFileSync(filePath, content);
  return true;
});

// Import
ipcMain.handle("import-data", async (event, fileName) => {
  const active = raceWindow || homeWindow || loginWindow;
  const { canceled, filePaths } = await dialog.showOpenDialog(active, {
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (canceled) return null;

  const src = filePaths[0];
  const dest = fileName === "database.json" ? dbPath : reqPath;
  const content = fs.readFileSync(src, "utf8");

  JSON.parse(content); // validation

  fs.copyFileSync(src, dest);
  return content;
});
