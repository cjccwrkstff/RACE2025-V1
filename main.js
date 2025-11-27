// ===============================================
// R.A.C.E 2025 main.js - CRITICAL SETUP
// ===============================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let loginWindow; // Will hold the initial Login Window (login.html)
let homeWindow; // Will hold the Home Window (home.html) after login
let raceWindow; // Will hold the main Rates and Codes Engine Window (index.html)

// --- CRITICAL PATH DEFINITIONS ---
const appDataPath = app.getPath('userData');
const dbPath = path.join(appDataPath, 'database.json');
const docsDir = path.join(appDataPath, 'uploads');

// --- APP DATA INITIALIZATION FUNCTION ---
function initializeAppData() {
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Helper function to find and copy a file
  const copyFileToAppData = (fileName, destPath) => {
    const possiblePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', fileName),
      path.join(__dirname, fileName) 
    ];
    
    const sourcePath = possiblePaths.find(p => fs.existsSync(p));

    if (sourcePath) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Initialized ${fileName} from ${sourcePath}`);
    } else {
      console.error(`CRITICAL: Could not find source ${fileName}!`);
      // Create empty file to prevent crash
      fs.writeFileSync(destPath, '[]'); 
    }
  };

  if (!fs.existsSync(dbPath)) copyFileToAppData('database.json', dbPath);
  if (!fs.existsSync(reqPath)) copyFileToAppData('requirements.json', reqPath);
}

/**
 * Creates the initial Login window.
 */
function createLoginWindow() {
  initializeAppData();

  loginWindow = new BrowserWindow({
    // Increased default size and set min size
    width: 800, 
    height: 600,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
    title: 'RACE 2025 - Login',
    frame: false,    // Keep the custom frame (no native window bar)
    resizable: true, // Allow resizing
  });

  loginWindow.loadURL(`file://${path.join(__dirname, 'login.html')}`);

  loginWindow.on('closed', () => { 
    loginWindow = null; 
    if (!homeWindow && !raceWindow) app.quit();
  });
}

/**
 * Creates the Home window. This window replaces the login window.
 */
function createHomeWindow() {
  if (homeWindow) {
    homeWindow.focus();
    return;
  }
  
  homeWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
    title: 'RACE 2025 - Home',
    resizable: true, 
  });

  homeWindow.loadURL(`file://${path.join(__dirname, 'home.html')}`);

  homeWindow.on('closed', () => { 
    homeWindow = null; 
    if (!loginWindow && !raceWindow) app.quit();
  });
}

/**
 * Creates the Race (Index) window in a new, separate window.
 */
function createRaceWindow() {
  if (raceWindow) {
    raceWindow.focus();
    return;
  }
  
  raceWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
    title: 'RACE 2025 - Case Rate Search',
  });

  // Pass data paths to the renderer via URL query parameters
  const startUrl = `file://${path.join(__dirname, 'index.html')}?db_path=${encodeURIComponent(dbPath)}&req_path=${encodeURIComponent(reqPath)}`;
  raceWindow.loadURL(startUrl);

  raceWindow.on('closed', () => { 
    raceWindow = null; 
    if (!loginWindow && !homeWindow) app.quit();
  });
}

// --- APP LIFECYCLE HANDLERS ---
app.on('ready', createLoginWindow); // Start with the Login Window

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLoginWindow();
  }
});


// ===============================================
// IPC MAIN HANDLERS
// ===============================================

// 1. OPEN HOME WINDOW HANDLER (Triggered by login.html after successful auth)
// ACTION: Close Login, Open Home
ipcMain.on("open-home-window", (event) => {
    console.log('IPC: Opening Home Window...');
    createHomeWindow();
    
    if (loginWindow) {
        loginWindow.close();
        loginWindow = null; 
    }
});

// 2. OPEN RACE WINDOW HANDLER (Triggered by home.html "Let's Race" button)
// ACTION: Open Race in NEW window, Keep Home Open
ipcMain.on("open-race-window", (event) => {
    console.log('IPC: Opening Race Window...');
    createRaceWindow();
    
    if (homeWindow) {
        homeWindow.focus(); 
    }
});

