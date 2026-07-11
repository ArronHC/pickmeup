import { PackageData } from '../types';

const STORAGE_KEY = 'pickmeup_packages_v1';
const SAVE_DEBOUNCE_MS = 280;

let pendingSaveTimer: number | null = null;
let pendingPackages: PackageData[] | null = null;

const writePackagesNow = (packages: PackageData[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  } catch (error) {
    console.error('Failed to save packages to local storage', error);
  }
};

/** 立即写入（应用退出前可手动 flush） */
export const savePackages = (packages: PackageData[]): void => {
  pendingPackages = packages;
  if (pendingSaveTimer !== null) {
    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }
  writePackagesNow(packages);
  pendingPackages = null;
};

/** 防抖写入，避免列表高频更新时同步阻塞主线程 */
export const savePackagesDebounced = (packages: PackageData[]): void => {
  pendingPackages = packages;
  if (pendingSaveTimer !== null) {
    window.clearTimeout(pendingSaveTimer);
  }
  pendingSaveTimer = window.setTimeout(() => {
    pendingSaveTimer = null;
    if (pendingPackages) {
      writePackagesNow(pendingPackages);
      pendingPackages = null;
    }
  }, SAVE_DEBOUNCE_MS);
};

export const flushPendingPackageSave = (): void => {
  if (pendingSaveTimer !== null) {
    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }
  if (pendingPackages) {
    writePackagesNow(pendingPackages);
    pendingPackages = null;
  }
};

export const loadPackages = (): PackageData[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load packages from local storage', error);
    return [];
  }
};
