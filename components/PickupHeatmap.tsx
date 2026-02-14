import React, { useState, useMemo } from 'react';
import { PackageData } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface PickupHeatmapProps {
  packages: PackageData[];
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

const getLevel = (count: number): number => {
  if (count >= 4) return 4;
  if (count >= 3) return 3;
  if (count >= 2) return 2;
  if (count >= 1) return 1;
  return 0;
};

const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const PickupHeatmap: React.FC<PickupHeatmapProps> = ({ packages }) => {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(HEATMAP_COLLAPSED_KEY) === 'true';
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(HEATMAP_COLLAPSED_KEY, String(next));
  };

  const { grid, monthLabels, totalCount } = useMemo(() => {
    // 按天聚合包裹数量
    const countMap = new Map<string, number>();
    for (const pkg of packages) {
      const ts = pkg.createdAt ?? new Date(pkg.timestamp).getTime();
      if (!Number.isFinite(ts)) continue;
      const key = formatDateKey(new Date(ts));
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    // 计算日期范围：从本周日（含）向前推 WEEKS 周
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 本周的周日作为最后一列的最后一天
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一 ...
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (7 - (dayOfWeek === 0 ? 7 : dayOfWeek)));

    // 起始日期：向前推 WEEKS 周
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - WEEKS * 7 + 1);

    // 构建网格：columns[weekIndex][dayIndex(0=周一, 6=周日)]
    const columns: { date: Date; count: number }[][] = [];
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    const cursor = new Date(startDate);
    let weekCol: { date: Date; count: number }[] = [];

    while (cursor <= endDate) {
      // 周一=0 ... 周日=6
      const jsDay = cursor.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;

      if (dayIndex === 0 && weekCol.length > 0) {
        columns.push(weekCol);
        weekCol = [];
      }

      // 月份标签
      const curMonth = cursor.getMonth();
      if (curMonth !== lastMonth) {
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        months.push({ label: monthNames[curMonth], colIndex: columns.length });
        lastMonth = curMonth;
      }

      const key = formatDateKey(cursor);
      weekCol.push({ date: new Date(cursor), count: countMap.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (weekCol.length > 0) {
      columns.push(weekCol);
    }

    return {
      grid: columns,
      monthLabels: months,
      totalCount: packages.length,
    };
  }, [packages]);

  return (
    <div className="mb-4">
      <motion.div
        layout
        className="glass-card rounded-[20px] border border-white/60 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm overflow-hidden"
      >
        {/* 标题栏 */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              取件频次
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {totalCount} 个包裹
            </span>
          </div>
          <motion.svg
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={{ duration: 0.2 }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 text-gray-400 dark:text-gray-500"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </motion.svg>
        </button>

        {/* 热力图内容 */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4">
                {/* 月份标签 */}
                <div className="flex ml-6 mb-1">
                  {(() => {
                    const totalCols = grid.length;
                    const colWidth = 13; // 10px方块 + 3px间距
                    const items: React.ReactNode[] = [];
                    for (let i = 0; i < monthLabels.length; i++) {
                      const left = monthLabels[i].colIndex * colWidth;
                      const nextLeft = i + 1 < monthLabels.length
                        ? monthLabels[i + 1].colIndex * colWidth
                        : totalCols * colWidth;
                      const width = nextLeft - left;
                      items.push(
                        <div
                          key={monthLabels[i].label + monthLabels[i].colIndex}
                          className="text-[10px] text-gray-400 dark:text-gray-500 leading-none"
                          style={{ width: `${width}px`, flexShrink: 0 }}
                        >
                          {width >= 26 ? monthLabels[i].label : ''}
                        </div>
                      );
                    }
                    return items;
                  })()}
                </div>

                {/* 网格区域 */}
                <div className="flex">
                  {/* 星期标签 */}
                  <div className="flex flex-col mr-1.5 flex-shrink-0" style={{ gap: '3px' }}>
                    {DAY_LABELS.map((label, i) => (
                      <div
                        key={i}
                        className="text-[9px] text-gray-400 dark:text-gray-500 leading-none flex items-center justify-end"
                        style={{ width: '14px', height: '10px' }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* 方块网格 */}
                  <div className="flex overflow-x-auto no-scrollbar" style={{ gap: '3px' }}>
                    {grid.map((col, colIdx) => (
                      <div key={colIdx} className="flex flex-col" style={{ gap: '3px' }}>
                        {Array.from({ length: 7 }, (_, rowIdx) => {
                          const cell = col.find(c => {
                            const jsDay = c.date.getDay();
                            return (jsDay === 0 ? 6 : jsDay - 1) === rowIdx;
                          });

                          if (!cell) {
                            return (
                              <div
                                key={rowIdx}
                                style={{ width: '10px', height: '10px' }}
                              />
                            );
                          }

                          const level = getLevel(cell.count);
                          const dateStr = `${cell.date.getMonth() + 1}月${cell.date.getDate()}日`;
                          const title = cell.count > 0
                            ? `${dateStr}：${cell.count} 个包裹`
                            : `${dateStr}：无包裹`;

                          return (
                            <div
                              key={rowIdx}
                              title={title}
                              className={`rounded-[2px] ${LEVEL_COLORS_LIGHT[level]} ${LEVEL_COLORS_DARK[level]}`}
                              style={{ width: '10px', height: '10px' }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 底部：色阶图例 */}
                <div className="flex items-center justify-end mt-3 gap-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">少</span>
                  {LEVEL_THRESHOLDS.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-[2px] ${LEVEL_COLORS_LIGHT[i]} ${LEVEL_COLORS_DARK[i]}`}
                      style={{ width: '10px', height: '10px' }}
                    />
                  ))}
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">多</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default PickupHeatmap;
