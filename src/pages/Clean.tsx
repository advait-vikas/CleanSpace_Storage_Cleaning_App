import { AlertCircle, Trash2, Shield, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { formatBytes } from '../utils/formatting';
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Clean() {
  const { recommendations, deleteFiles } = useApp();
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalSpace = recommendations.reduce((sum, rec) => sum + rec.potentialSpace, 0);
  const selectedSpace = recommendations
    .filter((rec) => selectedRecs.has(rec.id))
    .reduce((sum, rec) => sum + rec.potentialSpace, 0);

  const getFilesForDeletion = () => {
    const recs = recommendations.filter((rec) => selectedRecs.has(rec.id));
    const filePaths: string[] = [];

    for (const rec of recs) {
      for (const file of rec.files) {
        filePaths.push(file.path);
      }
    }

    return filePaths;
  };

  const handleCleanNow = async () => {
    const filePaths = getFilesForDeletion();
    if (filePaths.length === 0) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteFiles(filePaths);

      if (result.success) {
        // Clear selected recommendations after successful deletion
        setSelectedRecs(new Set());
        // Show success message
        alert(`Successfully cleaned ${result.deleted.length} file(s), freeing ${formatBytes(result.totalSize)}`);
      } else if (result.failed && result.failed.length > 0) {
        setDeleteError(`Failed to delete ${result.failed.length} file(s). Some files may still be in use.`);
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'An error occurred during cleanup');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleRecommendation = (id: string) => {
    setSelectedRecs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getSafetyIcon = (level: string) => {
    switch (level) {
      case 'safe':
        return <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'caution':
        return <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      case 'advanced':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    }
  };

  const getSafetyColor = (level: string) => {
    switch (level) {
      case 'safe':
        return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10';
      case 'caution':
        return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10';
      case 'advanced':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10';
      default:
        return '';
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cleanup Assistant</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Smart recommendations to free up disk space safely
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
          <Info className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">No Recommendations Available</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Run a scan from the Analyze tab to generate cleanup recommendations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cleanup Assistant</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Smart recommendations to free up disk space safely
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Total Available</h3>
          </div>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {formatBytes(totalSpace)}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
            Across {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-bold text-green-900 dark:text-green-100">Selected</h3>
          </div>
          <p className="text-3xl font-bold text-green-900 dark:text-green-100">
            {formatBytes(selectedSpace)}
          </p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-2">
            {selectedRecs.size} recommendation{selectedRecs.size !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>

      {deleteError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-100">Cleanup Error</h4>
              <p className="text-sm text-red-800 dark:text-red-200 mt-1">{deleteError}</p>
            </div>
          </div>
        </div>
      )}

      {selectedRecs.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Ready to clean {formatBytes(selectedSpace)}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Files will be moved to Recycle Bin and can be restored
            </p>
          </div>
          <button
            onClick={handleCleanNow}
            disabled={isDeleting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isDeleting ? 'Cleaning...' : 'Clean Now'}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {recommendations.map((rec) => {
          const isSelected = selectedRecs.has(rec.id);
          return (
            <div
              key={rec.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-all ${isSelected
                  ? 'border-blue-500 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-700'
                }`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecommendation(rec.id)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                          {rec.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {rec.description}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatBytes(rec.potentialSpace)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          can be freed
                        </p>
                      </div>
                    </div>

                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getSafetyColor(rec.safetyLevel)}`}>
                      {getSafetyIcon(rec.safetyLevel)}
                      <span className="text-sm font-medium capitalize">
                        {rec.safetyLevel === 'safe' && 'Safe to Clean'}
                        {rec.safetyLevel === 'caution' && 'Review Before Cleaning'}
                        {rec.safetyLevel === 'advanced' && 'Advanced Users Only'}
                      </span>
                    </div>

                    {rec.files.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Preview ({rec.files.length} item{rec.files.length !== 1 ? 's' : ''})
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {rec.files.slice(0, 3).map((file) => (
                            <div
                              key={file.id}
                              className="text-xs text-gray-600 dark:text-gray-400 truncate"
                            >
                              {file.path}
                            </div>
                          ))}
                          {rec.files.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                              + {rec.files.length - 3} more item{rec.files.length - 3 !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">Safety First</h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              All deleted files will be moved to your Recycle Bin and can be restored. System files
              and important data are automatically protected. You can review each file before cleanup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
