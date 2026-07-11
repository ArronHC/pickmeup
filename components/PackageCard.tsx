import React, { useRef, useState, useEffect, memo, useCallback } from 'react';
import { PackageData } from '../types';
import { getCourierDisplayLabel, getCourierIconSource } from '../services/courierIcons';
import { motion } from 'framer-motion';

interface PackageCardProps {
  pkg: PackageData;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const formatPackageDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatExpiresAt = (expiresAt: number): string => {
  const expiresAtDate = new Date(expiresAt);
  return `${expiresAtDate.getMonth() + 1}月${expiresAtDate.getDate()}日 ${expiresAtDate
    .getHours()
    .toString()
    .padStart(2, '0')}:${expiresAtDate.getMinutes().toString().padStart(2, '0')}`;
};

const PackageCard: React.FC<PackageCardProps> = ({
  pkg,
  onToggleStatus,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}) => {
  const formattedDate = formatPackageDate(pkg.timestamp);
  const formattedExpiresAt = pkg.expiresAt ? formatExpiresAt(pkg.expiresAt) : null;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const courierIconSource = getCourierIconSource(pkg.courier);
  const courierLabel = getCourierDisplayLabel(pkg.courier);
  const isPicked = pkg.status === 'picked' || pkg.isPickedUp;

  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pkg.pickupCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = pkg.pickupCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (copyTimer.current) {
        window.clearTimeout(copyTimer.current);
      }
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('复制失败', error);
    }
  }, [pkg.pickupCode]);

  const handleToggleSelect = useCallback(() => {
    onToggleSelect?.(pkg.id);
  }, [onToggleSelect, pkg.id]);

  const handleToggleStatusClick = useCallback(() => {
    onToggleStatus(pkg.id);
  }, [onToggleStatus, pkg.id]);

  const handleDeleteClick = useCallback(() => {
    onDelete(pkg.id);
  }, [onDelete, pkg.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 48, transition: { duration: 0.18, ease: 'easeOut' } }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={`package-card relative overflow-hidden rounded-[20px] glass-card border mb-4
      ${
        selected
          ? 'border-blue-400/80 dark:border-blue-500/60 ring-2 ring-blue-500/20'
          : 'border-white/60 dark:border-white/10'
      }
      ${
        isPicked
          ? 'bg-gray-100/40 dark:bg-gray-800/20 opacity-70'
          : 'bg-white dark:bg-slate-800 shadow-sm'
      }`}
    >
      <div className="flex p-5">
        {selectionMode && (
          <button
            type="button"
            onClick={handleToggleSelect}
            className="mr-3 mt-1 flex-shrink-0 active-scale"
            aria-label={selected ? '取消选择' : '选择'}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
              ${
                selected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-500'
              }`}
            >
              {selected && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {courierIconSource ? (
                  <img
                    src={courierIconSource}
                    alt={courierLabel}
                    className="w-5 h-5 object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5 text-gray-400"
                  >
                    <path d="M3.5 3.75A.75.75 0 014.25 3h11.5a.75.75 0 01.75.75v3.026a2.25 2.25 0 00-.75-.126H4.25a2.25 2.25 0 00-.75.126V3.75zM3.5 9.25v7A.75.75 0 004.25 17h11.5a.75.75 0 00.75-.75v-7a.75.75 0 00-.75-.75H4.25a.75.75 0 00-.75.75z" />
                  </svg>
                )}
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                {courierLabel}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-auto flex-shrink-0">
              {formattedDate}
            </span>
          </div>

          {isPicked && formattedExpiresAt && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-1">
              过期时间 {formattedExpiresAt}
            </div>
          )}

          <div className="my-1.5">
            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">
              取件码 · 点击复制
            </div>
            <button
              type="button"
              onClick={handleCopy}
              title="点击复制取件码"
              className={`text-left text-3xl font-bold tracking-tight font-sans transition-colors active-scale
                ${
                  isPicked
                    ? 'text-gray-400 dark:text-gray-600 line-through decoration-2'
                    : 'text-gray-900 dark:text-white drop-shadow-sm hover:text-blue-700 dark:hover:text-blue-300'
                }`}
            >
              {pkg.pickupCode}
            </button>
            {copied && (
              <div className="mt-1 text-xs font-semibold text-green-600 dark:text-green-400">
                已复制
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 flex-shrink-0 opacity-70"
            >
              <path
                fillRule="evenodd"
                d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.006.003.002.001.003.001a.79.79 0 00.01 0zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium truncate opacity-90">{pkg.location}</span>
          </div>

          {pkg.address && (
            <div className="mt-2 flex items-start gap-1.5 text-gray-500 dark:text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 flex-shrink-0 opacity-70 mt-0.5"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a.75.75 0 01-.75-.75v-1.5a.75.75 0 011.5 0V17.5A.75.75 0 0110 18zm0-4a.75.75 0 01-.75-.75v-6a.75.75 0 011.5 0v6A.75.75 0 0110 14zm0-9.5a.75.75 0 01.75.75V6a.75.75 0 01-1.5 0V5.25A.75.75 0 0110 4.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs leading-relaxed">{pkg.address}</span>
            </div>
          )}
        </div>

        {!selectionMode && (
          <div className="flex flex-col justify-center pl-4 border-l border-gray-100 dark:border-white/10 ml-2 gap-3">
            <button
              type="button"
              onClick={handleToggleStatusClick}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shadow-sm active-scale
              ${
                isPicked
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40'
              }`}
            >
              {isPicked ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-red-100/50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-200/50 dark:hover:bg-red-900/40 transition-colors active-scale"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path
                  fillRule="evenodd"
                  d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

function arePackageCardPropsEqual(previous: PackageCardProps, next: PackageCardProps): boolean {
  return (
    previous.pkg === next.pkg &&
    previous.selectionMode === next.selectionMode &&
    previous.selected === next.selected &&
    previous.onToggleStatus === next.onToggleStatus &&
    previous.onDelete === next.onDelete &&
    previous.onToggleSelect === next.onToggleSelect
  );
}

export default memo(PackageCard, arePackageCardPropsEqual);
