import { useState, useMemo, useEffect } from 'react';
import { Package, Search, Clock, AlertCircle, LayoutGrid, List, ArrowUpDown, ExternalLink, Loader2, RotateCw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatBytes, formatDate } from '../utils/formatting';
import { Application } from '../types';

type FilterType = 'all' | 'never' | 'rare' | 'large';
type SortType = 'name' | 'size' | 'date';
type ViewMode = 'grid' | 'list';

export default function Applications() {
  const { applications, loading, uninstallApplication, refreshApplications } = useApp();

  useEffect(() => {
    console.log('Applications page received apps:', applications.length);
  }, [applications]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('size');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const filteredApps = useMemo(() => {
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
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.publisher.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      if (sortType === 'size') return b.size - a.size;
      if (sortType === 'name') return a.name.localeCompare(b.name);
      if (sortType === 'date') {
        const dateA = a.installDate ? new Date(a.installDate).getTime() : 0;
        const dateB = b.installDate ? new Date(b.installDate).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });
  }, [applications, filter, searchQuery, sortType]);

  const stats = useMemo(() => {
    const neverUsed = applications.filter(app => app.usage === 'never');
    const totalSize = applications.reduce((sum, app) => sum + app.size, 0);
    const potentialSavings = neverUsed.reduce((sum, app) => sum + app.size, 0);
    return { count: applications.length, neverUsedCount: neverUsed.length, totalSize, potentialSavings };
  }, [applications]);

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
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="mt-4 text-gray-600 dark:text-gray-400 animate-pulse font-medium">Scanning installed applications...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
            Application Manager
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Identify and remove unused applications to reclaim gigabytes of space.
          </p>
        </div>
        <button
          onClick={refreshApplications}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          <RotateCw className="w-4 h-4" />
          Refresh List
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Installed
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-gray-900 dark:text-white">
              {stats.count}
            </p>
            <p className="text-sm text-gray-500 font-medium">apps</p>
          </div>
          <p className="mt-2 text-sm text-gray-500">Occupying {formatBytes(stats.totalSize)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
              <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Unused / Rare
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-gray-900 dark:text-white">
              {stats.neverUsedCount}
            </p>
            <p className="text-sm text-gray-500 font-medium">potential</p>
          </div>
          <p className="mt-2 text-sm text-gray-500">Haven't been opened in 90+ days</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
              <AlertCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Reclaimable
            </h3>
          </div>
          <p className="text-4xl font-black text-green-600 dark:text-green-400">
            {formatBytes(stats.potentialSavings)}
          </p>
          <p className="mt-2 text-sm text-gray-500">By clearing unused applications</p>
        </div>
      </div>

      {/* Unified Controls Bar */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="w-full xl:max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search applications or publishers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border-none rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1 border border-gray-100 dark:border-gray-700">
            {(['all', 'never', 'rare', 'large'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${filter === t
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as SortType)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="size">Sort by Size</option>
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Install Date</option>
            </select>
          </div>

          <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl shadow-sm p-1 border border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600' : 'text-gray-400'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600' : 'text-gray-400'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Applications Display */}
      {filteredApps.length > 0 ? (
        viewMode === 'list' ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredApps.map((app) => (
                <AppListItem
                  key={app.id}
                  app={app}
                  usageBadge={getUsageBadge(app.usage)}
                  onUninstall={() => uninstallApplication(app)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredApps.map((app) => (
              <AppGridItem
                key={app.id}
                app={app}
                usageBadge={getUsageBadge(app.usage)}
                onUninstall={() => uninstallApplication(app)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">No applications found</h3>
          <p className="text-gray-500 mt-2">Try adjusting your filters or search query.</p>
        </div>
      )}
    </div>
  );
}

function AppListItem({ app, usageBadge, onUninstall }: { app: Application; usageBadge: string; onUninstall: () => void }) {
  return (
    <div className="group p-6 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform">
          {app.icon || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5 truncate group-hover:text-blue-600 transition-colors">
                {app.name}
              </h3>
              <p className="text-sm text-gray-500 font-medium truncate mb-2">
                {app.publisher}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-tighter ${usageBadge}`}>
                  {app.usage}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {app.installDate ? `Installed ${formatDate(new Date(app.installDate))}` : 'Unknown install date'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-gray-900 dark:text-white">
                {formatBytes(app.size || 0)}
              </p>
              <button
                onClick={onUninstall}
                className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg border border-red-100 dark:border-red-800 hover:bg-red-600 hover:text-white transition-all"
              >
                Uninstall <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppGridItem({ app, usageBadge, onUninstall }: { app: Application; usageBadge: string; onUninstall: () => void }) {
  return (
    <div className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-inner group-hover:rotate-6 transition-all">
        {app.icon || '📦'}
      </div>
      <h3 className="font-bold text-gray-900 dark:text-white truncate w-full mb-1">
        {app.name}
      </h3>
      <p className="text-xs text-gray-500 font-medium truncate w-full mb-4">
        {app.publisher}
      </p>

      <div className="mt-auto w-full space-y-4">
        <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-700 pt-4">
          <span className="text-sm font-black text-gray-900 dark:text-white">{formatBytes(app.size || 0)}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${usageBadge}`}>
            {app.usage}
          </span>
        </div>
        <button
          onClick={onUninstall}
          className="w-full py-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white text-gray-600 dark:text-gray-400 text-sm font-bold rounded-xl transition-all border border-gray-100 dark:border-gray-700 hover:border-red-600"
        >
          Uninstall
        </button>
      </div>
    </div>
  );
}
