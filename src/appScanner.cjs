// src/appScanner.cjs - Application Scanner for Windows, macOS, and Linux
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Get installed applications for the current platform
 */
async function getInstalledApplications() {
  const platform = process.platform;

  switch (platform) {
    case 'win32':
      return await getWindowsApplications();
    case 'darwin':
      return await getMacApplications();
    case 'linux':
      return await getLinuxApplications();
    default:
      return [];
  }
}

/**
 * Windows: Read from registry and Program Files
 */
async function getWindowsApplications() {
  const apps = [];

  try {
    // Query Windows Registry for installed applications
    const registryPaths = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ];

    for (const regPath of registryPaths) {
      try {
        const { stdout } = await execPromise(
          `reg query "${regPath}" /s`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        const appData = parseWindowsRegistry(stdout);
        apps.push(...appData);
      } catch (error) {
        // Some registry paths might not exist or be accessible
        continue;
      }
    }

    // Also scan Program Files directories
    const programFilesPaths = [
      'C:\\Program Files',
      'C:\\Program Files (x86)'
    ];

    for (const programPath of programFilesPaths) {
      if (fs.existsSync(programPath)) {
        const folderApps = await scanProgramFilesDirectory(programPath);
        apps.push(...folderApps);
      }
    }

  } catch (error) {
    console.error('Error scanning Windows applications:', error);
  }

  // Remove duplicates based on name and path
  return deduplicateApps(apps);
}

/**
 * Parse Windows Registry output
 */
function parseWindowsRegistry(output) {
  const apps = [];
  const lines = output.split('\n');
  let currentApp = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // New registry key
    if (line.startsWith('HKEY_')) {
      if (currentApp && currentApp.name) {
        apps.push(currentApp);
      }
      currentApp = {
        id: '',
        name: '',
        publisher: '',
        size: 0,
        installDate: null,
        lastUsed: null,
        path: '',
        usage: 'never'
      };
    } else if (currentApp && line.includes('REG_SZ') || line.includes('REG_DWORD')) {
      // Parse registry values
      const parts = line.split(/\s{2,}/);
      if (parts.length >= 3) {
        const key = parts[0].trim();
        const value = parts[2].trim();

        if (key === 'DisplayName') {
          currentApp.name = value;
        } else if (key === 'Publisher') {
          currentApp.publisher = value;
        } else if (key === 'InstallLocation') {
          currentApp.path = value;
        } else if (key === 'InstallDate' && value.length === 8) {
          // Format: YYYYMMDD
          const year = value.substring(0, 4);
          const month = value.substring(4, 6);
          const day = value.substring(6, 8);
          currentApp.installDate = new Date(`${year}-${month}-${day}`);
        } else if (key === 'EstimatedSize') {
          // Size in KB
          currentApp.size = parseInt(value, 10) * 1024;
        }
      }
    }
  }

  if (currentApp && currentApp.name) {
    apps.push(currentApp);
  }

  return apps.filter(app => app.name && app.name.length > 0);
}

/**
 * Scan Program Files directory for applications
 */
/**
 * Scan Program Files directory for applications
 */
async function scanProgramFilesDirectory(dirPath) {
  const apps = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          // calculating directory size recursively is too slow for startup
          // const size = await getDirectorySize(fullPath); 
          const size = 0; // Default to 0 for performance

          apps.push({
            id: `folder_${entry.name}`,
            name: entry.name,
            publisher: 'Unknown',
            size: size,
            installDate: null,
            lastUsed: null,
            path: fullPath,
            usage: 'never'
          });
        } catch (error) {
          // Skip inaccessible directories
        }
      }
    }
  } catch (error) {
    console.error('Error scanning Program Files:', error);
  }

  return apps;
}

/**
 * macOS: Scan /Applications directory
 */
async function getMacApplications() {
  const apps = [];
  const appDir = '/Applications';

  try {
    if (!fs.existsSync(appDir)) {
      return apps;
    }

    const entries = fs.readdirSync(appDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.endsWith('.app')) {
        const fullPath = path.join(appDir, entry.name);
        const size = await getDirectorySize(fullPath);
        const stats = fs.statSync(fullPath);

        apps.push({
          id: `mac_${entry.name}`,
          name: entry.name.replace('.app', ''),
          publisher: 'Unknown',
          size: size,
          installDate: stats.birthtime,
          lastUsed: stats.atime,
          path: fullPath,
          usage: determineUsage(stats.atime)
        });
      }
    }
  } catch (error) {
    console.error('Error scanning macOS applications:', error);
  }

  return apps;
}

/**
 * Linux: Scan standard installation paths
 */
async function getLinuxApplications() {
  const apps = [];
  const appPaths = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    path.join(process.env.HOME || '', '.local/share/applications')
  ];

  try {
    for (const appPath of appPaths) {
      if (!fs.existsSync(appPath)) continue;

      const entries = fs.readdirSync(appPath);

      for (const entry of entries) {
        if (entry.endsWith('.desktop')) {
          const fullPath = path.join(appPath, entry);
          const content = fs.readFileSync(fullPath, 'utf8');

          const nameMatch = content.match(/^Name=(.*)$/m);
          const name = nameMatch ? nameMatch[1] : entry.replace('.desktop', '');

          apps.push({
            id: `linux_${entry}`,
            name: name,
            publisher: 'Unknown',
            size: 0, // Difficult to determine on Linux
            installDate: null,
            lastUsed: null,
            path: fullPath,
            usage: 'never'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning Linux applications:', error);
  }

  return apps;
}

/**
 * Calculate directory size recursively
 */
async function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      try {
        if (entry.isDirectory()) {
          totalSize += await getDirectorySize(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          totalSize += stats.size;
        }
      } catch (error) {
        // Skip inaccessible files/folders
      }
    }
  } catch (error) {
    // Return size accumulated so far
  }

  return totalSize;
}

/**
 * Determine usage frequency based on last access time
 */
function determineUsage(lastAccessDate) {
  if (!lastAccessDate) return 'never';

  const daysSinceAccess = (Date.now() - lastAccessDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceAccess < 7) return 'frequent';
  if (daysSinceAccess < 30) return 'occasional';
  if (daysSinceAccess < 90) return 'rare';
  return 'never';
}

/**
 * Remove duplicate applications
 */
function deduplicateApps(apps) {
  const seen = new Map();
  const unique = [];

  for (const app of apps) {
    const key = `${app.name.toLowerCase()}_${app.path}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      app.id = app.id || `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      unique.push(app);
    }
  }

  return unique;
}

module.exports = {
  getInstalledApplications,
  getDirectorySize
};
