// ===============================================================
// R.A.C.E 2025 main.js  —  Fully Integrated, Clean, Updated
// ===============================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------
// WINDOW REFERENCES
// ---------------------------------------------------------------
let loginWindow;
let homeWindow;
let raceWindow;
let adminWindow; 

// ---------------------------------------------------------------
// CRITICAL FILE PATHS
// ---------------------------------------------------------------
const appDataPath = app.getPath("userData");
const dbPath = path.join(appDataPath, "database.json");
const reqPath = path.join(appDataPath, "requirements.json");
const docsDir = path.join(appDataPath, "uploads");

// ---------------------------------------------------------------
// INITIALIZE APP DATA
// ---------------------------------------------------------------
function initializeAppData() {
    if (!fs.existsSync(appDataPath)) fs.mkdirSync(appDataPath, { recursive: true });
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const copyToAppData = (fileName, dest, defaultContent = "[]") => {
        if (fs.existsSync(dest)) return; // Already exists, skip copy

        const candidates = [
            path.join(process.resourcesPath, "app.asar.unpacked", fileName), // Production path
            path.join(__dirname, fileName) // Development path
        ];
        const source = candidates.find(p => fs.existsSync(p));

        try {
            if (source) {
                fs.copyFileSync(source, dest);
                console.log(`${fileName} copied → ${dest}`);
            } else {
                console.error(`Missing ${fileName} in bundle. Creating empty file.`);
                // Ensure default content is written if source is missing
                fs.writeFileSync(dest, defaultContent); 
            }
        } catch (e) {
            console.error(`Error copying/creating ${fileName}:`, e);
        }
    };

    // Initialize files if they don't exist in AppData
    copyToAppData("database.json", dbPath);
    copyToAppData("requirements.json", reqPath);
}

/**
 * Helper function to load the HTML file and inject file paths via URL.
 * @param {BrowserWindow} win The target BrowserWindow instance.
 * @param {string} htmlFile The HTML file name (e.g., 'home.html').
 */
function loadAppFile(win, htmlFile) {
    // CRITICAL FIX: Construct the URL with file scheme and path arguments
    const urlParams = new URLSearchParams({
        db_path: dbPath,
        req_path: reqPath
    }).toString();
    
    const startUrl = `file://${path.join(__dirname, htmlFile)}?${urlParams}`;
    
    // Use loadURL instead of loadFile when passing query parameters
    win.loadURL(startUrl);
}


// ---------------------------------------------------------------
// LOGIN WINDOW  (FIRST TO OPEN)
// ---------------------------------------------------------------
function createLoginWindow() {
    initializeAppData();

    if (loginWindow && !loginWindow.isDestroyed()) return loginWindow.focus();

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

    loginWindow.loadFile("login.html"); // Login page doesn't need data paths immediately

    loginWindow.on("closed", () => {
        loginWindow = null;
        if (!homeWindow && !raceWindow && !adminWindow) app.quit();
    });
}

// ---------------------------------------------------------------
// HOME WINDOW  (BILLER)
// ---------------------------------------------------------------
function createHomeWindow() {
    if (homeWindow && !homeWindow.isDestroyed()) return homeWindow.focus();

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

    // FIX APPLIED: Use loadAppFile to correctly inject file paths
    loadAppFile(homeWindow, "home.html");

    homeWindow.on("closed", () => {
        homeWindow = null;
        if (!loginWindow && !raceWindow && !adminWindow) app.quit();
    });
}

// ---------------------------------------------------------------
// ADMIN WINDOW  (ADMIN USER)
// ---------------------------------------------------------------
function createAdminWindow() {
    if (adminWindow && !adminWindow.isDestroyed()) return adminWindow.focus();

    adminWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: "RACE 2025 - Admin Panel",
        resizable: true
    });

    // FIX APPLIED: Use loadAppFile to correctly inject file paths
    loadAppFile(adminWindow, "admin.html");

    adminWindow.on("closed", () => {
        adminWindow = null;
        if (!loginWindow && !homeWindow && !raceWindow) app.quit();
    });
}

