// src/recommendationEngine.cjs - Generate cleanup recommendations
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Generate all cleanup recommendations
 */
function generateRecommendations(precollected, applications) {
  const recommendations = [];
  
  // 1. Large files not accessed recently
  const largeOld = precollected.largeOldFiles || [];
  if (largeOld.length > 0) {
    const totalSize = largeOld.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_large_old',
      title: 'Large Files Not Accessed Recently',
      description: `${largeOld.length} large files haven't been accessed in over 6 months`,
      category: 'old',
      potentialSpace: totalSize,
      files: largeOld,
      safetyLevel: 'caution'
    });
  }
  
  // 2. Duplicate files
  const duplicates = precollected.duplicateFiles || [];
  if (duplicates.length > 0) {
    const totalSize = duplicates.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_duplicates',
      title: 'Duplicate Files',
      description: `${duplicates.length} duplicate files found that can be safely removed`,
      category: 'duplicates',
      potentialSpace: totalSize,
      files: duplicates,
      safetyLevel: 'safe'
    });
  }
  
  // 3. Temporary files
  const tempFiles = precollected.tempFiles || [];
  if (tempFiles.length > 0) {
    const totalSize = tempFiles.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_temp',
      title: 'Temporary Files',
      description: `${tempFiles.length} temporary files that are safe to remove`,
      category: 'junk',
      potentialSpace: totalSize,
      files: tempFiles,
      safetyLevel: 'safe'
    });
  }
  
  // 4. Cache files
  const cacheFiles = precollected.cacheFiles || [];
  if (cacheFiles.length > 0) {
    const totalSize = cacheFiles.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_cache',
      title: 'Cache Files',
      description: `${cacheFiles.length} cache files that can be safely cleared`,
      category: 'junk',
      potentialSpace: totalSize,
      files: cacheFiles,
      safetyLevel: 'safe'
    });
  }
  
  // 5. Old downloads
  const oldDownloads = precollected.oldDownloads || [];
  if (oldDownloads.length > 0) {
    const totalSize = oldDownloads.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_old_downloads',
      title: 'Old Downloads',
      description: `${oldDownloads.length} files in Downloads folder older than 3 months`,
      category: 'old',
      potentialSpace: totalSize,
      files: oldDownloads,
      safetyLevel: 'caution'
    });
  }
  
  // 6. Rarely used large applications
  if (applications && applications.length > 0) {
    const unusedApps = findUnusedApplications(applications);
    if (unusedApps.files.length > 0) {
      recommendations.push(unusedApps);
    }
  }
  
  // 7. Large video files
  const largeVideos = precollected.largeVideos || [];
  if (largeVideos.length > 0) {
    const totalSize = largeVideos.reduce((sum, f) => sum + f.size, 0);
    recommendations.push({
      id: 'rec_large_videos',
      title: 'Large Video Files',
      description: `${largeVideos.length} video files larger than 500 MB`,
      category: 'large',
      potentialSpace: totalSize,
      files: largeVideos,
      safetyLevel: 'caution'
    });
  }
  
  return recommendations;
}

/**
 * Find large files not accessed in the last 6 months
 */
function findLargeOldFiles(files) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const threshold = 100 * 1024 * 1024; // 100 MB
  
  const oldLargeFiles = files.filter(f => 
    f.size >= threshold && 
    f.lastAccessed < sixMonthsAgo
  );
  
  const totalSize = oldLargeFiles.reduce((sum, f) => sum + f.size, 0);
  
  return {
    id: 'rec_large_old',
    title: 'Large Files Not Accessed Recently',
    description: `${oldLargeFiles.length} large files haven't been accessed in over 6 months`,
    category: 'old',
    potentialSpace: totalSize,
    files: oldLargeFiles,
    safetyLevel: 'caution'
  };
}

/**
 * Find duplicate files
 */
