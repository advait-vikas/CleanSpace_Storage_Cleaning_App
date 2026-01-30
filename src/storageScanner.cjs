// src/storageScanner.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXCLUDE_DIRS = [
  'node_modules', 'Windows', 'Program Files', 'Program Files (x86)',
  '$Recycle.Bin', 'System Volume Information', 'ProgramData',
  'Recovery', 'hiberfil.sys', 'pagefile.sys', 'swapfile.sys',
  '.git', 'AppData/Local/Temp'
];

const CATEGORIES = {
  Documents: ['.doc', '.docx', '.pdf', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'],
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'],
  Audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  Archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  Code: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.html', '.css']
};

function shouldExclude(dir) {
  return EXCLUDE_DIRS.some(ex => dir.includes(ex));
}

function getCategory(ext) {
  for (const [cat, exts] of Object.entries(CATEGORIES)) {
    if (exts.includes(ext)) return cat;
  }
  return 'Other';
}

function scanDirectoryAggregated(dir, options = {}) {
  // Aggregated Stats
  const categoryStats = {};
  for (const cat of Object.keys(CATEGORIES)) categoryStats[cat] = { size: 0, count: 0 };
  categoryStats['Other'] = { size: 0, count: 0 };

  // Top Lists
  const largeFiles = []; // Keep top 100
  const oldFiles = [];   // Keep top 100
  const potentialDuplicates = {}; // Map size -> [files]

  // Specific Cleanup Candidates
  const tempFiles = [];
  const cacheFiles = [];
  const oldDownloads = [];

  let fileCount = 0;
  let totalSize = 0;
  const { progressCallback, maxFiles = Infinity } = options;
  const startTime = Date.now();
  let lastProgressTime = 0;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Definitions for detection
  const tempExtensions = ['.tmp', '.temp', '.bak', '.old', '.log', '.chk'];
  const tempDirs = ['temp', 'tmp', 'temporary'];
  const cachePatterns = ['cache', '.cache'];
  // We need to know where the Downloads folder is roughly, or check path string
  // checking path string for "Downloads" is a heuristic

  function addItemSorted(list, item, limit) {
    list.push(item);
    list.sort((a, b) => b.size - a.size);
    if (list.length > limit) list.pop();
  }

  function walk(currentPath) {
    if (shouldExclude(currentPath)) return;

    // Time-based throttling for progress (every 500ms)
    const now = Date.now();
    if (progressCallback && (now - lastProgressTime > 500)) {
      progressCallback({
        currentPath,
        filesScanned: fileCount,
        progress: 0 // Indeterminate progress for DFS
      });
      lastProgressTime = now;
    }

    if (fileCount >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (fileCount >= maxFiles) break;

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          const stats = fs.statSync(fullPath);
          const size = stats.size;
          const ext = path.extname(entry.name).toLowerCase();
          const category = getCategory(ext);
          const lowerPath = fullPath.toLowerCase();

          fileCount++;
          totalSize += size;

          // Update Category Stats
          if (!categoryStats[category]) categoryStats[category] = { size: 0, count: 0 };
          categoryStats[category].size += size;
          categoryStats[category].count++;

          const fileItem = {
            id: `file_${fileCount}`, // Simple ID
            name: entry.name,
            path: fullPath,
            size: size,
            type: ext,
            category: category,
            lastAccessed: stats.atime,
            lastModified: stats.mtime
          };

          // 1. Check Large Files (>100MB)
          if (size > 100 * 1024 * 1024) {
            addItemSorted(largeFiles, fileItem, 100);
          }

          // 2. Check Old Files (>6 months and >10MB)
          if (size > 10 * 1024 * 1024 && stats.atime < sixMonthsAgo) {
            addItemSorted(oldFiles, fileItem, 100);
          }

          // 3. Check Potential Duplicates (>1MB)
          if (size > 1 * 1024 * 1024) {
            const key = `${size}`; // Group by size first for speed
            if (!potentialDuplicates[key]) potentialDuplicates[key] = [];
            potentialDuplicates[key].push({ path: fullPath, name: entry.name, size, id: fileItem.id });

            // Limit duplicate candidates per size to avoid memory explosion on massive folders of identical size files
            if (potentialDuplicates[key].length > 20) potentialDuplicates[key].shift();
          }

          // 4. Check Temp Files
          const isTempExt = tempExtensions.includes(ext);
          const isTempDir = tempDirs.some(d => lowerPath.includes(`${path.sep}${d}${path.sep}`));
          if (isTempExt || isTempDir) {
            addItemSorted(tempFiles, fileItem, 100);
          }

          // 5. Check Cache Files
          if (cachePatterns.some(p => lowerPath.includes(p))) {
            addItemSorted(cacheFiles, fileItem, 100);
          }

          // 6. Check Old Downloads (>3 months)
          if (lowerPath.includes('downloads') && stats.mtime < threeMonthsAgo) {
            addItemSorted(oldDownloads, fileItem, 100);
          }

        } catch { }
      }
    }
  }

  walk(dir);

  // Process duplicates: Filter groups with < 2 files
  const realDuplicateCandidates = [];
  for (const key in potentialDuplicates) {
    if (potentialDuplicates[key].length > 1) {
      // Only if names match too? Or just size? 
      // Combining size+name check here to be safer/smarter
      const nameMap = {};
      for (const f of potentialDuplicates[key]) {
        const k = f.name;
        if (!nameMap[k]) nameMap[k] = [];
        nameMap[k].push(f);
      }

      for (const nameKey in nameMap) {
        if (nameMap[nameKey].length > 1) {
          realDuplicateCandidates.push(nameMap[nameKey]);
        }
      }
    }
  }

  // Final progress update
  if (progressCallback) {
    progressCallback({
      currentPath: dir,
      filesScanned: fileCount,
      progress: 100
    });
  }

  // Flatten duplicate candidates into FileItems with duplicate props
  // We re-construct full items only for these candidates if needed, but we essentially have lightweight items
  // Let's format the return

  return {
    stats: {
      totalSize,
      fileCount,
      categoryStats: Object.entries(categoryStats).map(([name, s]) => ({
        name,
        size: s.size,
        count: s.count
      }))
    },
    largeFiles,
    oldFiles,
    tempFiles,
    cacheFiles,
    oldDownloads,
    duplicateCandidates: realDuplicateCandidates // Array of arrays of lightweight file objects
  };
}


function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// For backward compatibility / specific checks if needed
// But scanDirectoryAggregated replaces the need for separate findLarge/findOld
function findLargeFiles(files, threshold) { return files; }
function findDuplicateFiles(files) { return files; }
function findOldFiles(files) { return files; }

module.exports = {
  scanDirectory: scanDirectoryAggregated, // Main export uses new logic
  hashFile,
  findLargeFiles, // Keeping stubs to avoid breaking imports immediately, though main.cjs needs update
  findDuplicateFiles,
  findOldFiles,
  categorizeFiles: (files) => files // No-op, doing it in scan
};
