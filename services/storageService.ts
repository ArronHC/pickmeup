import { PackageData } from '../types';

const STORAGE_KEY = 'pickmeup_packages_v1';

const isPackageData = (value: unknown): value is PackageData => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<PackageData>;
  return Boolean(
    typeof item.id === 'string' &&
      typeof item.pickupCode === 'string' &&
      typeof item.location === 'string' &&
      typeof item.timestamp === 'string' &&
      typeof item.originalText === 'string' &&
      typeof item.isPickedUp === 'boolean' &&
      typeof item.createdAt === 'number'
  );
};

export const savePackages = (packages: PackageData[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  } catch (error) {
    console.error('Failed to save packages to local storage', error);
  }
};

export const loadPackages = (): PackageData[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }

    const parsed: unknown = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPackageData);
  } catch (error) {
    console.error('Failed to load packages from local storage', error);
    return [];
  }
};