function findDuplicates(files) {
  const groups = {};
  
  for (const file of files) {
    const key = `${file.name}_${file.size}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  }
  
  const duplicateFiles = [];
  for (const group of Object.values(groups)) {
    if (group.length > 1) {
      // Keep one copy, mark others as duplicates
      for (let i = 1; i < group.length; i++) {
        duplicateFiles.push(group[i]);
      }
    }
  }
  
  const totalSize = duplicateFiles.reduce((sum, f) => sum + f.size, 0);
  
  return {
    id: 'rec_duplicates',
    title: 'Duplicate Files',
    description: `${duplicateFiles.length} duplicate files found that can be safely removed`,
    category: 'duplicates',
    potentialSpace: totalSize,
    files: duplicateFiles,
    safetyLevel: 'safe'
  };
}

/**
 * Find temporary files
 */
function findTemporaryFiles(files) {
  const tempExtensions = ['.tmp', '.temp', '.bak', '.old', '.cache'];
  const tempDirs = ['Temp', 'tmp', 'temporary'];
  
  const tempFiles = files.filter(f => {
    const ext = path.extname(f.path).toLowerCase();
    const hasTempExt = tempExtensions.includes(ext);
    const inTempDir = tempDirs.some(dir => f.path.includes(dir));
    return hasTempExt || inTempDir;
  });
  
  const totalSize = tempFiles.reduce((sum, f) => sum + f.size, 0);
  
  return {
    id: 'rec_temp',
    title: 'Temporary Files',
    description: `${tempFiles.length} temporary files that are safe to remove`,
    category: 'junk',
    potentialSpace: totalSize,
    files: tempFiles,
    safetyLevel: 'safe'
  };
}

/**
 * Find cache files
 */
function findCacheFiles(files) {
  const cachePatterns = ['cache', 'Cache', '.cache'];
  
  const cacheFiles = files.filter(f => 
    cachePatterns.some(pattern => f.path.includes(pattern))
  );
  
  const totalSize = cacheFiles.reduce((sum, f) => sum + f.size, 0);
  
  return {
    id: 'rec_cache',
    title: 'Cache Files',
    description: `${cacheFiles.length} cache files that can be safely cleared`,
    category: 'junk',
    potentialSpace: totalSize,
    files: cacheFiles,
    safetyLevel: 'safe'
  };
}

/**
 * Find old files in Downloads folder
 */
function findOldDownloads(files) {
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const oldDownloads = files.filter(f =>
    f.path.startsWith(downloadsPath) &&
    f.lastModified < threeMonthsAgo &&
    f.size > 10 * 1024 * 1024 // > 10 MB
  );
  
  const totalSize = oldDownloads.reduce((sum, f) => sum + f.size, 0);
  
  return {
    id: 'rec_old_downloads',
    title: 'Old Downloads',
    description: `${oldDownloads.length} files in Downloads folder older than 3 months`,
    category: 'old',
    potentialSpace: totalSize,
    files: oldDownloads,
    safetyLevel: 'caution'
  };
}

/**
 * Find unused applications
 */
function findUnusedApplications(applications) {
  const unusedApps = applications.filter(app => 
    app.usage === 'never' || app.usage === 'rare'
  );
  
  const totalSize = unusedApps.reduce((sum, app) => sum + (Number(app.size) || 0), 0);
  
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

/**
 * Find large video files
 */
function findLargeVideoFiles(files) {
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];
  const threshold = 500 * 1024 * 1024; // 500 MB
  
  const largeVideos = files.filter(f =>
    videoExtensions.includes(path.extname(f.path).toLowerCase()) &&
    f.size >= threshold
  );
  
  const totalSize = largeVideos.reduce((sum, f) => sum + f.size, 0);
  
  return {
    id: 'rec_large_videos',
    title: 'Large Video Files',
    description: `${largeVideos.length} video files larger than 500 MB`,
    category: 'large',
    potentialSpace: totalSize,
    files: largeVideos,
    safetyLevel: 'caution'
  };
}

/**
 * Analyze storage distribution by category
 */
function analyzeStorageByCategory(files) {
  const categories = {
    Documents: { extensions: ['.doc', '.docx', '.pdf', '.txt', '.xls', '.xlsx', '.ppt', '.pptx'], size: 0, count: 0 },
    Images: { extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'], size: 0, count: 0 },
    Videos: { extensions: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'], size: 0, count: 0 },
    Audio: { extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'], size: 0, count: 0 },
    Archives: { extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'], size: 0, count: 0 },
    Code: { extensions: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.html', '.css'], size: 0, count: 0 },
    Other: { extensions: [], size: 0, count: 0 }
  };
  
  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    let categorized = false;
    
    for (const [category, data] of Object.entries(categories)) {
      if (category !== 'Other' && data.extensions.includes(ext)) {
        data.size += file.size;
        data.count += 1;
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      categories.Other.size += file.size;
      categories.Other.count += 1;
    }
  }
  
  return Object.entries(categories).map(([name, data]) => ({
    name,
    size: data.size,
    count: data.count
  }));
}

module.exports = {
  generateRecommendations,
  analyzeStorageByCategory
};
