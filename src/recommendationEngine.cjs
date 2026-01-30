// src/recommendationEngine.cjs - Generate cleanup recommendations
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Generate all cleanup recommendations from Aggregated Scan Results
 */
function generateRecommendations(scanResult, applications) {
  const recommendations = [];

  // 1. Large files not accessed recently
  // We already have this list from the scanner!
  if (scanResult.oldFiles && scanResult.oldFiles.length > 0) {
    const totalSize = scanResult.oldFiles.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_large_old',
      title: 'Large Old Files',
      description: `${scanResult.oldFiles.length} large files haven't been accessed in over 6 months`,
      category: 'old',
      potentialSpace: totalSize,
      files: scanResult.oldFiles,
      safetyLevel: 'caution'
    });
  }

  // 1b. Temp Files
  if (scanResult.tempFiles && scanResult.tempFiles.length > 0) {
    const totalSize = scanResult.tempFiles.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_temp',
      title: 'Temporary Files',
      description: `${scanResult.tempFiles.length} temporary files that can be safely removed`,
      category: 'junk',
      potentialSpace: totalSize,
      files: scanResult.tempFiles,
      safetyLevel: 'safe'
    });
  }

  // 1c. Cache Files
  if (scanResult.cacheFiles && scanResult.cacheFiles.length > 0) {
    const totalSize = scanResult.cacheFiles.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_cache',
      title: 'System & App Cache',
      description: `${scanResult.cacheFiles.length} cache files that can be cleared`,
      category: 'junk',
      potentialSpace: totalSize,
      files: scanResult.cacheFiles,
      safetyLevel: 'safe'
    });
  }

  // 1d. Old Downloads
  if (scanResult.oldDownloads && scanResult.oldDownloads.length > 0) {
    const totalSize = scanResult.oldDownloads.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_old_downloads',
      title: 'Old Downloads',
      description: `${scanResult.oldDownloads.length} files in Downloads older than 3 months`,
      category: 'old',
      potentialSpace: totalSize,
      files: scanResult.oldDownloads,
      safetyLevel: 'caution'
    });
  }

  // 2. Duplicate files
  // We have duplicate candidates
  if (scanResult.duplicateCandidates && scanResult.duplicateCandidates.length > 0) {
    const flatDups = [];
    scanResult.duplicateCandidates.forEach(group => {
      // All but one are waste
      for (let i = 1; i < group.length; i++) flatDups.push(group[i]);
    });

    if (flatDups.length > 0) {
      const totalSize = flatDups.reduce((sum, f) => sum + f.size, 0);
      recommendations.push({
        id: 'rec_duplicates',
        title: 'Duplicate Files',
        description: `${flatDups.length} duplicate files found that can be safely removed`,
        category: 'duplicates',
        potentialSpace: totalSize,
        files: flatDups,
        safetyLevel: 'safe'
      });
    }
  }

  // 3. Unused Apps
  if (applications && applications.length > 0) {
    const unusedApps = findUnusedApplications(applications);
    if (unusedApps.potentialSpace > 0) {
      recommendations.push(unusedApps);
    }
  }

  // 4. Large Files (General)
  if (scanResult.largeFiles && scanResult.largeFiles.length > 0) {
    const topLarge = scanResult.largeFiles.slice(0, 10); // Top 10
    const totalSize = topLarge.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_large_general',
      title: 'Top Large Files',
      description: `Review your largest files to free up space`,
      category: 'large',
      potentialSpace: totalSize,
      files: topLarge,
      safetyLevel: 'caution'
    });
  }

  return recommendations;
}


/**
 * Find unused applications
 */
function findUnusedApplications(applications) {
  const unusedApps = applications.filter(app =>
    app.usage === 'never' || app.usage === 'rare'
  );

  const totalSize = unusedApps.reduce((sum, app) => sum + app.size, 0);

  return {
    id: 'rec_unused_apps',
    title: 'Rarely Used Applications',
    description: `${unusedApps.length} applications that are rarely or never used`,
    category: 'apps',
    potentialSpace: totalSize,
    files: unusedApps.map(app => ({
      id: app.id,
      name: app.name,
      path: app.path,
      size: app.size,
      type: 'application',
      category: 'Applications',
      lastAccessed: app.lastUsed || new Date(0),
      lastModified: app.installDate || new Date(0)
    })),
    safetyLevel: 'advanced'
  };
}

module.exports = {
  generateRecommendations,
  // analyzeStorageByCategory // No longer used, logic moved to storageScanner
};
