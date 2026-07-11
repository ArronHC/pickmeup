import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { PackageData, ExtractedInfo } from './types';
import {
  loadPackages,
  savePackagesDebounced,
  flushPendingPackageSave,
} from './services/storageService';
import { SmsReader, isNativePlatform } from './services/smsService';
import { extractInfoFromTextSync } from './services/extractionService';
import { normalizePickupCode } from './services/pickupTextRules';
import { detectCourierName } from './services/courierIcons';
import {
  normalizePackageRecord,
  purgeExpiredPackages,
  markPackagePicked,
  markPackageActive,
  markPackageDeleted,
  isVisibleInList,
} from './services/packageLifecycle';
import PackageCard from './components/PackageCard';
import AddPackageModal from './components/AddPackageModal';
import SmsImportModal from './components/SmsImportModal';
import ConfirmDialog from './components/ConfirmDialog';
import Onboarding from './components/Onboarding';
import PickupHeatmap from './components/PickupHeatmap';
import PackageListToolbar from './components/PackageListToolbar';
import { AnimatePresence, motion } from 'framer-motion';

const SMS_AUTO_IMPORT_LAST_SYNC_KEY = 'pickmeup_sms_last_sync_ts';
const SEARCH_DEBOUNCE_MS = 180;
/** 批量/自动导入时每处理若干条让出主线程，避免 UI 卡死 */
const IMPORT_YIELD_EVERY = 8;

const yieldToMainThread = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