// 3. UNIVERSAL CLOSE WINDOW HANDLER
ipcMain.on("close-window", (event) => {
    console.log('IPC: Closing window...');
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.close();
});

// 4. READ DATA FROM DISK (Called by renderer processes)
ipcMain.handle('get-data', async (event, fileName) => {
  try {
    const dataPath = fileName === 'database.json' ? dbPath : reqPath;
    const data = fs.readFileSync(dataPath, 'utf-8');
    return data;
  } catch (error) {
    console.error(`Failed to read ${fileName}:`, error);
    return '[]';
  }
});

// --- IPC HANDLER FOR UPLOADING DOCUMENTS (ADMIN.HTML) ---
ipcMain.handle('upload-document', async (event) => {
  const targetWindow = raceWindow || homeWindow || loginWindow; 
  if (!targetWindow) return null;

  const file = await dialog.showOpenDialog(targetWindow, {
    title: 'Select document to upload',
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'] }
    ]
  });
  if (file.canceled) return null;

  const sourcePath = file.filePaths[0];
  const fileName = path.basename(sourcePath);
  const destPath = path.join(docsDir, fileName); // Copy to AppData/uploads
  fs.copyFileSync(sourcePath, destPath);
  return { name: fileName, time: fs.statSync(destPath).mtime.getTime() };
});

// List uploaded files
ipcMain.handle('list-files', () => {
  if (!fs.existsSync(docsDir)) return [];
  return fs.readdirSync(docsDir).map(f => ({
    name: f,
    time: fs.statSync(path.join(docsDir, f)).mtime.getTime()
  }));
});

// Rename file
ipcMain.handle('rename-file', (event, oldName, newName) => {
  const oldPath = path.join(docsDir, oldName);
  const newPath = path.join(docsDir, newName);
  
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    return true;
  }
  return false;
});

// Delete file
ipcMain.handle('delete-file', (event, fileName) => {
  const filePath = path.join(docsDir, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
});

// Open file in default system application
ipcMain.on('open-file', (event, fileName) => {
  const filePath = path.join(docsDir, fileName);
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
  }
});

// Export data (e.g., database.json)
ipcMain.handle('export-data', async (event, fileName, dataContent) => {
  const targetWindow = raceWindow || homeWindow || loginWindow; 
  if (!targetWindow) return null;

  const { filePath } = await dialog.showSaveDialog(targetWindow, {
    title: `Export ${fileName}`,
    defaultPath: path.join(app.getPath('downloads'), fileName),
    buttonLabel: 'Save',
    filters: [
        { name: 'JSON Files', extensions: ['json'] }
    ]
  });
  
  if (filePath) {
    fs.writeFileSync(filePath, dataContent);
    return true;
  }
  return false;
});

// Import/Update Data (e.g., database.json)
ipcMain.handle('import-data', async (event, fileName) => {
  const targetWindow = raceWindow || homeWindow || loginWindow; 
  if (!targetWindow) return null;

  const { canceled, filePaths } = await dialog.showOpenDialog(targetWindow, {
    title: `Select new ${fileName} file`,
    properties: ['openFile'],
    filters: [
      { name: 'JSON Data', extensions: ['json'] }
    ]
  });
  
  if (canceled || filePaths.length === 0) return null;

  const sourcePath = filePaths[0];
  const destPath = fileName === 'database.json' ? dbPath : reqPath;
  
  try {
    const content = fs.readFileSync(sourcePath, 'utf-8');
    JSON.parse(content); 
    
    fs.copyFileSync(sourcePath, destPath);
    
    return content;
  } catch (e) {
    dialog.showMessageBox(targetWindow, {
      type: 'error',
      title: 'Import Error',
      message: `Failed to import ${fileName}. The file may not be valid JSON.`
    });
    return null;
  }
});

