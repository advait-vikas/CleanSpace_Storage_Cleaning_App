// src/fileDeletion.cjs - Safe file deletion with recycle bin support
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

/**
 * Protected paths that should never be deleted
 */
const PROTECTED_PATHS = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  '/System',
  '/Library',
  '/usr',
  '/bin',
  '/sbin',
  '/etc'
];

/**
 * Check if a path is protected
 */
function isProtectedPath(filePath) {
  const normalizedPath = path.normalize(filePath);

  return PROTECTED_PATHS.some(protectedPath => {
    return normalizedPath.startsWith(path.normalize(protectedPath));
  });
}

/**
 * Validate file paths before deletion
 */
function validateFilesForDeletion(filePaths) {
  const results = {
    valid: [],
    invalid: []
  };

  for (const filePath of filePaths) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        results.invalid.push({
          path: filePath,
          reason: 'File does not exist'
        });
        continue;
      }

      // Check if path is protected
      if (isProtectedPath(filePath)) {
        results.invalid.push({
          path: filePath,
          reason: 'Protected system path'
        });
        continue;
      }

      // Check if we have permission to delete
      try {
        fs.accessSync(filePath, fs.constants.W_OK);
      } catch (error) {
        results.invalid.push({
          path: filePath,
          reason: 'No write permission'
        });
        continue;
      }

      results.valid.push(filePath);

    } catch (error) {
      results.invalid.push({
        path: filePath,
        reason: error.message
      });
    }
  }

  return results;
}

/**
 * Move files to recycle bin
 */
async function moveToRecycleBin(filePaths) {
  const validation = validateFilesForDeletion(filePaths);

  if (validation.invalid.length > 0) {
    return {
      success: false,
      deleted: [],
      failed: validation.invalid,
      totalSize: 0
    };
  }

  const deleted = [];
  const failed = [];
  let totalSize = 0;

  // Calculate total size first
  for (const filePath of validation.valid) {
    try {
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    } catch (error) {
      // Continue
    }
  }

  // Delete files one by one
  for (const filePath of validation.valid) {
    try {
      await shell.trashItem(filePath);
      deleted.push(filePath);
    } catch (error) {
      failed.push({
        path: filePath,
        reason: error.message
      });
    }
  }

  return {
    success: deleted.length > 0,
    deleted,
    failed,
    totalSize: deleted.length > 0 ? totalSize : 0 // Rough estimate, usually we care about what was deleted
  };
}

/**
 * Permanently delete files (bypass recycle bin)
 * WARNING: This is irreversible!
 */
async function permanentlyDeleteFiles(filePaths) {
  const validation = validateFilesForDeletion(filePaths);

  if (validation.invalid.length > 0) {
    return {
      success: false,
      deleted: [],
      failed: validation.invalid,
      totalSize: 0
    };
  }

  const deleted = [];
  const failed = [];
  let totalSize = 0;

  for (const filePath of validation.valid) {
    try {
      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }

      deleted.push(filePath);

    } catch (error) {
      failed.push({
        path: filePath,
        reason: error.message
      });
    }
  }

  return {
    success: deleted.length > 0,
    deleted,
    failed,
    totalSize
  };
}

/**
 * Get total size of files to be deleted
 */
function calculateDeletionSize(filePaths) {
  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;

  for (const filePath of filePaths) {
    try {
      if (!fs.existsSync(filePath)) continue;

      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        dirCount++;
        totalSize += getDirectorySize(filePath);
      } else {
        fileCount++;
        totalSize += stats.size;
      }
    } catch (error) {
      // Skip files we can't access
    }
  }

  return {
    totalSize,
    fileCount,
    dirCount
  };
}

/**
 * Get size of directory recursively
 */
function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      try {
        if (entry.isDirectory()) {
          totalSize += getDirectorySize(fullPath);
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
 * Restore files from recycle bin (platform-specific)
 * Note: This is limited as recycle bin APIs are platform-specific
 */
function canRestoreFromRecycleBin() {
  // The trash package doesn't support restoration
  // Users need to manually restore from their recycle bin
  return false;
}

module.exports = {
  moveToRecycleBin,
  permanentlyDeleteFiles,
  validateFilesForDeletion,
  calculateDeletionSize,
  isProtectedPath,
  canRestoreFromRecycleBin
};
