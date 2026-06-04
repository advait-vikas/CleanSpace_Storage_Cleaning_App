// src/storageScanner.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const EXCLUDE_DIRS = [
  'node_modules', 'Windows', 'Program Files', 'Program Files (x86)', 
  '$Recycle.Bin', 'System Volume Information', 'ProgramData', 
  'Recovery', 'hiberfil.sys', 'pagefile.sys', 'swapfile.sys',
  '.git', 'AppData/Local/Temp'
];

function shouldExclude(dir) {
  return EXCLUDE_DIRS.some(ex => dir.includes(ex));
}

function insertSortedDesc(array, item, limit) {
  let insertIdx = -1;
  for (let i = 0; i < array.length; i++) {
    if (item.size > array[i].size) {
      insertIdx = i;
      break;
    }
  }
  if (insertIdx === -1) {
    if (array.length < limit) {
      array.push(item);
    }
  } else {
    array.splice(insertIdx, 0, item);
    if (array.length > limit) {
      array.pop();
    }
  }
}

function getFileCategory(ext) {
  const categories = {
    Documents: ['.doc', '.docx', '.pdf', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'],
    Images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
    Videos: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'],
    Audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
    Archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    Code: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.html', '.css']
  };
  
  const extLower = ext.toLowerCase();
  for (const [cat, exts] of Object.entries(categories)) {
    if (exts.includes(extLower)) {
      return cat;
    }
  }
  return 'Other';
}

function scanDirectory(dir, options = {}) {
  const { progressCallback, maxFiles = Infinity } = options;
  
  // Pre-calculate top-level subdirectories to track progress
  let topLevelDirs = [];
  try {
    topLevelDirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !shouldExclude(path.join(dir, entry.name)))
      .map(entry => path.join(dir, entry.name));
  } catch (e) {
    // Ignore error
  }

  const totalTopLevel = topLevelDirs.length;
  let lastTopLevelIndex = -1;
  let filesInCurrentTopLevel = 0;
  let fileCount = 0;

  // On-the-fly collection arrays
  const largeFiles = [];
  const oldFiles = [];
  const largeOldFiles = [];
  const duplicateFiles = [];
  const tempFiles = [];
  const cacheFiles = [];
  const oldDownloads = [];
  const largeVideos = [];

  const seenFilesMap = new Map();

  const categoryStats = {
    Documents: { size: 0, count: 0 },
    Images: { size: 0, count: 0 },
    Videos: { size: 0, count: 0 },
    Audio: { size: 0, count: 0 },
    Archives: { size: 0, count: 0 },
    Code: { size: 0, count: 0 },
    Other: { size: 0, count: 0 }
  };

  const downloadsPath = path.join(os.homedir(), 'Downloads');
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  function walk(currentPath) {
    if (shouldExclude(currentPath)) return;
    
    // Find if we are currently inside a top-level directory
    let currentTopLevelIndex = -1;
    if (totalTopLevel > 0) {
      currentTopLevelIndex = topLevelDirs.findIndex(tld => 
        currentPath === tld || currentPath.startsWith(tld + path.sep)
      );
    }

    if (currentTopLevelIndex !== -1) {
      if (currentTopLevelIndex !== lastTopLevelIndex) {
        lastTopLevelIndex = currentTopLevelIndex;
        filesInCurrentTopLevel = 0;
      }
    }

    // Emit progress update
    if (progressCallback && fileCount % 100 === 0) {
      let progressPercent = 0;
      if (totalTopLevel > 0) {
        if (lastTopLevelIndex !== -1) {
          const low = (lastTopLevelIndex / totalTopLevel) * 100;
          const high = ((lastTopLevelIndex + 0.95) / totalTopLevel) * 100;
          const subProgress = 1 - 1 / (1 + filesInCurrentTopLevel / 500);
          progressPercent = low + (high - low) * subProgress;
        } else {
          // If we are in the root directory scanning files directly
          const high = (0.95 / totalTopLevel) * 100;
          const subProgress = 1 - 1 / (1 + fileCount / 500);
          progressPercent = high * subProgress;
        }
      } else {
        // Fallback for directories with no subdirectories
        progressPercent = (1 - 1 / (1 + fileCount / 500)) * 99;
      }

      progressPercent = Math.max(0, Math.min(progressPercent, 99));

      progressCallback({
        currentPath,
        filesScanned: fileCount,
        progress: progressPercent
      });
    }
    
    if (fileCount >= maxFiles) return;
    
    let files;
    try {
      files = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    
    for (const file of files) {
      if (fileCount >= maxFiles) break;
      
      const fullPath = path.join(currentPath, file.name);
      if (file.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          const stats = fs.statSync(fullPath);
          fileCount++;
          if (lastTopLevelIndex !== -1) {
            filesInCurrentTopLevel++;
          }
          
          const ext = path.extname(file.name).toLowerCase();
          const category = getFileCategory(ext);

          // Update category stats
          if (categoryStats[category]) {
            categoryStats[category].size += stats.size;
            categoryStats[category].count += 1;
          }

          // Generate unique ID for file
          const id = `file_${crypto.createHash('md5').update(fullPath).digest('hex')}`;
          const fileItem = {
            id,
            name: file.name,
            path: fullPath,
            size: stats.size,
            type: ext,
            ext: ext,
            category,
            lastAccessed: stats.atime,
            lastModified: stats.mtime
          };

          // 1. Large files (>= 100 MB)
          if (stats.size >= 100 * 1024 * 1024) {
            insertSortedDesc(largeFiles, fileItem, 2000);
          }

          // 2. Old files (> 6 months)
          if (stats.atime < sixMonthsAgo) {
            insertSortedDesc(oldFiles, fileItem, 2000);
          }

          // 3. Large old files (>= 100 MB and > 6 months)
          if (stats.size >= 100 * 1024 * 1024 && stats.atime < sixMonthsAgo) {
            insertSortedDesc(largeOldFiles, fileItem, 2000);
          }

          // 4. Duplicate detection (only for files >= 1 MB to save massive memory)
          if (stats.size >= 1 * 1024 * 1024) {
            const dupKey = `${file.name}_${stats.size}`;
            const existing = seenFilesMap.get(dupKey);
            if (existing) {
              if (existing !== true) {
                // Add original copy
                const origItem = { ...existing, isDuplicate: true };
                insertSortedDesc(duplicateFiles, origItem, 2000);
                seenFilesMap.set(dupKey, true);
              }
              // Add duplicate copy
              const dupItem = { ...fileItem, isDuplicate: true };
              insertSortedDesc(duplicateFiles, dupItem, 2000);
            } else {
              seenFilesMap.set(dupKey, fileItem);
            }
          }

          // 5. Temporary files (.tmp, .temp, .bak, .old, .cache, or temp/tmp path)
          const isTemp = ['.tmp', '.temp', '.bak', '.old', '.cache'].includes(ext) || 
                         fullPath.toLowerCase().includes(path.sep + 'temp' + path.sep) ||
                         fullPath.toLowerCase().includes(path.sep + 'tmp' + path.sep) ||
                         fullPath.toLowerCase().includes(path.sep + 'temporary' + path.sep);
          if (isTemp) {
            insertSortedDesc(tempFiles, fileItem, 2000);
          }

          // 6. Cache files
          if (fullPath.toLowerCase().includes('cache')) {
            insertSortedDesc(cacheFiles, fileItem, 2000);
          }

          // 7. Old downloads (Downloads folder, mtime > 3 months, size > 10 MB)
          if (fullPath.toLowerCase().startsWith(downloadsPath.toLowerCase()) && stats.mtime < threeMonthsAgo && stats.size > 10 * 1024 * 1024) {
            insertSortedDesc(oldDownloads, fileItem, 2000);
          }

          // 8. Large videos (Video extension, size >= 500 MB)
          if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'].includes(ext) && stats.size >= 500 * 1024 * 1024) {
            insertSortedDesc(largeVideos, fileItem, 2000);
          }

        } catch {}
      }
    }
  }
  
  walk(dir);
  
  // Final progress update
  if (progressCallback) {
    progressCallback({
      currentPath: dir,
      filesScanned: fileCount,
      progress: 100
    });
  }

  // Format categoryStats to array as expected
  const categoriesList = Object.entries(categoryStats).map(([name, data]) => ({
    name,
    size: data.size,
    count: data.count
  }));
  
  return {
    largeFiles,
    oldFiles,
    largeOldFiles,
    duplicateFiles,
    tempFiles,
    cacheFiles,
    oldDownloads,
    largeVideos,
    categoriesList,
    fileCount
  };
}