// ---------------------------------------------------------------
// RACE WINDOW (index.html) — Separate window
// ---------------------------------------------------------------
function createRaceWindow() {
    if (raceWindow && !raceWindow.isDestroyed()) return raceWindow.focus();

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

    // The logic here was already correct, but standardized to use loadAppFile
    loadAppFile(raceWindow, "index.html");

    raceWindow.on("closed", () => {
        raceWindow = null;
        if (!loginWindow && !homeWindow && !adminWindow) app.quit();
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
// Biller login opens home.html
ipcMain.on("open-home-window", () => {
    createHomeWindow();
    if (loginWindow) loginWindow.close();
});

// Admin login opens admin.html
ipcMain.on("open-admin-window", () => {
    console.log("Opening admin panel...");
    createAdminWindow();
    if (loginWindow) loginWindow.close();
});

// Home window opens race (index.html) in a new window
ipcMain.on("open-race-window", () => {
    createRaceWindow();
    // Keep home window open and focus it (as per original logic)
    if (homeWindow) homeWindow.focus(); 
});

ipcMain.on("close-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

// ---------------------------------------------------------------
// READ DATA
// ---------------------------------------------------------------
ipcMain.handle("get-data", async (event, fileName) => {
    try {
        const file = fileName === "database.json" ? dbPath : reqPath;
        return fs.readFileSync(file, "utf8");
    } catch (err) {
        console.error(`Error reading ${fileName}:`, err);
        return "[]";
    }
});

// ---------------------------------------------------------------
// UPLOAD DOCUMENTS
// ---------------------------------------------------------------
ipcMain.handle("upload-document", async () => {
    // Prioritize the active window for the dialog
    const active = BrowserWindow.getFocusedWindow() || raceWindow || homeWindow || loginWindow;

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

// ---------------------------------------------------------------
// FILE LIST / RENAME / DELETE
// ---------------------------------------------------------------
ipcMain.handle("list-files", () => {
    if (!fs.existsSync(docsDir)) return [];
    return fs.readdirSync(docsDir).map(name => ({
        name,
        time: fs.statSync(path.join(docsDir, name)).mtime.getTime()
    }));
});

ipcMain.handle("rename-file", (event, oldName, newName) => {
    const oldP = path.join(docsDir, oldName);
    const newP = path.join(docsDir, newName);
    if (!fs.existsSync(oldP)) return false;
    fs.renameSync(oldP, newP);
    return true;
});

ipcMain.handle("delete-file", (event, name) => {
    const p = path.join(docsDir, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
});

// ---------------------------------------------------------------
// OPEN FILE
// ---------------------------------------------------------------
ipcMain.on("open-file", (event, name) => {
    const p = path.join(docsDir, name);
    if (fs.existsSync(p)) shell.openPath(p);
});

// ---------------------------------------------------------------
// EXPORT / IMPORT
// ---------------------------------------------------------------
ipcMain.handle("export-data", async (event, fileName, content) => {
    const active = BrowserWindow.getFocusedWindow() || raceWindow || homeWindow || loginWindow;

    const { filePath } = await dialog.showSaveDialog(active, {
        defaultPath: path.join(app.getPath("downloads"), fileName)
    });

    if (filePath) fs.writeFileSync(filePath, content);
    return true;
});

ipcMain.handle("import-data", async (event, fileName) => {
    const active = BrowserWindow.getFocusedWindow() || raceWindow || homeWindow || loginWindow;

    const { canceled, filePaths } = await dialog.showOpenDialog(active, {
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (canceled) return null;

    const src = filePaths[0];
    const dest = fileName === "database.json" ? dbPath : reqPath;
    const content = fs.readFileSync(src, "utf8");

    try {
        JSON.parse(content); // validation
    } catch (e) {
        console.error("Import data is invalid JSON:", e);
        throw new Error("Invalid JSON structure in imported file.");
    }

    fs.copyFileSync(src, dest);
    return content;
});
