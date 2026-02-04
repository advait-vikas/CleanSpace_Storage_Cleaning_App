// preload.js - Electron Preload Script

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // File scanning
  scanDirectory: (dir, options) => ipcRenderer.invoke('scan-directory', dir, options),
  scanDirectoryWithProgress: (dir, options) => ipcRenderer.invoke('scan-directory-with-progress', dir, options),
  cancelScan: (scannerId) => ipcRenderer.invoke('cancel-scan', scannerId),

  // File analysis
  findLargeFiles: (files, threshold) => ipcRenderer.invoke('find-large-files', files, threshold),
  findDuplicateFiles: (files) => ipcRenderer.invoke('find-duplicate-files', files),
  findOldFiles: (files, monthsOld) => ipcRenderer.invoke('find-old-files', files, monthsOld),
  confirmDuplicatesWithHash: (duplicateGroups) => ipcRenderer.invoke('confirm-duplicates-with-hash', duplicateGroups),
  analyzeFiles: (files) => ipcRenderer.invoke('analyze-files', files),

  // Hashing
  hashFile: (filePath) => ipcRenderer.invoke('hash-file', filePath),

  // Applications
  getInstalledApplications: () => ipcRenderer.invoke('get-installed-applications'),
  getAppSizes: (apps) => ipcRenderer.invoke('get-app-sizes', apps),
  uninstallApplication: (app) => ipcRenderer.invoke('uninstall-application', app),

  // Recommendations
  generateRecommendations: (files, applications) => ipcRenderer.invoke('generate-recommendations', files, applications),

  // File deletion
  calculateDeletionSize: (filePaths) => ipcRenderer.invoke('calculate-deletion-size', filePaths),
  moveToRecycleBin: (filePaths) => ipcRenderer.invoke('move-to-recycle-bin', filePaths),
  permanentlyDeleteFiles: (filePaths) => ipcRenderer.invoke('permanently-delete-files', filePaths),
  validateDeletion: (filePaths) => ipcRenderer.invoke('validate-deletion', filePaths),

  // Event listeners for progress updates
  onScanProgress: (callback) => {
    ipcRenderer.on('scan-progress', (event, data) => callback(data));
  },
  onScanComplete: (callback) => {
    ipcRenderer.on('scan-complete', (event, data) => callback(data));
  },
  removeScanProgressListener: () => {
    ipcRenderer.removeAllListeners('scan-progress');
  },
  removeScanCompleteListener: () => {
    ipcRenderer.removeAllListeners('scan-complete');
  }
});
