import { PackageData } from '../types';

const STORAGE_KEY = 'pickmeup_packages_v1';

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
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load packages from local storage', error);
    return [];
  }
};