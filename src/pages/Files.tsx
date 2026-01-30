import { useState } from 'react';
import { FolderOpen, Search, ArrowUpDown, FileText, Image, Video, Music, File, CheckSquare, Square } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatBytes, formatDate } from '../utils/formatting';
import { FileItem } from '../types';

type SortBy = 'name' | 'size' | 'date' | 'type';
type SortOrder = 'asc' | 'desc';

export default function Files() {
  const { largeFiles, selectedFiles, toggleFileSelection } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('size');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Documents':
        return <FileText className="w-5 h-5" />;
      case 'Images':
        return <Image className="w-5 h-5" />;
      case 'Videos':
        return <Video className="w-5 h-5" />;
      case 'Audio':
        return <Music className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const getFilteredAndSortedFiles = (): FileItem[] => {
    let filtered = largeFiles;

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((file) => file.category === categoryFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (file) =>
          file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.path.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = a.lastModified.getTime() - b.lastModified.getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  const files = getFilteredAndSortedFiles();
  const categories = ['all', ...new Set(largeFiles.map((f) => f.category))];
  const selectedCount = files.filter((f) => selectedFiles.has(f.id)).length;

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">File Browser</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse, sort, and organize your files
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-lg border-2 whitespace-nowrap transition-all ${categoryFilter === cat
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                }`}
            >
              {cat === 'all' ? 'All Files' : cat}
            </button>
          ))}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              Move to Cleanup
            </button>
            <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
              Mark as Protected
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Files</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {files.length} file{files.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleSort('name')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'name'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <div className="flex items-center gap-2">
                  Name
                  {sortBy === 'name' && <ArrowUpDown className="w-3 h-3" />}
                </div>
              </button>
              <button
                onClick={() => toggleSort('size')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'size'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <div className="flex items-center gap-2">
                  Size
                  {sortBy === 'size' && <ArrowUpDown className="w-3 h-3" />}
                </div>
              </button>
              <button
                onClick={() => toggleSort('date')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sortBy === 'date'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <div className="flex items-center gap-2">
                  Date
                  {sortBy === 'date' && <ArrowUpDown className="w-3 h-3" />}
                </div>
              </button>
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
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleFileSelection(file.id)}
                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 text-gray-600 dark:text-gray-300">
                    {getCategoryIcon(file.category)}
                  </div>

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
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                            {file.type}
                          </span>
                          <span>Modified: {formatDate(file.lastModified)}</span>
                          <span>Accessed: {formatDate(file.lastAccessed)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {files.length === 0 && (
            <div className="p-12 text-center">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No files found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