const App: React.FC = () => {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [filter, setFilter] = useState<'active' | 'history'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'location'>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isAutoImporting, setIsAutoImporting] = useState(false);
  const [autoImportNotice, setAutoImportNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [courierFilter, setCourierFilter] = useState('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const packagesRef = useRef<PackageData[]>([]);
  const autoImportLockRef = useRef(false);
  const autoImportNoticeTimerRef = useRef<number | null>(null);
  const searchDebounceTimerRef = useRef<number | null>(null);
  const hasHydratedPackagesRef = useRef(false);

  const commitPackages = useCallback((next: PackageData[]) => {
    const purged = purgeExpiredPackages(next);
    packagesRef.current = purged;
    setPackages(purged);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    const data = purgeExpiredPackages(
      loadPackages().map((record) => normalizePackageRecord(record))
    );
    data.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
    packagesRef.current = data;
    setPackages(data);
    hasHydratedPackagesRef.current = true;

    const hasSeenOnboarding = localStorage.getItem('has_seen_onboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    const savedSortBy = localStorage.getItem('packages_sort_by');
    const savedSortDirection = localStorage.getItem('packages_sort_direction');
    if (savedSortBy === 'time' || savedSortBy === 'location') {
      setSortBy(savedSortBy);
    }
    if (savedSortDirection === 'asc' || savedSortDirection === 'desc') {
      setSortDirection(savedSortDirection);
    }

    setIsNative(isNativePlatform());
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((previousMode) => {
      const nextMode = !previousMode;
      if (nextMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return nextMode;
    });
  }, []);

  useEffect(() => {
    if (!hasHydratedPackagesRef.current) {
      return;
    }
    packagesRef.current = packages;
    savePackagesDebounced(packages);
  }, [packages]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingPackageSave();
      }
    };
    const handlePageHide = () => {
      flushPendingPackageSave();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingPackageSave();
      if (searchDebounceTimerRef.current) {
        window.clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('packages_sort_by', sortBy);
    localStorage.setItem('packages_sort_direction', sortDirection);
  }, [sortBy, sortDirection]);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceTimerRef.current) {
      window.clearTimeout(searchDebounceTimerRef.current);
    }
    searchDebounceTimerRef.current = window.setTimeout(() => {
      startTransition(() => {
        setSearchQuery(value);
      });
    }, SEARCH_DEBOUNCE_MS);
  }, [startTransition]);

  const handleCompleteOnboarding = useCallback(() => {
    localStorage.setItem('has_seen_onboarding', 'true');
    setShowOnboarding(false);
  }, []);

  const handleAddPackage = useCallback(
    (
      info: ExtractedInfo,
      originalText: string,
      options?: { sourceTimestamp?: number; preferSourceTimestamp?: boolean }
    ): boolean => {
      const incomingCode = normalizePickupCode(info.pickupCode);

      const resolvedTimestamp = (() => {
        if (options?.preferSourceTimestamp && options.sourceTimestamp) {
          return new Date(options.sourceTimestamp).toISOString();
        }
        if (info.timestamp) {
          return info.timestamp;
        }
        if (options?.sourceTimestamp) {
          return new Date(options.sourceTimestamp).toISOString();
        }
        return new Date().toISOString();
      })();

      const resolvedCourier = detectCourierName(originalText, info.courier);

      const newPackage: PackageData = {
        id: crypto.randomUUID(),
        pickupCode: normalizePickupCode(info.pickupCode),
        location: info.location,
        address: info.address,
        courier: resolvedCourier,
        timestamp: resolvedTimestamp,
        originalText: originalText,
        status: 'active',
        isPickedUp: false,
        createdAt: Date.now(),
      };

      const current = packagesRef.current;
      const existingIndex = current.findIndex(
        (pkg) => normalizePickupCode(pkg.pickupCode) === incomingCode
      );

      if (existingIndex !== -1) {
        const existing = current[existingIndex];

        // 已删除墓碑：3 天内不复活、不升级
        if (existing.status === 'deleted') {
          return false;
        }

        const shouldUpgradeLocation =
          (existing.location === '未知' || !existing.location) &&
          !!info.location &&
          info.location !== '未知';
        const shouldUpgradeAddress = !existing.address && !!info.address;
        const shouldUpgradeOriginalText =
          (!existing.originalText || existing.originalText === '图片识别导入') &&
          !!originalText &&
          originalText !== '图片识别导入';
        const shouldUpgradeCourier =
          (!existing.courier || existing.courier === '未知') &&
          !!resolvedCourier &&
          resolvedCourier !== '未知';

        if (
          !(
            shouldUpgradeLocation ||
            shouldUpgradeAddress ||
            shouldUpgradeOriginalText ||
            shouldUpgradeCourier
          )
        ) {
          return false;
        }

        const updated = [...current];
        updated[existingIndex] = {
          ...existing,
          location: shouldUpgradeLocation ? info.location : existing.location,
          address: shouldUpgradeAddress ? info.address : existing.address,
          originalText: shouldUpgradeOriginalText ? originalText : existing.originalText,
          courier: shouldUpgradeCourier ? resolvedCourier : existing.courier,
        };
        commitPackages(updated);
        return false;
      }

      commitPackages([newPackage, ...current]);
      return true;
    },
    [commitPackages]
  );

  const handleToggleStatus = useCallback(
    (id: string) => {
      const now = Date.now();
      const next = packagesRef.current.map((pkg) => {
        if (pkg.id !== id) return pkg;
        if (pkg.status === 'picked' || pkg.isPickedUp) {
          return markPackageActive(pkg);
        }
        return markPackagePicked(pkg, now);
      });
      commitPackages(next);
    },
    [commitPackages]
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmId) return;
    const now = Date.now();
    const next = packagesRef.current.map((pkg) =>
      pkg.id === deleteConfirmId ? markPackageDeleted(pkg, now) : pkg
    );
    commitPackages(next);
    setDeleteConfirmId(null);
    setSelectedIds((previous) => {
      const updated = new Set(previous);
      updated.delete(deleteConfirmId);
      return updated;
    });
  }, [commitPackages, deleteConfirmId]);

  const togglePackageSelection = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const showAutoImportNotice = useCallback((message: string) => {
    setAutoImportNotice(message);
    if (autoImportNoticeTimerRef.current) {
      window.clearTimeout(autoImportNoticeTimerRef.current);
    }
    autoImportNoticeTimerRef.current = window.setTimeout(() => {
      setAutoImportNotice(null);
    }, 2600);
  }, []);

  const syncNativeAutoImportedPackages = useCallback(async (): Promise<number> => {
    const result = await SmsReader.getAutoImportedPackages();
    const nativePackages = [...(result.packages || [])];
    if (nativePackages.length === 0) {
      return 0;
    }

    nativePackages.sort((left, right) => {
      const leftTime = left.sourceTimestamp ?? new Date(left.timestamp).getTime();
      const rightTime = right.sourceTimestamp ?? new Date(right.timestamp).getTime();
      return leftTime - rightTime;
    });

    const processedIds: string[] = [];
    let importedCount = 0;

    for (let index = 0; index < nativePackages.length; index += 1) {
      const nativePkg = nativePackages[index];
      if (!nativePkg?.id || !nativePkg?.pickupCode) {
        continue;
      }
      processedIds.push(nativePkg.id);
      const added = handleAddPackage(
        {
          pickupCode: nativePkg.pickupCode,
          location: nativePkg.location || '未知',
          address: nativePkg.address,
          timestamp: nativePkg.timestamp,
        },
        nativePkg.originalText || '',
        {
          sourceTimestamp: nativePkg.sourceTimestamp,
          preferSourceTimestamp: true,
        }
      );
      if (added) {
        importedCount += 1;
      }
      if ((index + 1) % IMPORT_YIELD_EVERY === 0) {
        await yieldToMainThread();
      }
    }

    if (processedIds.length > 0) {
      await SmsReader.clearAutoImportedPackages({ ids: processedIds });
    }

    return importedCount;
  }, [handleAddPackage]);

  const runAutoSmsImport = useCallback(async () => {
    if (!isNativePlatform() || autoImportLockRef.current) {
      return;
    }

    autoImportLockRef.current = true;
    setIsAutoImporting(true);

    try {
      let permissionResult = await SmsReader.checkPermission();
      if (!permissionResult.granted) {
        permissionResult = await SmsReader.requestPermission();
      }
      if (!permissionResult.granted) {
        return;
      }

      let totalSuccessCount = 0;
      try {
        totalSuccessCount += await syncNativeAutoImportedPackages();
      } catch (error) {
        console.error('同步原生自动入库数据失败', error);
      }

      const savedSyncRaw = localStorage.getItem(SMS_AUTO_IMPORT_LAST_SYNC_KEY) || '0';
      const savedSyncTimestamp = Number.parseInt(savedSyncRaw, 10);
      const hasValidSync = Number.isFinite(savedSyncTimestamp) && savedSyncTimestamp > 0;
      const smsResult = await SmsReader.getDeliverySms(
        hasValidSync
          ? { limit: 200, sinceTimestamp: Math.max(0, savedSyncTimestamp - 60 * 1000) }
          : { limit: 200, sinceDays: 7 }
      );
      const orderedMessages = [...smsResult.messages].sort((left, right) => left.date - right.date);

      let maxMessageTimestamp = hasValidSync ? savedSyncTimestamp : 0;
      let successCount = 0;
      let failedCount = 0;

      for (let index = 0; index < orderedMessages.length; index += 1) {
        const message = orderedMessages[index];
        maxMessageTimestamp = Math.max(maxMessageTimestamp, message.date);
        try {
          const info = extractInfoFromTextSync(message.body);
          const added = handleAddPackage(info, message.body, {
            sourceTimestamp: message.date,
            preferSourceTimestamp: true,
          });
          if (added) {
            successCount += 1;
          }
        } catch (error) {
          failedCount += 1;
          console.error('自动识别短信失败', error);
        }
        if ((index + 1) % IMPORT_YIELD_EVERY === 0) {
          await yieldToMainThread();
        }
      }

      if (maxMessageTimestamp > 0) {
        localStorage.setItem(SMS_AUTO_IMPORT_LAST_SYNC_KEY, String(maxMessageTimestamp + 1));
      }

      totalSuccessCount += successCount;

      if (totalSuccessCount > 0 && failedCount > 0) {
        showAutoImportNotice(`自动导入 ${totalSuccessCount} 条，失败 ${failedCount} 条`);
      } else if (totalSuccessCount > 0) {
        showAutoImportNotice(`已自动导入 ${totalSuccessCount} 条短信`);
      } else if (failedCount > 0) {
        showAutoImportNotice(`自动识别失败 ${failedCount} 条`);
      }
    } catch (error) {
      console.error('自动导入短信失败', error);
      showAutoImportNotice('自动导入短信失败，请稍后重试');
    } finally {
      autoImportLockRef.current = false;
      setIsAutoImporting(false);
    }
  }, [handleAddPackage, showAutoImportNotice, syncNativeAutoImportedPackages]);

  useEffect(() => {
    return () => {
      if (autoImportNoticeTimerRef.current) {
        window.clearTimeout(autoImportNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isNative) {
      return;
    }
    void runAutoSmsImport();
  }, [isNative, runAutoSmsImport]);

  const heatmapPackages = useMemo(
    () => packages.filter((pkg) => pkg.status !== 'deleted'),
    [packages]
  );

  const filteredPackages = useMemo(
    () => packages.filter((pkg) => isVisibleInList(pkg, filter)),
    [packages, filter]
  );

  const courierOptions = useMemo(() => {
    const names = new Set<string>();
    for (const pkg of packages) {
      if (pkg.status === 'deleted') continue;
      if (pkg.courier && pkg.courier !== '未知') {
        names.add(pkg.courier);
      }
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
  }, [packages]);

  const searchedPackages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return filteredPackages.filter((pkg) => {
      if (courierFilter !== 'all' && (pkg.courier || '未知') !== courierFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        pkg.pickupCode,
        normalizePickupCode(pkg.pickupCode),
        pkg.location,
        pkg.address || '',
        pkg.courier || '',
        pkg.originalText || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [filteredPackages, searchQuery, courierFilter]);

  const sortedPackages = useMemo(() => {
    return [...searchedPackages].sort((left, right) => {
      if (sortBy === 'time') {
        const leftTime = new Date(left.timestamp).getTime();
        const rightTime = new Date(right.timestamp).getTime();
        return sortDirection === 'asc' ? leftTime - rightTime : rightTime - leftTime;
      }
      const leftLocation = (left.location || '').toLowerCase();
      const rightLocation = (right.location || '').toLowerCase();
      const comparison = leftLocation.localeCompare(rightLocation, 'zh-Hans-CN');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [searchedPackages, sortBy, sortDirection]);

  const handleSelectAllVisible = useCallback(() => {
    setSelectedIds(new Set(sortedPackages.map((pkg) => pkg.id)));
  }, [sortedPackages]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((previous) => {
      if (previous) {
        setSelectedIds(new Set());
      }
      return !previous;
    });
  }, []);

  const handleBatchPickUp = useCallback(() => {
    if (selectedIds.size === 0) return;
    const now = Date.now();
    const next = packagesRef.current.map((pkg) => {
      if (!selectedIds.has(pkg.id) || pkg.status !== 'active') {
        return pkg;
      }
      return markPackagePicked(pkg, now);
    });
    commitPackages(next);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [commitPackages, selectedIds]);

  const confirmBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) {
      setBatchDeleteConfirmOpen(false);
      return;
    }
    const now = Date.now();
    const next = packagesRef.current.map((pkg) =>
      selectedIds.has(pkg.id) ? markPackageDeleted(pkg, now) : pkg
    );
    commitPackages(next);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBatchDeleteConfirmOpen(false);
  }, [commitPackages, selectedIds]);

  const openBatchDeleteConfirm = useCallback(() => {
    setBatchDeleteConfirmOpen(true);
  }, []);

  const openAddModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const openSmsModal = useCallback(() => {
    setIsSmsModalOpen(true);
  }, []);

  const closeSmsModal = useCallback(() => {
    setIsSmsModalOpen(false);
  }, []);

  const cancelDeleteConfirm = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const cancelBatchDeleteConfirm = useCallback(() => {
    setBatchDeleteConfirmOpen(false);
  }, []);

  const emptyTitle =
    searchQuery.trim() || courierFilter !== 'all'
      ? '没有匹配的包裹'
      : filter === 'active'
        ? '暂无待取包裹'
        : '暂无历史记录';

  const emptyDescription =
    searchQuery.trim() || courierFilter !== 'all'
      ? '试试调整搜索词或快递筛选条件。'
      : filter === 'active'
        ? '点击右上角加号，粘贴取件短信开始管理。'
        : '标记已取件后，记录会在这里保留 3 天。';

  if (showOnboarding) {
    return <Onboarding onComplete={handleCompleteOnboarding} isDarkMode={isDarkMode} />;
  }

  return (
    <div
      className={`min-h-screen pb-safe transition-colors duration-300 ease-out
      ${isDarkMode ? 'bg-black' : 'bg-[#F2F2F7]'}`}
    >
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 px-5 pt-safe-top pb-4 glass-panel">
          <div className="flex justify-between items-center mb-4 mt-2">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/logo.svg"
                alt="取件助手"
                className="w-12 h-12 rounded-[14px] shadow-sm flex-shrink-0"
                decoding="async"
              />
              <div className="min-w-0">
                <h1 className="text-[32px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                  取件助手
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  PickMeUp
                </p>
                {isNative && (isAutoImporting || autoImportNotice) && (
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1 font-medium">
                    {isAutoImporting ? '正在自动识别短信...' : autoImportNotice}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 text-gray-600 dark:text-yellow-400 active-scale"
              >
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.591a.75.75 0 101.06 1.061l1.591-1.591zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM10.5 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path
                      fillRule="evenodd"
                      d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {isNative && (
                <button
                  type="button"
                  onClick={openSmsModal}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500 text-white shadow-lg shadow-green-500/30 active-scale"
                  title="从短信导入"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                    <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={openAddModal}
                className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 active-scale"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path
                    fillRule="evenodd"
                    d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="bg-gray-200/50 dark:bg-gray-800/50 p-1 rounded-[12px] flex">
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`flex-1 py-1.5 text-[13px] font-semibold rounded-[10px] transition-colors duration-200 ${
                filter === 'active'
                  ? 'bg-white dark:bg-slate-600 text-black dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              待取件
            </button>
            <button
              type="button"
              onClick={() => setFilter('history')}
              className={`flex-1 py-1.5 text-[13px] font-semibold rounded-[10px] transition-colors duration-200 ${
                filter === 'history'
                  ? 'bg-white dark:bg-slate-600 text-black dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              已取件
            </button>
          </div>

          <PackageListToolbar
            searchQuery={searchInput}
            onSearchQueryChange={handleSearchQueryChange}
            courierFilter={courierFilter}
            onCourierFilterChange={setCourierFilter}
            courierOptions={courierOptions}
            selectionMode={selectionMode}
            onToggleSelectionMode={handleToggleSelectionMode}
            selectedCount={selectedIds.size}
            onBatchPickUp={handleBatchPickUp}
            onBatchDelete={openBatchDeleteConfirm}
            onSelectAll={handleSelectAllVisible}
            onClearSelection={handleClearSelection}
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
              {sortedPackages.length} 个包裹
              {sortedPackages.length !== filteredPackages.length
                ? `（筛选自 ${filteredPackages.length}）`
                : ''}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex bg-gray-200/50 dark:bg-gray-800/50 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setSortBy('time')}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors
                      ${
                        sortBy === 'time'
                          ? 'bg-white dark:bg-slate-600 text-black dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                >
                  时间
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('location')}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors
                      ${
                        sortBy === 'location'
                          ? 'bg-white dark:bg-slate-600 text-black dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                >
                  地点
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 active-scale"
              >
                {sortDirection === 'asc' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path
                      fillRule="evenodd"
                      d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path
                      fillRule="evenodd"
                      d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pt-4 pb-32 flex-1 overflow-x-hidden">
          {filter === 'active' && !searchQuery.trim() && courierFilter === 'all' && (
            <PickupHeatmap packages={heatmapPackages} />
          )}
          <AnimatePresence initial={false}>
            {sortedPackages.length === 0 ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="w-24 h-24 bg-white/50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-6 text-gray-400 dark:text-gray-500 shadow-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-10 h-10"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.251l4.286 4.286m-4.286-4.286L7.964 15.25m4.286-4.286V2.25"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{emptyTitle}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-[15px] max-w-[240px]">
                  {emptyDescription}
                </p>
              </motion.div>
            ) : (
              sortedPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(pkg.id)}
                  onToggleSelect={togglePackageSelection}
                />
              ))
            )}
          </AnimatePresence>
        </main>

        <AddPackageModal
          isOpen={isModalOpen}
          onClose={closeAddModal}
          onAdd={handleAddPackage}
        />

        <SmsImportModal
          isOpen={isSmsModalOpen}
          onClose={closeSmsModal}
          onImport={handleAddPackage}
        />

        <ConfirmDialog
          isOpen={!!deleteConfirmId}
          title="删除包裹"
          message="删除后 3 天内不会再次自动导入相同取件码。"
          confirmLabel="删除"
          confirmVariant="danger"
          onConfirm={confirmDelete}
          onCancel={cancelDeleteConfirm}
        />

        <ConfirmDialog
          isOpen={batchDeleteConfirmOpen}
          title="批量删除"
          message={`将删除已选的 ${selectedIds.size} 个包裹，3 天内不会重复导入。`}
          confirmLabel="删除"
          confirmVariant="danger"
          onConfirm={confirmBatchDelete}
          onCancel={cancelBatchDeleteConfirm}
        />
      </div>
    </div>
  );
};

export default App;
