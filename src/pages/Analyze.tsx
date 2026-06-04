import { useState } from 'react';
import { Play, FileSearch, Copy, Clock, X, CheckSquare, Square } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatBytes, formatDate } from '../utils/formatting';
import { FileItem } from '../types';

type ViewType = 'large' | 'duplicates' | 'old';

export default function Analyze() {
  const { selectedDrive, scanProgress, startScan, cancelScan, largeFiles, duplicateFiles, oldFiles, selectedFiles, toggleFileSelection } = useApp();
  const [viewType, setViewType] = useState<ViewType>('large');

  if (!selectedDrive) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading system info...</h1>
        <p className="text-gray-600">Please wait while we detect your drives.</p>
      </div>
    );
  }

  const getFiles = (): FileItem[] => {
    switch (viewType) {
      case 'large':
        return largeFiles;
      case 'duplicates':
        return duplicateFiles;
      case 'old':
        return oldFiles;
    }
  };

  const files = getFiles();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const selectedCount = files.filter((f) => selectedFiles.has(f.id)).length;
  const selectedSize = files.filter((f) => selectedFiles.has(f.id)).reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">File Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Scan and identify files that take up space
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => scanProgress.isScanning ? cancelScan() : startScan(selectedDrive.id)}
          disabled={false}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {scanProgress.isScanning ? (
            <>
              <X className="w-5 h-5" />
              <span>Cancel Scan</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Start Scan</span>
            </>
          )}
        </button>

        <div className="flex-1">
          {scanProgress.isScanning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {scanProgress.currentPath}
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {scanProgress.progress.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                  style={{ width: `${scanProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {scanProgress.filesScanned.toLocaleString()} files scanned
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setViewType('large')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${viewType === 'large'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
        >
          <FileSearch className="w-4 h-4" />
          <span className="font-medium">Large Files</span>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
            {largeFiles.length}
          </span>
        </button>

        <button
          onClick={() => setViewType('duplicates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${viewType === 'duplicates'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
        >
          <Copy className="w-4 h-4" />
          <span className="font-medium">Duplicates</span>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
            {duplicateFiles.length}
          </span>
        </button>

        <button
          onClick={() => setViewType('old')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${viewType === 'old'
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
        >
          <Clock className="w-4 h-4" />
          <span className="font-medium">Old Files</span>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
            {oldFiles.length}
          </span>
        </button>
      </div>

      {selectedCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Total size: {formatBytes(selectedSize)}
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            Add to Cleanup Queue
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {viewType === 'large' && 'Large Files'}
                {viewType === 'duplicates' && 'Duplicate Files'}
                {viewType === 'old' && 'Old Files (6+ months)'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Total: {formatBytes(totalSize)} across {files.length} file{files.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {files.map((file) => {
            const isSelected = selectedFiles.has(file.id);
            return (
              <div
                key={file.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => toggleFileSelection(file.id)}
                    className="mt-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                          {file.path}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{file.type}</span>
                          <span>Modified: {formatDate(file.lastModified)}</span>
                          <span>Accessed: {formatDate(file.lastAccessed)}</span>
                          {file.isDuplicate && (
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                              Duplicate
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
