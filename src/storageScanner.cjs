// src/storageScanner.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDirectorySize } = require('./utils/fileSystem.cjs');

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
  const parts = dir.split(path.sep);
  return EXCLUDE_DIRS.some(ex => parts.includes(ex));
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

  // Expanded definitions for detection
  const tempExtensions = [
    '.tmp', '.temp', '.bak', '.old', '.log', '.chk', '.dmp',
    '.thumbs.db', '.thumb', '.ds_store', '.stackdump'
  ];
  const tempDirs = [
    'temp', 'tmp', 'temporary', 'cache', 'caches', 'logs',
    'npm-cache', 'yarn-cache', 'pip-cache'
  ];
  const junkPatterns = [
    'error.log', 'npm-debug.log', 'yarn-error.log',
    'ghostscript', 'crash-reports'
  ];

  function addItemSorted(list, item, limit) {
    list.push(item);
    list.sort((a, b) => b.size - a.size);
    if (list.length > limit) list.pop();
  }

  function startScan() {
    const stack = [dir];

    while (stack.length > 0 && fileCount < maxFiles) {
      const currentPath = stack.pop();
      if (shouldExclude(currentPath)) continue;

      // Time-based throttling for progress (every 500ms)
      const now = Date.now();
      if (progressCallback && (now - lastProgressTime > 500)) {
        let progress = 0;
        if (options.totalUsedSpace && options.totalUsedSpace > 0) {
          progress = Math.min(99, Math.round((totalSize / options.totalUsedSpace) * 100));
        }

        progressCallback({
          currentPath,
          filesScanned: fileCount,
          progress
        });
        lastProgressTime = now;
      }

      let entries;
      try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (fileCount >= maxFiles) break;

        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          stack.push(fullPath);
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
              id: `file_${fileCount}`,
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
              const key = `${size}`;
              if (!potentialDuplicates[key]) potentialDuplicates[key] = [];
              potentialDuplicates[key].push({ path: fullPath, name: entry.name, size, id: fileItem.id });

              if (potentialDuplicates[key].length > 20) potentialDuplicates[key].shift();
            }

            // 4. Check Temp/Junk Files
            const isTempExt = tempExtensions.includes(ext);
            const isTempDir = tempDirs.some(d => lowerPath.includes(`${path.sep}${d}${path.sep}`) || lowerPath.endsWith(`${path.sep}${d}`));
            const isJunkPattern = junkPatterns.some(p => lowerPath.includes(p));

            if (isTempExt || isTempDir || isJunkPattern) {
              addItemSorted(tempFiles, fileItem, 200);
            }

            // 5. Check Cache Files
            if (lowerPath.includes('cache') || lowerPath.includes('.cache')) {
              addItemSorted(cacheFiles, fileItem, 200);
            }

            // 6. Check Old Downloads (>3 months)
            if (lowerPath.includes('downloads') && stats.mtime < threeMonthsAgo) {
              addItemSorted(oldDownloads, fileItem, 100);
            }

          } catch { }
        }
      }
    }
  }

  startScan();

  // Process duplicates: Filter groups with < 2 files
  const realDuplicateCandidates = [];
  for (const key in potentialDuplicates) {
    if (potentialDuplicates[key].length > 1) {
      // Compatibility with Old Logic: Check name match primarily
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
function findLargeFiles(files, threshold) { return files; }
function findDuplicateFiles(files) { return files; }
function findOldFiles(files) { return files; }

module.exports = {
  scanDirectory: scanDirectoryAggregated,
  hashFile,
  findLargeFiles,
  findDuplicateFiles,
  findOldFiles,
  categorizeFiles: (files) => files
};
