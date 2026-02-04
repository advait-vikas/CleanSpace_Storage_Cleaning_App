// src/appScanner.cjs - Application Scanner for Windows, macOS, and Linux
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { getDirectorySize } = require('./utils/fileSystem.cjs');

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
        console.log(`Scanning registry: ${regPath}`);
        const { stdout } = await execPromise(
          `reg query "${regPath}" /s`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );

        const appData = parseWindowsRegistry(stdout);
        console.log(`Found ${appData.length} apps in ${regPath}`);
        apps.push(...appData);
      } catch (error) {
        // Some registry paths might not exist or be accessible
        console.log(`Failed to scan ${regPath}: ${error.message}`);
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



    // Scan Windows Store Apps (Appx)
    try {
      const storeApps = await getWindowsStoreApps();
      apps.push(...storeApps);
      console.log(`Found ${storeApps.length} Store apps`);
    } catch (e) {
      console.error('Error scanning Store apps:', e);
    }

    console.log(`Total apps found before deduplication: ${apps.length}`);

    // Deduplicate and merge information
    const uniqueApps = deduplicateApps(apps);
    console.log(`Unique apps after deduplication: ${uniqueApps.length}`);

    return uniqueApps;

  } catch (error) {
    console.error('Error scanning Windows applications:', error);
    return [];
  }
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
    if (!line) continue;

    // New registry key
    if (line.startsWith('HKEY_')) {
      if (currentApp && currentApp.name && !isSystemComponent(currentApp)) {
        // Normalize path
        if (currentApp.path) {
          currentApp.path = currentApp.path.replace(/"/g, '').trim();
          if (currentApp.path.endsWith('\\') || currentApp.path.endsWith('/')) {
            currentApp.path = currentApp.path.slice(0, -1);
          }
        }

        if (currentApp.path && fs.existsSync(currentApp.path)) {
          try {
            const stats = fs.statSync(currentApp.path);
            currentApp.lastUsed = stats.atime;
            currentApp.usage = determineUsage(stats.atime, currentApp.name);
          } catch (e) { }
        }
        currentApp.icon = getAppEmoji(currentApp.name);
        // console.log(`Found app: ${currentApp.name}`);
        apps.push(currentApp);
      }
      currentApp = {
        id: '',
        name: '',
        publisher: 'Unknown Publisher',
        size: 0,
        installDate: null,
        lastUsed: null,
        path: '',
        usage: 'never',
        icon: '',
        uninstallString: ''
      };
    } else if (currentApp && (line.includes('REG_SZ') || line.includes('REG_DWORD'))) {
      // Parse registry values
      const parts = line.split(/\s{2,}/);
      if (parts.length >= 3) {
        const key = parts[0].trim();
        const value = parts[2].trim();

        if (key === 'DisplayName') {
          currentApp.name = value;
        } else if (key === 'Publisher') {
          currentApp.publisher = value;
        } else if (key === 'InstallLocation' && value) {
          currentApp.path = value.replace(/"/g, '').trim();
        } else if (key === 'UninstallString' && value) {
          currentApp.uninstallString = value;
          // Try to extract directory from uninstall string if path not already set
          if (!currentApp.path) {
            let cleanPath = value.replace(/"/g, '').trim();
            if (cleanPath.toLowerCase().includes('uninstall')) {
              currentApp.path = path.dirname(cleanPath);
            }
          }
        } else if (key === 'DisplayIcon' && !currentApp.path && value) {
          let cleanPath = value.replace(/"/g, '').split(',')[0].trim();
          currentApp.path = path.dirname(cleanPath);
        } else if (key === 'InstallDate' && value.length === 8) {
          // Format: YYYYMMDD
          const year = value.substring(0, 4);
          const month = value.substring(4, 6);
          const day = value.substring(6, 8);
          currentApp.installDate = new Date(`${year}-${month}-${day}`);
        } else if (key === 'EstimatedSize') {
          // Size in KB, often in hex like 0x00001900
          const sizeVal = value.startsWith('0x') ? parseInt(value, 16) : parseInt(value, 10);
          currentApp.size = (sizeVal || 0) * 1024;
        } else if (key === 'SystemComponent' && value === '0x1') {
          currentApp.isSystemComponent = true;
        }
      }
    }
  }

  if (currentApp && currentApp.name && !isSystemComponent(currentApp)) {
    // Normalize path
    if (currentApp.path) {
      currentApp.path = currentApp.path.replace(/"/g, '').trim();
      if (currentApp.path.endsWith('\\') || currentApp.path.endsWith('/')) {
        currentApp.path = currentApp.path.slice(0, -1);
      }
    }

    // Try to get last used from path if available
    if (currentApp.path && fs.existsSync(currentApp.path)) {
      try {
        const stats = fs.statSync(currentApp.path);
        currentApp.lastUsed = stats.atime;
        currentApp.usage = determineUsage(stats.atime, currentApp.name);
      } catch (e) { }
    }
    currentApp.icon = getAppEmoji(currentApp.name);
    apps.push(currentApp);
  }

  return apps.filter(app => app.name && app.name.length > 0);
}

function isSystemComponent(app) {
  if (app.isSystemComponent) return true;
  const name = app.name.toLowerCase();

  // Specific exclusions for system background apps and frameworks
  const exclusions = [
    'windows driver', 'redistributable',
    'microsoft.ui.xaml', 'microsoft.vclibs', 'microsoft.net.native',
    'microsoft.windowsappruntime', 'microsoft.services.store.engagement',
    'windows.printdialog', 'microsoft.windows.search', 'microsoft.windows.shellexperiencehost',
    'microsoft.windows.startmenuexperiencehost', 'microsoft.bioenrollment', 'microsoft.aad.brokerplugin',
    'microsoft.accountscontrol', 'microsoft.asynctextservice', 'microsoft.creddialoghost',
    'microsoft.ecapp', 'microsoft.lockapp', 'microsoft.win32webviewhost',
    'microsoft.windows.contentdeliverymanager', 'microsoft.windows.oobenetwork',
    'microsoft.windows.sechealthui', 'microsoft.windows.cloudexperiencehost',
    'microsoft.windows.parentalcontrols', 'microsoft.windows.peopleexperiencehost',
    'microsoft.gethelp', 'microsoft.windows.photos', 'microsoft.xboxgameoverlay',
    'microsoft.windows.filepicker', 'microsoft.windows.callingfileshellapp',
    'microsoft.languageexperiencepack', 'microsoft.lexicon', 'microsoft.inputapp',
    'microsoft.windows.client.cbs', 'microsoft.windows.client.oobe', 'microsoft.windows.client.coreai',
    'microsoft.windows.client.webexperience', 'microsoft.windows.crossdevice',
    'microsoft.windows.oobenetworkcaptiveportal', 'microsoft.windows.oobenetworkconnectionflow',
    'microsoft.windows.shell.omni', 'microsoft.windows.startexperiencesapp',
    'microsoft.windows.systemtray', 'microsoft.windows.templates', 'microsoft.windows.xwizard',
    'microsoft.windows.camera', 'microsoft.windows.calculator', 'microsoft.windows.alarms',
    'microsoft.windows.maps', 'microsoft.windows.soundrecorder', // 'microsoft.windows.store', // Keep Store, useful
    'microsoft.xbox.tcui', 'microsoft.xboxgamingoverlay', 'microsoft.xboxspeechtowho',
    'microsoft.yourphone', 'microsoft.zunevideo', 'microsoft.zunemusic',
    'microsoft.getstarted', 'microsoft.heifimageextension', 'microsoft.vp9videoextensions',
    'microsoft.webmediaextensions', 'microsoft.webpimageextension', 'microsoft.av1videoextension',
    'microsoft.rawimageextension', 'microsoft.hevcvideoextensions', 'microsoft.mpeg2videoextension',
    'appup.intelgraphicsexperience', 'appup.inteloptanememoryandstoragemanagement',
    'windows.immersivecontrolpanel', 'clipchamp.clipchamp', 'cortana', 'quickassist',
    'windows.contactsupport', 'windows.print3d', 'xboxgamecallableui', 'xboxidentityprovider',
    'xboxspeechtowho', 'xbox.tcui', 'yourphone', 'zunevideo', 'zunemusic',
    'windowsalarms', 'windowscalculator', 'windowscamera', 'windowsmaps', 'windowsphone',
    'windowssoundrecorder', 'windowsstore', 'xboxapp', 'xboxgameoverlay'
  ];

  return exclusions.some(ex => name.includes(ex));
}

function getAppEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('chrome') || n.includes('browser') || n.includes('edge') || n.includes('firefox')) return '🌐';
  if (n.includes('code') || n.includes('studio') || n.includes('sublime')) return '💻';
  if (n.includes('game') || n.includes('steam') || n.includes('play')) return '🎮';
  if (n.includes('music') || n.includes('spotify') || n.includes('itunes')) return '🎵';
  if (n.includes('video') || n.includes('vlc') || n.includes('player')) return '🎬';
  if (n.includes('adobe') || n.includes('photo') || n.includes('design')) return '🎨';
  if (n.includes('office') || n.includes('word') || n.includes('excel')) return '📄';
  if (n.includes('slack') || n.includes('discord') || n.includes('teams')) return '💬';
  return '📦';
}

/**
 * Scan Windows Store Applications via PowerShell
 */
async function getWindowsStoreApps() {
  const apps = [];
  try {
    // Use -NoProfile and -NonInteractive to bypass profile issues
    const { stdout } = await execPromise(
      `powershell -NoProfile -NonInteractive -Command "Get-AppxPackage | Select-Object Name, PackageFullName, InstallLocation, Publisher, Version | ConvertTo-Json"`,
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );

    if (!stdout.trim()) return [];

    let data;
    try {
      data = JSON.parse(stdout);
    } catch (e) {
      // Sometimes it returns a single object instead of array if only 1 match
      console.error('Failed to parse Store Apps JSON', e);
      return [];
    }

    const list = Array.isArray(data) ? data : [data];

    for (const item of list) {
      if (!item.Name) continue;

      const installPath = item.InstallLocation;
      let stats = null;
      if (installPath && fs.existsSync(installPath)) {
        try { stats = fs.statSync(installPath); } catch (e) { }
      }

      // Clean up name
      let friendlyName = item.Name;
      // Remove weird prefixes if present
      if (friendlyName.startsWith('Microsoft.')) friendlyName = friendlyName.replace('Microsoft.', '');
      if (friendlyName.includes('.')) {
        // Heuristic: If it looks like com.company.app, try to get last part, but some are just simple names
        // Most Store apps have reasonably readable names in 'Name' field compared to PackageFullName
      }

      const app = {
        id: `store_${item.PackageFullName}`,
        name: friendlyName,
        publisher: item.Publisher ? item.Publisher.split(',')[0].replace('CN=', '') : 'Microsoft Store',
        size: 0, // Will be calculated if path exists
        installDate: stats ? stats.birthtime : null,
        lastUsed: stats ? stats.atime : null,
        path: installPath,
        usage: stats ? determineUsage(stats.atime, friendlyName) : refineUsage('never', friendlyName),
        icon: getAppEmoji(friendlyName),
        isSystemComponent: false // We filter later
      };

      if (!isSystemComponent(app)) {
        apps.push(app);
      }
    }
  } catch (error) {
    console.error('PowerShell Store App scan failed:', error);
  }
  return apps;
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
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          const stats = fs.statSync(fullPath);

          apps.push({
            id: `folder_${entry.name}`,
            name: entry.name,
            publisher: 'Unknown',
            size: 0,
            installDate: stats.birthtime || stats.mtime,
            lastUsed: stats.atime,
            path: fullPath,
            usage: determineUsage(stats.atime, entry.name),
            icon: getAppEmoji(entry.name)
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
        const stats = fs.statSync(fullPath);

        apps.push({
          id: `mac_${entry.name}`,
          name: entry.name.replace('.app', ''),
          publisher: 'Unknown',
          size: 0,
          installDate: stats.birthtime,
          lastUsed: stats.atime,
          path: fullPath,
          usage: determineUsage(stats.atime, entry.name),
          icon: getAppEmoji(entry.name)
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
            usage: 'never',
            icon: getAppEmoji(name)
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
// This function is now imported from fileSystem.cjs

/**
 * Determine usage frequency based on last access time
 */
function determineUsage(lastAccessDate, appName) {
  let usage = 'never';
  if (lastAccessDate) {
    const daysSinceAccess = (Date.now() - lastAccessDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceAccess < 7) usage = 'frequent';
    else if (daysSinceAccess < 30) usage = 'occasional';
    else if (daysSinceAccess < 90) usage = 'rare';
    else usage = 'never';
  }

  // Refine usage based on app popularity if filesystem stats are misleading (e.g. atime disabled)
  if (appName) {
    return refineUsage(usage, appName);
  }
  return usage;
}

/**
 * Refines usage status for known popular apps that are likely frequent
 * forcing them out of "Never" or "Rare" lists if stats are missing.
 */
function refineUsage(currentUsage, appName) {
  if (currentUsage === 'frequent' || currentUsage === 'occasional') return currentUsage;

  const n = appName.toLowerCase();

  const popularApps = [
    'chrome', 'firefox', 'edge', 'brave', 'opera',
    'discord', 'slack', 'teams', 'zoom', 'whatsapp', 'telegram',
    'spotify', 'itunes', 'vlc', 'netflix',
    'visual studio', 'vscode', 'sublime', 'notepad++',
    'outlook', 'word', 'excel', 'powerpoint', 'onenote',
    'steam', 'epic games', 'battle.net'
  ];

  if (popularApps.some(app => n.includes(app))) {
    return 'frequent'; // Mark as frequent to avoid "Never/Rare" lists
  }

  return currentUsage;
}

/**
 * Remove duplicate applications
 */
function deduplicateApps(apps) {
  const pathMap = new Map(); // key: name|path
  const nameMap = new Map(); // key: name

  for (const app of apps) {
    if (!app.name) continue;

    const name = app.name.toLowerCase().trim();
    // Normalize path for comparison
    let cleanPath = (app.path || '').replace(/"/g, '').trim();
    if (cleanPath) {
      cleanPath = path.normalize(cleanPath).toLowerCase().replace(/\\+$/, '');
    }

    const pathKey = cleanPath ? `${name}|${cleanPath}` : null;
    let existing = null;

    if (pathKey && pathMap.has(pathKey)) {
      existing = pathMap.get(pathKey);
    } else if (nameMap.has(name)) {
      const candidate = nameMap.get(name);
      // Only merge if paths don't conflict
      if (!candidate.path || !app.path || candidate.path === app.path) {
        existing = candidate;
      }
    }

    if (existing) {
      // Merge properties - keep the better value
      if (!existing.publisher || existing.publisher === 'Unknown' || existing.publisher === 'Unknown Publisher') {
        existing.publisher = app.publisher;
      }

      if (!existing.size || existing.size === 0) {
        existing.size = app.size;
      }

      if (!existing.path && app.path) {
        existing.path = app.path;
      }

      if (!existing.installDate) {
        existing.installDate = app.installDate;
      }

      if (!existing.lastUsed || (app.lastUsed && app.lastUsed > existing.lastUsed)) {
        existing.lastUsed = app.lastUsed;
      }

      if (existing.lastUsed) {
        existing.usage = determineUsage(existing.lastUsed, existing.name);
      } else if (existing.usage === 'never' && app.usage !== 'never') {
        existing.usage = app.usage;
      }

      // Safety check: if known popular app, ensure it's not marked as never/rare after merge
      existing.usage = refineUsage(existing.usage, existing.name);

      if (!existing.icon && app.icon) {
        existing.icon = app.icon;
      }
    } else {
      const newApp = { ...app };
      if (pathKey) pathMap.set(pathKey, newApp);

      if (nameMap.has(name)) {
        // Collision but rejected merge -> likely different path version
        newApp.name = `${newApp.name} (${cleanPath || 'Unknown'})`;
        nameMap.set(newApp.name.toLowerCase(), newApp);
      } else {
        nameMap.set(name, newApp);
      }
    }
  }

  return Array.from(nameMap.values()).map(app => {
    if (!app.id) {
      app.id = `app_${Math.random().toString(36).substr(2, 9)}`;
    }
    return app;
  });
}

module.exports = {
  getInstalledApplications,
  getDirectorySize
};
