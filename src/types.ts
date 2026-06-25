export interface ExpiredItem {
  code: string;       // Unique warehousing code or barcode (xx-xxxxxxxx format)
  name?: string;      // Product name / description (optional)
  location?: string;  // Warehouse shelf location (optional)
  importTime: string; // Time this item was loaded into the expired inventory
  notes?: string;     // Extra comments (optional)
}

export interface ScanLog {
  id: string;
  scanCode: string;
  scanTime: string;
  isMatched: boolean; // True if matches an item in the expired list
  matchedItem?: ExpiredItem;
  status: 'pending' | 'removed' | 'dismissed'; // removed means taken out, dismissed means normal/ignored, pending means expired found but operator hasn't cleared it yet
  removedTime?: string; // Time when operator takes it out of the inventory/shelves
}

export interface SystemStats {
  totalImported: number;
  totalScanned: number;
  totalMatched: number;
  totalWithdrawn: number;
}

// Fixed format validation: xx-xxxxxxxx (2 alphanumeric chars, followed by hyphen, followed by 8 alphanumeric chars)
export const WAREHOUSE_CODE_REGEX = /^[A-Za-z0-9]{2}-[A-Za-z0-9]{8}$/;

export function isValidWarehouseCode(code: string): boolean {
  return WAREHOUSE_CODE_REGEX.test(code.trim());
}
