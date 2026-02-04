export interface DriveInfo {
  id: string;
  name: string;
  letter: string;
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  fileSystem: string;
}

export interface FileCategory {
  name: string;
  size: number;
  count: number;
  color: string;
  icon: string;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  category: string;
  lastAccessed: Date;
  lastModified: Date;
  isDuplicate?: boolean;
  duplicateGroup?: string;
}

export interface Application {
  id: string;
  name: string;
  publisher: string;
  size: number;
  installDate: Date;
  lastUsed: Date | null;
  path: string;
  icon: string;
  usage: 'never' | 'rare' | 'occasional' | 'frequent';
  isSystemComponent?: boolean;
  uninstallString?: string;
}

export interface CleanupRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'duplicates' | 'large' | 'old' | 'junk' | 'apps';
  potentialSpace: number;
  files: FileItem[];
  safetyLevel: 'safe' | 'caution' | 'advanced';
}

export interface ScanProgress {
  isScanning: boolean;
  currentPath: string;
  filesScanned: number;
  progress: number;
}
