const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type BatchStatus = "AUTHENTIC" | "FAKE" | "EXPIRED" | "RECALLED";

export interface BatchData {
  batchId: string;
  drugName: string;
  manufacturer: string;
  expiryDate: number;
  expiryISO?: string | null;
  registeredBy: string;
  isRevoked: boolean;
  exists: boolean;
  // DID / manufacturer identity fields
  manufacturerName?: string | null;
  licenseId?: string | null;
  isVerified?: boolean;
}

export interface VerifyResponse {
  status: BatchStatus;
  message: string;
  data: BatchData;
}

export interface BatchListResponse {
  total: number;
  batches: BatchData[];
}

export interface StatsResponse {
  totalBatches: number;
  authenticCount: number;
  expiredCount: number;
  revokedCount: number;
}

export async function verifyBatch(batchId: string): Promise<VerifyResponse> {
  const normalizedBatchId = batchId.trim().toUpperCase();
  if (!normalizedBatchId) {
    throw new Error("Batch ID is required");
  }

  const res = await fetch(
    `${API_BASE_URL}/api/verify/${encodeURIComponent(normalizedBatchId)}`
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Verification failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function getAllBatches(): Promise<BatchListResponse> {
  const res = await fetch(`${API_BASE_URL}/api/batches`);
  if (!res.ok) {
    throw new Error(`Failed to fetch batches (${res.status})`);
  }
  return res.json();
}

export async function getStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch stats (${res.status})`);
  }
  return res.json();
}
