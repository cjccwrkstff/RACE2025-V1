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
let adminWindow;   // ✅ FIX: Added missing adminWindow

// ---------------------------------------------------------------
// CRITICAL FILE PATHS
// ---------------------------------------------------------------
const appDataPath = app.getPath("userData");
const dbPath = path.join(appDataPath, "database.json");
const reqPath = path.join(appDataPath, "requirements.json");  // ✅ FIX: Missing reqPath added
const docsDir = path.join(appDataPath, "uploads");

// ---------------------------------------------------------------
// INITIALIZE APP DATA
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
// LOGIN WINDOW  (FIRST TO OPEN)
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
