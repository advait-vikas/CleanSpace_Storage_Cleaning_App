// main.cjs - Electron Main Process

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const storageScanner = require('./src/storageScanner.cjs');
const appScanner = require('./src/appScanner.cjs');
const recommendationEngine = require('./src/recommendationEngine.cjs');
const fileDeletion = require('./src/fileDeletion.cjs');
const drivelist = require('drivelist');

// Store active scan workers
const activeScanWorkers = new Map();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  // In development, load Vite dev server; in production, load built files
  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, 'dist', 'index.html')}`;
  win.loadURL(startUrl);
}

ipcMain.handle('get-system-info', async () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    homedir: os.homedir(),
    hostname: os.hostname(),
    drives: await getDrives()
  };
});

// IPC: Scan directory for files
const { Worker } = require('worker_threads');
ipcMain.handle('scan-directory', async (event, dir, options) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'src', 'scanWorker.js'), {
      workerData: { dir, options }
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
});

// IPC: Find large files in a directory (using existing file list)
ipcMain.handle('find-large-files', async (event, files, threshold) => {
  if (!files || !Array.isArray(files)) return [];
  return storageScanner.findLargeFiles(files, threshold);
});

// IPC: Find duplicate files in a directory (using existing file list)
ipcMain.handle('find-duplicate-files', async (event, files) => {
  if (!files || !Array.isArray(files)) return [];
  return storageScanner.findDuplicateFiles(files);
});

// IPC: Hash a file (for duplicate confirmation)
ipcMain.handle('hash-file', async (event, filePath) => {
  return await storageScanner.hashFile(filePath);
});

// IPC: Scan directory with progress updates
ipcMain.handle('scan-directory-with-progress', async (event, dir, options = {}) => {
  const scannerId = Date.now().toString();

  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'src', 'scanWorker.cjs'), {
      workerData: { dir, options }
    });

    // Store terminate function for cancellation
    activeScanWorkers.set(scannerId, () => {
      worker.terminate();
    });

    worker.on('message', (message) => {
      if (message.type === 'progress') {
        event.sender.send('scan-progress', { scannerId, ...message.data });
      } else if (message.type === 'complete') {
        event.sender.send('scan-complete', { scannerId });
        activeScanWorkers.delete(scannerId);
        // message.data contains { stats, largeFiles, oldFiles, duplicateCandidates }
        resolve({ ...message.data, scannerId });
      } else if (message.type === 'error') {
        activeScanWorkers.delete(scannerId);
        reject(new Error(message.error));
      }
    });

    worker.on('error', (err) => {
      activeScanWorkers.delete(scannerId);
      reject(err);
    });

    worker.on('exit', (code) => {
      activeScanWorkers.delete(scannerId);
      if (code !== 0) {
        // If terminated by cancel, it's not an error but we don't resolve with files
        console.log(`Worker stopped with exit code ${code}`);
      }
    });
  });
});

// IPC: Cancel scan
ipcMain.handle('cancel-scan', async (event, scannerId) => {
  const cancelFn = activeScanWorkers.get(scannerId);
  if (cancelFn) {
    cancelFn();
    activeScanWorkers.delete(scannerId);
    return { success: true };
  }
  return { success: false };
});

// IPC: Get installed applications
ipcMain.handle('get-installed-applications', async () => {
  try {
    console.log('Fetching installed applications...');
    const apps = await appScanner.getInstalledApplications();
    console.log(`Found ${apps.length} applications.`);
    return apps;
  } catch (error) {
    console.error('Error getting applications:', error);
    return [];
  }
});

// IPC: Calculate sizes for specific app folders
ipcMain.handle('get-app-sizes', async (event, apps) => {
  const results = [];
  for (const app of apps) {
    if (app.path && !app.size) {
      try {
        const size = appScanner.getDirectorySize(app.path);
        results.push({ id: app.id, size });
      } catch (e) {
        results.push({ id: app.id, size: 0 });
      }
    }
  }
  return results;
});

// IPC: Uninstall application
ipcMain.handle('uninstall-application', async (event, app) => {
  if (!app.uninstallString) {
    return { success: false, error: 'No uninstall string available' };
  }

  const mainWindow = BrowserWindow.getAllWindows()[0];
  const response = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Uninstall'],
    defaultId: 1,
    title: 'Confirm Uninstallation',
    message: `Are you sure you want to uninstall ${app.name}?`,
    detail: 'This will launch the application\'s uninstaller.'
  });

  if (response.response === 1) {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(app.uninstallString, (error) => {
        if (error) {
          console.error('Uninstall error:', error);
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  return { success: false, cancelled: true };
});

// IPC: Analyze files and categorize them
ipcMain.handle('analyze-files', async (event, files) => {
  const categorized = storageScanner.categorizeFiles(files);
  const categories = recommendationEngine.analyzeStorageByCategory(categorized);
  return { files: categorized, categories };
});

// IPC: Find old files
ipcMain.handle('find-old-files', async (event, scanResult) => {
  return scanResult.oldFiles || [];
});

// IPC: Confirm duplicates with hash
ipcMain.handle('confirm-duplicates-with-hash', async (event, duplicateGroups) => {
  return await storageScanner.confirmDuplicatesWithHash(duplicateGroups);
});

// IPC: Generate cleanup recommendations
ipcMain.handle('generate-recommendations', async (event, files, applications) => {
  return recommendationEngine.generateRecommendations(files, applications);
});

// IPC: Calculate deletion size
ipcMain.handle('calculate-deletion-size', async (event, filePaths) => {
  return fileDeletion.calculateDeletionSize(filePaths);
});

// IPC: Move files to recycle bin
ipcMain.handle('move-to-recycle-bin', async (event, filePaths) => {
  // Show confirmation dialog
  const mainWindow = BrowserWindow.getAllWindows()[0];
  const sizeInfo = fileDeletion.calculateDeletionSize(filePaths);

  const response = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Move to Recycle Bin'],
    defaultId: 0,
    title: 'Confirm Deletion',
    message: `Move ${sizeInfo.fileCount} file(s) to Recycle Bin?`,
    detail: `Total size: ${formatBytes(sizeInfo.totalSize)}\n\nFiles will be moved to the Recycle Bin and can be restored.`
  });

  if (response.response === 1) {
    return await fileDeletion.moveToRecycleBin(filePaths);
  }

  return { success: false, cancelled: true };
});

// IPC: Permanently delete files (with extra confirmation)
ipcMain.handle('permanently-delete-files', async (event, filePaths) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  const sizeInfo = fileDeletion.calculateDeletionSize(filePaths);

  const response = await dialog.showMessageBox(mainWindow, {
    type: 'error',
    buttons: ['Cancel', 'Permanently Delete'],
    defaultId: 0,
    title: 'Confirm Permanent Deletion',
    message: `Permanently delete ${sizeInfo.fileCount} file(s)?`,
    detail: `Total size: ${formatBytes(sizeInfo.totalSize)}\n\nWARNING: This action cannot be undone! Files will be permanently deleted.`
  });

  if (response.response === 1) {
    return await fileDeletion.permanentlyDeleteFiles(filePaths);
  }

  return { success: false, cancelled: true };
});

// IPC: Validate files for deletion
ipcMain.handle('validate-deletion', async (event, filePaths) => {
  return fileDeletion.validateFilesForDeletion(filePaths);
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function getDrives() {
  const drives = await drivelist.list();

  // Flatten mountpoints to check
  const mountsToCheck = [];
  for (const drive of drives) {
    for (const mount of drive.mountpoints) {
      mountsToCheck.push({ drive, mount });
    }
  }

  // Check all mounts in parallel
  const driveStats = await Promise.all(mountsToCheck.map(async ({ drive, mount }) => {
    try {
      let totalSpace = null;
      let freeSpace = null;

      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        const deviceId = mount.path.replace(/\\+$/, '').slice(0, 2);

        await new Promise((resolve) => {
          exec(`wmic logicaldisk where "DeviceID='${deviceId}'" get Size,FreeSpace /format:csv`, { encoding: 'utf8' }, (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split('\n');
              if (lines.length > 1) {
                const parts = lines[lines.length - 1].split(',');
                if (parts.length >= 3) {
                  // Standard CSV output: Node,FreeSpace,Size
                  // parts[1] is FreeSpace, parts[2] is Size
                  freeSpace = parseInt(parts[1], 10);
                  totalSpace = parseInt(parts[2], 10);
                }
              }
            }
            resolve();
          });
        });
      } else {
        const { exec } = require('child_process');
        await new Promise((resolve) => {
          exec(`df -k "${mount.path}"`, { encoding: 'utf8' }, (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split('\n');
              if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                totalSpace = parseInt(parts[1], 10) * 1024;
                freeSpace = parseInt(parts[3], 10) * 1024;
              }
            }
            resolve();
          });
        });
      }

      return {
        id: mount.path,
        letter: mount.path,
        name: drive.description || mount.path,
        totalSpace,
        freeSpace,
        usedSpace: totalSpace !== null && freeSpace !== null ? totalSpace - freeSpace : null,
        fileSystem: drive.fileSystem || ''
      };
    } catch {
      return {
        id: mount.path,
        letter: mount.path,
        name: drive.description || mount.path,
        totalSpace: null,
        freeSpace: null,
        usedSpace: null,
        fileSystem: drive.fileSystem || ''
      };
    }
  }));

  return driveStats;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
