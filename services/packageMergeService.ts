import { PackageData } from '../types';
import { normalizePickupCode } from './pickupTextRules';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isSameDelivery(
  existing: PackageData,
  incoming: Pick<PackageData, 'pickupCode' | 'location' | 'timestamp'>,
  now = Date.now()
): boolean {
  if (normalizePickupCode(existing.pickupCode) !== normalizePickupCode(incoming.pickupCode)) {
    return false;
  }

  const existingTime = new Date(existing.timestamp).getTime();
  const incomingTime = new Date(incoming.timestamp).getTime();
  const referenceTime = Number.isFinite(incomingTime) ? incomingTime : now;

  return (
    Math.abs((Number.isFinite(existingTime) ? existingTime : now) - referenceTime) <=
    DUPLICATE_WINDOW_MS
  );
}

export function findDuplicatePackage(
  packages: PackageData[],
  incoming: Pick<PackageData, 'pickupCode' | 'location' | 'timestamp'>
): number {
  return packages.findIndex((item) => isSameDelivery(item, incoming));
}
