import { PackageData, PackageStatus } from '../types';

/** 取件 / 删除后的保留时长（与防重一致） */
export const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

type LegacyPackageRecord = Partial<PackageData> & {
  id?: string;
  pickupCode?: string;
  isPickedUp?: boolean;
  status?: PackageStatus;
};

const resolveLegacyStatus = (record: LegacyPackageRecord): PackageStatus => {
  if (record.status === 'active' || record.status === 'picked' || record.status === 'deleted') {
    return record.status;
  }
  return record.isPickedUp ? 'picked' : 'active';
};

const resolveBaseTime = (record: LegacyPackageRecord, now: number): number => {
  if (typeof record.pickedUpAt === 'number') {
    return record.pickedUpAt;
  }
  if (typeof record.deletedAt === 'number') {
    return record.deletedAt;
  }
  if (typeof record.createdAt === 'number') {
    return record.createdAt;
  }
  if (record.timestamp) {
    const parsed = new Date(record.timestamp).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return now;
};

/** 将旧存储记录规范为带 status 的 PackageData */
export const normalizePackageRecord = (
  raw: LegacyPackageRecord,
  now = Date.now()
): PackageData => {
  const status = resolveLegacyStatus(raw);
  const isPickedUp = status === 'picked';
  const baseTime = resolveBaseTime(raw, now);

  let pickedUpAt = raw.pickedUpAt;
  let deletedAt = raw.deletedAt;
  let expiresAt = raw.expiresAt;

  if (status === 'picked') {
    pickedUpAt = typeof pickedUpAt === 'number' ? pickedUpAt : baseTime;
    expiresAt = typeof expiresAt === 'number' ? expiresAt : pickedUpAt + RETENTION_MS;
  }

  if (status === 'deleted') {
    deletedAt = typeof deletedAt === 'number' ? deletedAt : baseTime;
    expiresAt = typeof expiresAt === 'number' ? expiresAt : deletedAt + RETENTION_MS;
  }

  if (status === 'active') {
    pickedUpAt = undefined;
    deletedAt = undefined;
    expiresAt = undefined;
  }

  return {
    id: raw.id || crypto.randomUUID(),
    pickupCode: raw.pickupCode || '',
    location: raw.location || '未知',
    address: raw.address,
    courier: raw.courier,
    timestamp: raw.timestamp || new Date(now).toISOString(),
    originalText: raw.originalText || '',
    status,
    isPickedUp,
    pickedUpAt,
    deletedAt,
    expiresAt,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
  };
};

export const isTerminalStatus = (status: PackageStatus): boolean =>
  status === 'picked' || status === 'deleted';

/** 已取件 / 已删除且超过保留期 */
export const isExpiredTerminalPackage = (pkg: PackageData, now = Date.now()): boolean =>
  isTerminalStatus(pkg.status) &&
  typeof pkg.expiresAt === 'number' &&
  pkg.expiresAt <= now;

export const purgeExpiredPackages = (
  packages: PackageData[],
  now = Date.now()
): PackageData[] => packages.filter((pkg) => !isExpiredTerminalPackage(pkg, now));

export const markPackagePicked = (pkg: PackageData, now = Date.now()): PackageData => ({
  ...pkg,
  status: 'picked',
  isPickedUp: true,
  pickedUpAt: now,
  deletedAt: undefined,
  expiresAt: now + RETENTION_MS,
});

export const markPackageActive = (pkg: PackageData): PackageData => ({
  ...pkg,
  status: 'active',
  isPickedUp: false,
  pickedUpAt: undefined,
  deletedAt: undefined,
  expiresAt: undefined,
});

export const markPackageDeleted = (pkg: PackageData, now = Date.now()): PackageData => ({
  ...pkg,
  status: 'deleted',
  isPickedUp: false,
  pickedUpAt: undefined,
  deletedAt: now,
  expiresAt: now + RETENTION_MS,
});

export const isVisibleInList = (pkg: PackageData, filter: 'active' | 'history'): boolean => {
  if (pkg.status === 'deleted') {
    return false;
  }
  if (filter === 'active') {
    return pkg.status === 'active';
  }
  return pkg.status === 'picked';
};
