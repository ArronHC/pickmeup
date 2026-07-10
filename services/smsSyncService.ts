export interface SmsSyncItem {
  id: string;
  timestamp: number;
  success: boolean;
}

// Only advance across a contiguous run of successfully processed messages.
// The first failure remains inside the next sync window and can be retried.
export function getSafeSyncCursor(items: SmsSyncItem[], previousCursor = 0): number {
  let cursor = previousCursor;

  for (const item of [...items].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!item.success) {
      break;
    }
    cursor = Math.max(cursor, item.timestamp + 1);
  }

  return cursor;
}
