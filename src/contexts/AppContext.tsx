import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DriveInfo, FileItem, Application, ScanProgress, CleanupRecommendation } from '../types';

interface AppContextType {
  selectedDrive: DriveInfo | null;
  setSelectedDrive: (drive: DriveInfo | null) => void;
  drives: DriveInfo[];
  largeFiles: FileItem[];
  duplicateFiles: FileItem[];
  oldFiles: FileItem[];
  applications: Application[];
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

// Inline recommendation engine — mirrors recommendationEngine.cjs logic
// Used as fallback when Electron IPC is unavailable (e.g. browser-only dev mode)
function generateRecommendationsInline(files: any[], applications: Application[]): CleanupRecommendation[] {
  const recs: CleanupRecommendation[] = [];
  const now = Date.now();

  // 1. Large files not accessed in 6+ months
  const sixMonthsAgo = new Date(now - 6 * 30 * 24 * 60 * 60 * 1000);
  const largeOld = files.filter(f => f.size >= 100 * 1024 * 1024 && new Date(f.lastAccessed) < sixMonthsAgo);
  if (largeOld.length > 0) {
    recs.push({
      id: 'rec_large_old',
      title: 'Large Files Not Accessed Recently',
      description: `${largeOld.length} large files haven't been accessed in over 6 months`,
      category: 'old',
      potentialSpace: largeOld.reduce((s, f) => s + f.size, 0),
      files: largeOld,
      safetyLevel: 'caution'
    });
  }

  // 2. Duplicates (same name + size)
  const dupGroups: Record<string, any[]> = {};
  for (const f of files) {
    const key = `${f.name}_${f.size}`;
    if (!dupGroups[key]) dupGroups[key] = [];
    dupGroups[key].push(f);
  }
  const dupFiles = Object.values(dupGroups).filter(g => g.length > 1).flatMap(g => g.slice(1));
  if (dupFiles.length > 0) {
    recs.push({
      id: 'rec_duplicates',
      title: 'Duplicate Files',
      description: `${dupFiles.length} duplicate files found that can be safely removed`,
      category: 'duplicates',
      potentialSpace: dupFiles.reduce((s, f) => s + f.size, 0),
      files: dupFiles,
      safetyLevel: 'safe'
    });
  }

  // 3. Temp files
  const tempExts = ['.tmp', '.temp', '.bak', '.old', '.cache'];
  const tempFiles = files.filter(f => tempExts.includes((f.type || '').toLowerCase()) || f.path?.toLowerCase().includes('\\temp\\'));
  if (tempFiles.length > 0) {
    recs.push({
      id: 'rec_temp',
      title: 'Temporary Files',
      description: `${tempFiles.length} temporary files that are safe to remove`,
      category: 'junk',
      potentialSpace: tempFiles.reduce((s, f) => s + f.size, 0),
      files: tempFiles,
      safetyLevel: 'safe'
    });
  }

  // 4. Rarely used apps
  if (applications?.length > 0) {
    const unusedApps = applications.filter(a => a.usage === 'never' || a.usage === 'rare');
    if (unusedApps.length > 0) {
      recs.push({
        id: 'rec_unused_apps',
        title: 'Rarely Used Applications',
        description: `${unusedApps.length} applications that are rarely or never used`,
        category: 'apps',
        potentialSpace: unusedApps.reduce((s, a) => s + a.size, 0),
        files: unusedApps.map(a => ({
          id: a.id,
          name: a.name,
          path: a.path,
          size: a.size,
          type: 'application',
          category: 'Applications',
          lastAccessed: a.lastUsed || new Date(0),
          lastModified: a.installDate || new Date(0),
          isDuplicate: false
        })),
        safetyLevel: 'advanced'
      });
    }
  }

  return recs;
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDrive, setSelectedDrive] = useState<DriveInfo | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [largeFiles, setLargeFiles] = useState<FileItem[]>([]);
  const [duplicateFiles, setDuplicateFiles] = useState<FileItem[]>([]);
  const [oldFiles, setOldFiles] = useState<FileItem[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
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
      // Pass applications to options so that the worker can generate recommendations
      const result = await window.electronAPI.scanDirectoryWithProgress(driveId, { applications });
      const { scannerId, largeFiles: scannedLarge, oldFiles: scannedOld, duplicateFiles: scannedDups, recommendations: scannedRecs } = result as any;
      setCurrentScannerId(scannerId);

      // Date helper since IPC serializes Date objects to strings
      const mapFileDates = (f: any) => ({
        ...f,
        lastAccessed: f.lastAccessed ? new Date(f.lastAccessed) : new Date(),
        lastModified: f.lastModified ? new Date(f.lastModified) : new Date()
      });

      const mappedLarge = (scannedLarge || []).map(mapFileDates);
      const mappedOld = (scannedOld || []).map(mapFileDates);
      const mappedDups = (scannedDups || []).map(mapFileDates);
      const mappedRecs = (scannedRecs || []).map((rec: any) => ({
        ...rec,
        files: (rec.files || []).map(mapFileDates)
      }));

      setLargeFiles(mappedLarge);
      setOldFiles(mappedOld);
      setDuplicateFiles(mappedDups);
      setRecommendations(mappedRecs);

      setScanProgress({
        isScanning: false,
        currentPath: '',
        filesScanned: mappedLarge.length + mappedOld.length + mappedDups.length,
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

    const result = await window.electronAPI.moveToRecycleBin(filePaths);

    if (result && result.deleted && result.deleted.length > 0) {
      const deletedPaths = result.deleted;

      setLargeFiles(prev => prev.filter(f => !deletedPaths.includes(f.path)));
      setOldFiles(prev => prev.filter(f => !deletedPaths.includes(f.path)));
      setDuplicateFiles(prev => prev.filter(f => !deletedPaths.includes(f.path)));

      setRecommendations(prev => prev.map(rec => {
        const remainingFiles = (rec.files || []).filter(f => !deletedPaths.includes(f.path));
        const potentialSpace = remainingFiles.reduce((sum, f) => sum + f.size, 0);
        return {
          ...rec,
          files: remainingFiles,
          potentialSpace
        };
      }).filter(rec => rec.files.length > 0));
    }

    return result;
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

