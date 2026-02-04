// electron.d.ts - TypeScript declarations for Electron API
import { DriveInfo, FileItem, Application, CleanupRecommendation } from './types';

export interface ScanProgress {
  scannerId: string;
  currentPath: string;
  filesScanned: number;
  progress: number;
}

export interface ScanResult {
  stats: {
    totalSize: number;
    fileCount: number;
    categoryStats: Array<{
      name: string;
      size: number;
      count: number;
    }>;
  };
  largeFiles: FileItem[];
  oldFiles: FileItem[];
  tempFiles: FileItem[];
  cacheFiles: FileItem[];
  oldDownloads: FileItem[];
  duplicateCandidates: FileItem[][];
  scannerId: string;
}

export interface DeletionResult {
  success: boolean;
  deleted: string[];
  failed: Array<{ path: string; reason: string }>;
  totalSize: number;
  cancelled?: boolean;
}

export interface ValidationResult {
  valid: string[];
  invalid: Array<{ path: string; reason: string }>;
}

export interface SizeInfo {
  totalSize: number;
  fileCount: number;
  dirCount: number;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: any[];
  totalmem: number;
  freemem: number;
  homedir: string;
  hostname: string;
  drives: DriveInfo[];
}

export interface AnalysisResult {
  files: FileItem[];
  categories: Array<{
    name: string;
    size: number;
    count: number;
  }>;
}

interface ElectronAPI {
  // System info
  getSystemInfo: () => Promise<SystemInfo>;

  // File scanning
  scanDirectory: (dir: string, options?: any) => Promise<FileItem[]>;
  scanDirectoryWithProgress: (dir: string, options?: any) => Promise<ScanResult>;
  cancelScan: (scannerId: string) => Promise<{ success: boolean }>;

  // File analysis
  findLargeFiles: (files: FileItem[], threshold: number) => Promise<FileItem[]>;
  findDuplicateFiles: (files: FileItem[]) => Promise<FileItem[][]>;
  findOldFiles: (files: FileItem[], monthsOld: number) => Promise<FileItem[]>;
  confirmDuplicatesWithHash: (duplicateGroups: FileItem[][]) => Promise<FileItem[]>;
  analyzeFiles: (files: FileItem[]) => Promise<AnalysisResult>;

  // Hashing
  hashFile: (filePath: string) => Promise<string>;

  // Applications
  getInstalledApplications: () => Promise<Application[]>;
  getAppSizes: (apps: Application[]) => Promise<Array<{ id: string, size: number }>>;
  uninstallApplication: (app: Application) => Promise<{ success: boolean, cancelled?: boolean, error?: string }>;

  // Recommendations
  generateRecommendations: (files: FileItem[], applications: Application[]) => Promise<CleanupRecommendation[]>;

  // File deletion
  calculateDeletionSize: (filePaths: string[]) => Promise<SizeInfo>;
  moveToRecycleBin: (filePaths: string[]) => Promise<DeletionResult>;
  permanentlyDeleteFiles: (filePaths: string[]) => Promise<DeletionResult>;
  validateDeletion: (filePaths: string[]) => Promise<ValidationResult>;

  // Event listeners
  onScanProgress: (callback: (data: ScanProgress) => void) => void;
  onScanComplete: (callback: (data: { scannerId: string }) => void) => void;
  removeScanProgressListener: () => void;
  removeScanCompleteListener: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export { };
