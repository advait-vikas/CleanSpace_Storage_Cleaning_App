import { HardDrive, Folder, File, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatBytes } from '../utils/formatting';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { selectedDrive, drives, setSelectedDrive, categories, recommendations, startScan, scanProgress } = useApp();

  if (!selectedDrive || drives.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading system info...</h1>
        <p className="text-gray-600">Please wait while we detect your drives.</p>
      </div>
    );
  }

  const usagePercentage = selectedDrive.totalSpace > 0
    ? (selectedDrive.usedSpace / selectedDrive.totalSpace) * 100
    : 0;

  const totalRecommendedSpace = recommendations.reduce((sum, rec) => sum + rec.potentialSpace, 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Storage Overview</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor and optimize your disk space usage</p>
      </div>

      <div className="flex gap-3">
        {drives.map((drive) => (
          <button
            key={drive.id}
            onClick={() => setSelectedDrive(drive)}
            className={`px-4 py-2 rounded-lg border-2 transition-all ${selectedDrive.id === drive.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              <span className="font-medium">{drive.letter}</span>
              <span className="text-sm opacity-75">{drive.name}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Space</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(selectedDrive.totalSpace)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Folder className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Used Space</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(selectedDrive.usedSpace)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <File className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Free Space</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(selectedDrive.freeSpace)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Storage Usage</h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {usagePercentage.toFixed(1)}% Used
          </span>
        </div>
        <div className="relative h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 dark:bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
                You can free up {formatBytes(totalRecommendedSpace)} safely
              </h3>
              <p className="text-green-700 dark:text-green-300 mb-4">
                Smart PC Storage Manager found {recommendations.length} optimization opportunities
              </p>
              <button
                onClick={() => onNavigate('clean')}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                View Recommendations
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                Scan to Analyze Storage
              </h3>
              <p className="text-blue-700 dark:text-blue-300 mb-4">
                {scanProgress.isScanning ? 'Scanning in progress...' : 'Start a scan to see detailed file categories and cleanup recommendations.'}
              </p>
              <button
                onClick={() => !scanProgress.isScanning && startScan(selectedDrive.id)}
                disabled={scanProgress.isScanning}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                {scanProgress.isScanning ? `Scanning ${scanProgress.progress.toFixed(0)}%` : 'Start Scan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Storage by Category</h2>
          <div className="space-y-4">
            {categories.map((category) => {
              const percentage = selectedDrive.usedSpace > 0
                ? (category.size / selectedDrive.usedSpace) * 100
                : 0;
              return (
                <div key={category.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {category.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {category.count.toLocaleString()} items
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatBytes(category.size)}
                    </span>
                  </div>
                  <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: category.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
