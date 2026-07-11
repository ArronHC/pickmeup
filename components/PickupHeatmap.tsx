import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import { PackageData } from '../types';

interface PickupHeatmapProps {
  packages: PackageData[];
}

interface HeatmapCell {
  date: Date;
  count: number;
}

const WEEKS = 16;
const HEATMAP_COLLAPSED_KEY = 'pickmeup_heatmap_collapsed';

const DAY_LABELS = ['一', '', '三', '', '五', '', '日'] as const;
const LEVEL_THRESHOLDS = [0, 1, 2, 3, 4] as const;

const LEVEL_COLORS_LIGHT = [
  'bg-gray-100',
  'bg-blue-100',
  'bg-blue-300',
  'bg-blue-500',
  'bg-blue-700',
];
const LEVEL_COLORS_DARK = [
  'dark:bg-gray-800',
  'dark:bg-blue-900',
  'dark:bg-blue-700',
  'dark:bg-blue-500',
  'dark:bg-blue-400',
];

const MONTH_NAMES = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

const getLevel = (count: number): number => {
  if (count >= 4) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  if (count >= 1) return 1;
  return 0;
};

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PickupHeatmap: React.FC<PickupHeatmapProps> = ({ packages }) => {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(HEATMAP_COLLAPSED_KEY) === 'true';
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = () => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    localStorage.setItem(HEATMAP_COLLAPSED_KEY, String(nextCollapsed));
  };

  useEffect(() => {
    if (!selectedDate) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setSelectedDate(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedDate]);

  const packagesMap = useMemo(() => {
    const map = new Map<string, PackageData[]>();
    for (const pkg of packages) {
      const timestamp = pkg.createdAt ?? new Date(pkg.timestamp).getTime();
      if (!Number.isFinite(timestamp)) continue;
      const key = formatDateKey(new Date(timestamp));
      const existing = map.get(key);
      if (existing) {
        existing.push(pkg);
      } else {
        map.set(key, [pkg]);
      }
    }
    return map;
  }, [packages]);

  const { grid, monthLabels, totalCount } = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const pkg of packages) {
      const timestamp = pkg.createdAt ?? new Date(pkg.timestamp).getTime();
      if (!Number.isFinite(timestamp)) continue;
      const key = formatDateKey(new Date(timestamp));
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (7 - (dayOfWeek === 0 ? 7 : dayOfWeek)));

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - WEEKS * 7 + 1);

    // columns[weekIndex][dayIndex] dayIndex: 0=周一 ... 6=周日
    const columns: (HeatmapCell | null)[][] = [];
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    const cursor = new Date(startDate);
    let weekCol: (HeatmapCell | null)[] = Array.from({ length: 7 }, () => null);

    while (cursor <= endDate) {
      const jsDay = cursor.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;

      if (dayIndex === 0 && weekCol.some((cell) => cell !== null)) {
        columns.push(weekCol);
        weekCol = Array.from({ length: 7 }, () => null);
      }

      const currentMonth = cursor.getMonth();
      if (currentMonth !== lastMonth) {
        months.push({ label: MONTH_NAMES[currentMonth], colIndex: columns.length });
        lastMonth = currentMonth;
      }

      const key = formatDateKey(cursor);
      weekCol[dayIndex] = {
        date: new Date(cursor),
        count: countMap.get(key) ?? 0,
      };
      cursor.setDate(cursor.getDate() + 1);
    }

    if (weekCol.some((cell) => cell !== null)) {
      columns.push(weekCol);
    }

    return {
      grid: columns,
      monthLabels: months,
      totalCount: packages.length,
    };
  }, [packages]);

  const selectedPackages = selectedDate ? packagesMap.get(selectedDate) || [] : [];
  const selectedDateDisplay = selectedDate
    ? (() => {
        const date = new Date(selectedDate);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      })()
    : '';

  return (
    <div className="mb-4">
      <div className="glass-card rounded-[20px] border border-white/60 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-between px-5 py-4 text-left active-scale"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">取件频次</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {totalCount} 个包裹
            </span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
              collapsed ? '' : 'rotate-180'
            }`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {!collapsed && (
          <div className="px-5 pb-4">
            <div className="flex ml-6 mb-1">
              {(() => {
                const totalCols = grid.length;
                const colWidth = 13;
                const items: React.ReactNode[] = [];
                for (let index = 0; index < monthLabels.length; index += 1) {
                  const left = monthLabels[index].colIndex * colWidth;
                  const nextLeft =
                    index + 1 < monthLabels.length
                      ? monthLabels[index + 1].colIndex * colWidth
                      : totalCols * colWidth;
                  const width = nextLeft - left;
                  items.push(
                    <div
                      key={monthLabels[index].label + monthLabels[index].colIndex}
                      className="text-[10px] text-gray-400 dark:text-gray-500 leading-none"
                      style={{ width: `${width}px`, flexShrink: 0 }}
                    >
                      {width >= 26 ? monthLabels[index].label : ''}
                    </div>
                  );
                }
                return items;
              })()}
            </div>

            <div className="flex">
              <div className="flex flex-col mr-1.5 flex-shrink-0" style={{ gap: '3px' }}>
                {DAY_LABELS.map((label, index) => (
                  <div
                    key={index}
                    className="text-[9px] text-gray-400 dark:text-gray-500 leading-none flex items-center justify-end"
                    style={{ width: '14px', height: '10px' }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="flex overflow-x-auto no-scrollbar" style={{ gap: '3px' }}>
                {grid.map((col, colIdx) => (
                  <div key={colIdx} className="flex flex-col" style={{ gap: '3px' }}>
                    {col.map((cell, rowIdx) => {
                      if (!cell) {
                        return <div key={rowIdx} style={{ width: '10px', height: '10px' }} />;
                      }

                      const level = getLevel(cell.count);
                      const dateKey = formatDateKey(cell.date);
                      const isSelected = selectedDate === dateKey;
                      const hasPackages = cell.count > 0;

                      return (
                        <div
                          key={rowIdx}
                          onClick={
                            hasPackages
                              ? () => setSelectedDate(isSelected ? null : dateKey)
                              : undefined
                          }
                          className={`rounded-[2px] ${LEVEL_COLORS_LIGHT[level]} ${LEVEL_COLORS_DARK[level]} ${
                            hasPackages ? 'cursor-pointer' : ''
                          } ${
                            isSelected
                              ? 'ring-1 ring-gray-900 dark:ring-white ring-offset-1'
                              : ''
                          }`}
                          style={{ width: '10px', height: '10px' }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end mt-3 gap-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">少</span>
              {LEVEL_THRESHOLDS.map((_, index) => (
                <div
                  key={index}
                  className={`rounded-[2px] ${LEVEL_COLORS_LIGHT[index]} ${LEVEL_COLORS_DARK[index]}`}
                  style={{ width: '10px', height: '10px' }}
                />
              ))}
              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">多</span>
            </div>

            {selectedDate && selectedPackages.length > 0 && (
              <div
                ref={popoverRef}
                className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/60 border border-gray-200/50 dark:border-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    {selectedDateDisplay} · {selectedPackages.length} 个包裹
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
                  {selectedPackages.map((pkg) => (
                    <div key={pkg.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">
                        {pkg.pickupCode}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 truncate">
                        {pkg.location}
                      </span>
                      {(pkg.status === 'picked' || pkg.isPickedUp) && (
                        <span className="flex-shrink-0 text-[10px] text-green-600 dark:text-green-400 font-medium">
                          已取
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(PickupHeatmap);
