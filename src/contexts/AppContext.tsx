import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DriveInfo, FileItem, Application, ScanProgress, CleanupRecommendation, FileCategory } from '../types';

interface AppContextType {
  selectedDrive: DriveInfo | null;
  setSelectedDrive: (drive: DriveInfo | null) => void;
  drives: DriveInfo[];
  largeFiles: FileItem[];
  duplicateFiles: FileItem[];
  oldFiles: FileItem[];
  applications: Application[];
  categories: FileCategory[];
  recommendations: CleanupRecommendation[];
  scanProgress: ScanProgress;
  startScan: (driveId: string) => void;
  cancelScan: (scannerId?: string) => void;
  selectedFiles: Set<string>;
  toggleFileSelection: (fileId: string) => void;
  clearSelection: () => void;
  deleteFiles: (filePaths: string[]) => Promise<any>;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDrive, setSelectedDrive] = useState<DriveInfo | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [largeFiles, setLargeFiles] = useState<FileItem[]>([]);
  const [duplicateFiles, setDuplicateFiles] = useState<FileItem[]>([]);
  const [oldFiles, setOldFiles] = useState<FileItem[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [recommendations, setRecommendations] = useState<CleanupRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentScannerId, setCurrentScannerId] = useState<string | null>(null);

  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    isScanning: false,
    currentPath: '',
    filesScanned: 0,
    progress: 0
  });

  // Fetch real system info from Electron on mount
  useEffect(() => {
    async function fetchSystemAndFiles() {
      try {
        if (!window.electronAPI?.getSystemInfo) {
          setLoading(false);
          return;
        }

        // Get system info
        const info = await window.electronAPI.getSystemInfo();
        setDrives(info.drives || []);
        if (info.drives && info.drives[0]) {
          setSelectedDrive(info.drives[0]);
        }

        // Get installed applications
        try {
          const apps = await window.electronAPI.getInstalledApplications();
          setApplications(apps || []);
        } catch (error) {
          console.error('Error loading applications:', error);
          setApplications([]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching system info:', error);
        setLoading(false);
      }
    }

    fetchSystemAndFiles();
  }, []);

  // Listen for scan progress updates
  useEffect(() => {
    if (!window.electronAPI?.onScanProgress) return;

    window.electronAPI.onScanProgress((data) => {
      setScanProgress(prev => ({
        ...prev,
        currentPath: data.currentPath,
        filesScanned: data.filesScanned,
        progress: data.progress
      }));
    });

    return () => {
      window.electronAPI?.removeScanProgressListener?.();
    };
  }, []);

  const startScan = useCallback(async (driveId: string) => {
    if (!window.electronAPI?.scanDirectoryWithProgress) return;

    setScanProgress({
      isScanning: true,
      currentPath: driveId,
      filesScanned: 0,
      progress: 0
    });

    try {
      const result = await window.electronAPI.scanDirectoryWithProgress(driveId);
      setCurrentScannerId(result.scannerId);

      // 1. Process Categories from Stats
      if (result.stats && result.stats.categoryStats) {
        const mappedCategories = result.stats.categoryStats.map((cat: any) => ({
          ...cat,
          color: getCategoryColor(cat.name),
          icon: getCategoryIcon(cat.name)
        }));
        setCategories(mappedCategories);
      }

      // 2. Set Large Files
      setLargeFiles(result.largeFiles || []);

      // 3. Set Duplicates (Flatten the groups)
      const dups = result.duplicateCandidates || [];
      const flatDups: any[] = [];
      if (Array.isArray(dups)) {
        dups.forEach((group: any[]) => {
          // Mark duplicates
          group.forEach((f, idx) => {
            if (idx > 0) flatDups.push({ ...f, isDuplicate: true, duplicateGroup: group[0].name });
          });
        });
      }
      setDuplicateFiles(flatDups);

      // 4. Set Old Files
      setOldFiles(result.oldFiles || []);

      // 5. Generate Recommendations
      // We pass the aggregated result object since recommendationEngine was updated to handle it
      try {
        const recs = await window.electronAPI.generateRecommendations(result as any, applications);
        setRecommendations(recs);
      } catch (err) {
        console.error('Error generating recommendations:', err);
        setRecommendations([]);
      }

      setScanProgress({
        isScanning: false,
        currentPath: '',
        filesScanned: result.stats.fileCount,
        progress: 100
      });
    } catch (error) {
      console.error('Scan error:', error);
      setScanProgress({
        isScanning: false,
        currentPath: '',
        filesScanned: 0,
        progress: 0
      });
    }
  }, [applications]);

  const cancelScan = useCallback(async (scannerId?: string) => {
    if (!window.electronAPI?.cancelScan) return;

    const id = scannerId || currentScannerId;
    if (id) {
      await window.electronAPI.cancelScan(id);
    }

    setScanProgress({
      isScanning: false,
      currentPath: '',
      filesScanned: 0,
      progress: 0
    });
  }, [currentScannerId]);

  const deleteFiles = useCallback(async (filePaths: string[]) => {
    if (!window.electronAPI?.moveToRecycleBin) {
      throw new Error('Electron API not available');
    }

    return await window.electronAPI.moveToRecycleBin(filePaths);
  }, []);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  return (
    <AppContext.Provider
      value={{
        selectedDrive,
        setSelectedDrive,
        drives,
        largeFiles,
        duplicateFiles,
        oldFiles,
        applications,
        categories,
        recommendations,
        scanProgress,
        startScan,
        cancelScan,
        selectedFiles,
        toggleFileSelection,
        clearSelection,
        deleteFiles,
        loading
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// Helper functions for category styling
function getCategoryColor(name: string): string {
  switch (name.toLowerCase()) {
    case 'applications': return '#3b82f6';
    case 'videos': return '#8b5cf6';
    case 'images': return '#10b981';
    case 'documents': return '#f59e0b';
    case 'audio': return '#ec4899';
    case 'downloads': return '#06b6d4';
    case 'system & cache': return '#6366f1';
    default: return '#64748b';
  }
}

function getCategoryIcon(name: string): string {
  switch (name.toLowerCase()) {
    case 'applications': return 'package';
    case 'videos': return 'video';
    case 'images': return 'image';
    case 'documents': return 'file-text';
    case 'audio': return 'music';
    case 'downloads': return 'download';
    case 'system & cache': return 'hard-drive';
    default: return 'folder';
  }
}