function findLargeFiles(files, threshold = 100 * 1024 * 1024) {
  return files.filter(f => f.size >= threshold).sort((a, b) => b.size - a.size);
}

function findDuplicateFiles(files) {
  const groups = {};
  for (const file of files) {
    const key = `${file.name}_${file.size}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  }
  return Object.values(groups).filter(g => g.length > 1);
}

async function confirmDuplicatesWithHash(duplicateGroups) {
  const confirmedDuplicates = [];
  
  for (const group of duplicateGroups) {
    const hashMap = {};
    
    for (const file of group) {
      try {
        const hash = await hashFile(file.path);
        if (!hashMap[hash]) hashMap[hash] = [];
        hashMap[hash].push(file);
      } catch (error) {
        continue;
      }
    }
    
    for (const hash in hashMap) {
      if (hashMap[hash].length > 1) {
        confirmedDuplicates.push(...hashMap[hash]);
      }
    }
  }
  
  return confirmedDuplicates;
}

function findOldFiles(files, monthsOld = 6) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);
  return files.filter(f => f.lastAccessed < cutoffDate);
}

function categorizeFiles(files) {
  return files; // Already categorized on-the-fly!
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

module.exports = {
  scanDirectory,
  findLargeFiles,
  findDuplicateFiles,
  confirmDuplicatesWithHash,
  findOldFiles,
  categorizeFiles,
  hashFile
};
