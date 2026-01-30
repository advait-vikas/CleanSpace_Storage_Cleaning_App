import { useState } from 'react';
import { Package, Search, Clock, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatBytes, formatDate } from '../utils/formatting';
import { Application } from '../types';

type FilterType = 'all' | 'never' | 'rare' | 'large';

export default function Applications() {
  const { applications, loading } = useApp();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getFilteredApps = (): Application[] => {
    let filtered = applications;

    switch (filter) {
      case 'never':
        filtered = applications.filter((app) => app.usage === 'never');
        break;
      case 'rare':
        filtered = applications.filter((app) => app.usage === 'rare' || app.usage === 'never');
        break;
      case 'large':
        filtered = applications.filter((app) => app.size > 1024 * 1024 * 1024);
        break;
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.publisher.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => b.size - a.size);
  };

  const filteredApps = getFilteredApps();
  const totalSize = filteredApps.reduce((sum, app) => sum + app.size, 0);
  const unusedApps = applications.filter((app) => app.usage === 'never');

  const getUsageBadge = (usage: string) => {
    switch (usage) {
      case 'frequent':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'occasional':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'rare':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'never':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400';
    }
  };



  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Application Manager</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Loading applications...</p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Application Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">No applications found</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
          <Package className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Could not detect installed applications on this system</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Application Manager
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Analyze and manage installed applications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Apps
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {applications.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Rarely Used
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {unusedApps.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Potential Space
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatBytes(unusedApps.reduce((sum, app) => sum + app.size, 0))}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All' },
            { id: 'never', label: 'Never Used' },
            { id: 'rare', label: 'Rarely Used' },
            { id: 'large', label: 'Large (>1GB)' }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id as FilterType)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${filter === btn.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Installed Applications
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''} using{' '}
            {formatBytes(totalSize)}
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                        {app.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {app.publisher}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Installed: {formatDate(app.installDate)}</span>
                        <span>
                          Last used: {app.lastUsed ? formatDate(app.lastUsed) : 'Never'}
                        </span>
                        <span className={`px-2 py-1 rounded ${getUsageBadge(app.usage)}`}>
                          {app.usage === 'never' && 'Never Used'}
                          {app.usage === 'rare' && 'Rarely Used'}
                          {app.usage === 'occasional' && 'Occasionally Used'}
                          {app.usage === 'frequent' && 'Frequently Used'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatBytes(app.size)}
                      </p>
                      <button className="mt-2 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-200 dark:border-red-800 transition-colors">
                        Uninstall
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredApps.length === 0 && (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No applications found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
