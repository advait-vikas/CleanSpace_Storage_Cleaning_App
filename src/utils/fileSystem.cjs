// src/utils/fileSystem.cjs - Common file system utilities
const fs = require('fs');
const path = require('path');

/**
 * Get directory size recursively (synchronous)
 * Note: Use with caution on main thread for very large directories
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
            } catch (e) {
                // Ignore errors (inaccessible files)
            }
        }
    } catch (e) {
        // Ignore errors
    }
    return totalSize;
}

/**
 * Check if a path is a system-protected path
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

function isProtectedPath(filePath) {
    const normalizedPath = path.normalize(filePath);
    return PROTECTED_PATHS.some(protectedPath => {
        try {
            return normalizedPath.toLowerCase().startsWith(path.normalize(protectedPath).toLowerCase());
        } catch {
            return false;
        }
    });
}

module.exports = {
    getDirectorySize,
    isProtectedPath
};
