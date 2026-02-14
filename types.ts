export interface PackageData {
  id: string;
  pickupCode: string;
  location: string;
  address?: string;
  timestamp: string; // ISO String
  originalText: string;
  isPickedUp: boolean;
  pickedUpAt?: number;
  expiresAt?: number;
  createdAt: number;
}

export enum ImportMethod {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}

export interface ExtractedInfo {
  pickupCode: string;
  location: string;
  address?: string;
  timestamp?: string;
}
