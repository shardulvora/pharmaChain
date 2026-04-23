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
  const res = await fetch(
    `${API_BASE_URL}/api/verify/${encodeURIComponent(batchId.trim())}`
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

export interface RegisterBatchRequest {
  batchId: string;
  drugName: string;
  manufacturer: string;
  /** ISO date string, e.g. "2026-12-31" */
  expiryDate: string;
}

export interface RegisterBatchResponse {
  message: string;
  txHash: string;
}

export async function registerBatch(
  payload: RegisterBatchRequest
): Promise<RegisterBatchResponse> {
  const res = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json?.detail ?? JSON.stringify(json);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Registration failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export interface TokenBalanceResponse {
  balance: number;
}

export async function getTokenBalance(address: string): Promise<TokenBalanceResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/token-balance/${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface NarrativeRequest {
  batchId: string;
  drugName: string;
  manufacturer: string;
  status: string;
  scanCount: number;
  expectedUnits: number;
  alertReason: string | null;
  city?: string;
  isVerified: boolean;
}

export interface NarrativeResponse {
  narrative: string;
  riskLevel: "Low" | "Medium" | "High";
  confidence: number;
  keyFindings: string[];
  recommendation: string;
  model: string;
}

export async function getAINarrative(payload: NarrativeRequest): Promise<NarrativeResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai-narrative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function reportCounterfeitOnChain(
  batchId: string,
  contractAddress: string,
  abi: object[]
): Promise<string> {
  const { BrowserProvider, Contract } = await import("ethers");
  const eth = (window as Window & { ethereum?: unknown }).ethereum;
  if (!eth) {
    throw new Error("MetaMask not found");
  }
  const provider = new BrowserProvider(eth as never);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, abi, signer);
  const tx = await contract.reportCounterfeit(batchId);
  await tx.wait();
  return tx.hash as string;
}
