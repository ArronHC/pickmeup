export type PackageStatus = 'active' | 'picked' | 'deleted';

export interface PackageData {
  id: string;
  pickupCode: string;
  location: string;
  address?: string;
  courier?: string;
  timestamp: string; // ISO String
  originalText: string;
  status: PackageStatus;
  /** 与 status === 'picked' 同步，兼容旧数据与既有 UI */
  isPickedUp: boolean;
  pickedUpAt?: number;
  deletedAt?: number;
  expiresAt?: number;
  createdAt: number;
}

export interface ExtractedInfo {
  pickupCode: string;
  location: string;
  address?: string;
  courier?: string;
  timestamp?: string;
}
