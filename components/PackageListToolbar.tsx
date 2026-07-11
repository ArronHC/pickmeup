import React from 'react';
import { motion } from 'framer-motion';

interface PackageListToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  courierFilter: string;
  onCourierFilterChange: (value: string) => void;
  courierOptions: string[];
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  onBatchPickUp: () => void;
  onBatchDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const PackageListToolbar: React.FC<PackageListToolbarProps> = ({
  searchQuery,
  onSearchQueryChange,
  courierFilter,
  onCourierFilterChange,
  courierOptions,
  selectionMode,
  onToggleSelectionMode,
  selectedCount,
  onBatchPickUp,
  onBatchDelete,
  onSelectAll,
  onClearSelection,
}) => {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="搜索取件码、地点、快递…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-200/50 dark:bg-gray-800/50 text-[13px] text-gray-900 dark:text-white placeholder-gray-400 outline-none border border-transparent focus:border-blue-400/50"
          />
        </div>
        <select
          value={courierFilter}
          onChange={(event) => onCourierFilterChange(event.target.value)}
          className="max-w-[110px] py-2 px-2 rounded-xl bg-gray-200/50 dark:bg-gray-800/50 text-[12px] font-medium text-gray-700 dark:text-gray-200 outline-none"
        >
          <option value="all">全部快递</option>
          {courierOptions.map((courierName) => (
            <option key={courierName} value={courierName}>
              {courierName}
            </option>
          ))}
        </select>
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onToggleSelectionMode}
          className={`px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors
            ${
              selectionMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300'
            }`}
        >
          {selectionMode ? '完成' : '多选'}
        </motion.button>
      </div>

      {selectionMode && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-[12px] font-medium text-blue-600 dark:text-blue-400"
            >
              全选
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[12px] font-medium text-gray-500 dark:text-gray-400"
            >
              清空
            </button>
            <span className="text-[12px] text-gray-500 dark:text-gray-400">
              已选 {selectedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              disabled={selectedCount === 0}
              onClick={onBatchPickUp}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-green-500/90 text-white disabled:opacity-40"
            >
              批量已取
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              disabled={selectedCount === 0}
              onClick={onBatchDelete}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-red-500/90 text-white disabled:opacity-40"
            >
              批量删除
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageListToolbar;
